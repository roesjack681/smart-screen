<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useParkStore } from '@/stores/park';
import { RISK_LEVEL_COLOR, RISK_LEVEL_LABEL, type RiskLevel, type RiskUnit } from '@/types/park';

const park = useParkStore();

const canvasHost = ref<HTMLElement | null>(null);
const tooltip = ref<{
  visible: boolean;
  x: number;
  y: number;
  name: string;
  level: string;
  triggers: number;
}>({
  visible: false,
  x: 0,
  y: 0,
  name: '',
  level: '',
  triggers: 0,
});

const levels: RiskLevel[] = ['red', 'orange', 'yellow', 'blue'];

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let raycaster: THREE.Raycaster | null = null;
let pointer = new THREE.Vector2(-10, -10);
let animId = 0;
let buildingGroup: THREE.Group | null = null;
const meshById = new Map<string, THREE.Mesh>();
const targetColors = new Map<string, THREE.Color>();
const resizeObserver = ref<ResizeObserver | null>(null);

const filteredIds = computed(() => new Set(park.visibleUnits.map((u) => u.id)));

function colorFor(level: RiskLevel): THREE.Color {
  return new THREE.Color(RISK_LEVEL_COLOR[level]);
}

function buildScene(): void {
  const host = canvasHost.value;
  if (!host) return;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x081321, 0.028);

  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(10, 12, 14);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 8;
  controls.maxDistance = 28;
  controls.target.set(0, 0.5, 0);

  raycaster = new THREE.Raycaster();

  const ambient = new THREE.AmbientLight(0xb7d4ea, 0.55);
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(8, 16, 6);
  const fill = new THREE.DirectionalLight(0x3a7ca8, 0.35);
  fill.position.set(-10, 6, -8);
  scene.add(ambient, key, fill);

  // 地面网格示意
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 16),
    new THREE.MeshStandardMaterial({
      color: 0x0c2236,
      metalness: 0.15,
      roughness: 0.9,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(22, 22, 0x1e4a68, 0x14344c);
  grid.position.y = 0.01;
  scene.add(grid);

  // 道路示意
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x132a3d, metalness: 0.1, roughness: 0.95 });
  const roadH = new THREE.Mesh(new THREE.BoxGeometry(20, 0.04, 1.2), roadMat);
  roadH.position.set(0, 0.03, 0);
  const roadV = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 14), roadMat);
  roadV.position.set(0, 0.03, 0);
  scene.add(roadH, roadV);

  buildingGroup = new THREE.Group();
  scene.add(buildingGroup);
  syncBuildings(park.units);

  const onPointerMove = (ev: PointerEvent) => {
    const rect = renderer!.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    tooltip.value.x = ev.clientX - rect.left + 14;
    tooltip.value.y = ev.clientY - rect.top + 14;
  };
  const onPointerLeave = () => {
    pointer.set(-10, -10);
    tooltip.value.visible = false;
  };
  const onClick = () => {
    if (!raycaster || !camera || !buildingGroup) return;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(buildingGroup.children, false);
    const hit = hits.find((h) => h.object.userData.unitId);
    if (hit) {
      park.selectUnit(String(hit.object.userData.unitId), true);
    }
  };

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);
  renderer.domElement.addEventListener('click', onClick);
  (renderer.domElement as any)._parkHandlers = { onPointerMove, onPointerLeave, onClick };

  resize();
  resizeObserver.value = new ResizeObserver(() => resize());
  resizeObserver.value.observe(host);
  animate();
}

function syncBuildings(units: RiskUnit[]): void {
  if (!buildingGroup) return;
  const keep = new Set(units.map((u) => u.id));

  for (const [id, mesh] of meshById) {
    if (!keep.has(id)) {
      buildingGroup.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      meshById.delete(id);
      targetColors.delete(id);
    }
  }

  for (const unit of units) {
    let mesh = meshById.get(unit.id);
    if (!mesh) {
      const geo = new THREE.BoxGeometry(1.6, unit.height, 1.6);
      const mat = new THREE.MeshStandardMaterial({
        color: colorFor(unit.currentLevel),
        metalness: 0.25,
        roughness: 0.45,
        emissive: colorFor(unit.currentLevel),
        emissiveIntensity: 0.18,
        transparent: true,
        opacity: 0.95,
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.userData.unitId = unit.id;
      mesh.castShadow = true;
      buildingGroup.add(mesh);
      meshById.set(unit.id, mesh);

      // 顶部标识薄片
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 0.08, 1.65),
        new THREE.MeshStandardMaterial({
          color: 0xd7ecf8,
          metalness: 0.4,
          roughness: 0.35,
          transparent: true,
          opacity: 0.35,
        }),
      );
      cap.position.y = unit.height / 2 + 0.04;
      mesh.add(cap);
    }

    mesh.position.set(unit.gridX * 2.2, unit.height / 2, unit.gridZ * 2.2);
    targetColors.set(unit.id, colorFor(unit.currentLevel));
    applySelectionStyle(mesh, unit);
  }
}

function applySelectionStyle(mesh: THREE.Mesh, unit: RiskUnit): void {
  const mat = mesh.material as THREE.MeshStandardMaterial;
  const selected = park.selectedUnitId === unit.id;
  const filteredOut = park.levelFilter !== null && unit.currentLevel !== park.levelFilter;
  mat.opacity = filteredOut ? 0.18 : selected ? 1 : 0.94;
  mat.emissiveIntensity = selected ? 0.42 : filteredOut ? 0.04 : 0.18;
  mesh.scale.setScalar(selected ? 1.08 : 1);
}

function resize(): void {
  const host = canvasHost.value;
  if (!host || !renderer || !camera) return;
  const w = host.clientWidth || 1;
  const h = host.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function animate(): void {
  animId = requestAnimationFrame(animate);
  if (!renderer || !scene || !camera) return;
  controls?.update();

  // 颜色短动画 150–250ms 量级插值
  for (const [id, mesh] of meshById) {
    const target = targetColors.get(id);
    if (!target) continue;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.color.lerp(target, 0.18);
    mat.emissive.lerp(target, 0.18);
  }

  // hover
  if (raycaster && buildingGroup) {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(buildingGroup.children, false);
    const hit = hits.find((h) => h.object.userData.unitId);
    if (hit) {
      const unit = park.units.find((u) => u.id === hit.object.userData.unitId);
      if (unit && filteredIds.value.has(unit.id)) {
        tooltip.value.visible = true;
        tooltip.value.name = unit.name;
        tooltip.value.level = RISK_LEVEL_LABEL[unit.currentLevel];
        tooltip.value.triggers = unit.triggers.length;
      } else {
        tooltip.value.visible = false;
      }
    } else {
      tooltip.value.visible = false;
    }
  }

  renderer.render(scene, camera);
}

function dispose(): void {
  cancelAnimationFrame(animId);
  resizeObserver.value?.disconnect();
  if (renderer) {
    const handlers = (renderer.domElement as any)._parkHandlers;
    if (handlers) {
      renderer.domElement.removeEventListener('pointermove', handlers.onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', handlers.onPointerLeave);
      renderer.domElement.removeEventListener('click', handlers.onClick);
    }
    renderer.dispose();
    renderer.domElement.remove();
  }
  for (const mesh of meshById.values()) {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
  meshById.clear();
  targetColors.clear();
  controls?.dispose();
  renderer = null;
  scene = null;
  camera = null;
  controls = null;
  buildingGroup = null;
}

watch(
  () => park.units.map((u) => `${u.id}:${u.currentLevel}:${u.height}`).join('|'),
  () => syncBuildings(park.units),
);

watch(
  () => [park.selectedUnitId, park.levelFilter] as const,
  () => {
    for (const unit of park.units) {
      const mesh = meshById.get(unit.id);
      if (mesh) applySelectionStyle(mesh, unit);
    }
  },
);

onMounted(() => buildScene());
onBeforeUnmount(() => dispose());
</script>

<template>
  <div class="park-map3d">
    <div ref="canvasHost" class="park-map3d__canvas" />
    <div class="park-map3d__badge">示意布局 · 演示数据</div>

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
      <strong>{{ tooltip.name }}</strong>
      <span>{{ tooltip.level }}</span>
      <small>触发因素 {{ tooltip.triggers }}</small>
    </div>
  </div>
</template>

<style scoped>
.park-map3d {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  background:
    radial-gradient(ellipse at 50% 20%, #13324b55, transparent 55%),
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

.park-map3d__badge {
  position: absolute;
  left: 14px;
  top: 12px;
  z-index: 2;
  font-size: 10px;
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
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--lv) 45%, transparent);
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
  min-width: 140px;
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
}
</style>
