<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts/core';
import { CustomChart, PieChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import type { CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from 'echarts';
import type { OperationState } from '@/types/park';
import { OPERATION_STATE_LABEL } from '@/types/park';

echarts.use([
  PieChart,
  CustomChart,
  TooltipComponent,
  SVGRenderer,
  UniversalTransition,
  LabelLayout,
]);

const props = defineProps<{
  counts: Record<OperationState, number>;
}>();

const chartEl = ref<HTMLElement | null>(null);
let chart: echarts.ECharts | null = null;
let resizeObs: ResizeObserver | null = null;
let toggleTimer: number | undefined;
let showParliament = true;

const segments: Array<{ key: OperationState; color: string }> = [
  { key: 'ongoing', color: '#F59A38' },
  { key: 'pending', color: '#438DFA' },
  { key: 'paused', color: '#EBCB4B' },
  { key: 'completed', color: '#4ED9B3' },
];

/** 半径：议会点阵与饼图共用；内径加大，避免中心数字贴环 */
const radius = ['44%', '78%'] as const;
const SERIES_KEY = 'op-state';

const chartData = computed(() =>
  segments.map((s) => ({
    name: OPERATION_STATE_LABEL[s.key],
    // 点阵需要一定座位密度；真实数量在图例展示
    value: Math.max(1, (props.counts[s.key] || 0) * 10),
    real: props.counts[s.key] || 0,
    itemStyle: { color: s.color },
  })),
);

const total = computed(() =>
  segments.reduce((sum, s) => sum + (props.counts[s.key] || 0), 0),
);

function parliamentLayout(
  startAngle: number,
  endAngle: number,
  totalAngle: number,
  r0: number,
  r1: number,
  size: number,
): Array<[number, number]> {
  const rowsCount = Math.ceil((r1 - r0) / size);
  const points: Array<[number, number]> = [];
  let r = r0;
  for (let i = 0; i < rowsCount; i++) {
    const totalRingSeatsNumber = Math.round((totalAngle * r) / size);
    const newSize = totalRingSeatsNumber > 0 ? (totalAngle * r) / totalRingSeatsNumber : size;
    for (
      let k = Math.floor((startAngle * r) / newSize) * newSize;
      k < Math.floor((endAngle * r) / newSize) * newSize - 1e-6;
      k += newSize
    ) {
      const angle = k / r;
      points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    }
    r += size;
  }
  return points;
}

function sharedChrome(): echarts.EChartsCoreOption {
  const data = chartData.value;
  return {
    animationDurationUpdate: 450,
    tooltip: {
      trigger: 'item',
      backgroundColor: '#102d41',
      borderColor: '#32677a',
      textStyle: { color: '#eaf3fa', fontSize: 13 },
      formatter: (params: any) => {
        const real = data.find((d) => d.name === params.name)?.real ?? params.value;
        return `${params.name}<br/>${real} 项`;
      },
    },
  };
}

function buildPieOption(): echarts.EChartsCoreOption {
  const data = chartData.value;
  return {
    ...sharedChrome(),
    series: [
      {
        type: 'pie',
        id: SERIES_KEY,
        center: ['50%', '50%'],
        radius: [...radius],
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderRadius: 2,
          borderColor: '#0a1c2c',
          borderWidth: 1,
        },
        universalTransition: {
          enabled: true,
          seriesKey: SERIES_KEY,
        },
        animationDurationUpdate: 450,
        data,
      },
    ],
  };
}

function buildParliamentOption(): echarts.EChartsCoreOption {
  const data = chartData.value;
  const sum = data.reduce((s, cur) => s + cur.value, 0) || 1;
  const angles: number[] = [];
  const startAngle = -Math.PI / 2;
  let curAngle = startAngle;
  data.forEach((item) => {
    angles.push(curAngle);
    curAngle += (item.value / sum) * Math.PI * 2;
  });
  angles.push(startAngle + Math.PI * 2);

  return {
    ...sharedChrome(),
    series: [
      {
        type: 'custom',
        id: SERIES_KEY,
        data,
        coordinateSystem: undefined,
        universalTransition: {
          enabled: true,
          seriesKey: SERIES_KEY,
        },
        animationDurationUpdate: 450,
        renderItem(params: CustomSeriesRenderItemParams, api: CustomSeriesRenderItemAPI) {
          const idx = params.dataIndex;
          const viewSize = Math.min(api.getWidth(), api.getHeight());
          const r0 = ((parseFloat(radius[0]) / 100) * viewSize) / 2;
          const r1 = ((parseFloat(radius[1]) / 100) * viewSize) / 2;
          const cx = api.getWidth() * 0.5;
          const cy = api.getHeight() * 0.5;
          const size = Math.max(5, viewSize / 22);

          const points = parliamentLayout(
            angles[idx],
            angles[idx + 1],
            Math.PI * 2,
            r0,
            r1,
            size + 2.5,
          );

          const color = data[idx]?.itemStyle.color || '#438DFA';
          return {
            type: 'group',
            children: points.map((pt) => ({
              type: 'circle',
              autoBatch: true,
              shape: {
                cx: cx + pt[0],
                cy: cy + pt[1],
                r: size / 2,
              },
              style: { fill: color },
            })),
          };
        },
      },
    ],
  };
}

function render(forceMode?: boolean): void {
  if (!chart) return;
  if (typeof forceMode === 'boolean') showParliament = forceMode;
  const option = showParliament ? buildParliamentOption() : buildPieOption();
  chart.setOption(option, true);
}

function toggleMode(): void {
  showParliament = !showParliament;
  render();
}

function init(): void {
  if (!chartEl.value) return;
  chart = echarts.init(chartEl.value, undefined, { renderer: 'svg' });
  showParliament = true;
  render();
  resizeObs = new ResizeObserver(() => chart?.resize());
  resizeObs.observe(chartEl.value);
  toggleTimer = window.setInterval(() => toggleMode(), 9000);
}

onMounted(() => init());
onBeforeUnmount(() => {
  if (toggleTimer) window.clearInterval(toggleTimer);
  resizeObs?.disconnect();
  chart?.dispose();
  chart = null;
});

watch(
  () => segments.map((s) => props.counts[s.key]).join(','),
  () => render(),
);
</script>

<template>
  <div class="op-ring">
    <div class="op-ring__plot">
      <div ref="chartEl" class="op-ring__chart" />
      <div class="op-ring__total"><strong>{{ total }}</strong><span>合计</span></div>
    </div>
    <ul class="op-ring__legend" aria-label="作业状态数量">
      <li v-for="segment in segments" :key="segment.key">
        <i :style="{ background: segment.color }" />
        <span>{{ OPERATION_STATE_LABEL[segment.key] }}</span>
        <b>{{ counts[segment.key] }}</b>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.op-ring {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 2px 12px 6px;
  min-height: 156px;
}

.op-ring__plot {
  min-width: 0;
  position: relative;
}

.op-ring__chart {
  width: 100%;
  height: 156px;
}

.op-ring__total {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.op-ring__total strong {
  color: #edf5fc;
  font: 600 15px/1 'Bahnschrift', 'Consolas', monospace;
}

.op-ring__total span {
  color: #a0bbce;
  font-size: 10px;
  margin-top: 2px;
}

.op-ring__legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.op-ring__legend li {
  display: grid;
  grid-template-columns: 8px 1fr auto;
  align-items: center;
  gap: 6px;
  color: #b7ccda;
  font-size: 12px;
}

.op-ring__legend i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.op-ring__legend b {
  color: #edf5fc;
  font: 600 14px/1 'Bahnschrift', 'Consolas', monospace;
}

@media (max-height: 820px) {
  .op-ring {
    min-height: 128px;
  }

  .op-ring__chart {
    height: 128px;
  }
}
</style>
