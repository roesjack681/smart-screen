<script setup>
import { computed, ref, watch } from 'vue'
import TrendChart from './TrendChart.vue'
import PsIcon from './PsIcon.vue'
import { metricValue } from '@/utils/safety/format'
const props = defineProps({ store: Object, expanded: Boolean })
const emit = defineEmits(['rules'])
const device = props.store.selectedDevice
const frozen = ref(false)
const minutes = ref(6)
const thresholds = ref(true)
watch(() => device.value.id, () => { frozen.value = false })
const stats = computed(() => {
  const values = device.value.history.map(p => p.value)
  const precision = device.value.unit === 'MPa' ? 3 : 1
  return { min: Math.min(...values).toFixed(precision), max: Math.max(...values).toFixed(precision), avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(precision) }
})
</script>
<template>
  <section class="ps-panel ps-trend-panel" :class="{ 'ps-trend-expanded': expanded }">
    <header class="ps-panel-header"><h2><span class="ps-section-mark"></span>实时运行趋势 <span class="ps-live"><i></i> LIVE</span></h2><div class="ps-inline-actions"><select v-model="store.state.selectedDeviceId" aria-label="选择趋势设备"><option v-for="item in store.state.devices" :key="item.id" :value="item.id">{{ item.name }} · {{ item.metric }}</option></select><button class="ps-icon-button" title="配置所选设备规则" aria-label="配置所选设备规则" @click="emit('rules')"><PsIcon name="Settings2" :size="17"/></button></div></header>
    <div class="ps-trend-topline"><div class="ps-current-reading"><span>{{ device.metric }}实时值</span><strong>{{ metricValue(device) }}<small>{{ device.unit }}</small></strong><span class="ps-slope" :class="Math.abs(device.slope || 0) >= device.rules.slopeWarning ? 'ps-text-amber' : ''"><PsIcon :name="device.slope >= 0 ? 'TrendingUp' : 'ArrowDownRight'" :size="15"/>{{ device.slope === null ? '等待样本' : `${device.slope > 0 ? '+' : ''}${device.slope.toFixed(2)} ${device.unit}/min` }}</span></div><div class="ps-chart-controls"><div class="ps-segmented"><button v-for="m in [1, 3, 6]" :key="m" :class="{ active: minutes === m }" @click="minutes = m">{{ m }}分钟</button></div><button class="ps-icon-button" :class="{ 'ps-text-amber': frozen }" :aria-label="frozen ? '恢复曲线更新' : '冻结曲线，预警继续运行'" :title="frozen ? '恢复曲线更新' : '冻结曲线，预警继续运行'" @click="frozen = !frozen"><PsIcon :name="frozen ? 'Play' : 'Pause'" :size="16"/></button></div></div>
    <div class="ps-chart-legend"><span><i class="ps-line-key"></i>{{ device.name }} / {{ device.tag }}</span><button class="ps-legend-button" :class="{ muted: !thresholds }" @click="thresholds = !thresholds"><i class="ps-line-key ps-dashed"></i>上下限</button><span v-if="frozen" class="ps-text-amber">曲线已冻结，预警持续运行</span><span v-if="!device.online" class="ps-text-red">信号已离线，显示最后有效数据</span></div>
    <TrendChart :device="device" :frozen="frozen" :minutes="minutes" :show-thresholds="thresholds"/>
    <div class="ps-trend-stats"><span>窗口均值 <b>{{ stats.avg }} <small>{{ device.unit }}</small></b></span><span>最高 <b>{{ stats.max }}</b></span><span>最低 <b>{{ stats.min }}</b></span><span class="ps-right">采样间隔 <b>1s</b><i class="ps-dot"></i>{{ device.online ? '数据更新中' : '等待设备连接' }}</span></div>
  </section>
</template>
