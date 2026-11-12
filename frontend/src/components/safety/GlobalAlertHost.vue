<script setup>
import { computed } from 'vue'
import PsIcon from './PsIcon.vue'
import { formatTime } from '@/utils/safety/format'
const props = defineProps({ store: Object })
const emit = defineEmits(['details', 'maintenance'])
const pending = computed(() => props.store.pendingAlarms.value)
const alarm = computed(() => pending.value[0])
const severity = computed(() => props.store.highestSeverity.value)
const liveCount = computed(() => props.store.activeAlarms.value.length)
function openRelated(action) {
  const current = alarm.value
  if (!current) return
  // Let the operator read or edit the related dialog; the risk border remains visible.
  props.store.snooze(current.id)
  emit(action, current)
}
</script>
<template>
  <Teleport to="body">
    <div class="ps-global-root" :data-severity="severity">
      <div v-if="severity !== 'normal'" :class="['ps-screen-alert', severity]" aria-hidden="true"></div>
      <div class="ps-sr-only" role="status" aria-live="assertive" aria-atomic="true">{{ alarm ? `${alarm.severity === 'critical' ? '红色报警' : '黄色预警'}：${alarm.deviceName}，${alarm.title}，${alarm.reading}` : '' }}</div>
      <Transition name="ps-alert">
        <aside v-if="alarm" :key="`${alarm.id}-${alarm.severity}`" :class="['ps-alert-popup', alarm.severity]" role="alertdialog" aria-modal="false" :aria-labelledby="`alarm-title-${alarm.id}`" :aria-describedby="`alarm-desc-${alarm.id}`" tabindex="-1">
          <div class="ps-alert-top"><span><PsIcon name="Radio" :size="14"/> 全局安全通知</span><button class="ps-icon-button" aria-label="收起弹窗，60秒后再次提醒" @click="store.snooze(alarm.id)"><PsIcon name="X"/></button></div>
          <div class="ps-alert-heading"><span class="ps-alert-symbol"><PsIcon name="BellRing" :size="27"/></span><div><span class="ps-alert-level">{{ alarm.severity === 'critical' ? '红色报警 · 立即关注' : '黄色预警 · 及时核查' }}</span><h2 :id="`alarm-title-${alarm.id}`">{{ alarm.title }}</h2></div><span class="ps-alert-time">{{ formatTime(alarm.startedAt) }}</span></div>
          <p class="ps-alert-device">{{ alarm.deviceName }} <span>{{ alarm.area }} · {{ alarm.deviceId }}</span></p>
          <div class="ps-alert-measure"><div><small>触发读数</small><strong>{{ alarm.reading }}</strong></div><div><small>判定条件</small><span>{{ alarm.threshold }}</span></div></div>
          <p :id="`alarm-desc-${alarm.id}`" class="ps-alert-suggestion">{{ alarm.suggestion }}</p>
          <div class="ps-alert-actions"><button class="ps-button ps-button-alert" @click="store.acknowledge(alarm.id)"><PsIcon name="Check" :size="16"/>确认告警</button><button class="ps-button" @click="openRelated('maintenance')">生成工单</button><button class="ps-link-button" @click="openRelated('details')">详情 <PsIcon name="ChevronRight" :size="14"/></button></div>
          <div class="ps-alert-foot"><span>{{ pending.length > 1 ? `另有 ${pending.length - 1} 条待确认` : '各页面持续监测' }}</span><span>{{ liveCount }} 条未恢复 · 确认后继续跟踪</span></div>
        </aside>
      </Transition>
      <Transition name="ps-toast"><div v-if="store.state.notice" class="ps-toast" role="status"><PsIcon name="CircleCheck" :size="18"/>{{ store.state.notice }}</div></Transition>
    </div>
  </Teleport>
</template>
