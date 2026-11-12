<script setup>
import TrendChart from './TrendChart.vue'
import PsIcon from './PsIcon.vue'
import { metricValue, statusNames } from '@/utils/safety/format'
defineProps({ store: Object, detailed: Boolean })
defineEmits(['navigate', 'maintenance'])
</script>
<template>
  <section class="ps-panel ps-devices-panel"><header class="ps-panel-header"><h2><span class="ps-section-mark"></span>{{ detailed ? '??????' : '??????' }}<small>{{ store.state.devices.length }} ???</small></h2></header>
    <div class="ps-device-grid" :class="{ detailed }"><article v-for="device in store.state.devices" :key="device.id" :class="['ps-device-card', { selected: store.state.selectedDeviceId === device.id }]">
      <button class="ps-device-select" :aria-label="`??${device.name}??`" @click="store.state.selectedDeviceId = device.id"><div class="ps-device-top"><span class="ps-device-name"><PsIcon :name="device.unit === '?' ? 'Thermometer' : device.unit === 'MPa' ? 'Gauge' : 'Activity'" :size="16"/>{{ device.name }}</span><span :class="['ps-status-dot', store.deviceStatus(device)]" :title="statusNames[store.deviceStatus(device)]"></span></div><div class="ps-device-reading"><strong>{{ metricValue(device) }}<small>{{ device.unit }}</small></strong><span>{{ device.tag }}</span></div><TrendChart v-if="detailed" :device="device" :show-thresholds="false" compact/><div class="ps-device-bottom"><span>{{ device.area }}</span><span :class="`ps-state-text-${store.deviceStatus(device)}`">{{ statusNames[store.deviceStatus(device)] }}</span></div></button>
      <button v-if="detailed" class="ps-device-maintain" @click="$emit('maintenance', device)"><PsIcon name="Wrench" :size="14"/>????<PsIcon name="ChevronRight" :size="14"/></button>
    </article></div>
  </section>
</template>
