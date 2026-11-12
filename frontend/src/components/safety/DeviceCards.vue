<script setup lang="ts">
import { computed, ref } from 'vue';
import PsIcon from './PsIcon.vue';
import { metricValue, statusNames } from '@/utils/safety/format';
import type { SafetyBridge } from '@/composables/useSafetyBridge';
import type { SafetyAlarm } from '@/types/safety';
const props = defineProps<{ store: SafetyBridge }>();
const emit = defineEmits<{ details: [alarm: SafetyAlarm] }>();
const domain = ref('all');
const devices = computed(() => props.store.state.devices.filter(device => device.domain!=='warehouse' && (domain.value === 'all' || device.domain === domain.value)));
function eventAlarm(id: string) { return props.store.activeAlarms.value.find(alarm => alarm.deviceId === id); }
</script>
<template>
  <section class="ps-panel ps-devices-panel">
    <header class="ps-panel-header"><h2><span class="ps-section-mark" />重点风险监测</h2><select v-model="domain" aria-label="筛选监测对象"><option value="all">全部测点 · 8</option><option value="process">提取工艺 · 4</option><option value="storage">地埋储罐 · 2</option><option value="gas">可燃气体 · 2</option><option value="leak">泄漏信号 · 3</option></select></header>
    <div v-if="domain !== 'leak'" class="ps-device-grid production-devices">
      <article v-for="device in devices" :key="device.id" :class="['ps-device-card', store.deviceStatus(device), { selected: store.state.selectedDeviceId === device.id }]">
        <button type="button" class="ps-device-select" :title="`${device.area} · ${device.tag} · ${statusNames[store.deviceStatus(device)]}`" :aria-label="`查看${device.name}${device.metric}趋势`" :aria-pressed="store.state.selectedDeviceId === device.id" @click="store.selectDevice(device.id)">
          <div class="ps-device-top"><span class="ps-device-name">{{ device.name }}</span><span :class="['ps-status-dot', store.deviceStatus(device)]" :title="statusNames[store.deviceStatus(device)]" /></div>
          <div class="ps-device-reading"><strong>{{ metricValue(device) }}<small>{{ device.unit }}</small></strong><span>{{ device.metric === '可燃气体浓度' ? '浓度' : device.metric }}</span></div>
        </button>
      </article>
    </div>
    <div v-else class="production-event-list">
      <article v-for="event in store.state.events" :key="event.id" :class="{ active:event.active, review:!event.active && eventAlarm(event.id) }">
        <PsIcon :name="event.id === 'LEAK-TNK' ? 'Droplets' : 'Flame'" :size="21" /><div><b>{{ event.name }}</b><small>{{ event.source }}</small><span>{{ event.active ? '报警信号触发' : eventAlarm(event.id) ? '信号恢复 · 待人工复核' : '未触发' }}</span></div>
        <button v-if="eventAlarm(event.id)" class="ps-link-button" @click="emit('details', eventAlarm(event.id)!)">详情</button>
      </article>
      <p>视频与检测事件均为模拟信号；红色事件需现场核验、信号恢复后人工复核解除。</p>
    </div>
    <div class="production-monitor-note"><PsIcon name="CircleAlert" :size="12" />{{ domain === 'leak' ? '联动操作仅展示处置建议' : '数值阈值为演示配置，可在趋势图右上角调整' }}</div>
  </section>
</template>
<style scoped>
.production-devices { flex:1; min-height:0; overflow:auto; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); grid-auto-rows:minmax(48px,1fr); align-content:start; padding:7px; gap:5px; }
.production-devices .ps-device-select { height:100%; padding:5px 9px; }
.production-devices .ps-device-reading { margin-top:4px; }
.production-devices .ps-device-reading strong { font-size:21px; }
.production-devices .ps-device-reading small { font-size:9px; margin-left:3px; }
.production-devices .ps-device-reading > span { letter-spacing:0; font-size:9px; }
.production-devices .ps-device-bottom { margin-top:3px; font-size:8px; }
.production-devices .ps-device-name { font-size:10px; }
.production-devices .ps-device-card.warning { border-color:#ad853c80; background:#79612716; }
.production-devices .ps-device-card.critical { border-color:#c45a6a90; background:#7e374b28; }
.production-monitor-note { flex-shrink:0; display:flex; gap:5px; align-items:center; padding:5px 10px; font-size:9px; color:#7099ad; border-top:1px solid #234254; background:#0d28394d; }
.production-event-list { flex:1; overflow:auto; padding:10px; display:flex; flex-direction:column; gap:9px; }
.production-event-list article { display:flex; align-items:center; gap:10px; padding:13px 10px; border:1px solid #2b4b5d; border-radius:4px; color:#6eb7b6; background:#16374630; }
.production-event-list article.active,.production-event-list article.review { border-color:#ad4c5a80; color:#ff7d88; background:#572a3e40; }
.production-event-list article > div { flex:1; }
.production-event-list b { display:block; font-size:12px; color:#c0d6e0; font-weight:500; }
.production-event-list small { display:block; font-size:9px; margin:5px 0; color:#7495a9; }
.production-event-list span,.production-event-list > p { font-size:10px; line-height:1.7; }
.production-event-list > p { color:#6c94ac; }
</style>
