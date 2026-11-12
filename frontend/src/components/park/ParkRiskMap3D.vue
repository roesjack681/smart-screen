<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useParkStore } from '@/stores/park';
import { RISK_LEVEL_COLOR, RISK_LEVEL_LABEL, type RiskLevel } from '@/types/park';
import {
  buildCampusDecor,
  buildUnitWithZones,
  colorFor,
} from '@/utils/park/campusFactory';

const park = useParkStore();

const canvasHost = ref<HTMLElement | null>(null);
const tooltip = ref<{
  visible: boolean;
  x: number;
  y: number;
  unitName: string;
  zoneName: string;
  level: string;
  alarm: string;
}>({
  visible: false,
  x: 0,
  y: 0,
  unitName: '',
  zoneName: '',
  level: '',
  alarm: '',
});

const levels: RiskLevel[] = ['red', 'orange', 'yellow', 'blue'];

interface MapLabel {
  id: string;
  name: string;
  level: RiskLevel;
  width: number;
  selected: boolean;
}

const mapLabels = ref<MapLabel[]>([]);
const labelsHost = ref<HTMLElement | null>(null);
const labelEls = new Map<string, HTMLElement>();
let labelModelKey = '';
const labelWorld = new THREE.Vector3();
const LABEL_WIDTH = 128;
const LABEL_HEIGHT = 26;
const LABEL_SCREEN_Y_OFFSET = 18;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let raycaster: THREE.Raycaster | null = null;
let pointer = new THREE.Vector2(-10, -10);
/** 区分拖拽与点击：按下后位移超过阈值则视为拖拽，松手不打开详情 */
let pointerDownX = 0;
let pointerDownY = 0;
let dragMoved = false;
const CLICK_DRAG_THRESHOLD_PX = 6;
let animId = 0;
let buildingGroup: THREE.Group | null = null;
const unitGroups = new Map<string, THREE.Group>();
const zoneMats = new Map<string, THREE.MeshStandardMaterial>();
const unitRings = new Map<string, THREE.Mesh>();
const resizeObserver = ref<ResizeObserver | null>(null);

const filteredIds = computed(() => new Set(park.visibleUnits.map((u) => u.id)));

function buildScene(): void {
  const host = canvasHost.value;
  if (!host) return;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x081321, 48, 120);

  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);
  camera.position.set(24, 22, 28);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  host.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minDistance = 14;
  controls.maxDistance = 56;
  controls.target.set(0, 0.8, 0);

  raycaster = new THREE.Raycaster();

  scene.add(new THREE.AmbientLight(0xd8e6f2, 0.92));
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(12, 20, 10);
  key.castShadow = true;
  const fill = new THREE.DirectionalLight(0x7eaac9, 0.5);
  fill.position.set(-14, 10, -12);
  scene.add(key, fill, new THREE.DirectionalLight(0x56c8e0, 0.22));

  buildCampusDecor(scene);
  buildingGroup = new THREE.Group();
  scene.add(buildingGroup);
  rebuildAllUnits();

  const onPointerDown = (ev: PointerEvent) => {
    if (ev.button !== 0) return;
    pointerDownX = ev.clientX;
    pointerDownY = ev.clientY;
    dragMoved = false;
  };
  const onPointerMove = (ev: PointerEvent) => {
    const rect = renderer!.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    tooltip.value.x = ev.clientX - rect.left + 14;
    tooltip.value.y = ev.clientY - rect.top + 14;
    if ((ev.buttons & 1) === 1) {
      const dx = ev.clientX - pointerDownX;
      const dy = ev.clientY - pointerDownY;
      if (dx * dx + dy * dy > CLICK_DRAG_THRESHOLD_PX * CLICK_DRAG_THRESHOLD_PX) {
        dragMoved = true;
      }
    }
  };
  const onPointerLeave = () => {
    pointer.set(-10, -10);
    tooltip.value.visible = false;
  };
  const onClick = () => {
    if (dragMoved) return;
    const hit = pickHit();
    if (hit?.zoneId) park.selectZone(hit.zoneId, true);
    else if (hit?.unitId) park.selectUnit(hit.unitId, true);
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);
  renderer.domElement.addEventListener('click', onClick);
  (renderer.domElement as any)._parkHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerLeave,
    onClick,
  };

  resize();
  resizeObserver.value = new ResizeObserver(() => resize());
  resizeObserver.value.observe(host);
  window.addEventListener('resize', resize);
  animate();
}

function pickHit(): { unitId?: string; zoneId?: string } | null {
  if (!raycaster || !camera || !buildingGroup) return null;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(buildingGroup.children, true);
  for (const hit of hits) {
    let obj: THREE.Object3D | null = hit.object;
    let unitId: string | undefined;
    let zoneId: string | undefined;
    while (obj) {
      if (obj.userData.zoneId) zoneId = String(obj.userData.zoneId);
      if (obj.userData.unitId) unitId = String(obj.userData.unitId);
      obj = obj.parent;
    }
    if (unitId || zoneId) return { unitId, zoneId };
  }
  return null;
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}

function clearUnits(): void {
  if (!buildingGroup) return;
  for (const group of unitGroups.values()) {
    buildingGroup.remove(group);
    disposeObject(group);
  }
  unitGroups.clear();
  zoneMats.clear();
  unitRings.clear();
}

function rebuildAllUnits(): void {
  if (!buildingGroup) return;
  clearUnits();
  const alarmed = park.alarmedZoneIds;
  for (const unit of park.units) {
    const zones = park.zonesOfUnit(unit.id);
    const { group, zoneMats: mats, ring } = buildUnitWithZones(
      unit,
      zones,
      alarmed,
      park.selectedZoneId,
    );
    group.position.set(unit.gridX, 0, unit.gridZ);
    group.rotation.y = unit.yaw || 0;
    buildingGroup.add(group);
    unitGroups.set(unit.id, group);
    unitRings.set(unit.id, ring);
    for (const [zid, mat] of mats) zoneMats.set(zid, mat);
  }
  applyVisibilityFilter();
  syncLabelModels();
}

function applyVisibilityFilter(): void {
  for (const unit of park.units) {
    const group = unitGroups.get(unit.id);
    if (!group) continue;
    const filteredOut = park.levelFilter !== null && unit.currentLevel !== park.levelFilter;
    group.visible = !filteredOut;
    const ring = unitRings.get(unit.id);
    if (ring) {
      (ring.material as THREE.MeshBasicMaterial).color.copy(colorFor(unit.currentLevel));
      (ring.material as THREE.MeshBasicMaterial).opacity =
        park.selectedUnitId === unit.id ? 0.55 : 0.32;
    }
  }
}

function refreshZoneStyles(): void {
  // 区域等级/告警变化时重建，保证告警柱与分区体块同步
  rebuildAllUnits();
}

function refreshLabelEls(): void {
  labelEls.clear();
  labelsHost.value?.querySelectorAll<HTMLElement>('[data-unit-id]').forEach((el) => {
    const id = el.dataset.unitId;
    if (id) labelEls.set(id, el);
  });
}

function syncLabelModels(): void {
  const labels = park.visibleUnits
    .map((unit) => ({
      id: unit.id,
      name: unit.name,
      level: unit.currentLevel,
      width: LABEL_WIDTH,
      selected: unit.id === park.selectedUnitId,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const key = labels.map((l) => `${l.id}:${l.name}:${l.level}:${l.selected}`).join('|');
  if (key !== labelModelKey) {
    labelModelKey = key;
    mapLabels.value = labels;
    void nextTick(() => {
      refreshLabelEls();
      updateLabelPositions();
    });
    return;
  }
  if (labelEls.size !== labels.length) {
    void nextTick(() => {
      refreshLabelEls();
      updateLabelPositions();
    });
  }
}

function updateLabelPositions(): void {
  const host = canvasHost.value;
  if (!host || !camera) return;
  const width = host.clientWidth;
  const height = host.clientHeight;

  for (const unit of park.units) {
    const el = labelEls.get(unit.id);
    if (!el) continue;
    const visible = park.levelFilter === null || unit.currentLevel === park.levelFilter;
    if (!visible) {
      el.style.visibility = 'hidden';
      continue;
    }
    labelWorld
      .set(unit.gridX, Math.max(unit.height, 2) + 1.35, unit.gridZ)
      .project(camera);
    const inView =
      labelWorld.z >= -1 &&
      labelWorld.z <= 1 &&
      Math.abs(labelWorld.x) <= 1.15 &&
      Math.abs(labelWorld.y) <= 1.15;
    if (!inView) {
      el.style.visibility = 'hidden';
      continue;
    }
    const x = Math.max(8, Math.min(width - LABEL_WIDTH - 8, ((labelWorld.x + 1) * width) / 2 - LABEL_WIDTH / 2));
    const y = Math.max(
      40,
      Math.min(height - LABEL_HEIGHT - 8, ((1 - labelWorld.y) * height) / 2 - LABEL_HEIGHT - LABEL_SCREEN_Y_OFFSET),
    );
    el.style.visibility = 'visible';
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
}

function resize(): void {
  const host = canvasHost.value;
  if (!host || !renderer || !camera) return;
  const w = host.clientWidth || 1;
  const h = host.clientHeight || 1;
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  updateLabelPositions();
}

function updateHoverTooltip(): void {
  const hit = pickHit();
  if (!hit?.unitId || !filteredIds.value.has(hit.unitId)) {
    tooltip.value.visible = false;
    return;
  }
  const unit = park.units.find((u) => u.id === hit.unitId);
  if (!unit) {
    tooltip.value.visible = false;
    return;
  }
  const zone = hit.zoneId ? park.zones.find((z) => z.id === hit.zoneId) : null;
  const alarm = hit.zoneId
    ? park.pendingAlarms.find((a) => a.zoneId === hit.zoneId)
    : park.pendingAlarms.find((a) => a.unitId === unit.id);
  tooltip.value.visible = true;
  tooltip.value.unitName = unit.name;
  tooltip.value.zoneName = zone?.name || '建筑公共区';
  tooltip.value.level = RISK_LEVEL_LABEL[zone?.currentLevel || unit.currentLevel];
  tooltip.value.alarm = alarm ? `${alarm.type} · ${alarm.summary}` : '当前区域无未关闭告警';
}

function animate(): void {
  animId = requestAnimationFrame(animate);
  if (!renderer || !scene || !camera) return;
  controls?.update();
  updateHoverTooltip();
  renderer.render(scene, camera);
  updateLabelPositions();
}

function dispose(): void {
  cancelAnimationFrame(animId);
  resizeObserver.value?.disconnect();
  window.removeEventListener('resize', resize);
  if (renderer) {
    const handlers = (renderer.domElement as any)._parkHandlers;
    if (handlers) {
      renderer.domElement.removeEventListener('pointerdown', handlers.onPointerDown);
      renderer.domElement.removeEventListener('pointermove', handlers.onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', handlers.onPointerLeave);
      renderer.domElement.removeEventListener('click', handlers.onClick);
    }
    renderer.dispose();
    renderer.domElement.remove();
  }
  clearUnits();
  mapLabels.value = [];
  labelEls.clear();
  labelModelKey = '';
  controls?.dispose();
  renderer = null;
  scene = null;
  camera = null;
  controls = null;
  buildingGroup = null;
}

watch(
  () =>
    [
      park.units.map((u) => `${u.id}:${u.currentLevel}`).join('|'),
      park.zones.map((z) => `${z.id}:${z.currentLevel}`).join('|'),
      [...park.alarmedZoneIds].sort().join('|'),
      park.selectedZoneId,
      park.selectedUnitId,
    ].join('#'),
  () => refreshZoneStyles(),
);

watch(
  () => park.levelFilter,
  () => {
    applyVisibilityFilter();
    syncLabelModels();
  },
);

onMounted(() => buildScene());
onBeforeUnmount(() => dispose());
</script>

<template>
  <div class="park-map3d">
    <div ref="canvasHost" class="park-map3d__canvas" />
    <div ref="labelsHost" class="park-map3d__labels" aria-hidden="true">
      <div
        v-for="label in mapLabels"
        :key="label.id"
        class="park-map3d__label"
        :class="{ 'is-selected': label.selected }"
        :data-unit-id="label.id"
        :style="{ width: `${label.width}px`, '--risk-color': RISK_LEVEL_COLOR[label.level] }"
      >
        <i />
        <span>{{ label.name }}</span>
      </div>
    </div>
    <div class="park-map3d__badge">示意布局 · 园区分区 · 演示数据</div>

    <div class="park-map3d__legend">
      <button
        v-for="lv in levels"
        :key="lv"
        type="button"
        class="park-map3d__legend-item"
        :class="{ active: park.levelFilter === lv }"
        :style="{ '--lv': RISK_LEVEL_COLOR[lv] }"
        @click="park.toggleLevelFilter(lv)"
      >
        <i />
        <span>{{ RISK_LEVEL_LABEL[lv] }}</span>
        <b>{{ park.levelCounts[lv] }}</b>
      </button>
    </div>

    <div
      v-show="tooltip.visible"
      class="park-map3d__tooltip"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
    >
      <strong>{{ tooltip.unitName }}</strong>
      <span>{{ tooltip.zoneName }} · {{ tooltip.level }}</span>
      <small>{{ tooltip.alarm }}</small>
    </div>
  </div>
</template>

<style scoped>
.park-map3d {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  background:
    radial-gradient(ellipse at 50% 18%, #13324b66, transparent 55%),
    linear-gradient(180deg, #0a1c2e, #071421);
  border-radius: 4px;
  overflow: hidden;
}

.park-map3d__canvas {
  position: absolute;
  inset: 0;
}

.park-map3d__canvas :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  cursor: grab;
}

.park-map3d__canvas :deep(canvas:active) {
  cursor: grabbing;
}

.park-map3d__labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.park-map3d__label {
  position: absolute;
  left: 0;
  top: 0;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 8px;
  border: 1px solid #426479;
  border-radius: 4px;
  background: #0b1e2fee;
  color: #edf5fc;
  font: 500 13px/1 'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif;
  box-shadow: 0 2px 5px #020b1466;
  transform: translate3d(-9999px, -9999px, 0);
  will-change: transform;
  backface-visibility: hidden;
}

.park-map3d__label.is-selected {
  border-color: var(--risk-color);
  background: #132e43;
}

.park-map3d__label i {
  width: 5px;
  height: 5px;
  border-radius: 1px;
  flex-shrink: 0;
  background: var(--risk-color);
}

.park-map3d__label span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.park-map3d__badge {
  position: absolute;
  left: 14px;
  top: 12px;
  z-index: 2;
  font-size: 12px;
  letter-spacing: 1px;
  color: #7ea3b8;
  border: 1px solid #2a4d63;
  background: #0c2235cc;
  padding: 4px 8px;
  border-radius: 3px;
  pointer-events: none;
}

.park-map3d__legend {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.park-map3d__legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #2a465b;
  background: #0d2436dd;
  color: #9cb6c7;
  border-radius: 4px;
  padding: 5px 9px;
  min-width: 128px;
  font-size: 11px;
}

.park-map3d__legend-item:hover {
  border-color: #3d6a82;
  color: #d7ecf5;
}

.park-map3d__legend-item.active {
  border-color: var(--lv);
}

.park-map3d__legend-item i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--lv);
  display: inline-block;
}

.park-map3d__legend-item b {
  margin-left: auto;
  font: 12px 'Bahnschrift', 'Consolas', monospace;
  color: #d5ebf5;
  font-weight: 500;
}

.park-map3d__tooltip {
  position: absolute;
  z-index: 3;
  pointer-events: none;
  min-width: 168px;
  max-width: 240px;
  padding: 8px 10px;
  border-radius: 4px;
  background: #102d41ee;
  border: 1px solid #32677a;
  box-shadow: 0 6px 18px #020a1266;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.park-map3d__tooltip strong {
  font-size: 12px;
  color: #e3f3fa;
  font-weight: 500;
}

.park-map3d__tooltip span {
  font-size: 11px;
  color: #7fd0e2;
}

.park-map3d__tooltip small {
  font-size: 10px;
  color: #7a99ad;
  line-height: 1.4;
}
</style>
