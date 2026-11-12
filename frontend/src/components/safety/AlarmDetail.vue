<script setup>
import { computed } from 'vue'
import BaseDialog from './BaseDialog.vue'
import PsIcon from './PsIcon.vue'
import { formatDate, formatTime } from '@/utils/safety/format'
const props = defineProps({ store: Object, alarm: Object })
const emit = defineEmits(['close', 'maintenance'])
const current = computed(() => props.store.state.alarms.find(a => a.id === props.alarm.id) || props.alarm)
const steps = computed(() => [ ['首次触发', current.value.startedAt, current.value.initialReading || current.value.reading],
  ...(current.value.escalatedAt ? [['升级为红色报警', current.value.escalatedAt, current.value.reading]] : []),
  ['人工确认', current.value.acknowledgedAt, current.value.acknowledgedAt ? '已确认并继续跟进' : '等待确认'],
  ['工况恢复', current.value.resolvedAt, current.value.resolvedAt ? `恢复读数：${current.value.lastReading}` : '尚未恢复，持续监测中'] ])
</script>
<template><BaseDialog title="预警事件详情" :subtitle="`${current.deviceName} · ${current.area} · ${current.deviceId}`" @close="emit('close')"><div class="ps-detail-heading"><span :class="['ps-badge', current.severity]">{{ current.severity === 'critical' ? '红色报警' : '黄色预警' }}</span><h3>{{ current.title }}</h3><span class="ps-subtle">{{ current.resolvedAt ? '已恢复' : current.acknowledgedAt ? '已确认，跟进中' : '等待确认' }}</span></div><div class="ps-detail-metrics"><div><span>触发读数</span><b>{{ current.reading }}</b></div><div><span>判定条件</span><b>{{ current.threshold }}</b></div></div><div class="ps-info-note"><PsIcon name="CircleAlert" :size="18"/><p>{{ current.suggestion }}</p></div><div class="ps-timeline"><div v-for="step in steps" :key="step[0]" :class="{ done: !!step[1] }"><i></i><h4>{{ step[0] }}<time>{{ step[1] ? formatDate(step[1]) + ' ' + formatTime(step[1]) : '待完成' }}</time></h4><p>{{ step[2] }}</p></div></div><div class="ps-dialog-actions"><button v-if="!current.resolvedAt" class="ps-button" @click="emit('maintenance', current)">生成维护工单</button><button v-if="!current.resolvedAt && !current.acknowledgedAt" class="ps-button ps-button-primary" @click="store.acknowledge(current.id)">确认告警</button><button v-else class="ps-button ps-button-primary" @click="emit('close')">完成</button></div></BaseDialog></template>
