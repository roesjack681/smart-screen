import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createAlcoholSummary } from '@/data/park/alcohol';
import { createBaseAlarms, createBaseRiskChanges } from '@/data/park/alarms';
import { createBaseOperations } from '@/data/park/operations';
import { createBaseUnits } from '@/data/park/units';
import type {
  AlcoholSummary,
  ParkAlarm,
  ParkOperation,
  RiskChangeItem,
  RiskLevel,
  RiskUnit,
  TimelineItem,
} from '@/types/park';

const DEMO_CLOCK = new Date('2026-11-11T10:00:00+08:00').getTime();

const SCENARIO_STEPS = [
  '重置：U03 黄，OP003 待开工',
  '动火开始：OP003 进行中，U03 升橙',
  '气体异常：U03 升红，新增告警',
  '信号解除：测点解除，仍待复核',
  '完成复核：U03 回橙，保留动火因素',
  '作业结束：OP003 完成，U03 回黄',
] as const;

function cloneUnits(): RiskUnit[] {
  return createBaseUnits().map((u) => ({
    ...u,
    activeTriggerIds: [...u.activeTriggerIds],
    triggers: [...u.triggers],
  }));
}

function cloneOps(): ParkOperation[] {
  return createBaseOperations().map((o) => ({ ...o }));
}

function cloneAlarms(): ParkAlarm[] {
  return createBaseAlarms().map((a) => ({ ...a }));
}

export const useParkStore = defineStore('park', () => {
  const units = ref<RiskUnit[]>(cloneUnits());
  const operations = ref<ParkOperation[]>(cloneOps());
  const alarms = ref<ParkAlarm[]>(cloneAlarms());
  const riskChanges = ref<RiskChangeItem[]>(createBaseRiskChanges());
  const alcohol = ref<AlcoholSummary>(createAlcoholSummary());
  const demoTime = ref(DEMO_CLOCK);
  const selectedUnitId = ref<string | null>(null);
  const levelFilter = ref<RiskLevel | null>(null);
  const scenarioStep = ref(0);
  const drawerOpen = ref(false);
  const overallIndex = ref(72.4);

  const selectedUnit = computed(
    () => units.value.find((u) => u.id === selectedUnitId.value) || null,
  );

  const levelCounts = computed(() => {
    const counts: Record<RiskLevel, number> = { red: 0, orange: 0, yellow: 0, blue: 0 };
    for (const u of units.value) counts[u.currentLevel] += 1;
    return counts;
  });

  const ongoingOps = computed(() => operations.value.filter((o) => o.actualState === 'ongoing'));
  const pendingAlarms = computed(() =>
    alarms.value.filter((a) => a.handlingState === 'pending' || a.handlingState === 'processing'),
  );
  const keyAlarms = computed(() => alarms.value.filter((a) => a.isKey && a.handlingState !== 'closed'));
  const visibleUnits = computed(() =>
    levelFilter.value ? units.value.filter((u) => u.currentLevel === levelFilter.value) : units.value,
  );

  const scenarioLabel = computed(() => SCENARIO_STEPS[scenarioStep.value] || SCENARIO_STEPS[0]);

  function selectUnit(id: string | null, openDrawer = true): void {
    selectedUnitId.value = id;
    if (id && openDrawer) drawerOpen.value = true;
    if (!id) drawerOpen.value = false;
  }

  function toggleLevelFilter(level: RiskLevel): void {
    levelFilter.value = levelFilter.value === level ? null : level;
  }

  function unitTimeline(unitId: string): TimelineItem[] {
    const unit = units.value.find((u) => u.id === unitId);
    if (!unit) return [];
    const items: TimelineItem[] = [
      {
        id: 't0',
        at: '2026-11-11 08:00',
        title: '基础监测',
        detail: `固有等级 ${unit.baseLevel}`,
      },
    ];
    for (const change of riskChanges.value.filter((c) => c.unitId === unitId)) {
      items.push({
        id: change.id,
        at: change.at,
        title: `等级变化 ${change.fromLevel} → ${change.toLevel}`,
        detail: change.reason,
      });
    }
    for (const alarm of alarms.value.filter((a) => a.unitId === unitId)) {
      items.push({
        id: alarm.id,
        at: alarm.occurredAt,
        title: alarm.type,
        detail: alarm.summary,
      });
    }
    return items.sort((a, b) => a.at.localeCompare(b.at));
  }

  function relatedOperations(unitId: string): ParkOperation[] {
    return operations.value.filter((o) => o.unitId === unitId);
  }

  function relatedAlarms(unitId: string): ParkAlarm[] {
    return alarms.value.filter((a) => a.unitId === unitId);
  }

  function applyScenarioStep(step: number): void {
    // 先回到基础，再按步进叠加，保证可逆
    units.value = cloneUnits();
    operations.value = cloneOps();
    alarms.value = cloneAlarms();
    riskChanges.value = createBaseRiskChanges();
    alcohol.value = createAlcoholSummary();

    const u03 = units.value.find((u) => u.id === 'U03')!;
    const op003 = operations.value.find((o) => o.id === 'OP003')!;

    if (step >= 1) {
      op003.actualState = 'ongoing';
      u03.currentLevel = 'orange';
      u03.activeTriggerIds = ['R01'];
      u03.triggers = ['非固定动火区作业进行中'];
      riskChanges.value.unshift({
        id: 'RC-S1',
        unitId: 'U03',
        unitName: u03.name,
        fromLevel: 'yellow',
        toLevel: 'orange',
        reason: 'OP003 动火开始',
        at: '2026-11-11 10:05',
      });
    }

    if (step >= 2) {
      u03.currentLevel = 'red';
      u03.activeTriggerIds = ['R01', 'R05'];
      u03.triggers = ['非固定动火区作业进行中', '可燃气体一级报警（演示情形）'];
      u03.reviewStatus = 'pending';
      alarms.value.unshift({
        id: 'AL-S2',
        unitId: 'U03',
        type: '可燃气体报警',
        location: '提取车间A区 GS003',
        occurredAt: '2026-11-11 10:12',
        handlingState: 'pending',
        summary: '场景演示新增气体异常',
        isKey: true,
      });
      alcohol.value.gasAlarmPoints = 3;
      alcohol.value.lastAbnormalAt = '2026-11-11 10:12';
      riskChanges.value.unshift({
        id: 'RC-S2',
        unitId: 'U03',
        unitName: u03.name,
        fromLevel: 'orange',
        toLevel: 'red',
        reason: '气体异常进入红区（预置演示情形）',
        at: '2026-11-11 10:12',
      });
    }

    if (step >= 3) {
      // 信号解除但仍待复核，保持红并标注
      u03.triggers = ['非固定动火区作业进行中', '气体报警已解除，待复核'];
      u03.reviewStatus = 'pending';
      const alarm = alarms.value.find((a) => a.id === 'AL-S2');
      if (alarm) alarm.summary = '测点已解除激活，处置与复核未完成';
    }

    if (step >= 4) {
      u03.currentLevel = 'orange';
      u03.activeTriggerIds = ['R01'];
      u03.triggers = ['非固定动火区作业进行中'];
      u03.reviewStatus = 'done';
      const alarm = alarms.value.find((a) => a.id === 'AL-S2');
      if (alarm) {
        alarm.handlingState = 'closed';
        alarm.summary = '演示复核完成，动火因素仍有效';
      }
      alcohol.value.gasAlarmPoints = 2;
      riskChanges.value.unshift({
        id: 'RC-S4',
        unitId: 'U03',
        unitName: u03.name,
        fromLevel: 'red',
        toLevel: 'orange',
        reason: '完成演示复核，保留动火因素',
        at: '2026-11-11 10:28',
      });
    }

    if (step >= 5) {
      op003.actualState = 'completed';
      u03.currentLevel = 'yellow';
      u03.activeTriggerIds = [];
      u03.triggers = [];
      u03.reviewStatus = 'none';
      riskChanges.value.unshift({
        id: 'RC-S5',
        unitId: 'U03',
        unitName: u03.name,
        fromLevel: 'orange',
        toLevel: 'yellow',
        reason: 'OP003 作业结束并确认',
        at: '2026-11-11 10:40',
      });
    }

    scenarioStep.value = step;
    if (selectedUnitId.value === 'U03' || step > 0) {
      selectUnit('U03', step > 0);
    }
  }

  function scenarioNext(): void {
    const next = Math.min(scenarioStep.value + 1, SCENARIO_STEPS.length - 1);
    applyScenarioStep(next);
  }

  function scenarioPrev(): void {
    const prev = Math.max(scenarioStep.value - 1, 0);
    applyScenarioStep(prev);
  }

  function scenarioReset(): void {
    applyScenarioStep(0);
    selectUnit(null);
  }

  function tickDemoClock(): void {
    demoTime.value += 1000;
  }

  return {
    units,
    operations,
    alarms,
    riskChanges,
    alcohol,
    demoTime,
    selectedUnitId,
    selectedUnit,
    levelFilter,
    scenarioStep,
    scenarioLabel,
    drawerOpen,
    overallIndex,
    levelCounts,
    ongoingOps,
    pendingAlarms,
    keyAlarms,
    visibleUnits,
    selectUnit,
    toggleLevelFilter,
    unitTimeline,
    relatedOperations,
    relatedAlarms,
    scenarioNext,
    scenarioPrev,
    scenarioReset,
    tickDemoClock,
    SCENARIO_STEPS,
  };
});
