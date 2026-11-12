// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, nextTick } from 'vue';
import WarehouseBoard from './WarehouseBoard.vue';
import AlertTable from './AlertTable.vue';
import SafetyPanel from './SafetyPanel.vue';
import { useSafetyBridge } from '@/composables/useSafetyBridge';
import { useSafetyStore } from '@/stores/safety';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-12T02:00:00Z'));
  setActivePinia(createPinia());
});
afterEach(() => { useSafetyStore().dispose(); vi.useRealTimers(); });

function mountBoard() {
  return mount(defineComponent({
    setup() {
      const bridge = useSafetyBridge();
      return () => h(WarehouseBoard, { store:bridge }, {
        default:() => h(AlertTable, { store:bridge, defaultDomain:'warehouse' }),
      });
    },
  }), { global:{ stubs:{ TrendChart:true } } });
}

it('控制台切换垛位时，库房、选中网格、档案和例外条件同步更新', async () => {
  const wrapper = mountBoard();
  const store = useSafetyStore();
  store.selectDevice('WH-C-A04');
  store.setStackException('WH-C-A04', true);
  await nextTick();
  expect(wrapper.find('.warehouse-cards .selected').text()).toContain('C号备料库');
  expect(wrapper.find('.stack-reading').text()).toContain('C库 A04垛');
  expect(wrapper.find('.heatmap .picked').attributes('aria-label')).toContain('C库 A04垛');
  expect((wrapper.find('.stack-exception input').element as HTMLInputElement).checked).toBe(true);
  await wrapper.findAll('.warehouse-cards button')[1].trigger('click');
  expect(store.selectedDeviceId).toBe('WH-B-A01');
  expect((wrapper.find('.stack-exception input').element as HTMLInputElement).checked).toBe(false);
  wrapper.unmount();
});

it('告警实时读数随采样更新，触发留档保持原值，确认和恢复状态同步', async () => {
  const wrapper = mountBoard();
  const store = useSafetyStore();
  store.selectDevice('WH-A-A02');
  store.startMock();
  store.injectScenario('critical', 'WH-A-A02');
  vi.advanceTimersByTime(3000);
  store.stopMock();
  await nextTick();
  const alarm = store.activeAlarms.find(a=>a.type==='warehouseNonconform')!;
  const initial = alarm.reading;
  const now = Date.now()+1000;
  store.ingestSample(alarm.deviceId,{t:now,value:36.2});
  store.process(now);
  await nextTick();
  expect(wrapper.find('.alarm-live-reading').text()).toContain('36.2');
  expect(wrapper.find('.alarm-live-reading').text()).toContain(`触发：${initial}`);
  expect(wrapper.find('.stack-alarm-status').text()).toContain('待确认');
  expect(wrapper.find('.ps-table-tabs').text()).toContain('全部记录2');
  store.acknowledge(alarm.id);
  await nextTick();
  expect(wrapper.find('.stack-alarm-status').text()).toContain('处置跟进中');
  store.injectScenario('normal',alarm.deviceId);
  await nextTick();
  expect(wrapper.find('.stack-alarm-status').text()).toContain('待人工复核');
  expect(wrapper.find('.ps-table-tabs').text()).toContain('待复核1');
  wrapper.unmount();
});

it('红色触发即计入待复核，确认和恢复保留计数，仅完成复核才减少', async () => {
  const wrapper = mount(defineComponent({
    setup() {
      const bridge=useSafetyBridge();
      return ()=>h(SafetyPanel,{store:bridge});
    },
  }), {global:{stubs:{TrendChart:true}}});
  const store=useSafetyStore();
  const redMetric=()=>wrapper.findAll('.ps-warning-overview > div').find(item=>item.text().includes('红色待复核'))!.find('strong').text();
  try {
    expect(redMetric()).toBe('0');
    store.startMock();
    store.injectScenario('critical','WH-A-A02');
    vi.advanceTimersByTime(3000);
    await nextTick();
    expect(redMetric()).toBe('1');
    expect(store.reviewAlarms).toHaveLength(0);
    store.injectScenario('critical','WH-B-A02');
    vi.advanceTimersByTime(3000);
    await nextTick();
    expect(redMetric()).toBe('2');
    await wrapper.findAll('.ps-table-tabs button').find(item=>item.text()==='待复核2')!.trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    const redAlarms=store.activeAlarms.filter(a=>a.severity==='critical');
    redAlarms.forEach(alarm=>store.acknowledge(alarm.id));
    await nextTick();
    expect(redMetric()).toBe('2');
    expect(store.review(redAlarms[0].id,'演示人员','现场已检查')).toContain('尚未恢复');
    store.restoreAll();
    await nextTick();
    expect(redMetric()).toBe('2');
    expect(store.reviewAlarms).toHaveLength(2);
    expect(store.review(redAlarms[0].id,'演示人员','现场已检查，温度恢复正常')).toBe('');
    await nextTick();
    expect(redMetric()).toBe('1');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(store.review(redAlarms[1].id,'演示人员','现场已检查，温度恢复正常')).toBe('');
    await nextTick();
    expect(redMetric()).toBe('0');
  } finally { wrapper.unmount(); }
});
