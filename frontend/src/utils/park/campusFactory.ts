import * as THREE from 'three';
import { RISK_LEVEL_COLOR, type RiskLevel, type RiskUnit, type RiskZone } from '@/types/park';

export function colorFor(level: RiskLevel): THREE.Color {
  return new THREE.Color(RISK_LEVEL_COLOR[level]);
}

/** 园区整体尺度：放大后减少“桌面沙盘/玩具”感 */
export const CAMPUS_SCALE = 1.55;

export function makeNeutral(color: number, metal = 0.2, rough = 0.7): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
}

function makeGlass(color = 0x7fa8b8, opacity = 0.28): THREE.MeshStandardMaterial {
  const glass = makeNeutral(color, 0.35, 0.22);
  glass.transparent = true;
  glass.opacity = opacity;
  glass.emissive = new THREE.Color(0x243a48);
  glass.emissiveIntensity = 0.12;
  return glass;
}

export function addBox(
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

export function addCylinder(
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

function addTree(parent: THREE.Object3D, x: number, z: number, scale = 1): void {
  const trunk = makeNeutral(0x4a3424, 0.08, 0.92);
  const leafA = makeNeutral(0x1a6b48, 0.04, 0.88);
  const leafB = makeNeutral(0x24855a, 0.05, 0.82);
  addCylinder(parent, 0.05 * scale, 0.08 * scale, 0.58 * scale, trunk, x, 0.32 * scale, z, 8);
  addCylinder(parent, 0.02 * scale, 0.38 * scale, 0.55 * scale, leafA, x, 0.78 * scale, z, 10);
  addCylinder(parent, 0.01 * scale, 0.28 * scale, 0.42 * scale, leafB, x, 1.12 * scale, z, 10);
}

function addStreetLamp(
  parent: THREE.Object3D,
  x: number,
  z: number,
  lampLights: THREE.PointLight[],
): void {
  const pole = makeNeutral(0x5a6e7c, 0.4, 0.48);
  const glow = new THREE.MeshStandardMaterial({
    color: 0xffe6b0,
    emissive: 0xffc56a,
    emissiveIntensity: 0.95,
    metalness: 0.15,
    roughness: 0.45,
  });
  addCylinder(parent, 0.05, 0.06, 2.1, pole, x, 1.05, z, 8);
  addBox(parent, 0.34, 0.05, 0.1, pole, x, 2.12, z);
  addCylinder(parent, 0.07, 0.09, 0.1, glow, x, 2.05, z, 10);
  const light = new THREE.PointLight(0xffd4a0, 0, 14, 1.8);
  light.position.set(x, 2.05, z);
  parent.add(light);
  lampLights.push(light);
}

function footprintRadius(form: RiskUnit['form']): number {
  switch (form) {
    case 'longshop':
    case 'gate':
      return 2.95;
    case 'tankfarm':
    case 'openyard':
    case 'loading':
      return 2.7;
    case 'warehouse':
    case 'blend':
      return 2.55;
    case 'office':
    case 'cooling':
      return 2.35;
    default:
      return 2.15;
  }
}

function addZones(
  group: THREE.Group,
  unit: RiskUnit,
  zones: RiskZone[],
  alarmedZoneIds: Set<string>,
  selectedZoneId: string | null,
  zoneMats: Map<string, THREE.MeshStandardMaterial>,
): void {
  for (const zone of zones) {
    const alarmed = alarmedZoneIds.has(zone.id);
    const selected = selectedZoneId === zone.id;
    const mat = new THREE.MeshStandardMaterial({
      color: colorFor(zone.currentLevel),
      emissive: colorFor(zone.currentLevel),
      emissiveIntensity: alarmed ? 0.55 : selected ? 0.38 : 0.1,
      metalness: 0.16,
      roughness: 0.52,
      transparent: true,
      opacity: alarmed ? 0.9 : selected ? 0.68 : 0.36,
    });
    zoneMats.set(zone.id, mat);

    const mesh = addBox(group, zone.lw, zone.lh, zone.ld, mat, zone.lx, zone.lh / 2 + 0.12, zone.lz);
    mesh.userData.unitId = unit.id;
    mesh.userData.zoneId = zone.id;
    mesh.userData.isZone = true;

    if (alarmed) {
      const beacon = makeNeutral(0xff6571, 0.2, 0.4);
      beacon.emissive = new THREE.Color('#F05252');
      beacon.emissiveIntensity = 0.75;
      addCylinder(group, 0.05, 0.05, zone.lh + 0.85, beacon, zone.lx, zone.lh / 2 + 0.65, zone.lz, 8);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xff6571, emissive: 0xff3040, emissiveIntensity: 1.0 }),
      );
      lamp.position.set(zone.lx, zone.lh + 0.95, zone.lz);
      lamp.userData.unitId = unit.id;
      lamp.userData.zoneId = zone.id;
      group.add(lamp);
    }

    if (selected) {
      addBox(
        group,
        zone.lw + 0.08,
        0.05,
        zone.ld + 0.08,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
        zone.lx,
        zone.lh + 0.16,
        zone.lz,
      ).userData.zoneId = zone.id;
    }
  }
}

/** 按 form 做强差异化外壳（偏工业混凝土/锈钢，降低玩具感） */
function buildShell(group: THREE.Group, unit: RiskUnit): void {
  const concrete = makeNeutral(0x2c4252, 0.08, 0.92);
  const pad = makeNeutral(0x243848, 0.05, 0.94);
  const steel = makeNeutral(0x6e8494, 0.38, 0.52);
  const dark = makeNeutral(0x2a3845, 0.18, 0.78);
  const brick = makeNeutral(0x4a5c68, 0.1, 0.86);
  const warm = makeNeutral(0x556370, 0.12, 0.82);
  const accent = makeNeutral(0x3d5868, 0.22, 0.58);
  const glassBright = makeGlass(0x8eb0c0, 0.34);

  switch (unit.form) {
    case 'tankfarm': {
      addBox(group, 4.8, 0.08, 4.2, pad, 0, 0.04, 0);
      addBox(group, 4.5, 0.38, 0.12, steel, 0, 0.26, -1.95);
      addBox(group, 4.5, 0.38, 0.12, steel, 0, 0.26, 1.95);
      addBox(group, 0.12, 0.38, 3.8, steel, -2.2, 0.26, 0);
      addBox(group, 0.12, 0.38, 3.8, steel, 2.2, 0.26, 0);
      addCylinder(group, 0.9, 0.9, 3.0, steel, -0.95, 1.6, -0.35, 24);
      addCylinder(group, 0.76, 0.76, 2.45, steel, 0.95, 1.32, -0.55, 24);
      addCylinder(group, 0.92, 0.92, 0.08, dark, -0.95, 2.55, -0.35, 24);
      addCylinder(group, 0.78, 0.78, 0.08, dark, 0.95, 2.0, -0.55, 24);
      addCylinder(group, 0.94, 0.05, 0.12, accent, -0.95, 3.15, -0.35, 16);
      addCylinder(group, 0.8, 0.05, 0.1, accent, 0.95, 2.6, -0.55, 16);
      addBox(group, 2.3, 1.1, 1.15, warm, 0.15, 0.62, 1.4);
      addBox(group, 2.4, 0.06, 1.25, steel, 0.15, 1.2, 1.4);
      addBox(group, 0.1, 1.7, 0.1, steel, -1.95, 0.95, 1.55);
      addBox(group, 0.1, 1.7, 0.1, steel, 1.9, 0.95, 1.55);
      break;
    }
    case 'warehouse': {
      addBox(group, 5.0, 0.08, 3.5, pad, 0, 0.04, 0);
      addBox(group, 4.5, 2.2, 3.0, brick, 0, 1.18, -0.08);
      addBox(group, 4.55, 0.08, 3.05, accent, 0, 2.28, -0.08);
      const roofL = addBox(group, 2.45, 0.12, 3.2, steel, -1.18, 2.52, -0.08);
      roofL.rotation.z = 0.2;
      const roofR = addBox(group, 2.45, 0.12, 3.2, steel, 1.18, 2.52, -0.08);
      roofR.rotation.z = -0.2;
      addBox(group, 1.7, 0.38, 1.15, concrete, 0, 0.24, 1.6);
      addBox(group, 1.4, 1.6, 0.08, dark, 0, 0.98, 1.45);
      addBox(group, 0.7, 0.58, 0.05, glassBright, -1.4, 1.4, 1.45);
      addBox(group, 0.7, 0.58, 0.05, glassBright, 1.4, 1.4, 1.45);
      break;
    }
    case 'office': {
      addBox(group, 3.6, 0.08, 2.8, pad, 0, 0.04, 0);
      addBox(group, 3.35, 1.28, 2.45, brick, 0, 0.74, 0);
      addBox(group, 3.15, 1.18, 2.25, warm, 0, 2.0, 0);
      addBox(group, 3.45, 0.1, 2.55, steel, 0, 2.7, 0);
      addBox(group, 3.2, 0.04, 0.06, accent, 0, 1.4, 1.24);
      for (let i = -1; i <= 1; i++) {
        addBox(group, 0.58, 0.45, 0.05, glassBright, i * 0.92, 0.92, 1.25);
        addBox(group, 0.5, 0.4, 0.05, glassBright, i * 0.82, 2.08, 1.15);
      }
      addBox(group, 0.55, 0.98, 0.06, dark, -0.15, 0.56, 1.25);
      addBox(group, 0.32, 0.5, 0.32, dark, 1.4, 3.0, -0.55);
      break;
    }
    case 'cooling': {
      addBox(group, 4.0, 0.1, 3.5, pad, 0, 0.05, 0);
      addBox(group, 2.3, 1.6, 2.1, brick, -0.7, 0.9, -0.15);
      addBox(group, 2.4, 0.1, 2.2, steel, -0.7, 1.75, -0.15);
      addCylinder(group, 0.98, 1.18, 2.75, steel, 1.2, 1.48, 0.12, 20);
      addCylinder(group, 0.58, 0.58, 0.35, dark, 1.2, 3.0, 0.12, 14);
      addBox(group, 1.05, 0.9, 0.95, steel, -1.4, 0.52, 1.25);
      addCylinder(group, 0.1, 0.1, 1.9, steel, -0.15, 1.8, 1.35, 8);
      break;
    }
    case 'loading': {
      addBox(group, 4.4, 0.08, 3.7, pad, 0, 0.04, 0);
      addBox(group, 3.5, 1.0, 1.55, steel, 0, 0.58, -0.45);
      addBox(group, 3.9, 0.08, 2.3, steel, 0, 1.5, -0.15);
      for (const sx of [-1.75, 1.75]) {
        for (const sz of [-1.35, 0.95]) addBox(group, 0.14, 1.45, 0.14, steel, sx, 0.82, sz);
      }
      addCylinder(group, 0.07, 0.07, 2.25, steel, -0.7, 1.25, 1.4);
      addCylinder(group, 0.07, 0.07, 2.25, steel, 0.7, 1.25, 1.4);
      const arm = addBox(group, 1.45, 0.07, 0.07, accent, 0, 1.6, 1.6);
      arm.rotation.x = 0.42;
      break;
    }
    case 'gate': {
      addBox(group, 5.8, 0.08, 3.3, pad, 0, 0.04, 0);
      addBox(group, 1.4, 1.75, 1.3, brick, -2.0, 0.98, -0.15);
      addBox(group, 1.4, 1.75, 1.3, brick, 2.0, 0.98, -0.15);
      addBox(group, 0.55, 0.45, 0.05, glassBright, -2.0, 1.15, 0.52);
      addBox(group, 0.55, 0.45, 0.05, glassBright, 2.0, 1.15, 0.52);
      addBox(group, 5.4, 0.14, 0.28, steel, 0, 2.2, -0.15);
      addBox(group, 0.12, 2.05, 0.12, steel, -2.6, 1.12, 1.05);
      addBox(group, 0.12, 2.05, 0.12, steel, 2.6, 1.12, 1.05);
      addBox(group, 5.1, 0.05, 1.95, makeNeutral(0x1a3042, 0.1, 0.9), 0, 0.07, 1.2);
      addBox(group, 0.08, 0.08, 2.5, accent, -0.55, 1.08, 0.45);
      addBox(group, 0.08, 0.08, 2.5, accent, 0.55, 1.08, 0.45);
      break;
    }
    case 'pumproom': {
      addBox(group, 3.2, 0.08, 2.7, pad, 0, 0.04, 0);
      addBox(group, 2.8, 1.6, 2.3, brick, -0.1, 0.9, -0.08);
      addBox(group, 2.95, 0.1, 2.4, steel, -0.1, 1.75, -0.08);
      addCylinder(group, 0.34, 0.34, 0.9, steel, 1.2, 0.58, 0.78);
      addCylinder(group, 0.24, 0.24, 0.58, dark, 1.2, 0.42, -0.35);
      addBox(group, 0.68, 1.05, 0.08, dark, -0.1, 0.62, 1.1);
      addBox(group, 0.36, 0.55, 0.36, steel, -1.15, 2.0, -0.7);
      break;
    }
    case 'electrical': {
      addBox(group, 3.7, 0.08, 2.8, pad, 0, 0.04, 0);
      addBox(group, 3.35, 2.1, 2.35, dark, 0, 1.15, 0);
      addBox(group, 3.5, 0.12, 2.5, steel, 0, 2.25, 0);
      addBox(group, 1.0, 1.3, 0.08, makeNeutral(0x516677, 0.35, 0.45), -0.9, 1.1, 1.2);
      addBox(group, 1.0, 1.3, 0.08, makeNeutral(0x516677, 0.35, 0.45), 0.9, 1.1, 1.2);
      addBox(group, 1.15, 0.72, 0.95, steel, 1.9, 0.48, -0.7);
      addBox(group, 0.28, 1.75, 0.28, steel, 1.95, 1.05, 0.9);
      addCylinder(group, 0.08, 0.08, 0.55, accent, 1.95, 2.15, 0.9, 8);
      break;
    }
    case 'openyard': {
      addBox(group, 4.5, 0.08, 3.9, pad, 0, 0.04, 0);
      addBox(group, 4.3, 0.28, 0.1, steel, 0, 0.2, -1.8);
      addBox(group, 0.1, 0.28, 3.5, steel, -2.1, 0.2, 0);
      addBox(group, 0.1, 0.28, 3.5, steel, 2.1, 0.2, 0);
      addBox(group, 1.85, 1.4, 1.55, warm, -1.15, 0.78, 0.55);
      addBox(group, 2.05, 0.08, 1.75, steel, -1.15, 1.55, 0.55);
      addBox(group, 0.16, 2.35, 0.16, steel, 1.6, 1.28, -0.9);
      addBox(group, 0.16, 2.35, 0.16, steel, 1.6, 1.28, 1.0);
      addBox(group, 0.14, 0.14, 2.05, accent, 1.6, 2.5, 0.05);
      addBox(group, 0.95, 0.48, 0.75, dark, 0.4, 0.32, -1.15);
      break;
    }
    case 'confined': {
      addBox(group, 3.6, 0.08, 3.2, pad, 0, 0.04, 0);
      addBox(group, 2.45, 1.95, 2.25, brick, -0.35, 1.08, -0.12);
      addCylinder(group, 0.72, 0.72, 2.1, steel, 0.15, 1.2, 0.12, 22);
      addCylinder(group, 0.24, 0.24, 0.42, dark, 0.15, 2.42, 0.12, 12);
      addBox(group, 1.35, 1.4, 1.15, warm, 1.45, 0.78, 0.72);
      addBox(group, 2.6, 0.08, 2.4, steel, -0.35, 2.15, -0.12);
      break;
    }
    case 'longshop': {
      addBox(group, 5.8, 0.08, 3.0, pad, 0, 0.04, 0);
      addBox(group, 5.4, 2.4, 2.6, brick, 0, 1.28, 0);
      addBox(group, 5.55, 0.1, 2.75, steel, 0, 2.55, 0);
      addBox(group, 1.9, 0.32, 0.95, dark, -0.35, 2.82, 0);
      addBox(group, 5.2, 0.04, 0.05, accent, 0, 1.55, 1.32);
      addBox(group, 1.15, 1.45, 0.08, dark, -1.65, 0.88, 1.33);
      addBox(group, 0.68, 0.52, 0.05, glassBright, 0.15, 1.4, 1.33);
      addBox(group, 0.68, 0.52, 0.05, glassBright, 1.2, 1.4, 1.33);
      addBox(group, 0.68, 0.52, 0.05, glassBright, 2.15, 1.4, 1.33);
      addCylinder(group, 0.18, 0.22, 1.8, steel, -2.35, 2.3, -0.78);
      break;
    }
    case 'blend':
    default: {
      addBox(group, 4.4, 0.08, 3.8, pad, 0, 0.04, 0);
      addBox(group, 2.65, 2.55, 2.35, brick, -0.55, 1.38, -0.42);
      addBox(group, 1.85, 1.8, 2.05, warm, 1.3, 0.98, 0.78);
      addBox(group, 2.85, 0.1, 2.55, steel, -0.55, 2.75, -0.42);
      addBox(group, 2.05, 0.08, 2.25, steel, 1.3, 1.95, 0.78);
      addBox(group, 0.78, 1.25, 0.08, dark, -0.4, 0.72, 0.8);
      addBox(group, 0.58, 0.52, 0.05, glassBright, -1.25, 1.55, 0.8);
      addCylinder(group, 0.14, 0.18, 1.4, steel, 0.25, 3.25, -0.95);
      addBox(group, 0.72, 0.55, 0.72, dark, 1.5, 2.25, 0.3);
      break;
    }
  }
}

export function buildUnitWithZones(
  unit: RiskUnit,
  zones: RiskZone[],
  alarmedZoneIds: Set<string>,
  selectedZoneId: string | null,
): { group: THREE.Group; zoneMats: Map<string, THREE.MeshStandardMaterial>; ring: THREE.Mesh } {
  const group = new THREE.Group();
  group.userData.unitId = unit.id;

  buildShell(group, unit);

  const zoneMats = new Map<string, THREE.MeshStandardMaterial>();
  addZones(group, unit, zones, alarmedZoneIds, selectedZoneId, zoneMats);

  const r = footprintRadius(unit.form);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r - 0.2, r + 0.02, 64),
    new THREE.MeshBasicMaterial({
      color: colorFor(unit.currentLevel),
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);

  return { group, zoneMats, ring };
}

export function buildCampusDecor(scene: THREE.Scene): {
  groundMat: THREE.MeshStandardMaterial;
  apronMat: THREE.MeshStandardMaterial;
  lampLights: THREE.PointLight[];
  root: THREE.Group;
} {
  const decor = new THREE.Group();
  decor.name = 'campus-decor';
  const lampLights: THREE.PointLight[] = [];

  // 外围延展：同系混凝土灰，避免蓝黑托盘感
  const apronMat = new THREE.MeshStandardMaterial({
    color: 0x151e28,
    metalness: 0.02,
    roughness: 0.98,
  });
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(108, 86), apronMat);
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.04;
  apron.receiveShadow = true;
  decor.add(apron);

  // 厚底托：让园区像落地基座，而不是薄片
  const skirt = makeNeutral(0x182430, 0.04, 0.96);
  addBox(decor, 72, 1.35, 56, skirt, 0, -0.72, 0);
  addBox(decor, 74, 0.22, 58, makeNeutral(0x1c2834, 0.05, 0.94), 0, -0.08, 0);

  // 主场地：工业混凝土灰，不再铺整片蓝/绿
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x24323e,
    metalness: 0.03,
    roughness: 0.94,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 54), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  decor.add(ground);

  // 仅边角绿化，不铺满整园
  const turf = makeNeutral(0x2a4034, 0.03, 0.92);
  for (const [w, d, x, z] of [
    [5.2, 2.6, -18, -10],
    [4.4, 3.0, 17, -9.5],
    [5.8, 2.4, -17, 7],
    [4.2, 2.8, 16, 11],
    [3.6, 1.8, -20, 0],
    [3.2, 1.6, 20, -2],
  ] as Array<[number, number, number, number]>) {
    addBox(decor, w, 0.03, d, turf, x, 0.02, z);
  }

  const pads: Array<[number, number, number, number]> = [
    [12, 10, -9.5, -8.5],
    [11, 9, 6.5, -7.5],
    [9, 8, -12, -0.5],
    [10, 8, 4, -1],
    [11, 7, -8, 3.5],
    [10, 8, 9, 5],
    [9, 6, -11, 8],
    [8, 5.2, 1.2, 11.2],
  ];
  const padMat = makeNeutral(0x2c3844, 0.05, 0.9);
  const curb = makeNeutral(0x3a4652, 0.08, 0.82);
  for (const [w, d, x, z] of pads) {
    addBox(decor, w, 0.06, d, padMat, x, 0.04, z);
    addBox(decor, w + 0.2, 0.04, 0.1, curb, x, 0.06, z - d / 2);
    addBox(decor, w + 0.2, 0.04, 0.1, curb, x, 0.06, z + d / 2);
  }

  const roadMat = makeNeutral(0x222c36, 0.04, 0.93);
  const mark = makeNeutral(0x5a6874, 0.1, 0.7);
  const roads: Array<[number, number, number, number]> = [
    [34, 2.0, -1, -3.2],
    [2.0, 28, 1.8, 1.5],
    [20, 1.55, 8, 5.2],
    [18, 1.5, -8, 4.0],
    [1.6, 13, -5.8, -7.2],
  ];
  for (const [w, d, x, z] of roads) {
    addBox(decor, w, 0.06, d, roadMat, x, 0.05, z);
    if (w > d) addBox(decor, w * 0.7, 0.012, 0.07, mark, x, 0.085, z);
    else addBox(decor, 0.07, 0.012, d * 0.7, mark, x, 0.085, z);
  }

  // 围墙 + 南门（略加高加厚）
  const wall = makeNeutral(0x243e50, 0.14, 0.82);
  const lintel = makeNeutral(0x6a8090, 0.35, 0.48);
  addBox(decor, 52, 1.25, 0.22, wall, 0, 0.62, -18.5);
  addBox(decor, 52, 1.25, 0.22, wall, 0, 0.62, 18.5);
  addBox(decor, 0.22, 1.25, 37, wall, -25.5, 0.62, 0);
  addBox(decor, 0.22, 1.25, 37, wall, 25.5, 0.62, 0);
  addBox(decor, 6.2, 0.28, 0.36, lintel, 1.2, 2.55, 18.2);
  addBox(decor, 0.48, 2.45, 0.48, wall, -1.55, 1.3, 18.2);
  addBox(decor, 0.48, 2.45, 0.48, wall, 3.95, 1.3, 18.2);

  // 停车场
  addBox(decor, 7.2, 0.05, 4.2, makeNeutral(0x1a3042, 0.08, 0.92), -18, 0.06, 13);
  for (let i = 0; i < 5; i++) {
    addBox(decor, 1.15, 0.02, 2.5, makeNeutral(0x253d52, 0.08, 0.88), -20.2 + i * 1.35, 0.09, 13);
  }

  const trees: Array<[number, number, number]> = [
    [-20, -13.5, 1.35],
    [-17, -14.8, 1.05],
    [-19.2, -11.5, 0.9],
    [18.5, -14, 1.4],
    [21, -11.5, 1.1],
    [19.8, -15, 0.95],
    [-21.5, 5, 1.2],
    [-19, 10.5, 1.0],
    [19.5, 8, 1.35],
    [17, 14.5, 1.1],
    [-10, 15, 0.92],
    [10.5, -14.5, 1.2],
    [0.5, -16, 0.85],
    [-16, -5.5, 1.05],
    [14, 14, 1.0],
  ];
  for (const [x, z, s] of trees) addTree(decor, x, z, s);

  // 路灯（夜间补光）
  for (const [x, z] of [
    [-6, -3.2],
    [8, -3.2],
    [1.8, -7],
    [1.8, 7],
    [-11, 4],
    [13, 5.2],
    [-16, -9],
    [14, -8],
    [-8, 10],
    [6, 12],
  ] as Array<[number, number]>) {
    addStreetLamp(decor, x, z, lampLights);
  }

  // 水池 + 边缘
  const water = makeNeutral(0x1a5a72, 0.28, 0.28);
  water.transparent = true;
  water.opacity = 0.58;
  water.emissive = new THREE.Color(0x0a3040);
  water.emissiveIntensity = 0.12;
  addBox(decor, 5.0, 0.08, 2.9, makeNeutral(0x2a4558, 0.14, 0.78), 18, 0.06, -14);
  addBox(decor, 4.5, 0.06, 2.45, water, 18, 0.1, -14);

  // 低矮管廊支架（短段，不斜穿）
  const pipe = makeNeutral(0x687e8c, 0.4, 0.45);
  addBox(decor, 7.2, 0.12, 0.12, pipe, -10, 1.85, -9.5);
  addBox(decor, 0.12, 1.7, 0.12, pipe, -13.2, 0.95, -9.5);
  addBox(decor, 0.12, 1.7, 0.12, pipe, -6.8, 0.95, -9.5);
  addBox(decor, 6.2, 0.12, 0.12, pipe, 9, 1.85, -8.2);
  addBox(decor, 0.12, 1.7, 0.12, pipe, 6.2, 0.95, -8.2);
  addBox(decor, 0.12, 1.7, 0.12, pipe, 11.8, 0.95, -8.2);

  scene.add(decor);
  return { groundMat, apronMat, lampLights, root: decor };
}
