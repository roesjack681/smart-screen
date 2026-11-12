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

function go(view: string): void {
  emit('navigate', view);
}
</script>

<template>
  <div class="park-overview">
    <section class="ps-metrics park-overview__metrics" aria-label="园区安全关键指标">
      <article class="park-metric-clickable" @click="go('risk')">
        <div class="ps-metric-icon cyan"><PsIcon name="Layers" :size="22" /></div>
        <div>
          <span>风险单元总数</span>
          <strong>
            {{ park.units.length }}
            <small><em>个</em></small>
          </strong>
          <p class="park-metric-levels">
            <span v-for="lv in levelOrder" :key="lv" :style="{ color: RISK_LEVEL_COLOR[lv] }">
              {{ RISK_LEVEL_LABEL[lv].slice(0, 2) }} {{ park.levelCounts[lv] }}
            </span>
          </p>
        </div>
        <button class="ps-metric-link" type="button" aria-label="进入动态风险评估" @click.stop="go('risk')">
          <PsIcon name="ArrowUpRight" :size="18" />
        </button>
      </article>

      <article class="park-metric-clickable" @click="go('operations')">
        <div class="ps-metric-icon amber"><PsIcon name="Activity" :size="22" /></div>
        <div>
          <span>进行中危险作业</span>
          <strong>
            {{ park.ongoingOps.length }}
            <small><em>项</em></small>
          </strong>
          <p>待开工 {{ opStateCounts.pending }} · 暂停 {{ opStateCounts.paused }}</p>
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
        <div class="ps-metric-icon green"><PsIcon name="BellRing" :size="22" /></div>
        <div>
          <span>待处理告警</span>
          <strong :class="park.pendingAlarms.length ? 'ps-text-amber' : ''">
            {{ park.pendingAlarms.length }}
            <small><em>条</em></small>
          </strong>
          <p>重点预警 {{ park.keyAlarms.length }} 条</p>
        </div>
        <button class="ps-metric-link" type="button" aria-label="进入生产安全预警" @click.stop="go('production')">
          <PsIcon name="ArrowUpRight" :size="18" />
        </button>
      </article>

      <article>
        <div class="ps-metric-icon violet"><PsIcon name="Gauge" :size="22" /></div>
        <div>
          <span>园区整体风险指数</span>
          <strong>
            {{ park.overallIndex.toFixed(1) }}
            <small><em>分</em></small>
          </strong>
          <p>演示值 · 等级映射待确认</p>
        </div>
      </article>
    </section>

    <div class="park-overview__scenario">
      <div>
        <span class="park-overview__scenario-label">场景演示</span>
        <strong>{{ park.scenarioLabel }}</strong>
      </div>
      <div class="park-overview__scenario-actions">
        <button class="ps-button ps-button-small" type="button" @click="park.scenarioPrev()">上一步</button>
        <button class="ps-button ps-button-primary ps-button-small" type="button" @click="park.scenarioNext()">
          下一步
        </button>
        <button class="ps-button ps-button-small" type="button" @click="park.scenarioReset()">重置</button>
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
        <div class="park-op-stats">
          <div><small>进行中</small><b>{{ opStateCounts.ongoing }}</b></div>
          <div><small>待开工</small><b>{{ opStateCounts.pending }}</b></div>
          <div><small>暂停</small><b>{{ opStateCounts.paused }}</b></div>
          <div><small>已完成</small><b>{{ opStateCounts.completed }}</b></div>
        </div>
        <ul class="park-feed">
          <li v-for="op in park.operations.slice(0, 5)" :key="op.id">
            <div>
              <strong>{{ op.name }}</strong>
              <p>{{ op.summary }}</p>
            </div>
            <span :data-state="op.actualState">{{ OPERATION_STATE_LABEL[op.actualState] }}</span>
          </li>
        </ul>

        <header class="ps-panel-header park-overview__subhead">
          <h2><i class="ps-section-mark" />重点预警</h2>
          <span class="ps-count" :class="{ hot: park.keyAlarms.length }">{{ park.keyAlarms.length }}</span>
        </header>
        <ul class="park-feed">
          <li
            v-for="al in park.keyAlarms.slice(0, 4)"
            :key="al.id"
            class="park-feed__click"
            @click="park.selectUnit(al.unitId)"
          >
            <div>
              <strong>{{ al.type }}</strong>
              <p>{{ al.location }} · {{ al.summary }}</p>
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
            <small>可燃气体测点</small>
            <b>{{ park.alcohol.gasPointTotal }}</b>
            <span>报警点位 {{ park.alcohol.gasAlarmPoints }}</span>
          </div>
          <div>
            <small>泄漏待复核</small>
            <b class="ps-text-amber">{{ park.alcohol.leakPendingReview }}</b>
            <span>演示摘要</span>
          </div>
          <div class="park-alcohol__wide">
            <small>最近异常</small>
            <b>{{ park.alcohol.lastAbnormalAt || '暂无' }}</b>
          </div>
        </div>

        <header class="ps-panel-header park-overview__subhead">
          <h2><i class="ps-section-mark" />告警入口</h2>
        </header>
        <ul class="park-feed">
          <li
            v-for="al in park.pendingAlarms.slice(0, 4)"
            :key="al.id"
            class="park-feed__click"
            @click="park.selectUnit(al.unitId)"
          >
            <div>
              <strong>{{ al.type }}</strong>
              <p>{{ al.summary }}</p>
            </div>
            <span class="park-feed__tag">待处理</span>
          </li>
          <li v-if="!park.pendingAlarms.length" class="park-feed__empty">暂无待处理告警</li>
        </ul>

        <header class="ps-panel-header park-overview__subhead">
          <h2><i class="ps-section-mark" />车辆预警</h2>
        </header>
        <p class="park-feed__empty park-vehicle-empty">暂无演示记录</p>
      </aside>
    </section>

    <section class="park-overview__bottom" aria-label="底部动态">
      <div class="ps-panel">
        <header class="ps-panel-header">
          <h2><i class="ps-section-mark" />危险作业动态</h2>
        </header>
        <ul class="park-bottom-list">
          <li v-for="op in park.operations" :key="op.id">
            <time>{{ op.plannedStart.slice(11, 16) }}</time>
            <div>
              <strong>{{ op.name }}</strong>
              <span>{{ op.type }} · {{ OPERATION_STATE_LABEL[op.actualState] }}</span>
            </div>
          </li>
        </ul>
      </div>
      <div class="ps-panel">
        <header class="ps-panel-header">
          <h2><i class="ps-section-mark" />近期风险变化</h2>
        </header>
        <ul class="park-bottom-list">
          <li v-for="item in park.riskChanges.slice(0, 8)" :key="item.id">
            <time>{{ item.at.slice(11) }}</time>
            <div>
              <strong>{{ item.unitName }}</strong>
              <span>
                <i :style="{ background: RISK_LEVEL_COLOR[item.fromLevel] }" />
                →
                <i :style="{ background: RISK_LEVEL_COLOR[item.toLevel] }" />
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
