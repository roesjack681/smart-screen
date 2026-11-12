import type {
  AlarmSeverity,
  AlarmSignal,
  HistorySample,
  SafetyAlarm,
  SafetyDevice,
  SafetyRules,
} from '@/types/safety';

export const DEFAULT_RULES: SafetyRules = Object.freeze({
  low: 45,
  high: 75,
  criticalLow: 35,
  criticalHigh: 85,
  slopeWarning: 4,
  slopeCritical: 8,
  durationSeconds: 2,
  offlineSeconds: 5,
  hysteresis: 0.8,
});

export function validateRules(rules: SafetyRules): string {
  if (
    Object.keys(DEFAULT_RULES).some(
      (key) => typeof rules[key as keyof SafetyRules] !== 'number' || !Number.isFinite(rules[key as keyof SafetyRules]),
    )
  ) {
    return '所有规则必须填写有效数字';
  }
  if (!(rules.criticalLow < rules.low && rules.low < rules.high && rules.high < rules.criticalHigh)) {
    return '阈值须满足：低低限 < 低限 < 高限 < 高高限';
  }
  if (!(rules.slopeWarning > 0 && rules.slopeCritical > rules.slopeWarning)) {
    return '变化速率须满足：0 < 黄色预警值 < 红色报警值';
  }
  if (rules.durationSeconds < 1 || rules.durationSeconds > 60) return '持续时间应为 1 至 60 秒';
  if (rules.offlineSeconds < 3 || rules.offlineSeconds > 120) return '离线时长应为 3 至 120 秒';
  if (rules.hysteresis < 0 || rules.hysteresis >= (rules.high - rules.low) / 2) {
    return '恢复回差须大于等于 0，且小于正常区间的一半';
  }
  return '';
}

export function calculateSlope(history: HistorySample[], windowMs = 15_000): number | null {
  if (!history || history.length < 2) return null;
  const last = history.at(-1)!;
  const recent = history.filter((sample) => sample.t <= last.t && sample.t >= last.t - windowMs);
  if (recent.length < 2 || last.t - recent[0].t < 1000) return null;
  return (last.value - recent[0].value) / ((last.t - recent[0].t) / 60_000);
}

export function evaluateDevice(
  device: SafetyDevice,
  now: number,
): { slope: number | null; online: boolean; signals: AlarmSignal[] } {
  const { rules: r, value: v, history } = device;
  const age = Math.max(0, now - device.lastSeen);
  const offline = age >= r.offlineSeconds * 1000;
  const slope = calculateSlope(history);
  const precision = device.unit === 'MPa' ? 3 : 1;
  const fmt = (n: number) => Number(n).toFixed(precision);
  const unit = device.unit;

  const signals: AlarmSignal[] = [
    {
      type: 'offline',
      severity: offline ? (age >= r.offlineSeconds * 3000 ? 'critical' : 'warning') : null,
      clear: !offline,
      title: '设备通信中断',
      reading: `${Math.floor(age / 1000)} 秒无数据`,
      threshold: `黄色 ≥ ${r.offlineSeconds} 秒 / 红色 ≥ ${r.offlineSeconds * 3} 秒无数据`,
      durationMs: 0,
      suggestion: '检查设备供电、网关与网络连接，确认采集恢复。',
    },
  ];

  if (offline) return { slope, online: false, signals };

  signals.push(
    {
      type: 'high',
      severity: v >= r.criticalHigh ? 'critical' : v >= r.high ? 'warning' : null,
      clear: v < r.high - r.hysteresis,
      title: `${device.metric}偏高`,
      reading: `${fmt(v)} ${unit}`,
      threshold: `高限 ${r.high} / 高高限 ${r.criticalHigh} ${unit}`,
      durationMs: r.durationSeconds * 1000,
      suggestion: '核对现场读数，检查工艺负荷和冷却状态；必要时按现场规程处置。',
    },
    {
      type: 'low',
      severity: v <= r.criticalLow ? 'critical' : v <= r.low ? 'warning' : null,
      clear: v > r.low + r.hysteresis,
      title: `${device.metric}偏低`,
      reading: `${fmt(v)} ${unit}`,
      threshold: `低限 ${r.low} / 低低限 ${r.criticalLow} ${unit}`,
      durationMs: r.durationSeconds * 1000,
      suggestion: '核对现场仪表与工况，检查供料、加热或传感器状态。',
    },
    {
      type: 'rate',
      severity:
        slope === null
          ? null
          : Math.abs(slope) >= r.slopeCritical
            ? 'critical'
            : Math.abs(slope) >= r.slopeWarning
              ? 'warning'
              : null,
      clear: slope !== null && Math.abs(slope) < r.slopeWarning * 0.75,
      title: `${device.metric}变化过快`,
      reading: slope === null ? '等待样本' : `${slope > 0 ? '+' : ''}${slope.toFixed(2)} ${unit}/min`,
      threshold: `|斜率| ≥ ${r.slopeWarning} / ${r.slopeCritical} ${unit}/min`,
      durationMs: r.durationSeconds * 1000,
      suggestion: '检查工况切换与仪表信号，核查快速升降原因，关注超限趋势。',
    },
  );

  return { slope, online: true, signals };
}

interface EngineEvent {
  kind: 'created' | 'escalated' | 'resolved';
  alarm: SafetyAlarm;
}

export class AlarmEngine {
  records: SafetyAlarm[];
  pending = new Map<string, { since: number; severity: AlarmSeverity }>();
  sequence = 1;

  constructor(history: SafetyAlarm[] = []) {
    this.records = history;
  }

  update(device: SafetyDevice, now: number): ReturnType<typeof evaluateDevice> & { events: EngineEvent[] } {
    const evaluation = evaluateDevice(device, now);
    const events: EngineEvent[] = [];
    const observedKeys = new Set(evaluation.signals.map((signal) => `${device.id}:${signal.type}`));

    for (const key of this.pending.keys()) {
      if (key.startsWith(`${device.id}:`) && !observedKeys.has(key)) this.pending.delete(key);
    }

    for (const signal of evaluation.signals) {
      const key = `${device.id}:${signal.type}`;
      const existing = this.records.find((a) => a.key === key && !a.resolvedAt);

      if (!signal.severity) {
        this.pending.delete(key);
        if (existing && signal.clear) {
          existing.resolvedAt = now;
          existing.status = 'resolved';
          existing.lastReading = signal.reading;
          events.push({ kind: 'resolved', alarm: existing });
        }
        continue;
      }

      if (existing) {
        existing.lastReading = signal.reading;
        if (signal.severity === 'critical' && existing.severity !== 'critical') {
          Object.assign(existing, {
            severity: 'critical',
            status: 'unacknowledged',
            acknowledgedAt: null,
            snoozedUntil: 0,
            escalatedAt: now,
            initialReading: existing.reading,
            reading: signal.reading,
            threshold: signal.threshold,
          });
          events.push({ kind: 'escalated', alarm: existing });
        }
        continue;
      }

      if (device.maintenance) {
        this.pending.delete(key);
        continue;
      }

      const pending = this.pending.get(key);
      if (!pending || pending.severity !== signal.severity) {
        this.pending.set(key, { since: now, severity: signal.severity });
      }
      if (now - this.pending.get(key)!.since < signal.durationMs) continue;

      const alarm: SafetyAlarm = {
        id: `AL-${now}-${this.sequence++}`,
        key,
        deviceId: device.id,
        deviceName: device.name,
        area: device.area,
        type: signal.type,
        title: signal.title,
        severity: signal.severity,
        reading: signal.reading,
        lastReading: signal.reading,
        threshold: signal.threshold,
        suggestion: signal.suggestion,
        startedAt: now,
        resolvedAt: null,
        acknowledgedAt: null,
        snoozedUntil: 0,
        status: 'unacknowledged',
        source: '实时监测',
      };
      this.records.unshift(alarm);
      this.records = [
        ...this.records.filter((a) => !a.resolvedAt),
        ...this.records.filter((a) => a.resolvedAt).slice(0, 100),
      ];
      this.pending.delete(key);
      events.push({ kind: 'created', alarm });
    }

    return { ...evaluation, events };
  }

  acknowledge(id: string, now: number): void {
    const alarm = this.records.find((a) => a.id === id);
    if (alarm && !alarm.resolvedAt) {
      Object.assign(alarm, { acknowledgedAt: now, status: 'acknowledged' });
    }
  }

  snooze(id: string, now: number, seconds = 60): void {
    const alarm = this.records.find((a) => a.id === id);
    if (alarm && !alarm.resolvedAt) alarm.snoozedUntil = now + seconds * 1000;
  }

  snapshot(): SafetyAlarm[] {
    return this.records.map((record) => ({ ...record }));
  }
}
