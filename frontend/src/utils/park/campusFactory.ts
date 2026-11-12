import * as THREE from 'three';
import { RISK_LEVEL_COLOR, type RiskLevel, type RiskUnit, type RiskZone } from '@/types/park';

export function colorFor(level: RiskLevel): THREE.Color {
  return new THREE.Color(RISK_LEVEL_COLOR[level]);
}

export function makeNeutral(color: number, metal = 0.2, rough = 0.7): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
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
  radial = 18,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radial), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addTree(parent: THREE.Object3D, x: number, z: number, scale = 1): void {
  const trunk = makeNeutral(0x5a3d28, 0.1, 0.9);
  const leaf = makeNeutral(0x1f6b4a, 0.05, 0.85);
  addCylinder(parent, 0.06 * scale, 0.08 * scale, 0.55 * scale, trunk, x, 0.3 * scale, z, 8);
  addCylinder(parent, 0.02 * scale, 0.42 * scale, 0.7 * scale, leaf, x, 0.85 * scale, z, 8);
}

function footprintRadius(form: RiskUnit['form']): number {
  switch (form) {
    case 'longshop':
    case 'gate':
      return 2.55;
    case 'tankfarm':
    case 'openyard':
    case 'loading':
      return 2.35;
    case 'warehouse':
    case 'blend':
      return 2.2;
    case 'office':
    case 'cooling':
      return 2.05;
    default:
      return 1.85;
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
      emissiveIntensity: alarmed ? 0.55 : selected ? 0.38 : 0.12,
      metalness: 0.18,
      roughness: 0.55,
      transparent: true,
      // 默认半透明，让外壳轮廓可见；告警时再抬亮
      opacity: alarmed ? 0.92 : selected ? 0.72 : 0.42,
    });
    zoneMats.set(zone.id, mat);

    const mesh = addBox(group, zone.lw, zone.lh, zone.ld, mat, zone.lx, zone.lh / 2 + 0.12, zone.lz);
    mesh.userData.unitId = unit.id;
    mesh.userData.zoneId = zone.id;
    mesh.userData.isZone = true;

    if (alarmed) {
      const beacon = makeNeutral(0xff6571, 0.2, 0.4);
      beacon.emissive = new THREE.Color('#F05252');
      beacon.emissiveIntensity = 0.7;
      addCylinder(group, 0.05, 0.05, zone.lh + 0.85, beacon, zone.lx, zone.lh / 2 + 0.65, zone.lz, 8);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xff6571, emissive: 0xff3040, emissiveIntensity: 0.9 }),
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

/** 按 form 做强差异化外壳 */
function buildShell(group: THREE.Group, unit: RiskUnit): void {
  const concrete = makeNeutral(0x1a3348, 0.1, 0.85);
  const steel = makeNeutral(0x7a92a3, 0.45, 0.4);
  const dark = makeNeutral(0x243846, 0.2, 0.7);
  const brick = makeNeutral(0x3a4f5e, 0.12, 0.82);
  const warm = makeNeutral(0x4a5560, 0.15, 0.78);
  const glass = makeNeutral(0x8ec8e0, 0.55, 0.2);
  glass.transparent = true;
  glass.opacity = 0.28;

  switch (unit.form) {
    case 'tankfarm': {
      // 露天罐区：围堰 + 双高罐 + 泵棚
      addBox(group, 4.6, 0.1, 4.0, concrete, 0, 0.05, 0);
      addBox(group, 4.4, 0.42, 0.14, steel, 0, 0.28, -1.85);
      addBox(group, 4.4, 0.42, 0.14, steel, 0, 0.28, 1.85);
      addBox(group, 0.14, 0.42, 3.6, steel, -2.15, 0.28, 0);
      addBox(group, 0.14, 0.42, 3.6, steel, 2.15, 0.28, 0);
      addCylinder(group, 0.85, 0.85, 2.8, steel, -0.95, 1.5, -0.35);
      addCylinder(group, 0.72, 0.72, 2.3, steel, 0.95, 1.25, -0.55);
      addCylinder(group, 0.88, 0.05, 0.12, dark, -0.95, 2.95, -0.35, 16);
      addCylinder(group, 0.75, 0.05, 0.1, dark, 0.95, 2.45, -0.55, 16);
      addBox(group, 2.2, 1.05, 1.1, warm, 0.2, 0.6, 1.35);
      addBox(group, 0.12, 1.6, 0.12, steel, -1.9, 0.9, 1.5);
      break;
    }
    case 'warehouse': {
      // 坡屋顶库房 + 装卸月台
      addBox(group, 4.8, 0.08, 3.4, concrete, 0, 0.04, 0);
      addBox(group, 4.4, 2.15, 2.9, brick, 0, 1.15, -0.1);
      const roofL = addBox(group, 2.4, 0.14, 3.15, steel, -1.15, 2.45, -0.1);
      roofL.rotation.z = 0.22;
      const roofR = addBox(group, 2.4, 0.14, 3.15, steel, 1.15, 2.45, -0.1);
      roofR.rotation.z = -0.22;
      addBox(group, 1.6, 0.35, 1.1, concrete, 0, 0.22, 1.55);
      addBox(group, 1.35, 1.55, 0.08, dark, 0, 0.95, 1.38);
      addBox(group, 0.65, 0.55, 0.05, glass, -1.35, 1.35, 1.38);
      addBox(group, 0.65, 0.55, 0.05, glass, 1.35, 1.35, 1.38);
      break;
    }
    case 'office': {
      // 两层条窗小楼
      addBox(group, 3.5, 0.08, 2.7, concrete, 0, 0.04, 0);
      addBox(group, 3.3, 1.25, 2.4, brick, 0, 0.72, 0);
      addBox(group, 3.1, 1.15, 2.2, warm, 0, 1.95, 0);
      addBox(group, 3.4, 0.12, 2.5, steel, 0, 2.65, 0);
      for (let i = -1; i <= 1; i++) {
        addBox(group, 0.55, 0.42, 0.05, glass, i * 0.9, 0.9, 1.22);
        addBox(group, 0.48, 0.38, 0.05, glass, i * 0.8, 2.05, 1.12);
      }
      addBox(group, 0.55, 0.95, 0.06, dark, -0.15, 0.55, 1.22);
      addBox(group, 0.35, 0.55, 0.35, dark, 1.35, 2.95, -0.6);
      break;
    }
    case 'cooling': {
      // 机房 + 高冷却塔
      addBox(group, 3.8, 0.1, 3.4, concrete, 0, 0.05, 0);
      addBox(group, 2.2, 1.55, 2.0, brick, -0.7, 0.85, -0.2);
      addBox(group, 2.35, 0.12, 2.15, steel, -0.7, 1.7, -0.2);
      addCylinder(group, 0.95, 1.15, 2.6, steel, 1.15, 1.4, 0.15, 16);
      addCylinder(group, 0.55, 0.55, 0.4, dark, 1.15, 2.85, 0.15, 12);
      addBox(group, 1.0, 0.85, 0.9, steel, -1.35, 0.5, 1.2);
      addCylinder(group, 0.12, 0.12, 1.8, steel, -0.2, 1.7, 1.3, 8);
      break;
    }
    case 'loading': {
      // 鹤管栈台 + 雨棚
      addBox(group, 4.2, 0.08, 3.6, concrete, 0, 0.04, 0);
      addBox(group, 3.4, 0.95, 1.5, steel, 0, 0.55, -0.45);
      addBox(group, 3.8, 0.1, 2.2, steel, 0, 1.45, -0.2);
      addBox(group, 0.16, 1.4, 0.16, steel, -1.7, 0.8, 0.9);
      addBox(group, 0.16, 1.4, 0.16, steel, 1.7, 0.8, 0.9);
      addBox(group, 0.16, 1.4, 0.16, steel, -1.7, 0.8, -1.3);
      addBox(group, 0.16, 1.4, 0.16, steel, 1.7, 0.8, -1.3);
      addCylinder(group, 0.07, 0.07, 2.2, steel, -0.7, 1.2, 1.35);
      addCylinder(group, 0.07, 0.07, 2.2, steel, 0.7, 1.2, 1.35);
      const arm = addBox(group, 1.4, 0.08, 0.08, steel, 0, 1.55, 1.55);
      arm.rotation.x = 0.45;
      break;
    }
    case 'gate': {
      // 门岗双亭 + 横杆通道
      addBox(group, 5.6, 0.08, 3.2, concrete, 0, 0.04, 0);
      addBox(group, 1.35, 1.7, 1.25, brick, -1.95, 0.95, -0.2);
      addBox(group, 1.35, 1.7, 1.25, brick, 1.95, 0.95, -0.2);
      addBox(group, 5.3, 0.16, 0.3, steel, 0, 2.15, -0.2);
      addBox(group, 0.12, 2.0, 0.12, steel, -2.55, 1.1, 1.0);
      addBox(group, 0.12, 2.0, 0.12, steel, 2.55, 1.1, 1.0);
      addBox(group, 5.0, 0.06, 1.9, makeNeutral(0x1a3042, 0.1, 0.9), 0, 0.07, 1.15);
      addBox(group, 0.08, 0.08, 2.4, steel, -0.6, 1.05, 0.4);
      addBox(group, 0.08, 0.08, 2.4, steel, 0.6, 1.05, 0.4);
      break;
    }
    case 'pumproom': {
      // 矮泵房 + 外露泵体
      addBox(group, 3.0, 0.08, 2.6, concrete, 0, 0.04, 0);
      addBox(group, 2.7, 1.55, 2.2, brick, -0.1, 0.85, -0.1);
      addBox(group, 2.85, 0.12, 2.35, steel, -0.1, 1.7, -0.1);
      addCylinder(group, 0.32, 0.32, 0.85, steel, 1.15, 0.55, 0.75);
      addCylinder(group, 0.22, 0.22, 0.55, dark, 1.15, 0.4, -0.35);
      addBox(group, 0.65, 1.0, 0.08, dark, -0.1, 0.6, 1.05);
      addBox(group, 0.35, 0.55, 0.35, steel, -1.1, 1.95, -0.7);
      break;
    }
    case 'electrical': {
      // 深色配电楼 + 变压器台
      addBox(group, 3.6, 0.08, 2.7, concrete, 0, 0.04, 0);
      addBox(group, 3.3, 2.05, 2.3, dark, 0, 1.1, 0);
      addBox(group, 3.45, 0.14, 2.45, steel, 0, 2.2, 0);
      addBox(group, 0.95, 1.25, 0.08, makeNeutral(0x445566, 0.3, 0.5), -0.85, 1.05, 1.18);
      addBox(group, 0.95, 1.25, 0.08, makeNeutral(0x445566, 0.3, 0.5), 0.85, 1.05, 1.18);
      addBox(group, 1.1, 0.7, 0.9, steel, 1.85, 0.45, -0.7);
      addBox(group, 0.28, 1.7, 0.28, steel, 1.9, 1.0, 0.85);
      addCylinder(group, 0.08, 0.08, 0.6, steel, 1.9, 2.05, 0.85, 8);
      break;
    }
    case 'openyard': {
      // 露天动火场：矮围栏 + 作业棚 + 龙门架
      addBox(group, 4.4, 0.08, 3.8, concrete, 0, 0.04, 0);
      addBox(group, 4.2, 0.28, 0.1, steel, 0, 0.2, -1.75);
      addBox(group, 0.1, 0.28, 3.4, steel, -2.05, 0.2, 0);
      addBox(group, 0.1, 0.28, 3.4, steel, 2.05, 0.2, 0);
      addBox(group, 1.8, 1.35, 1.5, warm, -1.1, 0.75, 0.55);
      addBox(group, 2.0, 0.1, 1.7, steel, -1.1, 1.5, 0.55);
      addBox(group, 0.18, 2.3, 0.18, steel, 1.55, 1.25, -0.9);
      addBox(group, 0.18, 2.3, 0.18, steel, 1.55, 1.25, 0.95);
      addBox(group, 0.15, 0.15, 2.0, steel, 1.55, 2.45, 0.05);
      addBox(group, 0.9, 0.45, 0.7, dark, 0.4, 0.3, -1.1);
      break;
    }
    case 'confined': {
      // 有限空间：罐体嵌入矮房
      addBox(group, 3.5, 0.08, 3.1, concrete, 0, 0.04, 0);
      addBox(group, 2.4, 1.9, 2.2, brick, -0.35, 1.05, -0.15);
      addCylinder(group, 0.7, 0.7, 2.0, steel, 0.15, 1.15, 0.1);
      addCylinder(group, 0.22, 0.22, 0.45, dark, 0.15, 2.35, 0.1, 10);
      addBox(group, 1.3, 1.35, 1.1, warm, 1.4, 0.75, 0.7);
      addBox(group, 2.55, 0.1, 2.35, steel, -0.35, 2.1, -0.15);
      break;
    }
    case 'longshop': {
      // 长条车间 + 侧烟囱 + 天窗
      addBox(group, 5.6, 0.08, 2.9, concrete, 0, 0.04, 0);
      addBox(group, 5.3, 2.35, 2.55, brick, 0, 1.25, 0);
      addBox(group, 5.5, 0.14, 2.75, steel, 0, 2.5, 0);
      addBox(group, 1.8, 0.35, 0.9, dark, -0.4, 2.75, 0);
      addBox(group, 1.1, 1.4, 0.08, dark, -1.6, 0.85, 1.3);
      addBox(group, 0.65, 0.5, 0.05, glass, 0.1, 1.35, 1.3);
      addBox(group, 0.65, 0.5, 0.05, glass, 1.15, 1.35, 1.3);
      addBox(group, 0.65, 0.5, 0.05, glass, 2.1, 1.35, 1.3);
      addCylinder(group, 0.18, 0.22, 1.7, steel, -2.3, 2.2, -0.75);
      break;
    }
    case 'blend':
    default: {
      // L 型反应厂房 + 高位烟囱
      addBox(group, 4.2, 0.08, 3.7, concrete, 0, 0.04, 0);
      addBox(group, 2.6, 2.5, 2.3, brick, -0.55, 1.35, -0.45);
      addBox(group, 1.8, 1.75, 2.0, warm, 1.3, 0.95, 0.75);
      addBox(group, 2.8, 0.12, 2.5, steel, -0.55, 2.7, -0.45);
      addBox(group, 2.0, 0.1, 2.2, steel, 1.3, 1.9, 0.75);
      addBox(group, 0.75, 1.2, 0.08, dark, -0.4, 0.7, 0.75);
      addBox(group, 0.55, 0.5, 0.05, glass, -1.25, 1.5, 0.75);
      addCylinder(group, 0.14, 0.18, 1.35, steel, 0.25, 3.2, -0.95);
      addBox(group, 0.7, 0.55, 0.7, dark, 1.5, 2.2, 0.3);
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
    new THREE.RingGeometry(r - 0.22, r, 48),
    new THREE.MeshBasicMaterial({
      color: colorFor(unit.currentLevel),
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.09;
  group.add(ring);

  return { group, zoneMats, ring };
}

export function buildCampusDecor(scene: THREE.Scene): void {
  const decor = new THREE.Group();
  decor.name = 'campus-decor';

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 40),
    new THREE.MeshStandardMaterial({ color: 0x081820, metalness: 0.05, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  decor.add(ground);

  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 36),
    new THREE.MeshStandardMaterial({ color: 0x0d2c22, metalness: 0.04, roughness: 0.92 }),
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = 0.01;
  decor.add(lawn);

  // 硬化场地块（轴对齐，尺寸/位置错落）
  const pads: Array<[number, number, number, number]> = [
    [11, 9, -9.5, -8.5],
    [10, 8, 6.5, -7.5],
    [8, 7, -12, -0.5],
    [9, 7, 4, -1],
    [10, 6, -8, 3.5],
    [9, 7, 9, 5],
    [8, 5, -11, 8],
    [7, 4.5, 1.2, 11.2],
  ];
  for (const [w, d, x, z] of pads) {
    addBox(decor, w, 0.04, d, makeNeutral(0x102437, 0.1, 0.9), x, 0.03, z);
  }

  const roadMat = makeNeutral(0x152a3d, 0.08, 0.92);
  // 正交路网：横纵干道 + 支路
  addBox(decor, 30, 0.05, 1.6, roadMat, -1, 0.04, -3.2);
  addBox(decor, 1.55, 0.05, 24, roadMat, 1.8, 0.04, 1.5);
  addBox(decor, 18, 0.05, 1.25, roadMat, 8, 0.04, 5.2);
  addBox(decor, 16, 0.05, 1.2, roadMat, -8, 0.04, 4.0);
  addBox(decor, 1.3, 0.05, 11, roadMat, -5.8, 0.04, -7.2);

  // 围墙 + 南门楣
  const wall = makeNeutral(0x173247, 0.15, 0.8);
  const lintel = makeNeutral(0x6f8798, 0.45, 0.4);
  addBox(decor, 44, 0.85, 0.14, wall, 0, 0.42, -16);
  addBox(decor, 44, 0.85, 0.14, wall, 0, 0.42, 16);
  addBox(decor, 0.14, 0.85, 32, wall, -21.5, 0.42, 0);
  addBox(decor, 0.14, 0.85, 32, wall, 21.5, 0.42, 0);
  addBox(decor, 5.2, 0.2, 0.25, lintel, 1.2, 2.1, 15.7);
  addBox(decor, 0.35, 2.0, 0.35, wall, -1.3, 1.1, 15.7);
  addBox(decor, 0.35, 2.0, 0.35, wall, 3.7, 1.1, 15.7);

  // 停车场偏一侧
  addBox(decor, 6.2, 0.04, 3.6, makeNeutral(0x1a3042, 0.1, 0.9), -16.5, 0.05, 11.8);
  for (let i = 0; i < 5; i++) {
    addBox(decor, 1.0, 0.02, 2.2, makeNeutral(0x243c50, 0.1, 0.85), -18.5 + i * 1.2, 0.08, 11.8);
  }

  // 绿化散点
  const trees: Array<[number, number, number]> = [
    [-18, -12, 1.1],
    [-15, -13.2, 0.85],
    [16.5, -12.5, 1.2],
    [19, -10.5, 0.9],
    [-19, 4.5, 1],
    [-17, 9.5, 0.8],
    [17.5, 7, 1.15],
    [15, 13, 0.95],
    [-9, 13.5, 0.75],
    [9.5, -13, 1.05],
    [0.5, -14, 0.7],
    [-14, -5, 0.9],
  ];
  for (const [x, z, s] of trees) addTree(decor, x, z, s);

  // 水池
  const water = makeNeutral(0x1a5f78, 0.35, 0.25);
  water.transparent = true;
  water.opacity = 0.55;
  addBox(decor, 4.2, 0.08, 2.4, water, 16, 0.06, -12.5);

  scene.add(decor);
}
