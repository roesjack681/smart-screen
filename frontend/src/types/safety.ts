export type AlarmSeverity = 'warning' | 'critical';
export type DeviceStatus = 'normal' | 'warning' | 'critical' | 'offline';
export type SafetyDomain = 'process' | 'storage' | 'gas' | 'leak' | 'warehouse';
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
  rules: SafetyRules;
  online: boolean;
  lastSeen: number;
  scenario: DeviceScenario | null;
  slope: number | null;
  history: HistorySample[];
  value: number;
  domain: Exclude<SafetyDomain, 'leak'>;
  unitId: string;
  source: string;
  ruleRef: string;
  suggestion: string;
  supportsLow: boolean;
  supportsRate: boolean;
  stack?: {
    warehouseId: string; row: string; column: number; material: string; batch: string;
    ambient: number; humidity: number; storedAt: number; checkedAt: number;
    ambientException: boolean;
  };
}

export interface SafetyEvent {
  id: string;
  name: string;
  area: string;
  source: string;
  ruleRef: string;
  suggestion: string;
  active: boolean;
  changedAt: number;
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
  resolutionReason?: string;
  domain?: SafetyDomain;
  ruleRef?: string;
  clearedAt?: number | null;
  reviewedAt?: number;
  reviewer?: string;
  reviewNote?: string;
  relatedDeviceIds?: string[];
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
  relatedDeviceIds?: string[];
}
