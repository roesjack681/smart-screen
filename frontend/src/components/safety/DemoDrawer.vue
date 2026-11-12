<script setup lang="ts">
import { computed, ref } from 'vue';
import PsIcon from './PsIcon.vue';
import type { SafetyBridge } from '@/composables/useSafetyBridge';
import type { ScenarioKind } from '@/types/safety';
const props = defineProps<{ store: SafetyBridge }>();
const emit = defineEmits<{ close: [] }>();
const selected = ref(props.store.state.selectedDeviceId);
const device = computed(() => props.store.state.devices.find(d => d.id === selected.value)!);
const autoDemo = computed({ get: () => props.store.state.autoDemo, set: value => props.store.setAutoDemo(value) });
const scenarios: { kind:ScenarioKind; title:string; hint:string; icon:string; level:string }[] = [
  { kind:'high', title:'高限预警', hint:'黄色 · 高报', icon:'Thermometer', level:'warning' },
  { kind:'low', title:'低限预警', hint:'黄色 · 低报', icon:'ArrowDownRight', level:'warning' },
  { kind:'critical', title:'严重超限', hint:'红色 · 高高报', icon:'BellRing', level:'critical' },
  { kind:'rapidUp', title:'快速上升', hint:'红色 · 正斜率过大', icon:'TrendingUp', level:'critical' },
  { kind:'rapidDown', title:'快速下降', hint:'红色 · 负斜率过大', icon:'Zap', level:'critical' },
  { kind:'offline', title:'设备离线', hint:'持续无数据后预警', icon:'WifiOff', level:'warning' },
];
const available = computed(() => scenarios.filter(s => !(s.kind === 'low' && !device.value.supportsLow) && !(['rapidUp','rapidDown'].includes(s.kind) && !device.value.supportsRate)).map(s => device.value.stack && s.kind === 'high' ? {...s,title:'包心升温',hint:'触发温检加密判定'} : device.value.stack && s.kind === 'critical' ? {...s,title:'包心温差异常',hint:'结合环境温差判定'} : s));
function inject(kind:ScenarioKind) { props.store.selectDevice(selected.value); props.store.injectScenario(kind,selected.value); emit('close'); }
function eventAction(id:string,active:boolean) { props.store.injectEvent(id,active); emit('close'); }
</script>
<template>
  <Teleport to="body"><div class="ps-global-root"><div class="ps-drawer-backdrop" @click.self="emit('close')"><aside class="ps-demo-drawer" role="dialog" aria-modal="true" aria-label="演示控制台" @keydown.esc="emit('close')">
    <header class="ps-dialog-header"><div><h2><PsIcon name="SlidersHorizontal" :size="20" />演示控制台</h2><p>各页面持续监测，异常触发全局弹窗与闪烁边框</p></div><button class="ps-icon-button" aria-label="关闭演示控制台" @click="emit('close')"><PsIcon name="X" :size="22" /></button></header>
    <div class="ps-drawer-body">
      <label class="ps-field">选择演示设备<select v-model="selected"><option v-for="item in store.state.devices" :key="item.id" :value="item.id">{{ item.name }} · {{ item.metric }}</option></select></label>
      <span class="ps-form-section-label">仪表异常 · 数值为演示配置</span>
      <div class="ps-scenario-grid"><button v-for="scenario in available" :key="scenario.kind" :class="['ps-scenario',scenario.level]" @click="inject(scenario.kind)"><PsIcon :name="scenario.icon" :size="20" /><b>{{ scenario.title }}</b><small>{{ scenario.hint }}</small></button></div>
      <button class="ps-button ps-button-full concurrent-demo" @click="store.injectConcurrent(); emit('close')"><PsIcon name="Layers" :size="17" />2号萃取罐 · 温度 + 压力并发超限</button>
      <span class="ps-form-section-label">泄漏报警信号 · 触发即红色提醒</span>
      <div class="demo-events"><div v-for="event in store.state.events" :key="event.id"><span><b>{{ event.name }}</b><small>{{ event.active ? '信号触发中' : '信号正常' }}</small></span><button class="ps-link-button" :disabled="event.active" @click="eventAction(event.id,true)">触发</button><button class="ps-link-button" :disabled="!event.active" @click="eventAction(event.id,false)">恢复信号</button></div></div>
      <div class="ps-demo-explain"><span>01</span><p>确认后切换同一测点的不同异常，再次提醒</p><span>02</span><p>重复注入当前异常不重弹、不重置计时</p><span>03</span><p>恢复信号后，红色事件需进入详情人工复核</p></div>
      <label class="ps-toggle-row"><div><b>自动场景轮播</b><small>每30秒切换工况；上一轮标记为演示重置</small></div><input v-model="autoDemo" type="checkbox" role="switch" aria-label="自动场景轮播" /></label>
      <button class="ps-button ps-button-full" @click="store.restoreAll(); emit('close')"><PsIcon name="RefreshCw" :size="17" />恢复全部演示数据</button>
      <p class="ps-drawer-note">确认只收起弹窗。黄色信号恢复后解除；红色信号恢复并人工复核后解除。处置建议不执行真实设备控制，声音可在顶栏启用。</p>
    </div>
  </aside></div></div></Teleport>
</template>
<style scoped>
.concurrent-demo { margin-top:12px; border-color:#80505d; color:#ff9aa2; font-size:11px; }
.demo-events { border:1px solid #304e63; border-radius:4px; padding:0 10px; }
.demo-events > div { display:flex; align-items:center; gap:12px; padding:12px 0; }.demo-events > div + div { border-top:1px solid #294457; }
.demo-events span { flex:1; }.demo-events b { display:block; color:#b6cddc; font-size:11px; font-weight:500; }.demo-events small { display:block; color:#6c96ac; font-size:9px; margin-top:5px; }
.demo-events button { font-size:10px; }.demo-events button:disabled { opacity:.3; cursor:default; }
</style>

