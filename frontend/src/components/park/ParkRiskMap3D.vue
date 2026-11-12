<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useParkStore } from '@/stores/park';
import { RISK_LEVEL_COLOR, RISK_LEVEL_LABEL, type RiskLevel, type RiskUnit } from '@/types/park';

type BuildingKind = 'workshop' | 'tank' | 'warehouse' | 'utility' | 'office' | 'loading' | 'gate';

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
let labelGroup: THREE.Group | null = null;
const unitGroups = new Map<string, THREE.Group>();
const riskMats = new Map<string, THREE.MeshStandardMaterial[]>();
const targetColors = new Map<string, THREE.Color>();
const labelSprites = new Map<string, THREE.Sprite>();
const resizeObserver = ref<ResizeObserver | null>(null);

const filteredIds = computed(() => new Set(park.visibleUnits.map((u) => u.id)));

function colorFor(level: RiskLevel): THREE.Color {
  return new THREE.Color(RISK_LEVEL_COLOR[level]);
}

function kindOf(unit: RiskUnit): BuildingKind {
  if (unit.area.includes('储罐') || unit.name.includes('储罐')) return 'tank';
  if (unit.name.includes('鹤位') || unit.name.includes('装卸')) return 'loading';
  if (unit.name.includes('门禁') || unit.name.includes('通道')) return 'gate';
  if (unit.area.includes('仓储') || unit.name.includes('库')) return 'warehouse';
  if (unit.area.includes('综合') || unit.name.includes('办公')) return 'office';
  if (unit.area.includes('公用') || unit.name.includes('泵') || unit.name.includes('变配') || unit.name.includes('冷却'))
    return 'utility';
  return 'workshop';
}

function makeRiskMat(level: RiskLevel, metal = 0.28, rough = 0.48): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: colorFor(level),
    emissive: colorFor(level),
    emissiveIntensity: 0.22,
    metalness: metal,
    roughness: rough,
    transparent: true,
    opacity: 0.96,
  });
}

function makeNeutral(color: number, metal = 0.2, rough = 0.7): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
}

function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent: THREE.Object3D,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  radial = 20,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radial), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(8, 24, 38, 0.72)';
  ctx.strokeStyle = 'rgba(64, 140, 170, 0.7)';
  ctx.lineWidth = 2;
  roundRect(ctx, 8, 12, 240, 40, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d7eef8';
  ctx.font = 'bold 22px Microsoft YaHei, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.length > 8 ? `${text.slice(0, 8)}…` : text, 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function buildUnitModel(unit: RiskUnit): THREE.Group {
  const group = new THREE.Group();
  group.userData.unitId = unit.id;
  const kind = kindOf(unit);
  const risk = makeRiskMat(unit.currentLevel);
  const mats: THREE.MeshStandardMaterial[] = [risk];
  const concrete = makeNeutral(0x1a3348, 0.1, 0.85);
  const steel = makeNeutral(0x6f8798, 0.55, 0.35);
  const dark = makeNeutral(0x0d1c2a, 0.15, 0.8);
  const glass = makeNeutral(0x7ec8e8, 0.7, 0.15);
  glass.transparent = true;
  glass.opacity = 0.45;

  // 基座地坪
  addBox(group, 3.2, 0.08, 3.0, concrete, 0, 0.04, 0);

  if (kind === 'tank') {
    const h = Math.max(unit.height, 2.6);
    for (const ox of [-0.85, 0.85]) {
      const body = addCylinder(group, 0.55, 0.55, h, risk, ox, h / 2 + 0.08, 0);
      body.userData.unitId = unit.id;
      addCylinder(group, 0.58, 0.58, 0.1, steel, ox, h + 0.08, 0);
      addCylinder(group, 0.12, 0.12, 0.45, steel, ox, h + 0.35, 0);
    }
    addBox(group, 2.6, 0.12, 0.18, steel, 0, 0.7, 1.1);
    addBox(group, 0.18, 1.2, 0.18, steel, -1.3, 0.7, 0.6);
    addBox(group, 0.18, 1.2, 0.18, steel, 1.3, 0.7, 0.6);
  } else if (kind === 'loading') {
    const h = Math.max(unit.height, 1.6);
    const body = addBox(group, 2.6, h * 0.55, 1.4, risk, 0, h * 0.28, 0);
    body.userData.unitId = unit.id;
    addBox(group, 2.8, 0.12, 1.6, steel, 0, h * 0.55 + 0.08, 0);
    addBox(group, 0.2, 1.4, 0.2, steel, -1.0, 0.9, 0.9);
    addBox(group, 0.2, 1.4, 0.2, steel, 1.0, 0.9, 0.9);
    addBox(group, 2.2, 0.1, 0.1, steel, 0, 1.55, 0.9);
    addCylinder(group, 0.08, 0.08, 1.8, steel, 0, 0.9, 1.2);
  } else if (kind === 'warehouse') {
    const h = Math.max(unit.height, 1.8);
    const body = addBox(group, 2.8, h, 2.2, risk, 0, h / 2 + 0.08, 0);
    body.userData.unitId = unit.id;
    // 人字屋顶
    const roof = addBox(group, 3.0, 0.18, 2.4, steel, 0, h + 0.2, 0);
    roof.rotation.z = 0;
    addBox(group, 0.9, 1.1, 0.08, dark, 0, 0.65, 1.12);
    addBox(group, 0.55, 0.55, 0.06, glass, -0.85, h * 0.55, 1.12);
    addBox(group, 0.55, 0.55, 0.06, glass, 0.85, h * 0.55, 1.12);
  } else if (kind === 'office') {
    const h = Math.max(unit.height, 1.5);
    const body = addBox(group, 2.4, h, 1.8, risk, 0, h / 2 + 0.08, 0);
    body.userData.unitId = unit.id;
    addBox(group, 2.5, 0.12, 1.9, steel, 0, h + 0.12, 0);
    for (let i = -1; i <= 1; i++) {
      addBox(group, 0.45, 0.4, 0.05, glass, i * 0.7, h * 0.55, 0.92);
    }
    addBox(group, 0.5, 0.85, 0.06, dark, 0, 0.5, 0.92);
  } else if (kind === 'utility') {
    const h = Math.max(unit.height, 1.8);
    const body = addBox(group, 2.2, h * 0.75, 2.0, risk, 0, h * 0.4, 0);
    body.userData.unitId = unit.id;
    addBox(group, 1.2, h * 0.55, 1.1, risk, 0.7, h * 0.75, -0.2);
    mats.push(risk);
    addCylinder(group, 0.18, 0.22, h * 0.9, steel, -0.7, h * 0.55, 0.55);
    addCylinder(group, 0.12, 0.12, 0.5, dark, -0.7, h * 1.05, 0.55);
    addBox(group, 2.3, 0.1, 2.1, steel, 0, h * 0.78, 0);
  } else if (kind === 'gate') {
    const h = Math.max(unit.height, 1.3);
    const body = addBox(group, 1.2, h, 1.0, risk, -0.9, h / 2 + 0.08, 0);
    body.userData.unitId = unit.id;
    addBox(group, 1.2, h, 1.0, risk, 0.9, h / 2 + 0.08, 0);
    addBox(group, 3.0, 0.15, 0.25, steel, 0, h + 0.2, 0);
    addBox(group, 2.2, 0.08, 1.8, concrete, 0, 0.06, 0.8);
  } else {
    // workshop 主厂房
    const h = Math.max(unit.height, 2.2);
    const body = addBox(group, 2.9, h, 2.3, risk, 0, h / 2 + 0.08, 0);
    body.userData.unitId = unit.id;
    addBox(group, 3.1, 0.16, 2.5, steel, 0, h + 0.16, 0);
    // 侧附房
    addBox(group, 1.1, h * 0.55, 1.2, risk, 1.5, h * 0.3, 0.4);
    // 烟囱 / 排气
    addCylinder(group, 0.14, 0.18, h * 0.7, steel, -1.0, h * 0.75, -0.7);
    // 门窗带
    addBox(group, 0.8, 1.1, 0.06, dark, 0, 0.7, 1.18);
    for (let i = -1; i <= 1; i++) {
      if (i === 0) continue;
      addBox(group, 0.55, 0.5, 0.05, glass, i * 0.95, h * 0.55, 1.18);
    }
    // 屋面设备
    addBox(group, 0.7, 0.35, 0.7, dark, 0.6, h + 0.4, -0.4);
  }

  // 风险光环底座
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.55, 1.75, 40),
    new THREE.MeshBasicMaterial({
      color: colorFor(unit.currentLevel),
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.09;
  ring.userData.isRing = true;
  group.add(ring);
  riskMats.set(unit.id, mats);
  group.userData.ring = ring;

  return group;
}

function buildCampusDecor(): void {
  if (!scene) return;
  const decor = new THREE.Group();
  decor.name = 'campus-decor';

  // 大地面
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 24),
    new THREE.MeshStandardMaterial({ color: 0x0a1c2e, metalness: 0.08, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  decor.add(ground);

  // 外围草坪带
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 22),
    new THREE.MeshStandardMaterial({ color: 0x0d2a22, metalness: 0.05, roughness: 0.92 }),
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = 0.01;
  decor.add(lawn);

  // 厂区铺装
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 18),
    new THREE.MeshStandardMaterial({ color: 0x102437, metalness: 0.12, roughness: 0.88 }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.015;
  decor.add(plaza);

  const grid = new THREE.GridHelper(26, 26, 0x1c4a66, 0x123348);
  grid.position.y = 0.02;
  decor.add(grid);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x152a3d, metalness: 0.1, roughness: 0.92 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x2a4d63, metalness: 0.2, roughness: 0.7 });

  // 主干道十字 + 环线
  const roads: Array<[number, number, number, number, number, number]> = [
    [24, 0.05, 1.6, 0, 0.04, 0],
    [1.6, 0.05, 18, 0, 0.04, 0],
    [24, 0.05, 1.0, 0, 0.04, -5.8],
    [24, 0.05, 1.0, 0, 0.04, 5.8],
    [1.0, 0.05, 18, -8.4, 0.04, 0],
    [1.0, 0.05, 18, 8.4, 0.04, 0],
  ];
  for (const [w, h, d, x, y, z] of roads) {
    addBox(decor, w, h, d, roadMat, x, y, z);
  }

  // 路缘灯柱
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    for (const side of [-1, 1]) {
      const pole = addCylinder(decor, 0.05, 0.05, 1.4, curbMat, i * 2.6, 0.75, side * 1.15);
      addCylinder(decor, 0.12, 0.12, 0.12, makeNeutral(0x8fd7ef, 0.4, 0.3), pole.position.x, 1.5, pole.position.z);
    }
  }

  // 围墙示意
  const wallMat = makeNeutral(0x173247, 0.15, 0.8);
  addBox(decor, 28, 0.7, 0.12, wallMat, 0, 0.35, -9.5);
  addBox(decor, 28, 0.7, 0.12, wallMat, 0, 0.35, 9.5);
  addBox(decor, 0.12, 0.7, 19, wallMat, -13.5, 0.35, 0);
  addBox(decor, 0.12, 0.7, 19, wallMat, 13.5, 0.35, 0);

  scene.add(decor);
}

function buildScene(): void {
  const host = canvasHost.value;
  if (!host) return;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x081321, 0.018);

  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(14, 13, 16);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  host.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minDistance = 10;
  controls.maxDistance = 36;
  controls.target.set(0, 0.8, 0);

  raycaster = new THREE.Raycaster();

  const ambient = new THREE.AmbientLight(0xb7d4ea, 0.62);
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(10, 18, 8);
  key.castShadow = true;
  const fill = new THREE.DirectionalLight(0x3a7ca8, 0.4);
  fill.position.set(-12, 8, -10);
  const rim = new THREE.DirectionalLight(0x56c8e0, 0.25);
  rim.position.set(0, 8, -14);
  scene.add(ambient, key, fill, rim);

  buildCampusDecor();

  buildingGroup = new THREE.Group();
  labelGroup = new THREE.Group();
  scene.add(buildingGroup, labelGroup);
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
    const id = pickUnitId();
    if (id) park.selectUnit(id, true);
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

function pickUnitId(): string | null {
  if (!raycaster || !camera || !buildingGroup) return null;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(buildingGroup.children, true);
  for (const hit of hits) {
    let obj: THREE.Object3D | null = hit.object;
    while (obj) {
      if (obj.userData.unitId) return String(obj.userData.unitId);
      obj = obj.parent;
    }
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
    const sprite = child as THREE.Sprite;
    if (sprite.material) {
      const sm = sprite.material as THREE.SpriteMaterial;
      sm.map?.dispose();
      sm.dispose();
    }
  });
}

function syncBuildings(units: RiskUnit[]): void {
  if (!buildingGroup || !labelGroup) return;
  const keep = new Set(units.map((u) => u.id));

  for (const [id, group] of unitGroups) {
    if (!keep.has(id)) {
      buildingGroup.remove(group);
      disposeObject(group);
      unitGroups.delete(id);
      riskMats.delete(id);
      targetColors.delete(id);
      const label = labelSprites.get(id);
      if (label) {
        labelGroup.remove(label);
        disposeObject(label);
        labelSprites.delete(id);
      }
    }
  }

  for (const unit of units) {
    let group = unitGroups.get(unit.id);
    if (!group) {
      group = buildUnitModel(unit);
      buildingGroup.add(group);
      unitGroups.set(unit.id, group);

      const label = makeLabelSprite(unit.name);
      label.position.set(unit.gridX * 2.55, Math.max(unit.height, 2) + 1.1, unit.gridZ * 2.55);
      labelGroup.add(label);
      labelSprites.set(unit.id, label);
    }

    group.position.set(unit.gridX * 2.55, 0, unit.gridZ * 2.55);
    targetColors.set(unit.id, colorFor(unit.currentLevel));
    applySelectionStyle(unit);
  }
}

function applySelectionStyle(unit: RiskUnit): void {
  const group = unitGroups.get(unit.id);
  if (!group) return;
  const selected = park.selectedUnitId === unit.id;
  const filteredOut = park.levelFilter !== null && unit.currentLevel !== park.levelFilter;
  const mats = riskMats.get(unit.id) || [];
  for (const mat of mats) {
    mat.opacity = filteredOut ? 0.16 : selected ? 1 : 0.96;
    mat.emissiveIntensity = selected ? 0.48 : filteredOut ? 0.05 : 0.22;
  }
  const ring = group.userData.ring as THREE.Mesh | undefined;
  if (ring) {
    const rm = ring.material as THREE.MeshBasicMaterial;
    rm.opacity = filteredOut ? 0.05 : selected ? 0.65 : 0.35;
  }
  group.scale.setScalar(selected ? 1.06 : 1);
  const label = labelSprites.get(unit.id);
  if (label) {
    label.visible = !filteredOut;
    (label.material as THREE.SpriteMaterial).opacity = selected ? 1 : 0.85;
  }
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

  for (const [id, mats] of riskMats) {
    const target = targetColors.get(id);
    if (!target) continue;
    for (const mat of mats) {
      mat.color.lerp(target, 0.18);
      mat.emissive.lerp(target, 0.18);
    }
    const group = unitGroups.get(id);
    const ring = group?.userData.ring as THREE.Mesh | undefined;
    if (ring) (ring.material as THREE.MeshBasicMaterial).color.lerp(target, 0.18);
  }

  if (raycaster && buildingGroup) {
    const id = pickUnitId();
    if (id && filteredIds.value.has(id)) {
      const unit = park.units.find((u) => u.id === id);
      if (unit) {
        tooltip.value.visible = true;
        tooltip.value.name = unit.name;
        tooltip.value.level = RISK_LEVEL_LABEL[unit.currentLevel];
        tooltip.value.triggers = unit.triggers.length;
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
  for (const group of unitGroups.values()) disposeObject(group);
  for (const label of labelSprites.values()) disposeObject(label);
  unitGroups.clear();
  labelSprites.clear();
  riskMats.clear();
  targetColors.clear();
  controls?.dispose();
  renderer = null;
  scene = null;
  camera = null;
  controls = null;
  buildingGroup = null;
  labelGroup = null;
}

watch(
  () => park.units.map((u) => `${u.id}:${u.currentLevel}:${u.height}`).join('|'),
  () => syncBuildings(park.units),
);

watch(
  () => [park.selectedUnitId, park.levelFilter] as const,
  () => {
    for (const unit of park.units) applySelectionStyle(unit);
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
