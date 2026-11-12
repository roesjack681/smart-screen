export type AlarmSeverity = 'warning' | 'critical';
export type DeviceStatus = 'normal' | 'warning' | 'critical' | 'offline' | 'maintenance';
export type OrderStatus = 'pending' | 'inprogress' | 'completed';
export type OrderPriority = 'low' | 'medium' | 'high';
export type ScenarioKind =
  | 'normal'
  | 'high'
  | 'low'
  | 'critical'
  | 'rapidUp'
  | 'rapidDown'
  | 'offline';

export interface SafetyRules {
  low: number;
  high: number;
  criticalLow: number;
  criticalHigh: number;
  slopeWarning: number;
  slopeCritical: number;
  durationSeconds: number;
  offlineSeconds: number;
  hysteresis: number;
}

export interface HistorySample {
  t: number;
  value: number;
}

export interface DeviceScenario {
  kind: ScenarioKind;
  startedAt: number;
  center: number;
}

export interface SafetyDevice {
  id: string;
  name: string;
  area: string;
  tag: string;
  metric: string;
  unit: string;
  baseline: number;
  phase: number;
  health: number;
  rules: SafetyRules;
  online: boolean;
  maintenance: boolean;
  lastSeen: number;
  lastService: number;
  nextService: number;
  runtimeHours: number;
  scenario: DeviceScenario | null;
  slope: number | null;
  history: HistorySample[];
  value: number;
}

export interface SafetyAlarm {
  id: string;
  key: string;
  deviceId: string;
  deviceName: string;
  area: string;
  type: string;
  title: string;
  severity: AlarmSeverity;
  reading: string;
  lastReading: string;
  startedAt: number;
  resolvedAt: number | null;
  acknowledgedAt: number | null;
  status: 'unacknowledged' | 'acknowledged' | 'resolved';
  source: string;
  threshold: string;
  suggestion: string;
  snoozedUntil: number;
  escalatedAt?: number;
  initialReading?: string;
}

export interface MaintenanceOrder {
  id: string;
  deviceId: string;
  title: string;
  owner: string;
  priority: OrderPriority;
  plannedAt: number;
  status: OrderStatus;
  source: string;
  note?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: string;
  acceptance?: boolean[];
  alarmId?: string;
}

export interface CreateOrderInput {
  deviceId: string;
  title: string;
  owner: string;
  priority: OrderPriority;
  plannedAt: number;
  source: string;
  note?: string;
  alarmId?: string;
}

export interface AlarmSignal {
  type: string;
  severity: AlarmSeverity | null;
  clear: boolean;
  title: string;
  reading: string;
  threshold: string;
  durationMs: number;
  suggestion: string;
}
