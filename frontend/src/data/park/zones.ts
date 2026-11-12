import type { RiskZone } from '@/types/park';

/** 各风险单元内部独立区域（随建筑形态略有不同排布） */
export function createBaseZones(): RiskZone[] {
  return [
    // U01 L型反应调配
    { id: 'Z01-A', unitId: 'U01', name: '反应间', lx: -0.7, lz: -0.35, lw: 1.4, ld: 1.5, lh: 1.8, currentLevel: 'red' },
    { id: 'Z01-B', unitId: 'U01', name: '暂存间', lx: 1.2, lz: 0.65, lw: 1.05, ld: 1.15, lh: 1.35, currentLevel: 'orange' },
    { id: 'Z01-C', unitId: 'U01', name: '灌装间', lx: -0.45, lz: 0.95, lw: 1.15, ld: 0.85, lh: 1.15, currentLevel: 'yellow' },

    // U02 罐区
    { id: 'Z02-A', unitId: 'U02', name: '1#罐位', lx: -0.95, lz: -0.35, lw: 1.3, ld: 1.3, lh: 2.6, currentLevel: 'orange' },
    { id: 'Z02-B', unitId: 'U02', name: '2#罐位', lx: 0.95, lz: -0.55, lw: 1.15, ld: 1.15, lh: 2.2, currentLevel: 'yellow' },
    { id: 'Z02-C', unitId: 'U02', name: '泵棚', lx: 0.2, lz: 1.35, lw: 1.9, ld: 0.75, lh: 0.95, currentLevel: 'yellow' },

    // U03 长厂房
    { id: 'Z03-A', unitId: 'U03', name: 'A1工段', lx: -1.6, lz: 0.05, lw: 1.6, ld: 1.55, lh: 1.8, currentLevel: 'yellow' },
    { id: 'Z03-B', unitId: 'U03', name: 'A2工段', lx: 0.35, lz: 0.05, lw: 1.6, ld: 1.55, lh: 1.8, currentLevel: 'yellow' },
    { id: 'Z03-C', unitId: 'U03', name: '控制室', lx: 1.95, lz: -0.55, lw: 1.0, ld: 0.9, lh: 1.15, currentLevel: 'blue' },

    // U04 露天动火场
    { id: 'Z04-A', unitId: 'U04', name: '动火点A', lx: -1.0, lz: 0.55, lw: 1.35, ld: 1.25, lh: 1.2, currentLevel: 'orange' },
    { id: 'Z04-B', unitId: 'U04', name: '动火点B', lx: 0.95, lz: -0.15, lw: 1.25, ld: 1.35, lh: 1.2, currentLevel: 'yellow' },
    { id: 'Z04-C', unitId: 'U04', name: '材料堆场', lx: -0.15, lz: -1.2, lw: 1.85, ld: 0.7, lh: 0.85, currentLevel: 'blue' },

    // U05 冷却站
    { id: 'Z05-A', unitId: 'U05', name: '循环泵区', lx: -0.75, lz: -0.15, lw: 1.35, ld: 1.3, lh: 1.3, currentLevel: 'orange' },
    { id: 'Z05-B', unitId: 'U05', name: '冷却塔位', lx: 1.15, lz: 0.15, lw: 1.25, ld: 1.25, lh: 2.1, currentLevel: 'yellow' },
    { id: 'Z05-C', unitId: 'U05', name: '配电廊', lx: -1.3, lz: 1.15, lw: 0.95, ld: 0.7, lh: 0.85, currentLevel: 'blue' },

    // U06 库房
    { id: 'Z06-A', unitId: 'U06', name: '原料堆垛', lx: -1.1, lz: -0.15, lw: 1.55, ld: 1.7, lh: 1.55, currentLevel: 'yellow' },
    { id: 'Z06-B', unitId: 'U06', name: '辅料区', lx: 1.05, lz: -0.2, lw: 1.45, ld: 1.55, lh: 1.45, currentLevel: 'yellow' },
    { id: 'Z06-C', unitId: 'U06', name: '装卸月台', lx: 0.05, lz: 1.35, lw: 1.5, ld: 0.7, lh: 0.9, currentLevel: 'blue' },

    // U07 有限空间
    { id: 'Z07-A', unitId: 'U07', name: '反应釜位', lx: 0.1, lz: 0.05, lw: 1.2, ld: 1.2, lh: 1.85, currentLevel: 'yellow' },
    { id: 'Z07-B', unitId: 'U07', name: '人孔作业点', lx: -0.85, lz: -0.35, lw: 1.1, ld: 1.1, lh: 1.4, currentLevel: 'yellow' },
    { id: 'Z07-C', unitId: 'U07', name: '监护棚', lx: 1.35, lz: 0.7, lw: 1.0, ld: 0.9, lh: 1.1, currentLevel: 'blue' },

    // U08 装卸
    { id: 'Z08-A', unitId: 'U08', name: '1#鹤位', lx: -0.85, lz: 0.85, lw: 1.15, ld: 1.0, lh: 1.35, currentLevel: 'yellow' },
    { id: 'Z08-B', unitId: 'U08', name: '2#鹤位', lx: 0.85, lz: 0.85, lw: 1.15, ld: 1.0, lh: 1.35, currentLevel: 'yellow' },
    { id: 'Z08-C', unitId: 'U08', name: '栈台', lx: 0.05, lz: -0.55, lw: 2.4, ld: 1.15, lh: 0.95, currentLevel: 'blue' },

    // U09 办公
    { id: 'Z09-A', unitId: 'U09', name: '一楼办公', lx: -0.15, lz: 0.05, lw: 2.0, ld: 1.5, lh: 1.1, currentLevel: 'blue' },
    { id: 'Z09-B', unitId: 'U09', name: '会议室', lx: 0.85, lz: -0.55, lw: 1.15, ld: 1.0, lh: 1.0, currentLevel: 'blue' },
    { id: 'Z09-C', unitId: 'U09', name: '资料室', lx: -0.95, lz: -0.55, lw: 1.1, ld: 1.0, lh: 1.0, currentLevel: 'blue' },

    // U10 泵房
    { id: 'Z10-A', unitId: 'U10', name: '消防泵组', lx: -0.2, lz: -0.15, lw: 1.55, ld: 1.35, lh: 1.25, currentLevel: 'blue' },
    { id: 'Z10-B', unitId: 'U10', name: '稳压罐', lx: 1.05, lz: 0.55, lw: 0.85, ld: 0.85, lh: 1.0, currentLevel: 'blue' },
    { id: 'Z10-C', unitId: 'U10', name: '配电柜', lx: -0.95, lz: 0.65, lw: 0.85, ld: 0.7, lh: 0.9, currentLevel: 'blue' },

    // U11 配电
    { id: 'Z11-A', unitId: 'U11', name: '高压室', lx: -0.75, lz: 0.05, lw: 1.35, ld: 1.4, lh: 1.55, currentLevel: 'blue' },
    { id: 'Z11-B', unitId: 'U11', name: '低压室', lx: 0.85, lz: 0.05, lw: 1.35, ld: 1.4, lh: 1.55, currentLevel: 'blue' },
    { id: 'Z11-C', unitId: 'U11', name: '变压器台', lx: 1.75, lz: -0.7, lw: 0.95, ld: 0.8, lh: 0.75, currentLevel: 'blue' },

    // U12 门禁
    { id: 'Z12-A', unitId: 'U12', name: '进厂车道', lx: -0.7, lz: 0.9, lw: 1.6, ld: 1.3, lh: 0.7, currentLevel: 'blue' },
    { id: 'Z12-B', unitId: 'U12', name: '出厂车道', lx: 0.85, lz: 0.9, lw: 1.6, ld: 1.3, lh: 0.7, currentLevel: 'blue' },
    { id: 'Z12-C', unitId: 'U12', name: '门岗亭', lx: -1.9, lz: -0.2, lw: 1.0, ld: 1.0, lh: 1.35, currentLevel: 'blue' },
  ];
}
