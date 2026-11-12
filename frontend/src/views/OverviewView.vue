<script setup lang="ts">
import { computed } from 'vue';
import ParkRiskMap3D from '@/components/park/ParkRiskMap3D.vue';
import UnitDetailDrawer from '@/components/park/UnitDetailDrawer.vue';
import PsIcon from '@/components/safety/PsIcon.vue';
import { useParkStore } from '@/stores/park';
import {
  OPERATION_STATE_LABEL,
  RISK_LEVEL_COLOR,
  RISK_LEVEL_LABEL,
  type OperationState,
  type RiskLevel,
} from '@/types/park';

const emit = defineEmits<{
  navigate: [view: string];
}>();

const park = useParkStore();

const opStateCounts = computed(() => {
  const counts = { pending: 0, ongoing: 0, paused: 0, completed: 0 };
  for (const op of park.operations) counts[op.actualState] += 1;
  return counts;
});

const levelOrder: RiskLevel[] = ['red', 'orange', 'yellow', 'blue'];

const opStatItems: Array<{
  key: OperationState;
  icon: string;
  label: string;
}> = [
  { key: 'ongoing', icon: 'Play', label: '进行中' },
  { key: 'pending', icon: 'Clock3', label: '待开工' },
  { key: 'paused', icon: 'Pause', label: '暂停' },
  { key: 'completed', icon: 'CircleCheck', label: '已完成' },
];

const opStateIcon: Record<OperationState, string> = {
  ongoing: 'Play',
  pending: 'Clock3',
  paused: 'Pause',
  completed: 'CircleCheck',
};

function go(view: string): void {
  emit('navigate', view);
}

function alarmIcon(type: string): string {
  if (type.includes('气体')) return 'Flame';
  if (type.includes('泄漏')) return 'Droplets';
  if (type.includes('压力')) return 'Gauge';
  if (type.includes('温度') || type.includes('温')) return 'Thermometer';
  return 'CircleAlert';
}
</script>

<template>
  <div class="park-overview">
    <section class="ps-metrics park-overview__metrics" aria-label="园区安全关键指标">
      <article class="park-metric-clickable" @click="go('risk')">
        <div class="ps-metric-icon cyan"><PsIcon name="Layers" :size="20" /></div>
        <div>
          <span>风险单元总数</span>
          <strong>
            {{ park.units.length }}
            <small><em>个</em></small>
          </strong>
          <p class="park-metric-levels" aria-label="四色数量">
            <span
              v-for="lv in levelOrder"
              :key="lv"
              class="park-level-chip"
              :style="{ '--lv': RISK_LEVEL_COLOR[lv] }"
              :title="`${RISK_LEVEL_LABEL[lv]} ${park.levelCounts[lv]}`"
            >
              <i />
              <b>{{ park.levelCounts[lv] }}</b>
            </span>
          </p>
        </div>
        <button class="ps-metric-link" type="button" aria-label="进入动态风险评估" @click.stop="go('risk')">
          <PsIcon name="ArrowUpRight" :size="18" />
        </button>
      </article>

      <article class="park-metric-clickable" @click="go('operations')">
        <div class="ps-metric-icon amber"><PsIcon name="HardHat" :size="20" /></div>
        <div>
          <span>进行中危险作业</span>
          <strong>
            {{ park.ongoingOps.length }}
            <small><em>项</em></small>
          </strong>
          <p class="park-metric-mini">
            <span class="park-state-pill" data-state="pending" :title="`待开工 ${opStateCounts.pending}`">
              <PsIcon name="Clock3" :size="11" />
              {{ opStateCounts.pending }}
            </span>
            <span class="park-state-pill" data-state="paused" :title="`暂停 ${opStateCounts.paused}`">
              <PsIcon name="Pause" :size="11" />
              {{ opStateCounts.paused }}
            </span>
          </p>
        </div>
        <button class="ps-metric-link" type="button" aria-label="进入危险作业" @click.stop="go('operations')">
          <PsIcon name="ArrowUpRight" :size="18" />
        </button>
      </article>

      <article
        class="park-metric-clickable"
        :class="{ 'ps-metric-warning': park.pendingAlarms.length }"
        @click="go('production')"
      >
        <div class="ps-metric-icon green"><PsIcon name="BellRing" :size="20" /></div>
        <div>
          <span>待处理告警</span>
          <strong :class="park.pendingAlarms.length ? 'ps-text-amber' : ''">
            {{ park.pendingAlarms.length }}
            <small><em>条</em></small>
          </strong>
          <p class="park-metric-mini">
            <span class="park-state-pill hot" :title="`重点预警 ${park.keyAlarms.length}`">
              <PsIcon name="AlertTriangle" :size="11" />
              {{ park.keyAlarms.length }}
            </span>
          </p>
        </div>
        <button class="ps-metric-link" type="button" aria-label="进入生产安全预警" @click.stop="go('production')">
          <PsIcon name="ArrowUpRight" :size="18" />
        </button>
      </article>

      <article>
        <div class="ps-metric-icon violet"><PsIcon name="Gauge" :size="20" /></div>
        <div>
          <span>园区整体风险指数</span>
          <strong>
            {{ park.overallIndex.toFixed(1) }}
            <small><em>分</em></small>
          </strong>
          <p class="park-index-bar" title="演示值 · 等级映射待确认">
            <i :style="{ width: `${Math.min(100, park.overallIndex)}%` }" />
          </p>
        </div>
      </article>
    </section>

    <section class="park-overview__main" aria-label="总览主体">
      <aside class="ps-panel park-overview__left">
        <header class="ps-panel-header">
          <h2><i class="ps-section-mark" />危险作业概况</h2>
          <button class="ps-link-button" type="button" @click="go('operations')">
            进入监控 <PsIcon name="ChevronRight" :size="14" />
          </button>
        </header>
        <div class="park-op-stats">
          <div v-for="item in opStatItems" :key="item.key" :title="item.label">
            <span class="park-op-stats__icon" :data-state="item.key">
              <PsIcon :name="item.icon" :size="13" />
            </span>
            <b>{{ opStateCounts[item.key] }}</b>
          </div>
        </div>
        <ul class="park-feed">
          <li v-for="op in park.operations.slice(0, 3)" :key="op.id">
            <div>
              <strong>{{ op.name }}</strong>
              <p>{{ op.summary }}</p>
            </div>
            <span
              class="park-state-icon"
              :data-state="op.actualState"
              :title="OPERATION_STATE_LABEL[op.actualState]"
            >
              <PsIcon :name="opStateIcon[op.actualState]" :size="14" />
            </span>
          </li>
        </ul>

        <header class="ps-panel-header park-overview__subhead">
          <h2><i class="ps-section-mark" />重点预警</h2>
          <span class="ps-count" :class="{ hot: park.keyAlarms.length }">{{ park.keyAlarms.length }}</span>
        </header>
        <ul class="park-feed">
          <li
            v-for="al in park.keyAlarms.slice(0, 3)"
            :key="al.id"
            class="park-feed__click"
            @click="park.selectUnit(al.unitId)"
          >
            <span class="park-feed__glyph hot" :title="al.type">
              <PsIcon :name="alarmIcon(al.type)" :size="14" />
            </span>
            <div>
              <strong>{{ al.type }}</strong>
              <p>{{ al.location }}</p>
            </div>
            <time>{{ al.occurredAt.slice(11) }}</time>
          </li>
          <li v-if="!park.keyAlarms.length" class="park-feed__empty">暂无重点预警</li>
        </ul>
      </aside>

      <div class="ps-panel park-overview__center">
        <header class="ps-panel-header">
          <h2>
            <i class="ps-section-mark" />
            园区风险单元图
            <small>三维示意</small>
          </h2>
          <span class="ps-subtle">点击单元查看详情</span>
        </header>
        <div class="park-overview__map">
          <ParkRiskMap3D />
        </div>
      </div>

      <aside class="ps-panel park-overview__right">
        <header class="ps-panel-header">
          <h2><i class="ps-section-mark" />酒精香精风险</h2>
          <button class="ps-link-button" type="button" @click="go('production')">
            生产安全入口 <PsIcon name="ChevronRight" :size="14" />
          </button>
        </header>
        <div class="park-alcohol">
          <div>
            <small>
              <PsIcon name="Radio" :size="11" />
              可燃气体测点
            </small>
            <b>{{ park.alcohol.gasPointTotal }}</b>
            <span class="park-alcohol__meta">
              <PsIcon name="Flame" :size="11" />
              {{ park.alcohol.gasAlarmPoints }}
            </span>
          </div>
          <div>
            <small>
              <PsIcon name="Droplets" :size="11" />
              泄漏待复核
            </small>
            <b class="ps-text-amber">{{ park.alcohol.leakPendingReview }}</b>
            <span class="park-alcohol__meta muted">演示摘要</span>
          </div>
          <div class="park-alcohol__wide">
            <small>
              <PsIcon name="Clock3" :size="11" />
              最近异常
            </small>
            <b>{{ park.alcohol.lastAbnormalAt || '暂无' }}</b>
          </div>
        </div>

        <header class="ps-panel-header park-overview__subhead">
          <h2><i class="ps-section-mark" />告警入口</h2>
        </header>
        <ul class="park-feed">
          <li
            v-for="al in park.pendingAlarms.slice(0, 3)"
            :key="al.id"
            class="park-feed__click"
            @click="park.selectUnit(al.unitId)"
          >
            <span class="park-feed__glyph" :title="al.type">
              <PsIcon :name="alarmIcon(al.type)" :size="14" />
            </span>
            <div>
              <strong>{{ al.type }}</strong>
              <p>{{ al.summary }}</p>
            </div>
            <span class="park-state-icon warn" title="待处理">
              <PsIcon name="CircleAlert" :size="14" />
            </span>
          </li>
          <li v-if="!park.pendingAlarms.length" class="park-feed__empty">暂无待处理告警</li>
        </ul>

        <header class="ps-panel-header park-overview__subhead">
          <h2><i class="ps-section-mark" />车辆预警</h2>
        </header>
        <p class="park-feed__empty park-vehicle-empty">
          <PsIcon name="Truck" :size="14" />
          暂无演示记录
        </p>
      </aside>
    </section>

    <section class="park-overview__bottom" aria-label="底部动态">
      <div class="ps-panel">
        <header class="ps-panel-header">
          <h2><i class="ps-section-mark" />危险作业动态</h2>
        </header>
        <ul class="park-bottom-list">
          <li v-for="op in park.operations.slice(0, 3)" :key="op.id">
            <time>{{ op.plannedStart.slice(11, 16) }}</time>
            <div>
              <strong>{{ op.name }}</strong>
              <span>
                {{ op.type }}
                <em
                  class="park-state-icon inline"
                  :data-state="op.actualState"
                  :title="OPERATION_STATE_LABEL[op.actualState]"
                >
                  <PsIcon :name="opStateIcon[op.actualState]" :size="12" />
                </em>
              </span>
            </div>
          </li>
        </ul>
      </div>
      <div class="ps-panel">
        <header class="ps-panel-header">
          <h2><i class="ps-section-mark" />近期风险变化</h2>
        </header>
        <ul class="park-bottom-list">
          <li v-for="item in park.riskChanges.slice(0, 3)" :key="item.id">
            <time>{{ item.at.slice(11) }}</time>
            <div>
              <strong>{{ item.unitName }}</strong>
              <span>
                <i class="park-level-dot" :style="{ background: RISK_LEVEL_COLOR[item.fromLevel] }" :title="RISK_LEVEL_LABEL[item.fromLevel]" />
                <PsIcon name="ArrowRight" :size="11" />
                <i class="park-level-dot" :style="{ background: RISK_LEVEL_COLOR[item.toLevel] }" :title="RISK_LEVEL_LABEL[item.toLevel]" />
                {{ item.reason }}
              </span>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <UnitDetailDrawer />
  </div>
</template>
