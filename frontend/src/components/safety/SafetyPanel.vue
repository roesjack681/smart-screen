<script setup lang="ts">
import { computed, shallowRef, ref } from 'vue';
import TrendPanel from './TrendPanel.vue';
import DeviceCards from './DeviceCards.vue';
import AlertTable from './AlertTable.vue';
import RulesDialog from './RulesDialog.vue';
import RuleBasis from './RuleBasis.vue';
import AlarmDetail from './AlarmDetail.vue';
import PsIcon from './PsIcon.vue';
import WarehouseBoard from './WarehouseBoard.vue';
import {inspectionAdvice,warehouses} from '@/data/safety/warehouse';
import type { SafetyBridge } from '@/composables/useSafetyBridge';
import type { SafetyAlarm } from '@/types/safety';
const props = defineProps<{ store: SafetyBridge }>();
const rulesOpen = ref(false), basisOpen = ref(false);
const detail = shallowRef<SafetyAlarm | null>(null);
const mode=ref('warehouse');
// 顶部统计完整红色处置闭环；reviewAlarms 仅表示信号已恢复、可以提交复核的子集。
const warehouseRedPendingReview = computed(() => props.store.activeAlarms.value.filter(a=>a.domain==='warehouse' && a.severity==='critical'));
const metrics = computed(() => mode.value==='warehouse' ? [
  {label:'监测库房 / 垛位',value:`${warehouses.length} / ${props.store.state.devices.filter(d=>d.stack).length}`,icon:'Layers',level:''},
  {label:'到期温检垛位',value:props.store.state.devices.filter(d=>d.stack && inspectionAdvice(d,props.store.state.time).due).length,icon:'ClipboardList',level:'warning'},
  {label:'仓储跟踪事件',value:props.store.activeAlarms.value.filter(a=>a.domain==='warehouse').length,icon:'BellRing',level:'critical'},
  {label:'红色待复核',value:warehouseRedPendingReview.value.length,icon:'ShieldCheck',level:warehouseRedPendingReview.value.length?'critical':''},
] : [
  { label: '在线仪表测点', value: `${props.store.state.devices.filter(d => !d.stack && d.online).length} / ${props.store.state.devices.filter(d => !d.stack).length}`, icon: 'Radio', level: '' },
  { label: '黄色预警', value: props.store.activeAlarms.value.filter(a => a.severity === 'warning').length, icon: 'AlertTriangle', level: 'warning' },
  { label: '红色报警', value: props.store.activeAlarms.value.filter(a => a.severity === 'critical').length, icon: 'BellRing', level: 'critical' },
  { label: '信号恢复待复核', value: props.store.reviewAlarms.value.length, icon: 'ClipboardList', level: props.store.reviewAlarms.value.length ? 'critical' : '' },
]);
function openDetail(alarm: SafetyAlarm): void {
  if (!alarm.resolvedAt && !alarm.acknowledgedAt) props.store.snooze(alarm.id);
  detail.value = alarm;
}
</script>
<template>
  <div class="production-panel" :class="{'warehouse-layout':mode==='warehouse'}">
    <section class="ps-warning-overview" aria-label="生产预警概况">
      <div v-for="item in metrics" :key="item.label"><span :class="['ps-mini-symbol', item.level]"><PsIcon :name="item.icon" :size="20" /></span><span><small>{{ item.label }}</small><strong>{{ item.value }}</strong></span></div>
      <div class="production-switches"><div><button :class="{active:mode==='warehouse'}" @click="mode='warehouse'">原料仓储</button><button :class="{active:mode==='process'}" @click="mode='process';store.selectDevice('EXT-01')">生产工艺</button></div><button class="production-basis-button" @click="basisOpen=true">资料判定依据 <PsIcon name="ChevronRight" :size="12"/></button></div>
    </section>
    <WarehouseBoard v-if="mode==='warehouse'" :store="store"><AlertTable :store="store" default-domain="warehouse" @details="openDetail" /></WarehouseBoard>
    <div v-else class="production-monitor-grid"><TrendPanel :store="store" @rules="rulesOpen = true" /><DeviceCards :store="store" @details="openDetail" /></div>
    <AlertTable v-if="mode==='process'" :store="store" default-domain="all" @details="openDetail" />
  </div>
  <RulesDialog v-if="rulesOpen" :store="store" @close="rulesOpen = false" />
  <RuleBasis v-if="basisOpen" @close="basisOpen = false" />
  <AlarmDetail v-if="detail" :store="store" :alarm="detail" @close="detail = null" />
</template>
<style scoped>
.production-panel { height:100%; min-height:0; overflow:auto; display:grid; grid-template-rows:60px minmax(326px,1.5fr) minmax(145px,.7fr); gap:10px; padding-bottom:2px; }
.production-panel.warehouse-layout { grid-template-rows:60px minmax(0,1fr); }
.production-switches{display:flex;flex-direction:column;gap:5px;align-items:flex-end}.production-switches>div{display:flex;border:1px solid #216782;background:#0c263c}.production-switches>div button{padding:5px 18px;font-size:11px;border:0;background:transparent;color:#6aacc8}.production-switches>div button.active{color:#9ff5ff;background:#14627b;box-shadow:inset 0 -2px #20def6}.production-switches .production-basis-button{font-size:9px;padding:0;border:0;background:transparent}
.ps-warning-overview { padding:8px 18px; gap:16px; border-radius:0;border-color:#226185;background:linear-gradient(110deg,#0b2b44,#081a2b); }
.ps-mini-symbol{border-radius:0;width:34px;height:34px;background:#0c3a54;}
.ps-warning-overview strong { font-size:25px; line-height:1.1; }
.production-basis-button { display:flex; align-items:center; gap:9px; padding:7px 10px; background:#12405740; color:#61c8d4; border:1px solid #2d6a7b70; border-radius:4px; text-align:left; font-size:11px; }
.production-basis-button:hover { border-color:#42c4d5; }
.production-basis-button small { display:block; margin-top:4px; color:#79a3b9; font-size:9px; }
.production-monitor-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(350px,31%); gap:12px; min-height:0; }
.production-monitor-grid :deep(.ps-trend-panel), .production-monitor-grid :deep(.ps-devices-panel) { display:flex; flex-direction:column; min-height:0; }
.production-monitor-grid :deep(.ps-trend-chart) { flex:1; min-height:95px; height:auto; }
.production-monitor-grid :deep(.ps-panel-header) { min-height:41px; flex-shrink:0; }
.production-panel :deep(.ps-alert-table) { display:flex; flex-direction:column; min-height:0; }
.production-panel :deep(.ps-table-scroll) { flex:1; min-height:0; overflow:auto; }
.production-panel :deep(thead) { position:sticky; top:0; z-index:1; }
.production-panel :deep(.ps-table-toolbar) { flex-shrink:0; padding:7px 16px; gap:10px; }
.production-panel :deep(.ps-alert-table .ps-panel-header) { min-height:39px; flex-shrink:0; }
.production-panel,
.production-panel :deep(.ps-table-scroll),
.production-panel :deep(.production-devices),
.production-panel :deep(.production-event-list) { scrollbar-width:none; -ms-overflow-style:none; }
.production-panel::-webkit-scrollbar,
.production-panel :deep(.ps-table-scroll::-webkit-scrollbar),
.production-panel :deep(.production-devices::-webkit-scrollbar),
.production-panel :deep(.production-event-list::-webkit-scrollbar) { display:none; width:0; height:0; }
@media(max-width:1000px) {
  .production-panel { display:flex; flex-direction:column; }
  .production-panel :deep(.warehouse-board) { flex:none; }
  .ps-warning-overview { flex-wrap:wrap; flex-shrink:0; gap:12px; }
  .production-basis-button { margin-left:auto; }
  .production-monitor-grid { grid-template-columns:minmax(0,1fr); flex-shrink:0; }
  .production-monitor-grid :deep(.ps-trend-panel) { min-height:330px; }
  .production-monitor-grid :deep(.ps-devices-panel) { min-height:310px; }
  .production-panel :deep(.ps-alert-table) { min-height:300px; flex-shrink:0; }
}
</style>
