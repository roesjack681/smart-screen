import type { ParkAlarm, RiskChangeItem } from '@/types/park';

/** 6条：待处理2、处理中2、已关闭2；未关闭4 */
export function createBaseAlarms(): ParkAlarm[] {
  return [
    {
      id: 'AL001',
      unitId: 'U02',
      type: '可燃气体报警',
      location: '乙醇储罐区 GS002',
      occurredAt: '2026-11-11 09:42',
      handlingState: 'pending',
      summary: '二级报警，待现场确认',
      isKey: true,
    },
    {
      id: 'AL002',
      unitId: 'U01',
      type: '泄漏识别',
      location: '香精调配区 CAM-01',
      occurredAt: '2026-11-11 09:18',
      handlingState: 'pending',
      summary: '香精泄漏待复核（演示素材）',
      isKey: true,
    },
    {
      id: 'AL003',
      unitId: 'U05',
      type: '压力超限',
      location: '冷却循环站 PI-301',
      occurredAt: '2026-11-11 08:55',
      handlingState: 'processing',
      summary: '高报处理中',
      isKey: true,
    },
    {
      id: 'AL004',
      unitId: 'U06',
      type: '温度关注',
      location: '原料库东侧 TW-12',
      occurredAt: '2026-11-11 08:20',
      handlingState: 'processing',
      summary: '包温相对温差关注',
      isKey: false,
    },
    {
      id: 'AL005',
      unitId: 'U08',
      type: '可燃气体报警',
      location: '装卸鹤位 GS008',
      occurredAt: '2026-11-10 16:10',
      handlingState: 'closed',
      summary: '已关闭历史事件',
      isKey: false,
    },
    {
      id: 'AL006',
      unitId: 'U04',
      type: '工艺异常',
      location: '动火集中区',
      occurredAt: '2026-11-10 11:05',
      handlingState: 'closed',
      summary: '已关闭历史事件',
      isKey: false,
    },
  ];
}

export function createBaseRiskChanges(): RiskChangeItem[] {
  return [
    {
      id: 'RC001',
      unitId: 'U01',
      unitName: '香精调配区',
      fromLevel: 'orange',
      toLevel: 'red',
      reason: '香精大面积泄漏待复核',
      at: '2026-11-11 09:18',
    },
    {
      id: 'RC002',
      unitId: 'U02',
      unitName: '乙醇储罐区',
      fromLevel: 'yellow',
      toLevel: 'orange',
      reason: '可燃气体二级报警',
      at: '2026-11-11 09:42',
    },
    {
      id: 'RC003',
      unitId: 'U04',
      unitName: '动火作业集中区',
      fromLevel: 'yellow',
      toLevel: 'orange',
      reason: '非固定动火作业开始',
      at: '2026-11-11 08:05',
    },
    {
      id: 'RC004',
      unitId: 'U05',
      unitName: '冷却循环站',
      fromLevel: 'blue',
      toLevel: 'orange',
      reason: '压力超限高报',
      at: '2026-11-11 08:55',
    },
  ];
}
