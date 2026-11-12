import { DEFAULT_RULES } from '@/utils/safety/rules';
import type { MaintenanceOrder, SafetyAlarm, SafetyDevice, SafetyRules } from '@/types/safety';

export const areas = ['合成车间', '储罐区', '公用工程'] as const;

const definitions: Array<
  [string, string, string, string, string, string, number, number, number]
> = [
  ['EXT-01', '1号反应釜', '合成车间', 'TI-101', '温度', '℃', 62.4, 0, 96],
  ['EXT-02', '2号反应釜', '合成车间', 'TI-102', '温度', '℃', 58.7, 1.2, 89],
  ['TNK-01', '乙醇储罐', '储罐区', 'TI-201', '温度', '℃', 28.6, 2.1, 98],
  ['CLG-01', '冷却循环系统', '公用工程', 'TI-301', '温度', '℃', 22.8, 0.5, 95],
  ['EXT-P1', '反应压力单元', '合成车间', 'PI-101', '压力', 'MPa', 0.31, 2.8, 97],
  ['PMP-01', '物料循环泵', '公用工程', 'VI-101', '振动', 'mm/s', 2.1, 3.4, 92],
];

export function normalValue(device: Pick<SafetyDevice, 'unit' | 'baseline' | 'phase'>, seconds: number): number {
  const amplitude = device.unit === 'MPa' ? 0.013 : device.unit === 'mm/s' ? 0.1 : 2.1;
  return (
    device.baseline +
    Math.sin(seconds / 50 + device.phase) * amplitude +
    Math.cos(seconds / 18 + device.phase) * amplitude * 0.12
  );
}

export function makeHistory(
  device: Pick<SafetyDevice, 'unit' | 'baseline' | 'phase'>,
  now: number,
  seconds = 0,
  center: number | null = null,
): SafetyDevice['history'] {
  return Array.from({ length: 121 }, (_, i) => {
    const offset = (i - 120) * 3;
    return {
      t: now + offset * 1000,
      value:
        center === null
          ? normalValue(device, seconds + offset)
          : center + Math.sin(offset / 50) * (device.unit === 'MPa' ? 0.001 : 0.1),
    };
  });
}

export function makeDevices(now: number): SafetyDevice[] {
  return definitions.map(([id, name, area, tag, metric, unit, baseline, phase, health], i) => {
    let rules: SafetyRules = { ...DEFAULT_RULES };
    if (id === 'TNK-01') Object.assign(rules, { low: 12, high: 38, criticalLow: 5, criticalHigh: 45 });
    if (id === 'CLG-01') Object.assign(rules, { low: 10, high: 35, criticalLow: 3, criticalHigh: 42 });
    if (unit === 'MPa') {
      rules = {
        ...rules,
        low: 0.12,
        high: 0.55,
        criticalLow: 0.06,
        criticalHigh: 0.65,
        slopeWarning: 0.08,
        slopeCritical: 0.15,
        hysteresis: 0.01,
      };
    }
    if (unit === 'mm/s') {
      rules = {
        ...rules,
        low: -0.1,
        high: 4,
        criticalLow: -1,
        criticalHigh: 6,
        slopeWarning: 1.5,
        slopeCritical: 3,
        hysteresis: 0.1,
      };
    }

    const device: SafetyDevice = {
      id,
      name,
      area,
      tag,
      metric,
      unit,
      baseline,
      phase,
      health,
      rules,
      online: true,
      maintenance: false,
      lastSeen: now,
      lastService: now - (i + 10) * 86400000,
      nextService: now + (i === 1 ? 0 : i + 2) * 86400000,
      runtimeHours: 2680 + i * 347,
      scenario: null,
      slope: 0,
      history: [],
      value: 0,
    };
    device.history = makeHistory(device, now);
    device.value = device.history.at(-1)!.value;
    return device;
  });
}

export function makePastAlarms(now: number): SafetyAlarm[] {
  const devices = makeDevices(now);
  return Array.from({ length: 12 }, (_, i) => {
    const device = devices[i % devices.length];
    const rate = i % 3 === 0;
    const critical = i % 5 === 0;
    const value = rate
      ? (critical ? device.rules.slopeCritical : device.rules.slopeWarning) * 1.2
      : (critical ? device.rules.criticalHigh : device.rules.high) +
        (device.rules.criticalHigh - device.rules.high) * 0.2;
    const precision = device.unit === 'MPa' ? 3 : 1;
    const startedAt = now - (i + 1) * 31 * 60000;
    return {
      id: `HIST-${i}`,
      key: `history:${i}`,
      deviceId: device.id,
      deviceName: device.name,
      area: device.area,
      type: rate ? 'rate' : 'high',
      title: `${device.metric}${rate ? '变化过快' : '偏高'}`,
      severity: critical ? 'critical' : 'warning',
      reading: `${rate ? '+' : ''}${value.toFixed(precision)} ${device.unit}${rate ? '/min' : ''}`,
      lastReading: `${device.baseline} ${device.unit}`,
      startedAt,
      resolvedAt: startedAt + 240000,
      acknowledgedAt: startedAt + 60000,
      status: 'resolved' as const,
      source: '历史演示',
      threshold: rate
        ? `|斜率| ≥ ${device.rules.slopeWarning} / ${device.rules.slopeCritical} ${device.unit}/min`
        : `高限 ${device.rules.high} / 高高限 ${device.rules.criticalHigh} ${device.unit}`,
      suggestion: '已完成现场检查与处置。',
      snoozedUntil: 0,
    };
  });
}

export function makeOrders(now: number): MaintenanceOrder[] {
  return [
    {
      id: 'WO-001',
      deviceId: 'EXT-02',
      title: '温度探头校准',
      owner: '张工',
      priority: 'medium',
      plannedAt: now,
      status: 'pending',
      source: '周期保养',
      note: '核对温度探头与参考仪表读数。',
      createdAt: now - 86400000,
    },
    {
      id: 'WO-002',
      deviceId: 'PMP-01',
      title: '循环泵轴承巡检',
      owner: '李工',
      priority: 'low',
      plannedAt: now + 2 * 86400000,
      status: 'pending',
      source: '巡检计划',
      note: '检查轴承润滑与设备振动。',
      createdAt: now - 86400000,
    },
    {
      id: 'WO-003',
      deviceId: 'TNK-01',
      title: '储罐温度采集回路检查',
      owner: '周工',
      priority: 'low',
      plannedAt: now - 86400000,
      status: 'completed',
      source: '周期保养',
      note: '线路与采集均正常。',
      result: '已完成校准及试运行。',
      createdAt: now - 2 * 86400000,
      completedAt: now - 86400000,
    },
  ];
}
