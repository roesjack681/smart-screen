import { DEFAULT_RULES } from '@/utils/safety/rules';
import { makeStacks } from './warehouse';
import type { SafetyAlarm, SafetyDevice, SafetyDomain, SafetyEvent } from '@/types/safety';

export const domainNames:Record<SafetyDomain,string> = {
  "warehouse": "原料仓储",
  "process": "提取工艺",
  "storage": "地埋储罐",
  "gas": "可燃气体",
  "leak": "泄漏事件"
};
const definitions:Pick<SafetyDevice,'id'|'name'|'area'|'tag'|'metric'|'unit'|'baseline'|'domain'|'unitId'|'ruleRef'|'suggestion'>[] = [
  {
    "id": "EXT-01",
    "name": "1号萃取罐",
    "area": "提取车间",
    "tag": "TI-101",
    "metric": "温度",
    "unit": "℃",
    "baseline": 62.4,
    "domain": "process",
    "unitId": "EXT-01",
    "ruleRef": "规则10 · 提取温度超限",
    "suggestion": "降低加热或加强冷却，暂停投料，排查超温原因；必要时按现场规程联锁停车。"
  },
  {
    "id": "EXT-02",
    "name": "2号萃取罐",
    "area": "提取车间",
    "tag": "TI-102",
    "metric": "温度",
    "unit": "℃",
    "baseline": 58.7,
    "domain": "process",
    "unitId": "EXT-02",
    "ruleRef": "规则10 · 提取温度超限",
    "suggestion": "降低加热或加强冷却，暂停投料，排查超温原因；必要时按现场规程联锁停车。"
  },
  {
    "id": "EXT-P1",
    "name": "2号萃取罐",
    "area": "提取车间",
    "tag": "PI-102",
    "metric": "压力",
    "unit": "MPa",
    "baseline": 0.31,
    "domain": "process",
    "unitId": "EXT-02",
    "ruleRef": "规则8 · 提取压力超限",
    "suggestion": "调整工艺、降负荷或暂停投料，排查超压原因，双人确认处置结果。"
  },
  {
    "id": "EXT-L2",
    "name": "2号萃取罐",
    "area": "提取车间",
    "tag": "LI-102",
    "metric": "液位",
    "unit": "%",
    "baseline": 56.2,
    "domain": "process",
    "unitId": "EXT-02",
    "ruleRef": "规则9 · 提取液位超限",
    "suggestion": "停止相关进料或出料，核对实际液位，防止溢流或抽空，排查仪表异常。"
  },
  {
    "id": "ETH-L1",
    "name": "1号地埋乙醇罐",
    "area": "地埋罐区",
    "tag": "LI-201",
    "metric": "液位",
    "unit": "%",
    "baseline": 65.1,
    "domain": "storage",
    "unitId": "ETH-01",
    "ruleRef": "规则11 · 地埋乙醇储罐液位超限",
    "suggestion": "停止收料或发料，核对液位，防止溢流，排查液位计及相关设备。"
  },
  {
    "id": "ETH-L2",
    "name": "2号地埋乙醇罐",
    "area": "地埋罐区",
    "tag": "LI-202",
    "metric": "液位",
    "unit": "%",
    "baseline": 48.6,
    "domain": "storage",
    "unitId": "ETH-02",
    "ruleRef": "规则11 · 地埋乙醇储罐液位超限",
    "suggestion": "停止收料或发料，核对液位，防止溢流，排查液位计及相关设备。"
  },
  {
    "id": "GAS-01",
    "name": "提取区可燃气体",
    "area": "提取车间",
    "tag": "GAS-101",
    "metric": "可燃气体浓度",
    "unit": "%LEL",
    "baseline": 2.2,
    "domain": "gas",
    "unitId": "GAS-01",
    "ruleRef": "规则4 / 5 · 可燃气体高报、高高报",
    "suggestion": "高报时联动通风、核查泄漏源并现场复核；高高报时按预案切断来源、紧急通风、疏散无关人员并启动应急响应。"
  },
  {
    "id": "GAS-02",
    "name": "罐区可燃气体",
    "area": "地埋罐区",
    "tag": "GAS-201",
    "metric": "可燃气体浓度",
    "unit": "%LEL",
    "baseline": 1.4,
    "domain": "gas",
    "unitId": "GAS-02",
    "ruleRef": "规则4 / 5 · 可燃气体高报、高高报",
    "suggestion": "核查泄漏源、加强监测和通风；高高报时按预案隔离、切断来源、疏散并开展应急复核。"
  }
];

type SampleDevice=Pick<SafetyDevice,'unit'|'baseline'|'phase'> & Partial<Pick<SafetyDevice,'domain'>>;
export function normalValue(device:SampleDevice,seconds:number):number {
  const amplitude=device.domain==='warehouse'?0.12:device.unit==='MPa'?0.013:device.unit==='%LEL'?0.3:2.1;
  return device.baseline+Math.sin(seconds/50+device.phase)*amplitude+Math.cos(seconds/18+device.phase)*amplitude*0.12;
}
export function makeHistory(device:SampleDevice,now:number,seconds=0,center:number|null=null):SafetyDevice['history'] {
  return Array.from({length:121},(_,i)=>{
    const offset=(i-120)*3;
    return {t:now+offset*1000,value:center===null?normalValue(device,seconds+offset):center+Math.sin(offset/50)*(device.unit==='MPa'?0.001:0.1)};
  });
}
export function makeDevices(now:number):SafetyDevice[] {
  return definitions.map((definition,i)=>{
    const rules={...DEFAULT_RULES};
    if(definition.unit==='MPa')Object.assign(rules,{low:0.12,high:0.55,criticalLow:0.06,criticalHigh:0.65,slopeWarning:0.08,slopeCritical:0.15,hysteresis:0.01});
    if(definition.unit==='%')Object.assign(rules,{low:20,high:80,criticalLow:10,criticalHigh:90,slopeWarning:6,slopeCritical:12,hysteresis:1});
    if(definition.domain==='gas')Object.assign(rules,{low:-1,criticalLow:-2,high:20,criticalHigh:40,slopeWarning:6,slopeCritical:12,hysteresis:1});
    const device:SafetyDevice={...definition,phase:i*0.7,rules,source:definition.domain==='gas'?'可燃气体探测器 · 模拟':'在线仪表 · 模拟',supportsLow:definition.domain!=='gas',supportsRate:definition.domain!=='gas',online:true,lastSeen:now,scenario:null,slope:0,history:[],value:0};
    device.history=makeHistory(device,now);
    device.value=device.history.at(-1)!.value;
    return device;
  }).concat(makeStacks(now));
}
export function makeEvents(now:number):SafetyEvent[] {
  return [
  {
    "id": "LEAK-ESS",
    "name": "香精大面积泄漏",
    "area": "提取车间",
    "source": "视频AI事件 · 模拟",
    "ruleRef": "规则6 · 香精视频大面积泄漏",
    "suggestion": "立即报警、切断泄漏来源，划定警戒区，疏散无关人员，开展应急处置和现场复核。"
  },
  {
    "id": "LEAK-ETH",
    "name": "酒精大面积泄漏",
    "area": "乙醇使用区",
    "source": "视频AI / 气体检测 · 模拟",
    "ruleRef": "规则7 · 酒精视频大面积泄漏",
    "suggestion": "切断来源、禁绝火源，加强通风，警戒隔离，组织疏散并启动应急响应。"
  },
  {
    "id": "LEAK-TNK",
    "name": "地埋罐泄漏检测",
    "area": "地埋罐区",
    "source": "泄漏检测系统 · 模拟",
    "ruleRef": "规则12 · 地埋罐泄漏系统报警",
    "suggestion": "立即停泵，隔离罐区并检测复核，设置警戒、疏散人员，按预案应急处置。"
  }
].map(event=>({...event,active:false,changedAt:now}));
}
export function makePastAlarms(now:number):SafetyAlarm[] {
  return makeDevices(now).slice(0,5).map((device,i)=>{
    const startedAt=now-(i+1)*31*60000;
    return {id:'HIST-'+i,key:'history:'+i,deviceId:device.id,deviceName:device.name,area:device.area,domain:device.domain,ruleRef:device.ruleRef,type:'high',title:device.metric+'高报',severity:'warning',reading:(device.rules.high*1.04).toFixed(device.unit==='MPa'?3:1)+' '+device.unit,lastReading:device.baseline+' '+device.unit,startedAt,clearedAt:startedAt+240000,resolvedAt:startedAt+240000,acknowledgedAt:startedAt+60000,status:'resolved',source:'历史演示',threshold:'高报 ≥ '+device.rules.high+' / 高高报 ≥ '+device.rules.criticalHigh+' '+device.unit+'（演示）',suggestion:device.suggestion,snoozedUntil:0};
  });
}
