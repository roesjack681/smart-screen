<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import PsIcon from './PsIcon.vue';
import { formatTime, formatDate } from '@/utils/safety/format';
import type { SafetyBridge } from '@/composables/useSafetyBridge';
import type { SafetyAlarm } from '@/types/safety';
import { domainNames } from '@/data/safety/mock';

const props = defineProps<{ store: SafetyBridge; defaultDomain?:string }>();
const emit = defineEmits<{ details: [alarm: SafetyAlarm] }>();
const status = ref('all');
const severity = ref('all');
const domain = ref(props.defaultDomain || 'all');
watch(()=>props.defaultDomain,value=>{domain.value=value || 'all';});
const search = ref('');
const matchingAlarms = computed(() => props.store.state.alarms.filter(a =>
  (severity.value === 'all' || a.severity === severity.value) &&
  (domain.value === 'all' || a.domain === domain.value) &&
  `${a.deviceName}${a.deviceId}${a.title}${a.area}`.toLowerCase().includes(search.value.trim().toLowerCase()),
));
const tabs = computed(() => [
  { key:'all', label:'全部记录', count:matchingAlarms.value.length },
  { key:'unacknowledged', label:'待确认', count:matchingAlarms.value.filter(a=>!a.resolvedAt && !a.acknowledgedAt).length },
  { key:'acknowledged', label:'跟进中', count:matchingAlarms.value.filter(a=>!a.resolvedAt && a.acknowledgedAt).length },
  { key:'review', label:'待复核', count:matchingAlarms.value.filter(a=>!a.resolvedAt && a.severity==='critical').length },
  { key:'resolved', label:'已解除', count:matchingAlarms.value.filter(a=>a.resolvedAt).length },
]);
const rows = computed(() => matchingAlarms.value.filter(a =>
  status.value === 'all' || (status.value === 'review' ? !a.resolvedAt && a.severity === 'critical' : a.status === status.value),
));
</script>

<template>
  <section class="ps-panel ps-alert-table">
    <header class="ps-panel-header"><h2><span class="ps-section-mark" />预警事件中心</h2><span class="ps-subtle">发现异常 → 确认处置 → 信号恢复 → 红色人工复核</span></header>
    <div class="ps-table-toolbar">
      <div class="ps-table-tabs" aria-label="告警状态筛选">
        <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: status === tab.key }" :aria-pressed="status === tab.key" :title="tab.key==='review'?'尚未完成复核的红色事件；信号恢复后可提交人工复核':undefined" @click="status = tab.key">{{ tab.label }}<span>{{ tab.count }}</span></button>
      </div>
      <div class="ps-table-filters">
        <label class="ps-search"><PsIcon name="Search" :size="15" /><input v-model="search" placeholder="搜索设备 / 预警" aria-label="搜索预警" /></label>
        <select v-model="domain" aria-label="筛选预警类别"><option value="all">全部类别</option><option v-for="(name,key) in domainNames" :key="key" :value="key">{{ name }}</option></select>
        <select v-model="severity" aria-label="筛选预警级别"><option value="all">全部级别</option><option value="warning">黄色预警</option><option value="critical">红色报警</option></select>
      </div>
    </div>
    <div class="ps-table-scroll">
      <table>
        <thead><tr><th>触发时间</th><th>设备 / 区域</th><th>预警内容</th><th>实时读数 / 触发留档</th><th>级别</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="alarm in rows" :key="alarm.id" :class="{ 'ps-row-active': !alarm.resolvedAt }">
            <td><b>{{ formatTime(alarm.startedAt) }}</b><small>{{ formatDate(alarm.startedAt) }}</small></td>
            <td><b>{{ alarm.deviceName }}</b><small>{{ alarm.area }} · {{ alarm.deviceId }}</small></td>
            <td><b>{{ alarm.title }}</b><small>{{ alarm.source }}</small></td><td class="ps-mono alarm-live-reading"><b>{{ alarm.lastReading || alarm.reading }}</b><small>{{alarm.resolvedAt ? '解除时读数' : alarm.clearedAt ? '信号已恢复' : '实时更新'}} · 触发：{{alarm.initialReading || alarm.reading}}</small></td>
            <td><span :class="['ps-badge', alarm.severity]">{{ alarm.severity === 'critical' ? '红色报警' : '黄色预警' }}</span></td>
            <td><span :class="['ps-badge', !alarm.resolvedAt && alarm.clearedAt ? 'critical' : alarm.status]">{{ alarm.resolvedAt ? '已解除' : alarm.clearedAt ? '待人工复核' : alarm.acknowledgedAt ? '跟进中' : '待确认' }}</span></td>
            <td><div class="ps-row-actions"><button type="button" class="ps-link-button" @click="emit('details', alarm)">{{ !alarm.resolvedAt && alarm.clearedAt ? '复核' : '详情' }}</button><button v-if="!alarm.resolvedAt && !alarm.acknowledgedAt" type="button" class="ps-link-button" @click="store.acknowledge(alarm.id)">确认</button></div></td>
          </tr>
        </tbody>
      </table>
      <div v-if="!rows.length" class="ps-empty"><PsIcon name="ShieldCheck" :size="30" /><h3>暂无符合条件的预警</h3><p>调整筛选条件，或通过演示控制台注入异常工况。</p></div>
    </div>
  </section>
</template>

<style scoped>
.ps-table-toolbar { gap:12px; padding:12px 14px; }
.ps-table-tabs { gap:16px; }
.ps-table-tabs button { font-size:12px; }
.ps-table-tabs button > span { font-size:11px; }
.ps-table-filters { gap:7px; }
.ps-table-filters select { min-height:34px; padding:5px 9px; font-size:12px; }
.ps-search { min-height:34px; }
.ps-search input { font-size:12px; }
.ps-table-scroll table { font-size:12px; }
.ps-table-scroll th { padding:12px 12px; font-size:11px; }
.ps-table-scroll td { padding:14px 12px; }
.ps-table-scroll td b { font-size:13px; line-height:1.5; }
.ps-table-scroll td small { margin-top:5px; color:#80a8c0; font-size:11px; line-height:1.5; }
.ps-table-scroll .ps-badge { font-size:11px; padding:4px 8px; }
.ps-table-scroll .ps-link-button { font-size:12px; }
.alarm-live-reading b { font-size:12px !important; }
.alarm-live-reading small { max-width:360px; white-space:normal; }
@media(max-width:1250px) {
  .ps-table-toolbar { justify-content:flex-start; }
  .ps-table-tabs { gap:12px; }
  .ps-table-tabs button { font-size:11px; }
}
@media(max-width:680px) {
  .ps-table-toolbar { padding:12px; }
  .ps-table-tabs { gap:14px; overflow-x:auto; }
  .ps-table-tabs button { font-size:12px; }
  .ps-table-scroll th,
  .ps-table-scroll td { padding:12px 10px; }
}
</style>
