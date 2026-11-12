<script setup>
import { computed, ref } from 'vue'
import BaseDialog from './BaseDialog.vue'
import PsIcon from './PsIcon.vue'
import { formatDate } from '@/utils/safety/format'
const props = defineProps({ store: Object, data: Object, mode: { type: String, default: 'create' } })
const emit = defineEmits(['close', 'created'])
const deviceId = props.data?.deviceId || props.data?.id || props.store.state.selectedDeviceId
const isAlarm = !!props.data?.key
const form = ref({ deviceId, title: isAlarm ? props.data.title + '检查与处理' : '', owner: '', priority: props.data?.severity === 'critical' ? 'high' : 'medium', date: formatDate(props.store.state.time), note: '' })
const error = ref(''), result = ref(''), checks = ref([false, false, false])
const currentDevice = computed(() => props.store.state.devices.find(d => d.id === (props.mode === 'complete' ? props.data.deviceId : form.value.deviceId)))
function save() {
  if (props.mode === 'complete') {
    error.value = props.store.completeOrder(props.data.id, result.value, checks.value)
    if (!error.value) emit('close')
  } else {
    const created = props.store.createOrder({ ...form.value, plannedAt: Date.parse(`${form.value.date}T09:00:00+08:00`), source: isAlarm ? '告警转维护' : '人工创建', alarmId: isAlarm ? props.data.id : undefined })
    error.value = created.error || ''
    if (!error.value) { emit('created', created.order); emit('close') }
  }
}
</script>
<template><BaseDialog :title="mode === 'complete' ? '维护完工验收' : '新建维护工单'" :subtitle="mode === 'complete' ? data.title : '记录设备问题，安排负责人和维护计划'" @close="emit('close')"><form @submit.prevent="save"><template v-if="mode === 'create'"><label class="ps-field">关联设备<select v-model="form.deviceId" required><option v-for="device in store.state.devices" :key="device.id" :value="device.id">{{ device.name }} · {{ device.id }}</option></select></label><label class="ps-field">工单事项<input v-model="form.title" placeholder="例如：温度探头检查与校准" maxlength="80" required/></label><div class="ps-form-grid"><label class="ps-field">负责人<input v-model="form.owner" placeholder="请输入负责人" maxlength="30" required/></label><label class="ps-field">优先级<select v-model="form.priority"><option value="low">常规</option><option value="medium">优先</option><option value="high">紧急</option></select></label></div><label class="ps-field">计划日期<input v-model="form.date" type="date" required/></label><label class="ps-field">问题描述<textarea v-model="form.note" rows="3" placeholder="记录现象、检查内容或需要的备件" maxlength="500"></textarea></label><div class="ps-info-note"><PsIcon name="Wrench" :size="17"/><p>工单开始后进入维护模式，暂停该设备新告警。现有告警保留，信号恢复后记录恢复时间。</p></div></template><template v-else><div class="ps-acceptance-device"><PsIcon name="Cpu" :size="20"/><div><b>{{ currentDevice?.name }}</b><small>{{ currentDevice?.id }} · {{ data.owner }}</small></div><span class="ps-badge maintenance">维护中</span></div><label class="ps-field">维修与验收结果<textarea v-model="result" required rows="4" placeholder="填写处理措施、检修结果与试运行情况" maxlength="500"></textarea></label><div class="ps-checklist"><label v-for="(label, i) in ['现场维护工作已完成','设备试运行与状态检查正常','监测数据已恢复并核对']" :key="label"><input v-model="checks[i]" type="checkbox"/>{{ label }}</label></div><p class="ps-subtle">设备离线或仍有未恢复告警时，需先恢复工况再验收。</p></template><p v-if="error" class="ps-form-error" role="alert">{{ error }}</p><div class="ps-dialog-actions"><button class="ps-button" type="button" @click="emit('close')">取消</button><button class="ps-button ps-button-primary" type="submit">{{ mode === 'complete' ? '确认验收并恢复监测' : '创建工单' }}<PsIcon name="ChevronRight" :size="16"/></button></div></form></BaseDialog></template>
