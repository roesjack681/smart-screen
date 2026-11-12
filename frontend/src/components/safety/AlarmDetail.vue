<script setup lang="ts">
import { computed, ref } from 'vue';
import BaseDialog from './BaseDialog.vue';
import PsIcon from './PsIcon.vue';
import { formatDate, formatTime } from '@/utils/safety/format';
import type { SafetyBridge } from '@/composables/useSafetyBridge';
import type { SafetyAlarm } from '@/types/safety';
const props = defineProps<{ store: SafetyBridge; alarm: SafetyAlarm }>();
const emit = defineEmits<{ close: [] }>();
const reviewer = ref(''), note = ref(''), checked = ref(false), error = ref('');
const current = computed(() => props.store.state.alarms.find(a => a.id === props.alarm.id) || props.alarm);
const status = computed(() => current.value.resolvedAt ? (current.value.resolutionReason || '已解除') : current.value.clearedAt ? '信号已恢复 · 待人工复核' : current.value.acknowledgedAt ? '已确认 · 处置跟进中' : '等待确认');
const steps = computed(() => [
  { label: '首次触发', time: current.value.startedAt, text: current.value.initialReading || current.value.reading },
  ...(current.value.escalatedAt ? [{ label: '升级为红色报警', time: current.value.escalatedAt, text: current.value.reading }] : []),
  { label: '告警确认', time: current.value.acknowledgedAt, text: current.value.acknowledgedAt ? '已收到告警，持续跟进处置' : '等待确认；确认不代表解除' },
  { label: '信号恢复', time: current.value.clearedAt, text: current.value.clearedAt ? `恢复信息：${current.value.lastReading}` : '信号尚未恢复，请核查现场工况' },
  ...(current.value.severity === 'critical' ? [{ label: '人工复核解除', time: current.value.reviewedAt, text: current.value.reviewedAt ? `${current.value.reviewer}：${current.value.reviewNote}` : current.value.resolutionReason === '演示场景重置' ? '演示控制台已切换场景，上一轮记录保留' : '信号恢复后，记录现场复核结果再解除红色提醒' }] : []),
]);
function submitReview() {
  if (!checked.value) { error.value = '请确认已完成现场核验'; return; }
  error.value = props.store.review(current.value.id, reviewer.value, note.value);
  if (!error.value) emit('close');
}
</script>
<template>
  <BaseDialog title="预警事件详情" :subtitle="`${current.deviceName} · ${current.area} · ${current.deviceId}`" @close="emit('close')">
    <div class="ps-detail-heading"><span :class="['ps-badge',current.severity]">{{ current.severity === 'critical' ? '红色报警' : '黄色预警' }}</span><h3>{{ current.title }}</h3></div>
    <p class="detail-state" :class="{ red:!current.resolvedAt && current.severity === 'critical' }">{{ status }}</p>
    <div class="ps-detail-metrics"><div><span>{{current.resolvedAt ? '解除时读数' : '实时读数 / 事件'}}</span><b>{{ current.lastReading || current.reading }}</b><small>触发：{{current.initialReading || current.reading}}</small></div><div><span>判定条件</span><b>{{ current.threshold }}</b></div></div>
    <div class="detail-source"><span>{{ current.source }}</span><span>{{ current.ruleRef }}</span></div>
    <div class="ps-info-note"><PsIcon name="CircleAlert" :size="18" /><p><b>处置建议</b> {{ current.suggestion }}<small>请按现场规程执行；演示未执行联动控制。</small></p></div>
    <div class="ps-timeline"><div v-for="step in steps" :key="step.label" :class="{done:!!step.time}"><i /><h4>{{ step.label }}<time>{{ step.time ? formatDate(step.time)+' '+formatTime(step.time) : '待完成' }}</time></h4><p>{{ step.text }}</p></div></div>
    <form v-if="current.severity === 'critical' && !current.resolvedAt" class="detail-review" @submit.prevent="submitReview">
      <h4><PsIcon name="ShieldCheck" :size="16" />现场复核</h4>
      <p v-if="!current.clearedAt" class="ps-subtle">报警信号尚未恢复。先核查处置；演示时可通过控制台恢复信号，再完成复核。</p>
      <template v-else><label class="ps-field">复核人<input v-model="reviewer" required minlength="2" maxlength="30" placeholder="请输入复核人" /></label><label class="ps-field">现场复核结果<textarea v-model="note" required minlength="4" maxlength="300" rows="2" placeholder="记录现场检查、异常原因与处置结果" /></label><label class="review-check"><input v-model="checked" type="checkbox" required />已现场核验，确认异常消除、具备恢复条件</label><p v-if="error" class="ps-form-error" role="alert">{{ error }}</p><button type="submit" class="ps-button ps-button-primary">记录复核并解除本事件</button></template>
    </form>
    <div class="ps-dialog-actions"><button v-if="!current.resolvedAt && !current.acknowledgedAt" class="ps-button ps-button-primary" @click="store.acknowledge(current.id)">确认告警</button><button class="ps-button" @click="emit('close')">关闭</button></div>
  </BaseDialog>
</template>
<style scoped>
.detail-state { margin-top:9px; color:#7bb7bd; font-size:11px; }.detail-state.red { color:#ff7d88; }
.detail-source { display:flex; flex-wrap:wrap; gap:6px 16px; font-size:10px; color:#64a6bc; margin:-6px 0 16px; }
.ps-info-note small { display:block; color:#7194a8; margin-top:5px; font-size:10px; }
.detail-review { padding:14px; border:1px solid #386075; border-radius:4px; margin-top:19px; background:#12324740; }
.detail-review h4 { display:flex; align-items:center; gap:7px; color:#89c5d5; font-size:12px; margin-bottom:12px; }
.detail-review .ps-field { margin-top:12px; }
.detail-review textarea { resize:vertical; width:100%; }
.review-check { display:flex; align-items:center; gap:8px; color:#9bb8c8; font-size:11px; margin:12px 0; }
.review-check input { width:14px; height:14px; accent-color:#2dc4db; }
</style>
