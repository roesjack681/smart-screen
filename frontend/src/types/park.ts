/** 风险四色：重大红 / 较大橙 / 一般黄 / 低风险蓝 */
export type RiskLevel = 'red' | 'orange' | 'yellow' | 'blue';

export type OperationState = 'pending' | 'ongoing' | 'paused' | 'completed';
export type AlarmHandlingState = 'pending' | 'processing' | 'closed';
export type ReviewStatus = 'none' | 'pending' | 'done';

export interface RiskUnit {
  id: string;
  name: string;
  area: string;
  /** 示意布局网格坐标 */
  gridX: number;
  gridZ: number;
  height: number;
  baseLevel: RiskLevel;
  currentLevel: RiskLevel;
  activeTriggerIds: string[];
  reviewStatus: ReviewStatus;
  triggers: string[];
}

export interface ParkOperation {
  id: string;
  unitId: string;
  name: string;
  type: string;
  plannedStart: string;
  plannedEnd: string;
  actualState: OperationState;
  summary: string;
}

export interface ParkAlarm {
  id: string;
  unitId: string;
  type: string;
  location: string;
  occurredAt: string;
  handlingState: AlarmHandlingState;
  summary: string;
  isKey: boolean;
}

export interface AlcoholSummary {
  gasPointTotal: number;
  gasAlarmPoints: number;
  leakPendingReview: number;
  lastAbnormalAt: string | null;
}

export interface RiskChangeItem {
  id: string;
  unitId: string;
  unitName: string;
  fromLevel: RiskLevel;
  toLevel: RiskLevel;
  reason: string;
  at: string;
}

export interface TimelineItem {
  id: string;
  at: string;
  title: string;
  detail: string;
}

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  red: '重大风险',
  orange: '较大风险',
  yellow: '一般风险',
  blue: '低风险',
};

export const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
  red: '#F05252',
  orange: '#F59A38',
  yellow: '#EBCB4B',
  blue: '#438DFA',
};

export const OPERATION_STATE_LABEL: Record<OperationState, string> = {
  pending: '待开工',
  ongoing: '进行中',
  paused: '暂停',
  completed: '已完成',
};
