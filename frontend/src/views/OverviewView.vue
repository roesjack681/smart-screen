<script setup lang="ts">
import { computed, ref } from 'vue';
import OpStateRing3D from '@/components/park/OpStateRing3D.vue';
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

export type OverviewNavQuery = Record<string, string>;

const emit = defineEmits<{
  navigate: [view: string, query?: OverviewNavQuery];
}>();

const park = useParkStore();

type AgentKey = 'operations' | 'production' | 'risk';
const agentOpen = ref(false);
const agentKey = ref<AgentKey>('risk');

const agentMeta: Record<AgentKey, { title: string; hint: string; questions: string[] }> = {
  operations: {
    title: '危险作业智能体',
    hint: '总览入口 · 作业票审核 / 资质材料上下文（演示）',
    questions: ['这张动火票还缺什么材料？', '当前进行中作业有哪些风险点？', '有限空间作业监护是否齐全？'],
  },
  production: {
    title: '生产安全智能体',
    hint: '总览入口 · 可燃气体 / 渗漏 / 趋势问答（演示）',
    questions: ['今日可燃气体报警点有哪些？', '泄漏待复核事件摘要？', '最近一次异常发生在哪里？'],
  },
  risk: {
    title: '动态风险智能体',
    hint: '总览入口 · 园区态势 / 单元研判（演示）',
    questions: ['当前园区整体风险态势如何？', '红色风险单元有哪些触发因素？', 'U01 为何升到红区？'],
  },
};

const agentAnswer = ref('请选择上方预置问题，将返回演示研判结果（本轮仅总览入口壳）。');

const opStateCounts = computed(() => {
  const counts = { pending: 0, ongoing: 0, paused: 0, completed: 0 };
  for (const op of park.operations) counts[op.actualState] += 1;
  return counts;
});

const opMarqueeItems = computed(() => [...park.operations, ...park.operations]);
const opMarqueeDuration = computed(() => `${Math.max(18, park.operations.length * 2.2)}s`);

const levelOrder: RiskLevel[] = ['red', 'orange', 'yellow', 'blue'];

const opStateIcon: Record<OperationState, string> = {
  ongoing: 'Play',
  pending: 'Clock3',
  paused: 'Pause',
  completed: 'CircleCheck',
};

function go(view: string, query?: OverviewNavQuery): void {
  emit('navigate', view, query);
}

function openAgent(key: AgentKey): void {
  agentKey.value = key;
  agentOpen.value = true;
  agentAnswer.value = '请选择上方预置问题，将返回演示研判结果（本轮仅总览入口壳）。';
}

function askAgent(q: string): void {
  const ctx = agentMeta[agentKey.value].title;
  agentAnswer.value = `【${ctx} · 演示回复】针对「${q}」：当前为模拟数据研判。总览已带入园区四色、作业与告警上下文；完整问答能力随子页与数据接入迭代。`;
}

function goRiskByLevel(lv: RiskLevel, ev?: Event): void {
  ev?.stopPropagation();
  park.levelFilter = lv;
  go('risk', { level: lv });
}

function goOpsByState(state: OperationState, ev?: Event): void {
  ev?.stopPropagation();
  go('operations', { state });
}

function goProductionTopic(topic: string, ev?: Event): void {
  ev?.stopPropagation();
  go('production', { topic });
}

function openRiskChange(unitId: string): void {
  park.selectUnit(unitId, true);
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
            <button
              v-for="lv in levelOrder"
              :key="lv"
              type="button"
              class="park-level-chip"
              :style="{ '--lv': RISK_LEVEL_COLOR[lv] }"
              :title="`筛选 ${RISK_LEVEL_LABEL[lv]} 并进入动态风险`"
              @click="goRiskByLevel(lv, $event)"
            >
              <i />
              <b>{{ park.levelCounts[lv] }}</b>
            </button>
          </p>
        </div>
        <button class="ps-metric-link" type="button" aria-label="进入动态风险评估" @click.stop="go('risk')">
          <PsIcon name="ArrowUpRight" :size="18" />
        </button>
      </article>

      <article class="park-metric-clickable" @click="goOpsByState('ongoing')">
        <div class="ps-metric-icon amber"><PsIcon name="HardHat" :size="20" /></div>
        <div>
          <span>进行中危险作业</span>
          <strong>
            {{ park.ongoingOps.length }}
            <small><em>项</em></small>
          </strong>
          <p class="park-metric-mini">
            <button type="button" class="park-state-pill" data-state="pending" @click="goOpsByState('pending', $event)">
              <PsIcon name="Clock3" :size="11" />
              {{ opStateCounts.pending }}
            </button>
            <button type="button" class="park-state-pill" data-state="paused" @click="goOpsByState('paused', $event)">
              <PsIcon name="Pause" :size="11" />
              {{ opStateCounts.paused }}
            </button>
          </p>
        </div>
        <button class="ps-metric-link" type="button" aria-label="进入危险作业" @click.stop="go('operations')">
          <PsIcon name="ArrowUpRight" :size="18" />
        </button>
      </article>

      <article
        class="park-metric-clickable"
        :class="{ 'ps-metric-warning': park.pendingAlarms.length }"
        @click="goProductionTopic('alarms')"
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

      <article title="演示值 · 等级映射待确认">
        <div class="ps-metric-icon violet"><PsIcon name="Gauge" :size="20" /></div>
        <div>
          <span>园区整体风险指数</span>
          <strong>
            {{ park.overallIndex.toFixed(1) }}
            <small><em>分</em></small>
          </strong>
          <p class="park-index-bar">
            <i :style="{ width: `${Math.min(100, park.overallIndex)}%` }" />
          </p>
        </div>
      </article>

      <article class="park-metric-vehicle" title="暂无演示记录" @click="goProductionTopic('vehicle')">
        <div class="ps-metric-icon cyan"><PsIcon name="Truck" :size="20" /></div>
        <div>
          <span>车辆危险作业在途</span>
          <strong>
            0
            <small><em>条</em></small>
          </strong>
        </div>
      </article>
    </section>

    <div class="park-overview__toolbar">
      <div class="park-scenario-bar" :title="park.scenarioLabel">
        <em>场景演示</em>
        <span>{{ park.scenarioLabel }}</span>
        <button class="ps-button ps-button-small" type="button" @click="park.scenarioPrev()">上一步</button>
        <button class="ps-button ps-button-primary ps-button-small" type="button" @click="park.scenarioNext()">
          下一步
        </button>
        <button class="ps-button ps-button-small" type="button" @click="park.scenarioReset()">重置</button>
      </div>
      <div class="park-agent-entry" aria-label="智能体入口">
        <em>智能体</em>
        <button type="button" :class="{ active: agentOpen && agentKey === 'operations' }" @click="openAgent('operations')">
          危险作业
        </button>
        <button type="button" :class="{ active: agentOpen && agentKey === 'production' }" @click="openAgent('production')">
          生产安全
        </button>
        <button type="button" :class="{ active: agentOpen && agentKey === 'risk' }" @click="openAgent('risk')">
          动态风险
        </button>
      </div>
    </div>

    <section class="park-overview__main" aria-label="总览主体">
      <aside class="ps-panel park-overview__left">
        <header class="ps-panel-header">
          <h2><i class="ps-section-mark" />危险作业概况</h2>
          <button class="ps-link-button" type="button" @click="go('operations')">
            进入监控 <PsIcon name="ChevronRight" :size="14" />
          </button>
        </header>
        <OpStateRing3D :counts="opStateCounts" />
        <ul class="park-feed">
          <li
            v-for="op in park.operations"
            :key="op.id"
            class="park-feed__click"
            @click="goOpsByState(op.actualState)"
          >
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
            v-for="al in park.keyAlarms"
            :key="al.id"
            class="park-feed__click"
            @click="park.selectZone(al.zoneId)"
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
          <h2><i class="ps-section-mark" />可燃气体风险</h2>
          <button class="ps-link-button" type="button" @click="goProductionTopic('gas')">
            生产安全入口 <PsIcon name="ChevronRight" :size="14" />
          </button>
        </header>
        <div class="park-alcohol">
          <button type="button" @click="goProductionTopic('gas')">
            <small>
              <PsIcon name="Radio" :size="11" />
              可燃气体测点
            </small>
            <b>{{ park.alcohol.gasPointTotal }}</b>
            <span class="park-alcohol__meta">
              <PsIcon name="Flame" :size="11" />
              报警点 {{ park.alcohol.gasAlarmPoints }}
            </span>
          </button>
          <button type="button" @click="goProductionTopic('leak')">
            <small>
              <PsIcon name="Droplets" :size="11" />
              泄漏待复核
            </small>
            <b class="ps-text-amber">{{ park.alcohol.leakPendingReview }}</b>
            <span class="park-alcohol__meta muted">事件数 · 演示</span>
          </button>
          <button type="button" class="park-alcohol__wide" @click="goProductionTopic('gas')">
            <small>
              <PsIcon name="Clock3" :size="11" />
              最近异常
            </small>
            <b>{{ park.alcohol.lastAbnormalAt || '暂无' }}</b>
          </button>
        </div>

        <header class="ps-panel-header park-overview__subhead">
          <h2><i class="ps-section-mark" />告警入口</h2>
          <button class="ps-link-button" type="button" @click="goProductionTopic('alarms')">
            告警列表 <PsIcon name="ChevronRight" :size="14" />
          </button>
        </header>
        <ul class="park-feed">
          <li
            v-for="al in park.pendingAlarms"
            :key="al.id"
            class="park-feed__click"
            @click="park.selectZone(al.zoneId)"
          >
            <span class="park-feed__glyph" :title="al.type">
              <PsIcon :name="alarmIcon(al.type)" :size="14" />
            </span>
            <div>
              <strong>{{ al.type }}</strong>
              <p>{{ al.location }}</p>
            </div>
            <span class="park-state-icon warn" title="待处理">
              <PsIcon name="CircleAlert" :size="14" />
            </span>
          </li>
          <li v-if="!park.pendingAlarms.length" class="park-feed__empty">暂无待处理告警</li>
        </ul>
      </aside>
    </section>

    <section class="park-overview__bottom" aria-label="底部动态">
      <div class="ps-panel park-bottom-clickable" @click="go('operations')">
        <header class="ps-panel-header">
          <h2><i class="ps-section-mark" />危险作业动态</h2>
          <button class="ps-link-button" type="button" @click.stop="go('operations')">
            进入作业 <PsIcon name="ChevronRight" :size="14" />
          </button>
        </header>
        <div class="park-marquee" :style="{ '--park-marquee-duration': opMarqueeDuration }">
          <ul class="park-bottom-list park-marquee__track">
            <li
              v-for="(op, idx) in opMarqueeItems"
              :key="`${op.id}-${idx}`"
              @click.stop="goOpsByState(op.actualState)"
            >
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
      </div>
      <div class="ps-panel">
        <header class="ps-panel-header">
          <h2><i class="ps-section-mark" />近期风险变化</h2>
          <button class="ps-link-button" type="button" @click="go('risk')">
            风险页 <PsIcon name="ChevronRight" :size="14" />
          </button>
        </header>
        <ul class="park-bottom-list">
          <li
            v-for="item in park.riskChanges"
            :key="item.id"
            class="park-bottom-list__click"
            @click="openRiskChange(item.unitId)"
          >
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

    <aside v-if="agentOpen" class="park-agent-panel" :aria-label="agentMeta[agentKey].title">
      <header>
        <div>
          <h3>{{ agentMeta[agentKey].title }}</h3>
          <p>{{ agentMeta[agentKey].hint }}</p>
        </div>
        <button class="ps-icon-button" type="button" aria-label="关闭智能体" @click="agentOpen = false">
          <PsIcon name="X" :size="18" />
        </button>
      </header>
      <div class="park-agent-panel__tabs">
        <button
          v-for="(meta, key) in agentMeta"
          :key="key"
          type="button"
          :class="{ active: agentKey === key }"
          @click="openAgent(key as AgentKey)"
        >
          {{ meta.title.replace('智能体', '') }}
        </button>
      </div>
      <div class="park-agent-panel__qs">
        <button v-for="q in agentMeta[agentKey].questions" :key="q" type="button" @click="askAgent(q)">
          {{ q }}
        </button>
      </div>
      <div class="park-agent-panel__answer">{{ agentAnswer }}</div>
    </aside>

    <UnitDetailDrawer @goto-risk="go('risk', $event)" @goto-ops="go('operations', $event)" />
  </div>
</template>
