<script setup lang="ts">
import { computed } from 'vue';
import { useParkStore } from '@/stores/park';
import { RISK_LEVEL_COLOR, RISK_LEVEL_LABEL, type RiskLevel, type RiskUnit } from '@/types/park';
import PsIcon from '@/components/safety/PsIcon.vue';

const park = useParkStore();
const levels: RiskLevel[] = ['red', 'orange', 'yellow', 'blue'];

const unitPositions = computed(() => {
  const map = new Map<string, { left: string; top: string }>();
  const orderedUnits = [...park.units].sort((a, b) => a.gridZ - b.gridZ || a.gridX - b.gridX);
  orderedUnits.forEach((unit, index) => {
    const row = Math.floor(index / 4);
    const col = index % 4;
    map.set(unit.id, { left: `${13 + col * 24.7}%`, top: `${20 + row * 30}%` });
  });
  return map;
});

const operationByUnit = computed(() => {
  const result = new Map<string, number>();
  for (const op of park.ongoingOps) result.set(op.unitId, (result.get(op.unitId) || 0) + 1);
  return result;
});

function positionOf(unit: RiskUnit): Record<string, string> {
  const position = unitPositions.value.get(unit.id);
  return position ? { left: position.left, top: position.top } : {};
}

function selectUnit(unit: RiskUnit): void {
  park.selectUnit(unit.id);
}
</script>

<template>
  <div class="park-map-distribution">
    <div class="park-map-distribution__summary">
      <div class="park-map-distribution__total">
        <span>风险单元</span>
        <strong>{{ park.units.length }}<small> 个</small></strong>
      </div>
      <div class="park-map-distribution__levels">
        <button
          v-for="level in levels"
          :key="level"
          type="button"
          :class="{ active: park.levelFilter === level }"
          :style="{ '--level': RISK_LEVEL_COLOR[level] }"
          @click="park.toggleLevelFilter(level)"
        >
          <i />
          <span>{{ RISK_LEVEL_LABEL[level].replace('风险', '') }}</span>
          <b>{{ park.levelCounts[level] }}</b>
        </button>
        <button
          v-if="park.levelFilter"
          class="park-map-distribution__clear"
          type="button"
          @click="park.toggleLevelFilter(park.levelFilter)"
        >
          清除筛选
        </button>
      </div>
    </div>

    <div class="park-map-distribution__canvas" aria-label="园区风险单元二维示意分布图">
      <div class="park-map-distribution__orientation">布局示意 · 非实地坐标</div>
      <svg class="park-map-distribution__plan" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id="map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1e4258" stroke-width="1" opacity=".32" />
          </pattern>
          <linearGradient id="map-yard" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stop-color="#123349" />
            <stop offset="1" stop-color="#0c2638" />
          </linearGradient>
        </defs>
        <rect x="15" y="15" width="970" height="590" rx="24" fill="url(#map-yard)" stroke="#28526b" stroke-width="2" />
        <rect x="28" y="28" width="944" height="564" rx="18" fill="url(#map-grid)" />
        <path d="M55 210 H945 M55 410 H945 M250 40 V580 M500 40 V580 M750 40 V580" stroke="#183e53" stroke-width="48" opacity=".62" />
        <path d="M55 210 H945 M55 410 H945 M250 40 V580 M500 40 V580 M750 40 V580" stroke="#2a5367" stroke-width="2" stroke-dasharray="12 14" opacity=".75" />
        <path d="M55 90 H945 V530 H55 Z" fill="none" stroke="#397188" stroke-width="3" stroke-dasharray="9 9" opacity=".54" />
        <g fill="#5f91a5" font-family="Microsoft YaHei, sans-serif" font-size="18" opacity=".75">
          <text x="65" y="72">香料工程中心 · 风险单元分布示意</text>
          <text x="420" y="596">道路示意</text>
        </g>
      </svg>

      <button
        v-for="unit in park.units"
        :key="unit.id"
        class="park-map-node"
        :class="{
          selected: park.selectedUnitId === unit.id,
          muted: park.levelFilter !== null && park.levelFilter !== unit.currentLevel,
          alarm: unit.currentLevel === 'red' || unit.reviewStatus === 'pending',
        }"
        :style="{ ...positionOf(unit), '--level': RISK_LEVEL_COLOR[unit.currentLevel] }"
        type="button"
        :title="`${unit.name} · ${RISK_LEVEL_LABEL[unit.currentLevel]} · 点击查看详情`"
        @click="selectUnit(unit)"
      >
        <i class="park-map-node__dot" />
        <span class="park-map-node__text">
          <small>{{ unit.id }} · {{ unit.area }}</small>
          <b>{{ unit.name }}</b>
        </span>
        <em v-if="operationByUnit.get(unit.id)" class="park-map-node__work">
          <PsIcon name="HardHat" :size="10" /> 作业中
        </em>
        <span v-else class="park-map-node__level">{{ RISK_LEVEL_LABEL[unit.currentLevel].replace('风险', '') }}</span>
      </button>

      <div class="park-map-distribution__footer">
        <span><i class="park-map-distribution__live-dot" /> 动态等级 · 演示数据</span>
        <span>点击单元查看风险详情</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.park-map-distribution {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.park-map-distribution__summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-height: 46px;
  padding: 3px 8px 0;
}

.park-map-distribution__total span,
.park-map-distribution__total strong {
  display: block;
}

.park-map-distribution__total span {
  color: #6f91a6;
  font-size: 10px;
}

.park-map-distribution__total strong {
  color: #dff3fa;
  font: 20px/1.1 'Bahnschrift', 'Consolas', monospace;
  margin-top: 2px;
}

.park-map-distribution__total small {
  color: #7395aa;
  font: 10px 'Microsoft YaHei', sans-serif;
}

.park-map-distribution__levels {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  flex-wrap: wrap;
}

.park-map-distribution__levels button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 25px;
  border: 1px solid color-mix(in srgb, var(--level) 30%, #28475a);
  border-radius: 4px;
  padding: 0 7px;
  color: #a8c5d4;
  background: color-mix(in srgb, var(--level) 8%, #0b1e2d);
  font-size: 10px;
  cursor: pointer;
  transition: .18s ease;
}

.park-map-distribution__levels button:hover,
.park-map-distribution__levels button.active {
  border-color: var(--level);
  color: #e8f8fc;
  box-shadow: 0 0 12px color-mix(in srgb, var(--level) 18%, transparent);
}

.park-map-distribution__levels button i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--level);
  box-shadow: 0 0 8px var(--level);
}

.park-map-distribution__levels button b {
  color: var(--level);
  font: 12px 'Bahnschrift', 'Consolas', monospace;
}

.park-map-distribution__levels .park-map-distribution__clear {
  color: #81d9e6;
  border-color: #28627a;
  background: #0c2a3d;
}

.park-map-distribution__canvas {
  position: relative;
  flex: 1;
  min-height: 200px;
  border: 1px solid #214356;
  border-radius: 6px;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 50% 40%, #15405a55 0, transparent 70%),
    linear-gradient(145deg, #0b2030, #071722);
}

.park-map-distribution__plan {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.park-map-distribution__orientation {
  position: absolute;
  z-index: 1;
  top: 8px;
  right: 10px;
  border: 1px solid #284c61;
  border-radius: 3px;
  padding: 4px 6px;
  color: #7faabe;
  background: #0a1b29dd;
  font-size: 9px;
}

.park-map-node {
  position: absolute;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 7px;
  width: 21%;
  min-width: 90px;
  max-width: 160px;
  min-height: 42px;
  transform: translate(-50%, -50%);
  padding: 6px 7px;
  border: 1px solid color-mix(in srgb, var(--level) 54%, #28495b);
  border-radius: 5px;
  color: #d7eaf2;
  text-align: left;
  background: linear-gradient(135deg, color-mix(in srgb, var(--level) 12%, #0c2232), #0a1d2c 85%);
  box-shadow: 0 5px 16px #020b12a8, inset 0 1px #ffffff08;
  cursor: pointer;
  transition: border-color .18s ease, box-shadow .18s ease, opacity .18s ease, transform .18s ease;
}

.park-map-node:hover,
.park-map-node.selected {
  z-index: 3;
  border-color: var(--level);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--level) 45%, transparent), 0 0 18px color-mix(in srgb, var(--level) 24%, transparent);
  transform: translate(-50%, -50%) scale(1.04);
}

.park-map-node.muted {
  opacity: .24;
}

.park-map-node__dot {
  width: 9px;
  height: 9px;
  flex: 0 0 9px;
  border-radius: 50%;
  background: var(--level);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--level) 16%, transparent), 0 0 10px var(--level);
}

.park-map-node.alarm .park-map-node__dot {
  animation: map-pulse 1.8s ease-in-out infinite;
}

.park-map-node__text {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.park-map-node__text small {
  overflow: hidden;
  color: #6e91a6;
  font-size: 8px;
  line-height: 1.1;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.park-map-node__text b {
  overflow: hidden;
  color: #cfe4ed;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.park-map-node__level,
.park-map-node__work {
  flex: 0 0 auto;
  color: var(--level);
  font-size: 8px;
  font-style: normal;
  white-space: nowrap;
}

.park-map-node__work {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border-radius: 3px;
  padding: 3px 4px;
  background: #ef9c3222;
  color: #f7b358;
}

.park-map-distribution__footer {
  position: absolute;
  z-index: 1;
  right: 10px;
  bottom: 8px;
  left: 10px;
  display: flex;
  justify-content: space-between;
  color: #638499;
  font-size: 9px;
  pointer-events: none;
}

.park-map-distribution__footer > span:first-child {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.park-map-distribution__live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #48d9b1;
  box-shadow: 0 0 8px #48d9b1;
}

.park-map-distribution__total span,
.park-map-distribution__levels button,
.park-map-distribution__orientation {
  font-size: 12px;
}

.park-map-node__text small,
.park-map-node__level,
.park-map-node__work,
.park-map-distribution__footer {
  font-size: 10px;
}

.park-map-node__text b {
  font-size: 12px;
}

@keyframes map-pulse {
  50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--level) 12%, transparent), 0 0 13px var(--level); }
}

@media (max-width: 1100px) {
  .park-map-node { width: 22%; min-width: 76px; gap: 5px; padding: 5px; }
  .park-map-node__text small { display: none; }
}
</style>
