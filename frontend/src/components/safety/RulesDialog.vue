<script setup>
import { ref, computed, watch } from 'vue'
import BaseDialog from './BaseDialog.vue'
import PsIcon from './PsIcon.vue'
const props = defineProps({ store: Object })
const emit = defineEmits(['close'])
const selected = ref(props.store.state.selectedDeviceId)
const form = ref({}), error = ref('')
const device = computed(() => props.store.state.devices.find(d => d.id === selected.value))
watch(selected, () => { form.value = { ...device.value.rules }; error.value = '' }, { immediate: true })
const fields = computed(() => [ ['criticalLow', '低低限 · 红色', device.value.unit], ['low', '低限 · 黄色', device.value.unit], ['high', '高限 · 黄色', device.value.unit], ['criticalHigh', '高高限 · 红色', device.value.unit], ['slopeWarning', '变化速率 · 黄色', `${device.value.unit}/min`], ['slopeCritical', '变化速率 · 红色', `${device.value.unit}/min`], ['durationSeconds', '超限持续时间', '秒'], ['offlineSeconds', '离线判定时长', '秒'], ['hysteresis', '阈值恢复回差', device.value.unit] ])
function save() { error.value = props.store.updateRules(selected.value, form.value); if (!error.value) emit('close') }
</script>
<template><BaseDialog title="预警规则配置" subtitle="规则按设备独立生效，保存后立即参与判定" wide @close="emit('close')"><form @submit.prevent="save"><label class="ps-field">监测设备<select v-model="selected"><option v-for="item in store.state.devices" :key="item.id" :value="item.id">{{ item.name }} · {{ item.tag }} · {{ item.metric }}</option></select></label><div class="ps-form-grid ps-rule-grid"><label v-for="field in fields" :key="field[0]" class="ps-field">{{ field[1] }}<span class="ps-input-unit"><input v-model.number="form[field[0]]" type="number" step="any" required :aria-label="field[1]"/><small>{{ field[2] }}</small></span></label></div><div class="ps-info-note"><PsIcon name="CircleAlert" :size="17"/><p>速率使用最近 15 秒内有效样本，按实际时间差计算绝对斜率。相同设备同类告警合并，红色升级会再次提醒；恢复需回到回差范围内。当前数值用于演示。</p></div><p v-if="error" class="ps-form-error" role="alert">{{ error }}</p><div class="ps-dialog-actions"><button type="button" class="ps-button" @click="emit('close')">取消</button><button class="ps-button ps-button-primary" type="submit"><PsIcon name="Check" :size="16"/>保存规则</button></div></form></BaseDialog></template>
