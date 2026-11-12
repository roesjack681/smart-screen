<script setup>
import { computed, ref } from 'vue'
import { formatTime } from '@/utils/safety/format'
const props = defineProps({ device: Object, frozen: { type: Boolean, default: false }, showThresholds: { type: Boolean, default: true }, minutes: { type: Number, default: 6 }, compact: Boolean })
const hovered = ref(null)
const svg = ref(null)
let frozenHistory = null
const samples = computed(() => {
  if (props.frozen && frozenHistory) return frozenHistory
  const history = props.device.history
  const latest = history.at(-1)?.t || Date.now()
  const selected = history.filter(point => point.t >= latest - props.minutes * 60000)
  frozenHistory = selected.map(point => ({ ...point }))
  return selected
})
const width = 900, height = 260
const pad = { top: 22, right: 22, bottom: 32, left: 52 }
const bounds = computed(() => {
  const values = samples.value.map(s => s.value)
  let low = Math.min(...values), high = Math.max(...values)
  if (props.showThresholds) { low = Math.min(low, props.device.rules.low); high = Math.max(high, props.device.rules.high) }
  const span = Math.max(high - low, props.device.unit === 'MPa' ? 0.04 : 8)
  return { low: low - span * 0.14, high: high + span * 0.18 }
})
const x = t => {
  const first = samples.value[0]?.t || 0, last = samples.value.at(-1)?.t || first + 1
  return pad.left + ((t - first) / Math.max(last - first, 1)) * (width - pad.left - pad.right)
}
const y = value => height - pad.bottom - ((value - bounds.value.low) / (bounds.value.high - bounds.value.low)) * (height - pad.top - pad.bottom)
const path = computed(() => samples.value.map((s, i) => `${i ? 'L' : 'M'} ${x(s.t).toFixed(2)} ${y(s.value).toFixed(2)}`).join(' '))
const fill = computed(() => samples.value.length ? `${path.value} L ${x(samples.value.at(-1).t)} ${height - pad.bottom} L ${pad.left} ${height - pad.bottom} Z` : '')
const ticks = computed(() => Array.from({ length: 5 }, (_, i) => bounds.value.low + (bounds.value.high - bounds.value.low) * i / 4))
const times = computed(() => samples.value.length ? Array.from({ length: 6 }, (_, i) => samples.value[Math.round((samples.value.length - 1) * i / 5)]) : [])
const suffix = computed(() => props.device.id.replace(/[^a-z0-9]/gi, '') + (props.compact ? 'mini' : 'full'))
const focused = computed(() => hovered.value === null ? null : samples.value[hovered.value])
function hover(event) {
  if (props.compact || !samples.value.length) return
  const rect = svg.value.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, ((event.clientX - rect.left) / rect.width * width - pad.left) / (width - pad.left - pad.right)))
  hovered.value = Math.round(ratio * (samples.value.length - 1))
}
</script>
<template>
  <div class="ps-trend-chart" :class="{ 'ps-chart-compact': compact }">
    <svg ref="svg" :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none" role="img" :aria-label="`${device.name}${device.metric}实时趋势，当前${device.value.toFixed(2)}${device.unit}`" @pointermove="hover" @pointerleave="hovered = null">
      <defs>
        <linearGradient :id="`area-${suffix}`" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#28d7ee" stop-opacity=".28"/><stop offset="100%" stop-color="#28d7ee" stop-opacity="0"/></linearGradient>
        <linearGradient :id="`line-${suffix}`"><stop stop-color="#249bda"/><stop offset="100%" stop-color="#4df1e5"/></linearGradient>
        <clipPath :id="`clip-${suffix}`"><rect :x="pad.left" :y="pad.top" :width="width-pad.left-pad.right" :height="height-pad.top-pad.bottom"/></clipPath>
      </defs>
      <g v-if="!compact" class="ps-chart-grid">
        <g v-for="tick in ticks" :key="tick"><line :x1="pad.left" :x2="width-pad.right" :y1="y(tick)" :y2="y(tick)"/><text :x="pad.left-12" :y="y(tick)+4" text-anchor="end">{{ tick.toFixed(device.unit === 'MPa' ? 2 : 0) }}</text></g>
        <g v-for="(time, i) in times" :key="i"><line :x1="x(time.t)" :x2="x(time.t)" :y1="pad.top" :y2="height-pad.bottom"/><text :x="x(time.t)" :y="height-8" :text-anchor="i === 0 ? 'start' : i === 5 ? 'end' : 'middle'">{{ formatTime(time.t, false) }}</text></g>
        <text x="8" y="13">{{ device.unit }}</text>
      </g>
      <g :clip-path="`url(#clip-${suffix})`">
        <rect v-if="showThresholds && !compact" :x="pad.left" :y="y(device.rules.high)" :width="width-pad.left-pad.right" :height="Math.max(0, y(device.rules.low)-y(device.rules.high))" fill="#1da6b0" opacity=".035"/>
        <path :d="fill" :fill="`url(#area-${suffix})`"/>
        <g v-if="showThresholds && !compact" class="ps-limit-line">
          <line :x1="pad.left" :x2="width-pad.right" :y1="y(device.rules.high)" :y2="y(device.rules.high)"/><line :x1="pad.left" :x2="width-pad.right" :y1="y(device.rules.low)" :y2="y(device.rules.low)"/>
          <text :x="width-pad.right-4" :y="y(device.rules.high)-7" text-anchor="end">高限 {{ device.rules.high }}{{ device.unit }}</text>
          <text :x="width-pad.right-4" :y="y(device.rules.low)+15" text-anchor="end">低限 {{ device.rules.low }}{{ device.unit }}</text>
        </g>
        <path :d="path" fill="none" :stroke="`url(#line-${suffix})`" :stroke-width="compact ? 3 : 2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
        <circle v-if="samples.length" :cx="x(samples.at(-1).t)" :cy="y(samples.at(-1).value)" r="compact ? 0 : 4" fill="#7dfff0" stroke="#102b40" stroke-width="2"/>
        <g v-if="focused"><line :x1="x(focused.t)" :x2="x(focused.t)" :y1="pad.top" :y2="height-pad.bottom" stroke="#83adbb" stroke-dasharray="4 4"/><circle :cx="x(focused.t)" :cy="y(focused.value)" r="4" fill="#fff"/></g>
      </g>
    </svg>
    <div v-if="focused && !compact" class="ps-chart-tooltip">{{ formatTime(focused.t) }} <b>{{ focused.value.toFixed(device.unit === 'MPa' ? 3 : 2) }} {{ device.unit }}</b></div>
  </div>
</template>
