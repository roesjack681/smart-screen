import type { SafetyDevice } from '@/types/safety';

export const warehouses = [
  { id:'A', name:'A号原料库', use:'片烟在库贮存', ambient:29.2, humidity:62, capacity:48 },
  { id:'B', name:'B号原料库', use:'片烟在库贮存', ambient:28.6, humidity:60, capacity:48 },
  { id:'C', name:'C号备料库', use:'投产前备料周转', ambient:29.8, humidity:64, capacity:48 },
  { id:'D', name:'D号周转库', use:'在库周转与复检', ambient:30.1, humidity:61, capacity:48 },
];
export function makeStacks(now:number):SafetyDevice[] {
  return warehouses.flatMap((warehouse,w) => Array.from({length:48},(_,i) => {
    const row = 'ABCDEF'[Math.floor(i/8)], column = i%8+1;
    const id = `WH-${warehouse.id}-${row}${String(column).padStart(2,'0')}`;
    const baseline = warehouse.ambient-1.4+((i*17+w*7)%27)/10;
    const device:SafetyDevice = {
      id, name:`${warehouse.id}库 ${row}${String(column).padStart(2,'0')}垛`, area:warehouse.name, tag:id,
      metric:'包心均温',unit:'℃',baseline,phase:i*0.6,domain:'warehouse',unitId:id,
      source:'垛位抽检均值 · 模拟实时测点',ruleRef:'原料贮存程序 §5.3.4.2',
      suggestion:'根据包心温度和库内环境温差加密检查；发现异常按原料不合格品流程核实处理。',
      supportsLow:false,supportsRate:false,
      rules:{low:0,criticalLow:-5,high:32,criticalHigh:35,slopeWarning:2,slopeCritical:4,durationSeconds:2,offlineSeconds:5,hysteresis:0.3},
      online:true,lastSeen:now,scenario:null,slope:0,history:[],value:baseline,
      stack:{warehouseId:warehouse.id,row,column,material:'片烟',batch:`YL-${String(w+1).padStart(2,'0')}-${String(Math.floor(i/4)+1).padStart(3,'0')}`,ambient:warehouse.ambient,humidity:warehouse.humidity,
        storedAt:now-(warehouse.id==='C' && i===3 ? 40 : 5+i%20)*86400000,checkedAt:now-(i===9 ? 17 : 1+i%5)*86400000,ambientException:false},
    };
    device.history=Array.from({length:121},(_,j)=>({t:now+(j-120)*3000,value:baseline+Math.sin((j-120)/18+i)*0.12}));
    device.value=device.history.at(-1)!.value;
    return device;
  }));
}
export function inspectionAdvice(device:SafetyDevice, now:number):{label:string;due:boolean;days:number} {
  const stack=device.stack!;
  const month=new Date(now).getMonth()+1;
  const delta=device.value-stack.ambient;
  const days=device.value>=35 || delta>2 || stack.ambientException ? 1 : device.value>=32 ? 2 : month>=4 && month<=10 ? 7 : 15;
  return {label:days===1?'每日检查':days===2?'每两天检查':days===7?'每周检查':'每半月检查',due:now-stack.checkedAt>=days*86400000,days};
}
export function storageOverdue(device:SafetyDevice, now:number):boolean {
  if(device.stack?.warehouseId!=='C')return false;
  const limit=new Date(device.stack.storedAt), day=limit.getDate();
  limit.setDate(1); limit.setMonth(limit.getMonth()+1);
  limit.setDate(Math.min(day,new Date(limit.getFullYear(),limit.getMonth()+1,0).getDate()));
  return now>limit.getTime();
}
