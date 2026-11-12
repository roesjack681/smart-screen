import {describe,it,expect} from 'vitest';
import {makeStacks,inspectionAdvice,storageOverdue} from '@/data/safety/warehouse';
import {evaluateDevice,AlarmEngine} from './rules';
const now=new Date('2026-11-12T02:00:00Z').getTime();
function sample(value:number,ambient=30){const d=makeStacks(now)[0];d.value=value;d.stack!.ambient=ambient;return d;}
describe('原料仓储资料判定',()=>{
  it('32与35为检查加密条件，不把35直接当红色超温',()=>{
    const d=sample(32,31);expect(inspectionAdvice(d,now).days).toBe(2);
    d.value=35;d.stack!.ambient=34;
    expect(inspectionAdvice(d,now).days).toBe(1);
    const signals=evaluateDevice(d,now).signals;
    expect(signals.find(s=>s.type==='warehouseInspection')!.severity).toBe('warning');
    expect(signals.find(s=>s.type==='warehouseNonconform')!.severity).toBeNull();
  });
  it('均温温差严格超过2℃每日检查，严格超过4℃触发不合格复核',()=>{
    const d=sample(31,29);expect(inspectionAdvice(d,now).days).toBe(15);
    d.value=31.1;expect(inspectionAdvice(d,now).days).toBe(1);
    d.value=33;expect(evaluateDevice(d,now).signals.find(s=>s.type==='warehouseNonconform')!.severity).toBeNull();
    d.value=33.1;expect(evaluateDevice(d,now).signals.find(s=>s.type==='warehouseNonconform')!.severity).toBe('critical');
  });
  it('环境例外不自动认定不合格，但仍要求每日温检',()=>{
    const d=sample(36,29);d.stack!.ambientException=true;
    expect(inspectionAdvice(d,now).days).toBe(1);
    expect(evaluateDevice(d,now).signals.find(s=>s.type==='warehouseNonconform')!.severity).toBeNull();
  });
  it('备料库按日历一个月检查，不扩大到普通原料库',()=>{
    const d=sample(29);d.stack!.storedAt=new Date('2026-10-12T02:00:00Z').getTime();
    d.stack!.warehouseId='C';expect(storageOverdue(d,now)).toBe(false);expect(storageOverdue(d,now+1)).toBe(true);
    d.stack!.warehouseId='A';expect(storageOverdue(d,now+86400000)).toBe(false);
  });
  it('温差红色告警持续后触发，环境例外复核条件恢复后仍须人工解除',()=>{
    const d=sample(36,29);const engine=new AlarmEngine();engine.update(d,now);engine.update(d,now+2000);
    const alarm=engine.snapshot().find(a=>a.type==='warehouseNonconform')!;expect(alarm.severity).toBe('critical');
    engine.acknowledge(alarm.id,now+2000);expect(engine.snapshot().filter(a=>!a.acknowledgedAt)).toHaveLength(0);
    d.stack!.ambientException=true;engine.update(d,now+3000);
    expect(engine.snapshot().find(a=>a.id===alarm.id)!.clearedAt).toBe(now+3000);
    expect(engine.review(alarm.id,'演示人员','已核实为高温天气入库，安排每日检查',now+3000)).toBe('');
  });
});
