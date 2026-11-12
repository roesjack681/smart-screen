import type { AlarmSeverity, AlarmSignal, HistorySample, SafetyAlarm, SafetyDevice, SafetyDomain, SafetyEvent, SafetyRules } from '@/types/safety';

export const DEFAULT_RULES: SafetyRules = Object.freeze({
  low: 45, high: 75, criticalLow: 35, criticalHigh: 85,
  slopeWarning: 4, slopeCritical: 8, durationSeconds: 2, offlineSeconds: 5, hysteresis: 0.8,
});

export function validateRules(rules: SafetyRules): string {
  if (Object.keys(DEFAULT_RULES).some(key => typeof rules[key as keyof SafetyRules] !== 'number' || !Number.isFinite(rules[key as keyof SafetyRules]))) return '所有规则必须填写有效数字';
  if (!(rules.criticalLow < rules.low && rules.low < rules.high && rules.high < rules.criticalHigh)) return '阈值须满足：低低限 < 低限 < 高限 < 高高限';
  if (!(rules.slopeWarning > 0 && rules.slopeCritical > rules.slopeWarning)) return '变化速率须满足：0 < 黄色预警值 < 红色报警值';
  if (rules.durationSeconds < 1 || rules.durationSeconds > 60) return '持续时间应为 1 至 60 秒';
  if (rules.offlineSeconds < 3 || rules.offlineSeconds > 120) return '离线时长应为 3 至 120 秒';
  if (rules.hysteresis < 0 || rules.hysteresis >= (rules.high - rules.low) / 2) return '恢复回差须大于等于 0，且小于正常区间的一半';
  return '';
}

export function calculateSlope(history: HistorySample[], windowMs = 15_000): number | null {
  if (!history || history.length < 2) return null;
  const last = history.at(-1)!;
  const recent = history.filter(sample => sample.t <= last.t && sample.t >= last.t - windowMs);
  if (recent.length < 2 || last.t - recent[0].t < 1000) return null;
  return (last.value - recent[0].value) / ((last.t - recent[0].t) / 60_000);
}

export function evaluateDevice(device: SafetyDevice, now: number): { slope: number | null; online: boolean; signals: AlarmSignal[] } {
  const { rules: r, value: v, history } = device;
  const age = Math.max(0, now - device.lastSeen);
  const offline = age >= r.offlineSeconds * 1000;
  const slope = calculateSlope(history);
  const fmt = (n: number) => n.toFixed(device.unit === 'MPa' ? 3 : 1);
  const unit = device.unit;
  const signals: AlarmSignal[] = [{
    type: 'offline', severity: offline ? (age >= r.offlineSeconds * 3000 ? 'critical' : 'warning') : null, clear: !offline,
    title: '设备通信中断', reading: `${Math.floor(age / 1000)} 秒无数据`,
    threshold: `黄色 ≥ ${r.offlineSeconds} 秒 / 红色 ≥ ${r.offlineSeconds * 3} 秒无数据（演示）`, durationMs: 0,
    suggestion: '核查设备供电、采集网关与通信连接；通信中断期间需现场核实工况。',
  }];
  if (offline) return { slope, online: false, signals };
  if (device.stack) {
    const delta=v-device.stack.ambient;
    const daily=v>=35 || delta>2 || device.stack.ambientException;
    signals.push({ type:'warehouseInspection',severity:v>=32 || delta>2 || device.stack.ambientException ? 'warning':null,
      clear:v<31.7 && delta<=1.7 && !device.stack.ambientException,title:daily?'包心温检需加密至每日':'包心温检需每两天检查',
      reading:`${fmt(v)}℃ · 环境${device.stack.ambient.toFixed(1)}℃ · 温差${delta.toFixed(1)}℃`,
      threshold:'包心≥32℃每两天；≥35℃或均温高于环境2℃每日检查',durationMs:2000,
      suggestion:'按原料贮存程序§5.3.4.2加密包心温度检查并记录；32/35℃是检查频次条件。'});
    signals.push({type:'warehouseNonconform',severity:delta>4 && !device.stack.ambientException?'critical':null,
      clear:delta<=4 || device.stack.ambientException,title:'包心均温温差异常 · 待不合格复核',
      reading:`包心${fmt(v)}℃ / 环境${device.stack.ambient.toFixed(1)}℃ / 温差+${delta.toFixed(1)}℃`,
      threshold:'包心平均温度超过环境4℃；排除环境异常变温、高温天气入库情形',durationMs:2000,
      suggestion:'现场核实环境变化和入库条件；非例外情形按原料不合格品流程处理。例外情形仍应每日检查并观察趋势；红色为Demo处置优先级。'});
    return {slope,online:true,signals};
  }
  signals.push({
    type: 'high', severity: v >= r.criticalHigh ? 'critical' : v >= r.high ? 'warning' : null,
    clear: v < r.high - r.hysteresis, title: `${device.metric}超上限`, reading: `${fmt(v)} ${unit}`,
    threshold: `高报 ≥ ${r.high} / 高高报 ≥ ${r.criticalHigh} ${unit}（演示）`, durationMs: r.durationSeconds * 1000,
    suggestion: device.suggestion,
  });
  if (device.supportsLow) signals.push({
    type: 'low', severity: v <= r.criticalLow ? 'critical' : v <= r.low ? 'warning' : null,
    clear: v > r.low + r.hysteresis, title: `${device.metric}超下限`, reading: `${fmt(v)} ${unit}`,
    threshold: `低报 ≤ ${r.low} / 低低报 ≤ ${r.criticalLow} ${unit}（演示）`, durationMs: r.durationSeconds * 1000,
    suggestion: device.metric === '液位' ? '核对实际液位，防止抽空；检查出料状态、供料与液位计，按现场规程处置。' : '核对现场仪表与工况，检查供料、加热及传感器状态，排查低限原因。',
  });
  if (device.supportsRate) signals.push({
    type: 'rate', severity: slope === null ? null : Math.abs(slope) >= r.slopeCritical ? 'critical' : Math.abs(slope) >= r.slopeWarning ? 'warning' : null,
    clear: slope !== null && Math.abs(slope) < r.slopeWarning * 0.75, title: `${device.metric}变化过快`,
    reading: slope === null ? '等待样本' : `${slope > 0 ? '+' : ''}${slope.toFixed(2)} ${unit}/min`,
    threshold: `|斜率| ≥ ${r.slopeWarning} / ${r.slopeCritical} ${unit}/min（演示）`, durationMs: r.durationSeconds * 1000,
    suggestion: '核查工况切换、仪表信号和快速升降原因，关注超限趋势；变化速率为补充演示规则。',
  });
  return { slope, online: true, signals };
}

interface EngineEvent { kind: 'created' | 'escalated' | 'resolved' | 'retriggered'; alarm: SafetyAlarm }
interface Target { id: string; name: string; area: string; domain: SafetyDomain; source: string; ruleRef: string }

export class AlarmEngine {
  records: SafetyAlarm[];
  pending = new Map<string, { since: number; severity: AlarmSeverity }>();
  sequence = 1;
  constructor(history: SafetyAlarm[] = []) { this.records = history; }

  update(device: SafetyDevice, now: number): ReturnType<typeof evaluateDevice> & { events: EngineEvent[] } {
    const evaluation = evaluateDevice(device, now);
    return { ...evaluation, events: this.updateSignals(device, evaluation.signals, now) };
  }

  updateEvent(event: SafetyEvent, now: number): EngineEvent[] {
    return this.updateSignals({ ...event, domain: 'leak' }, [{
      type: 'leak', severity: event.active ? 'critical' : null, clear: !event.active, title: event.name,
      reading: event.active ? '泄漏报警信号触发' : '泄漏报警信号恢复', threshold: '泄漏报警事件触发即红色提醒；恢复须人工复核',
      durationMs: 0, suggestion: event.suggestion,
    }], now);
  }

  updateConcurrent(devices: SafetyDevice[], now: number): EngineEvent[] {
    const events: EngineEvent[] = [];
    const units = new Set(devices.filter(d => d.domain === 'process').map(d => d.unitId));
    for (const unitId of units) {
      const group = devices.filter(d => d.domain === 'process' && d.unitId === unitId);
      if (group.length < 2) continue;
      const evaluated = group.map(device => ({ device, evaluation: evaluateDevice(device, now) }));
      const abnormal = evaluated.filter(({ evaluation }) => evaluation.online && evaluation.signals.some(s => (s.type === 'high' || s.type === 'low') && s.severity));
      const metrics = new Set(abnormal.map(({ device }) => device.metric));
      // 同一装置不同工艺参数并发；同一参数的多条规则不重复计数。
      const allClear = evaluated.every(({ evaluation }) => evaluation.online && evaluation.signals.filter(s => s.type === 'high' || s.type === 'low').every(s => s.clear));
      const duration = Math.max(...group.map(d => d.rules.durationSeconds));
      events.push(...this.updateSignals({ id: `UNIT-${unitId}`, name: group[0].name, area: group[0].area, domain: 'process', source: '多参数关联判定 · 模拟', ruleRef: '规则8 / 9 / 10 · 工艺参数并发超限' }, [{
        type: 'concurrent', severity: metrics.size >= 2 ? 'critical' : null, clear: allClear,
        title: '工艺参数并发超限', reading: abnormal.length ? abnormal.map(({ device }) => `${device.metric} ${device.value.toFixed(device.unit === 'MPa' ? 3 : 1)}${device.unit}`).join(' / ') : '关联工艺参数均已恢复',
        threshold: `同一装置 ≥2 类工艺参数并发超限，持续 ${duration} 秒（演示）`, durationMs: duration * 1000,
        suggestion: '按并发超限升级处置，调整工艺并降负荷或暂停投料，排查原因，双人确认；所有关联参数恢复后人工复核。',
        relatedDeviceIds: group.map(d => d.id),
      }], now));
    }
    return events;
  }

  private updateSignals(target: Target, signals: AlarmSignal[], now: number): EngineEvent[] {
    const events: EngineEvent[] = [];
    const observed = new Set(signals.map(signal => `${target.id}:${signal.type}`));
    for (const key of this.pending.keys()) if (key.startsWith(`${target.id}:`) && !observed.has(key)) this.pending.delete(key);
    // 失联不能作为工艺信号已经恢复的依据。
    for (const alarm of this.records) if (!alarm.resolvedAt && alarm.deviceId === target.id && !observed.has(alarm.key)) alarm.clearedAt = null;
    for (const signal of signals) {
      const key = `${target.id}:${signal.type}`;
      const existing = this.records.find(a => a.key === key && !a.resolvedAt);
      if (!signal.severity) {
        this.pending.delete(key);
        if (existing) {
          existing.lastReading = signal.reading;
          if (signal.clear) {
            existing.clearedAt ??= now;
            if (existing.severity !== 'critical') {
              existing.resolvedAt = now;
              existing.status = 'resolved';
              events.push({ kind: 'resolved', alarm: existing });
            }
          } else existing.clearedAt = null;
        }
        continue;
      }
      if (existing) {
        if(existing.type==='warehouseInspection') existing.title=signal.title;
        const recoveredBefore = !!existing.clearedAt;
        existing.clearedAt = null;
        existing.lastReading = signal.reading;
        if ((signal.severity === 'critical' && existing.severity !== 'critical') || recoveredBefore) {
          const escalated = existing.severity !== 'critical' && signal.severity === 'critical';
          Object.assign(existing, { severity: escalated ? 'critical' : existing.severity, status: 'unacknowledged', acknowledgedAt: null, snoozedUntil: 0, initialReading: existing.initialReading || existing.reading, reading: signal.reading, threshold: signal.threshold });
          if (escalated) existing.escalatedAt = now;
          events.push({ kind: escalated ? 'escalated' : 'retriggered', alarm: existing });
        }
        continue;
      }
      const pending = this.pending.get(key);
      if (!pending || pending.severity !== signal.severity) this.pending.set(key, { since: now, severity: signal.severity });
      if (now - this.pending.get(key)!.since < signal.durationMs) continue;
      const alarm: SafetyAlarm = {
        id: `AL-${now}-${this.sequence++}`, key, deviceId: target.id, deviceName: target.name, area: target.area,
        domain: target.domain, ruleRef: signal.type === 'rate' ? '补充演示规则 · 变化速率' : signal.type === 'offline' ? '补充演示规则 · 通信质量' : signal.type === 'low' ? '补充演示规则 · 低限 / 低低限' : target.ruleRef,
        source: target.source, type: signal.type, title: signal.title, severity: signal.severity,
        reading: signal.reading, lastReading: signal.reading, threshold: signal.threshold, suggestion: signal.suggestion,
        startedAt: now, clearedAt: null, resolvedAt: null, acknowledgedAt: null, snoozedUntil: 0, status: 'unacknowledged',
        relatedDeviceIds: signal.relatedDeviceIds,
      };
      this.records.unshift(alarm);
      this.records = [...this.records.filter(a => !a.resolvedAt), ...this.records.filter(a => a.resolvedAt).slice(0, 100)];
      this.pending.delete(key);
      events.push({ kind: 'created', alarm });
    }
    return events;
  }

  // 仅用于演示控制台切换不同场景，保留记录；正常信号恢复不得调用此接口。
  resetDemoDevice(deviceId: string, now: number): void {
    for (const key of this.pending.keys()) if (key.startsWith(`${deviceId}:`)) this.pending.delete(key);
    for (const alarm of this.records.filter(a => a.deviceId === deviceId && !a.resolvedAt)) {
      Object.assign(alarm, { clearedAt: now, resolvedAt: now, status: 'resolved', resolutionReason: '演示场景重置' });
    }
  }

  acknowledge(id: string, now: number): void {
    const alarm = this.records.find(a => a.id === id && !a.resolvedAt);
    if (!alarm) return;
    alarm.acknowledgedAt = now;
    alarm.status = 'acknowledged';
    if(alarm.type==='warehouseNonconform') {
      for(const related of this.records.filter(a=>a.deviceId===alarm.deviceId && !a.resolvedAt)) { related.acknowledgedAt=now; related.status='acknowledged'; }
    }
    if (alarm.type === 'concurrent') {
      for (const related of this.records.filter(a => !a.resolvedAt && alarm.relatedDeviceIds?.includes(a.deviceId) && (a.type === 'high' || a.type === 'low'))) {
        related.acknowledgedAt = now;
        related.status = 'acknowledged';
      }
    }
  }

  review(id: string, reviewer: string, note: string, now: number): string {
    const alarm = this.records.find(a => a.id === id);
    if (!alarm || alarm.resolvedAt || alarm.severity !== 'critical') return '该事件无需复核解除';
    if (!alarm.clearedAt) return '报警信号尚未恢复，不能复核解除';
    if (reviewer.trim().length < 2 || note.trim().length < 4) return '请填写复核人（至少2字）和现场复核结果（至少4字）';
    Object.assign(alarm, { reviewedAt: now, reviewer: reviewer.trim(), reviewNote: note.trim(), resolvedAt: now, status: 'resolved', acknowledgedAt: alarm.acknowledgedAt || now, resolutionReason: '人工复核解除' });
    return '';
  }

  snooze(id: string, now: number, seconds = 60): void {
    const alarm = this.records.find(a => a.id === id);
    if (alarm && !alarm.resolvedAt) alarm.snoozedUntil = now + seconds * 1000;
  }
  snapshot(): SafetyAlarm[] { return this.records.map(record => ({ ...record, relatedDeviceIds: record.relatedDeviceIds ? [...record.relatedDeviceIds] : undefined })); }
}
