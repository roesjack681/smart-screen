<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useParkStore } from '@/stores/park';
import { RISK_LEVEL_COLOR, RISK_LEVEL_LABEL, type RiskLevel } from '@/types/park';
import {
  CAMPUS_SCALE,
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
  triggers: number;
  width: number;
  selected: boolean;
}

const mapLabels = ref<MapLabel[]>([]);
const labelsHost = ref<HTMLElement | null>(null);
const labelEls = new Map<string, HTMLElement>();
let labelModelKey = '';
const labelWorld = new THREE.Vector3();
const LABEL_HEIGHT = 26;
const LABEL_SCREEN_Y_OFFSET = 18;

/** 图层开关 + 场景时刻（0–24 小时） */
const showBuildingNames = ref(true);
const showAlarmCount = ref(true);
const showAlarmLevel = ref(true);
const sceneHour = ref(12);
const hudCollapsed = ref(true);

const sceneHourLabel = computed(() => {
  const h = Math.floor(sceneHour.value) % 24;
  const m = Math.round((sceneHour.value % 1) * 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

function labelWidthFor(name: string, triggers: number): number {
  const base = 24 + name.length * 13 + (triggers > 0 ? 28 : 0);
  return Math.min(168, Math.max(108, base));
}

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let raycaster: THREE.Raycaster | null = null;
let hemiLight: THREE.HemisphereLight | null = null;
let ambientLight: THREE.AmbientLight | null = null;
let keyLight: THREE.DirectionalLight | null = null;
let fillLight: THREE.DirectionalLight | null = null;
let rimLight: THREE.DirectionalLight | null = null;
let groundMat: THREE.MeshStandardMaterial | null = null;
let apronMat: THREE.MeshStandardMaterial | null = null;
let lampLights: THREE.PointLight[] = [];
const fogNight = new THREE.Color(0x1c3348);
const fogDay = new THREE.Color(0x9eb8cc);
const groundNight = new THREE.Color(0x1e2a34);
const groundDay = new THREE.Color(0x3a4854);
const apronNight = new THREE.Color(0x121820);
const apronDay = new THREE.Color(0x243038);
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
  // 线性雾：只在远景轻微收边，避免 Exp2 近中景被蒙住
  scene.fog = new THREE.Fog(0xb8d4e8, 72, 190);

  // 略长焦 + 更低机位，削弱俯视沙盘感
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 360);
  camera.position.set(42 * CAMPUS_SCALE * 0.72, 22 * CAMPUS_SCALE * 0.62, 48 * CAMPUS_SCALE * 0.72);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  host.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 22;
  controls.maxDistance = 110;
  controls.target.set(0, 2.2, 0);

  raycaster = new THREE.Raycaster();

  hemiLight = new THREE.HemisphereLight(0xb7d7ef, 0x0a1a22, 0.72);
  ambientLight = new THREE.AmbientLight(0x9eb8cc, 0.38);
  keyLight = new THREE.DirectionalLight(0xfff4e8, 1.55);
  keyLight.position.set(24, 36, 18);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 140;
  keyLight.shadow.camera.left = -52;
  keyLight.shadow.camera.right = 52;
  keyLight.shadow.camera.top = 42;
  keyLight.shadow.camera.bottom = -42;
  keyLight.shadow.bias = -0.00025;
  fillLight = new THREE.DirectionalLight(0x6fa8c8, 0.55);
  fillLight.position.set(-28, 18, -22);
  rimLight = new THREE.DirectionalLight(0x45c9e0, 0.35);
  rimLight.position.set(6, 12, -32);
  scene.add(hemiLight, ambientLight, keyLight, fillLight, rimLight);

  const decorMats = buildCampusDecor(scene);
  groundMat = decorMats.groundMat;
  apronMat = decorMats.apronMat;
  lampLights = decorMats.lampLights;
  decorMats.root.scale.setScalar(CAMPUS_SCALE);
  buildingGroup = new THREE.Group();
  buildingGroup.scale.setScalar(CAMPUS_SCALE);
  scene.add(buildingGroup);
  rebuildAllUnits();
  applyDayNight(sceneHour.value);

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
      const mat = ring.material as THREE.MeshBasicMaterial;
      if (showAlarmLevel.value) {
        mat.color.copy(colorFor(unit.currentLevel));
        mat.opacity = park.selectedUnitId === unit.id ? 0.55 : 0.34;
      } else {
        mat.color.set(0x5a7386);
        mat.opacity = park.selectedUnitId === unit.id ? 0.28 : 0.12;
      }
    }
    // 分区风险色随「警告等级」开关显示/弱化
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.userData?.isZone) return;
      const zmat = mesh.material as THREE.MeshStandardMaterial;
      if (!zmat?.emissive) return;
      if (showAlarmLevel.value) {
        zmat.opacity = Math.max(zmat.opacity, 0.36);
        zmat.emissiveIntensity = Math.max(zmat.emissiveIntensity, 0.1);
      } else {
        zmat.opacity = 0.12;
        zmat.emissiveIntensity = 0.02;
      }
    });
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
    .map((unit) => {
      const triggers = unit.triggers.length;
      const showCount = showAlarmCount.value && triggers > 0;
      return {
        id: unit.id,
        name: unit.name,
        level: unit.currentLevel,
        triggers,
        width: labelWidthFor(unit.name, showCount ? triggers : 0),
        selected: unit.id === park.selectedUnitId,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const key = labels
    .map((l) => `${l.id}:${l.name}:${l.level}:${l.triggers}:${l.selected}:${showAlarmCount.value}`)
    .join('|');
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
      delete el.dataset.lx;
      delete el.dataset.ly;
      continue;
    }
    labelWorld
      .set(
        unit.gridX * CAMPUS_SCALE,
        (Math.max(unit.height, 2) + 1.55) * CAMPUS_SCALE,
        unit.gridZ * CAMPUS_SCALE,
      )
      .project(camera);
    const inView =
      labelWorld.z >= -1 &&
      labelWorld.z <= 1 &&
      Math.abs(labelWorld.x) <= 1.15 &&
      Math.abs(labelWorld.y) <= 1.15;
    if (!inView) {
      el.style.visibility = 'hidden';
      delete el.dataset.lx;
      delete el.dataset.ly;
      continue;
    }
    const labelW = mapLabels.value.find((l) => l.id === unit.id)?.width ?? 128;
    // 取整像素，避免亚像素 transform 导致文字时清时糊
    const x = Math.round(
      Math.max(8, Math.min(width - labelW - 8, ((labelWorld.x + 1) * width) / 2 - labelW / 2)),
    );
    const y = Math.round(
      Math.max(
        40,
        Math.min(
          height - LABEL_HEIGHT - 8,
          ((1 - labelWorld.y) * height) / 2 - LABEL_HEIGHT - LABEL_SCREEN_Y_OFFSET,
        ),
      ),
    );
    el.style.visibility = 'visible';
    if (el.dataset.lx === String(x) && el.dataset.ly === String(y)) continue;
    el.dataset.lx = String(x);
    el.dataset.ly = String(y);
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

/** 按时刻调整光照：昼夜对比收窄，雾只做远景收边，保证中景清晰 */
function applyDayNight(hour: number): void {
  if (!renderer || !scene || !hemiLight || !ambientLight || !keyLight || !fillLight || !rimLight) return;
  const t = ((hour % 24) + 24) % 24;
  // 太阳高度：6 点升起，12 点最高，18 点落下
  const elev = Math.sin(((t - 6) / 12) * Math.PI);
  const dayFactor = Math.max(0, elev);
  const nightFactor = 1 - dayFactor;
  const dusk = Math.max(0, 1 - Math.abs(t - 18) / 2.2);
  const dawn = Math.max(0, 1 - Math.abs(t - 6) / 2.2);
  const noonBoost = Math.max(0, 1 - Math.abs(t - 12) / 1.8);
  const dayMix = Math.min(1, dayFactor * 0.9 + noonBoost * 0.2);

  const sunAngle = ((t - 6) / 12) * Math.PI;
  const sunX = Math.cos(sunAngle) * 34;
  const sunY = Math.max(6, dayFactor * 42 + 5);
  const sunZ = Math.sin(sunAngle) * 24;
  keyLight.position.set(sunX, sunY, sunZ);

  // 白天略提亮；夜晚主光偏暗，但用补光/轮廓光/路灯保住建筑可读
  hemiLight.intensity = 0.52 + dayFactor * 0.55 + noonBoost * 0.12;
  ambientLight.intensity = 0.48 + dayFactor * 0.28 + noonBoost * 0.08;
  keyLight.intensity = 0.58 + dayFactor * 1.2 + noonBoost * 0.28 + dusk * 0.14;
  fillLight.intensity = 0.5 + dayFactor * 0.28 + nightFactor * 0.22;
  rimLight.intensity = 0.24 + dayFactor * 0.14 + nightFactor * 0.36;

  const warm = new THREE.Color(0xffd2a0);
  const noon = new THREE.Color(0xfff6ec);
  const cool = new THREE.Color(0x9bb6d0);
  const skyDay = new THREE.Color(0xd8ecf8);
  const skyNight = new THREE.Color(0x3a5268);
  if (dusk > 0.05 || dawn > 0.05) {
    const blend = Math.max(dusk, dawn);
    keyLight.color.copy(noon).lerp(warm, blend);
  } else if (dayFactor > 0.15) {
    keyLight.color.copy(noon);
  } else {
    keyLight.color.copy(cool);
  }
  hemiLight.color.copy(skyNight).lerp(skyDay, dayMix);
  hemiLight.groundColor.set(dayFactor > 0.2 ? 0x3a4650 : 0x243038);
  ambientLight.color.set(dayFactor > 0.2 ? 0xd0e4f0 : 0x7a94a8);
  fillLight.color.set(dayFactor > 0.2 ? 0xa0cce0 : 0x6a90b0);
  rimLight.color.set(dayFactor > 0.15 ? 0x6ad4e4 : 0x5aa0c0);

  // 白天约 1.1–1.45；夜晚约 1.08，靠补光看清建筑而不是整体提亮
  renderer.toneMappingExposure = 1.08 + dayFactor * 0.28 + noonBoost * 0.1;

  const fog = scene.fog as THREE.Fog | null;
  if (fog) {
    fog.color.copy(fogNight).lerp(fogDay, dayMix);
    fog.near = 80 + dayFactor * 8;
    fog.far = 210 - nightFactor * 10;
  }
  groundMat?.color.copy(groundNight).lerp(groundDay, dayMix);
  apronMat?.color.copy(apronNight).lerp(apronDay, dayMix);

  const lampPower = 0.35 + nightFactor * 2.7 + dusk * 1.15 + dawn * 0.55;
  for (const lamp of lampLights) lamp.intensity = lampPower;

  const host = canvasHost.value?.parentElement as HTMLElement | null;
  if (host) {
    const lift = Math.round(34 + dayFactor * 32 + noonBoost * 10);
    host.style.setProperty('--park-sky-lift', String(lift));
    host.style.setProperty('--park-day', String(dayFactor.toFixed(3)));
  }
}

function onSceneHourInput(): void {
  applyDayNight(sceneHour.value);
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
  hemiLight = null;
  ambientLight = null;
  keyLight = null;
  fillLight = null;
  rimLight = null;
  groundMat = null;
  apronMat = null;
  lampLights = [];
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

watch(showAlarmCount, () => syncLabelModels());
watch(showAlarmLevel, () => applyVisibilityFilter());
watch(showBuildingNames, () => syncLabelModels());

onMounted(() => buildScene());
onBeforeUnmount(() => dispose());
</script>

<template>
  <div class="park-map3d">
    <div ref="canvasHost" class="park-map3d__canvas" />
    <div v-show="showBuildingNames" ref="labelsHost" class="park-map3d__labels" aria-hidden="true">
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
        <b
          v-if="showAlarmCount && label.triggers > 0"
          class="park-map3d__trig"
          :title="`警告数量 ${label.triggers}`"
        >
          {{ label.triggers }}
        </b>
      </div>
    </div>

    <div class="park-map3d__hud" :class="{ collapsed: hudCollapsed }" @pointerdown.stop @click.stop>
      <button
        class="park-map3d__hud-toggle"
        type="button"
        :aria-expanded="!hudCollapsed"
        :aria-label="hudCollapsed ? '展开图层控制' : '收起图层控制'"
        @click="hudCollapsed = !hudCollapsed"
      >
        <span>{{ hudCollapsed ? '图层' : '图层控制' }}</span>
        <em>{{ hudCollapsed ? '展开' : '收起' }}</em>
      </button>
      <div v-show="!hudCollapsed" class="park-map3d__hud-body">
        <label class="park-map3d__check">
          <input v-model="showBuildingNames" type="checkbox" />
          <span>建筑名称</span>
        </label>
        <label class="park-map3d__check">
          <input v-model="showAlarmCount" type="checkbox" />
          <span>警告数量</span>
        </label>
        <label class="park-map3d__check">
          <input v-model="showAlarmLevel" type="checkbox" />
          <span>警告等级</span>
        </label>
        <div class="park-map3d__time">
          <span>时间 {{ sceneHourLabel }}</span>
          <input
            v-model.number="sceneHour"
            class="park-map3d__time-range"
            type="range"
            min="0"
            max="24"
            step="0.25"
            @input="onSceneHourInput"
          />
        </div>
      </div>
    </div>

    <div v-show="showAlarmLevel" class="park-map3d__legend">
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
  --park-sky-lift: 52;
  --park-day: 1;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  background:
    radial-gradient(
      ellipse at 50% 18%,
      rgba(100, 160, 200, calc(0.12 + var(--park-day) * 0.22)),
      transparent 58%
    ),
    linear-gradient(
      180deg,
      rgb(calc(14 + var(--park-sky-lift)), calc(32 + var(--park-sky-lift) * 0.7), calc(52 + var(--park-sky-lift) * 0.5)),
      rgb(calc(10 + var(--park-sky-lift) * 0.4), calc(24 + var(--park-sky-lift) * 0.45), calc(40 + var(--park-sky-lift) * 0.38))
    );
  border-radius: 4px;
  overflow: hidden;
  transition: background 0.25s ease;
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
  font: 500 13px/26px 'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif;
  box-shadow: 0 2px 5px #020b1466;
  transform: translate3d(-9999px, -9999px, 0);
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
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
  transform: translateZ(0);
  flex: 1;
  min-width: 0;
}

.park-map3d__trig {
  flex-shrink: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--risk-color) 28%, #0b1e2f);
  border: 1px solid color-mix(in srgb, var(--risk-color) 55%, transparent);
  color: #edf5fc;
  font: 600 10px/16px 'Bahnschrift', 'Consolas', monospace;
  text-align: center;
}

.park-map3d__hud {
  position: absolute;
  left: 12px;
  top: 12px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  border: 1px solid #2a4d63;
  border-radius: 4px;
  background: #0c2235ee;
  box-shadow: 0 4px 16px #020b1455;
  overflow: hidden;
}

.park-map3d__hud.collapsed {
  min-width: 0;
  border-radius: 4px;
}

.park-map3d__hud.collapsed .park-map3d__hud-toggle {
  padding: 6px 10px;
  gap: 8px;
}

.park-map3d__hud-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 0;
  background: transparent;
  color: #c5dceb;
  font-size: 12px;
  padding: 7px 10px;
  cursor: pointer;
  white-space: nowrap;
}

.park-map3d__hud-toggle em {
  font-style: normal;
  font-size: 11px;
  color: #6f97ab;
}

.park-map3d__hud-toggle:hover em {
  color: #8ec8de;
}

.park-map3d__hud-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 168px;
  padding: 0 12px 10px;
  border-top: 1px solid #243f52;
  padding-top: 8px;
}

.park-map3d__check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #c5dceb;
  cursor: pointer;
  user-select: none;
}

.park-map3d__check input {
  width: 14px;
  height: 14px;
  accent-color: #3ab8d4;
  cursor: pointer;
}

.park-map3d__time {
  display: grid;
  gap: 6px;
  padding-top: 4px;
  border-top: 1px solid #243f52;
}

.park-map3d__time > span {
  font: 12px/1 'Bahnschrift', 'Consolas', monospace;
  color: #9ec0d2;
  letter-spacing: 0.5px;
}

.park-map3d__time-range {
  width: 100%;
  height: 18px;
  margin: 0;
  accent-color: #3ab8d4;
  cursor: pointer;
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
