import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createAlcoholSummary } from '@/data/park/alcohol';
import { createBaseAlarms, createBaseRiskChanges } from '@/data/park/alarms';
import { createBaseOperations } from '@/data/park/operations';
import { createBaseUnits } from '@/data/park/units';
import { createBaseZones } from '@/data/park/zones';
import { createParkDemoClock, parkDemoDateTime, parkDemoTimeAt } from '@/utils/park-demo-time';
import type {
  AlcoholSummary,
  ParkAlarm,
  ParkOperation,
  RiskChangeItem,
  RiskLevel,
  RiskUnit,
  RiskZone,
  TimelineItem,
} from '@/types/park';

const DEMO_CLOCK = createParkDemoClock();

const SCENARIO_STEPS = [
  '重置：U03 黄，OP003 待开工',
  '动火开始：OP003 进行中，U03·A1工段升橙',
  '气体异常：U03·A1工段升红，新增告警',
  '信号解除：测点解除，仍待复核',
  '完成复核：U03·A1回橙，保留动火因素',
  '作业结束：OP003 完成，U03 回黄',
] as const;

const SCENARIO_TIMES = ['09:00', '10:35', '10:42', '10:43', '10:58', '11:10'] as const;

function cloneUnits(): RiskUnit[] {
  return createBaseUnits().map((u) => ({
    ...u,
    activeTriggerIds: [...u.activeTriggerIds],
    triggers: [...u.triggers],
  }));
}

function cloneZones(): RiskZone[] {
  return createBaseZones().map((z) => ({ ...z }));
}

function cloneOps(): ParkOperation[] {
  return createBaseOperations().map((o) => ({ ...o }));
}

function cloneAlarms(): ParkAlarm[] {
  return createBaseAlarms().map((a) => ({ ...a }));
}

export const useParkStore = defineStore('park', () => {
  const units = ref<RiskUnit[]>(cloneUnits());
  const zones = ref<RiskZone[]>(cloneZones());
  const operations = ref<ParkOperation[]>(cloneOps());
  const alarms = ref<ParkAlarm[]>(cloneAlarms());
  const riskChanges = ref<RiskChangeItem[]>(createBaseRiskChanges());
  const alcohol = ref<AlcoholSummary>(createAlcoholSummary());
  const demoTime = ref(DEMO_CLOCK);
  const selectedUnitId = ref<string | null>(null);
  const selectedZoneId = ref<string | null>(null);
  const levelFilter = ref<RiskLevel | null>(null);
  const scenarioStep = ref(0);
  const drawerOpen = ref(false);
  const overallIndex = ref(72.4);

  const selectedUnit = computed(
    () => units.value.find((u) => u.id === selectedUnitId.value) || null,
  );

  const selectedZone = computed(
    () => zones.value.find((z) => z.id === selectedZoneId.value) || null,
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

  const alarmedZoneIds = computed(() => {
    const ids = new Set<string>();
    for (const a of pendingAlarms.value) {
      if (a.zoneId) ids.add(a.zoneId);
    }
    return ids;
  });

  const scenarioLabel = computed(() => SCENARIO_STEPS[scenarioStep.value] || SCENARIO_STEPS[0]);

  function zonesOfUnit(unitId: string): RiskZone[] {
    return zones.value.filter((z) => z.unitId === unitId);
  }

  function selectUnit(id: string | null, openDrawer = true): void {
    selectedUnitId.value = id;
    if (!id) {
      selectedZoneId.value = null;
      drawerOpen.value = false;
      return;
    }
    if (!selectedZoneId.value || !zones.value.some((z) => z.id === selectedZoneId.value && z.unitId === id)) {
      selectedZoneId.value = zones.value.find((z) => z.unitId === id)?.id || null;
    }
    if (openDrawer) drawerOpen.value = true;
  }

  function selectZone(zoneId: string | null, openDrawer = true): void {
    if (!zoneId) {
      selectedZoneId.value = null;
      return;
    }
    const zone = zones.value.find((z) => z.id === zoneId);
    if (!zone) return;
    selectedZoneId.value = zoneId;
    selectedUnitId.value = zone.unitId;
    if (openDrawer) drawerOpen.value = true;
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
        at: parkDemoDateTime('08:00'),
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
        detail: `${alarm.location} · ${alarm.summary}`,
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
    units.value = cloneUnits();
    zones.value = cloneZones();
    operations.value = cloneOps();
    alarms.value = cloneAlarms();
    riskChanges.value = createBaseRiskChanges();
    alcohol.value = createAlcoholSummary();

    const u03 = units.value.find((u) => u.id === 'U03')!;
    const zA1 = zones.value.find((z) => z.id === 'Z03-A')!;
    const op003 = operations.value.find((o) => o.id === 'OP003')!;

    if (step >= 1) {
      op003.actualState = 'ongoing';
      u03.currentLevel = 'orange';
      zA1.currentLevel = 'orange';
      u03.activeTriggerIds = ['R01'];
      u03.triggers = ['A1工段：固定动火区外动火作业进行中'];
      riskChanges.value.unshift({
        id: 'RC-S1',
        unitId: 'U03',
        unitName: u03.name,
        fromLevel: 'yellow',
        toLevel: 'orange',
        reason: 'OP003 动火开始 · A1工段',
        at: parkDemoDateTime('10:35'),
      });
    }

    if (step >= 2) {
      u03.currentLevel = 'red';
      zA1.currentLevel = 'red';
      u03.activeTriggerIds = ['R01', 'R05'];
      u03.triggers = ['A1工段：固定动火区外动火作业进行中', 'A1工段：可燃气体一级报警（演示情形）'];
      u03.reviewStatus = 'pending';
      alarms.value.unshift({
        id: 'AL-S2',
        unitId: 'U03',
        zoneId: 'Z03-A',
        type: '可燃气体报警',
        location: '合成车间A区 · A1工段 GS003',
        occurredAt: parkDemoDateTime('10:42'),
        handlingState: 'pending',
        summary: '场景演示新增气体异常（定位 A1工段）',
        isKey: true,
      });
      alcohol.value.gasAlarmPoints = 3;
      alcohol.value.lastAbnormalAt = parkDemoDateTime('10:42');
      riskChanges.value.unshift({
        id: 'RC-S2',
        unitId: 'U03',
        unitName: u03.name,
        fromLevel: 'orange',
        toLevel: 'red',
        reason: 'A1工段气体异常进入红区（预置演示情形）',
        at: parkDemoDateTime('10:42'),
      });
    }

    if (step >= 3) {
      u03.triggers = ['A1工段：固定动火区外动火作业进行中', 'A1工段：气体报警已解除，待复核'];
      u03.reviewStatus = 'pending';
      const alarm = alarms.value.find((a) => a.id === 'AL-S2');
      if (alarm) alarm.summary = 'A1工段测点已解除激活，处置与复核未完成';
    }

    if (step >= 4) {
      u03.currentLevel = 'orange';
      zA1.currentLevel = 'orange';
      u03.activeTriggerIds = ['R01'];
      u03.triggers = ['A1工段：固定动火区外动火作业进行中'];
      u03.reviewStatus = 'done';
      const alarm = alarms.value.find((a) => a.id === 'AL-S2');
      if (alarm) {
        alarm.handlingState = 'closed';
        alarm.summary = 'A1工段演示复核完成，动火因素仍有效';
      }
      alcohol.value.gasAlarmPoints = 2;
      riskChanges.value.unshift({
        id: 'RC-S4',
        unitId: 'U03',
        unitName: u03.name,
        fromLevel: 'red',
        toLevel: 'orange',
        reason: 'A1工段完成演示复核，保留动火因素',
        at: parkDemoDateTime('10:58'),
      });
    }

    if (step >= 5) {
      op003.actualState = 'completed';
      u03.currentLevel = 'yellow';
      zA1.currentLevel = 'yellow';
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
        at: parkDemoDateTime('11:10'),
      });
    }

    scenarioStep.value = step;
    demoTime.value = parkDemoTimeAt(SCENARIO_TIMES[step] || SCENARIO_TIMES[0]);
    if (step > 0) {
      selectZone('Z03-A', true);
    } else if (selectedUnitId.value === 'U03') {
      selectUnit('U03', false);
    }
  }

  function scenarioNext(): void {
    applyScenarioStep(Math.min(scenarioStep.value + 1, SCENARIO_STEPS.length - 1));
  }

  function scenarioPrev(): void {
    applyScenarioStep(Math.max(scenarioStep.value - 1, 0));
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
    zones,
    operations,
    alarms,
    riskChanges,
    alcohol,
    demoTime,
    selectedUnitId,
    selectedZoneId,
    selectedUnit,
    selectedZone,
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
    alarmedZoneIds,
    selectUnit,
    selectZone,
    zonesOfUnit,
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
