import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSafetyStore } from './safety';
import type { ScenarioKind } from '@/types/safety';

let store: ReturnType<typeof useSafetyStore>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-12T02:00:00Z'));
  setActivePinia(createPinia());
  store = useSafetyStore();
  store.startMock();
});
afterEach(() => { store.dispose(); vi.useRealTimers(); });

function trigger(kind: ScenarioKind, deviceId = 'EXT-02', ms = 3000) {
  store.injectScenario(kind, deviceId);
  vi.advanceTimersByTime(ms);
  return store.pendingAlarms.find(a => a.deviceId === deviceId)!;
}

describe('演示注入与持续监测', () => {
  it.each<[ScenarioKind, ScenarioKind]>([
    ['high', 'low'], ['low', 'high'], ['critical', 'high'], ['high', 'critical'],
  ])('同一设备 %s 确认后切换 %s 产生新提醒', (first, next) => {
    const previous = trigger(first);
    expect(previous).toBeDefined();
    store.acknowledge(previous.id);
    const current = trigger(next);
    expect(current.id).not.toBe(previous.id);
    expect(current.acknowledgedAt).toBeNull();
    expect(current.severity).toBe(next === 'critical' ? 'critical' : 'warning');
    expect(store.alarms.find(a => a.id === previous.id)?.resolutionReason).toBe('演示场景重置');
  });

  it('重复同一异常保持确认、起始时间和曲线，不再次弹窗', () => {
    const previous = trigger('high');
    store.acknowledge(previous.id);
    const device = store.devices.find(d => d.id === 'EXT-02')!;
    const history = device.history;
    const startedAt = device.scenario!.startedAt;
    store.injectScenario('high', device.id);
    expect(device.history).toBe(history);
    expect(device.scenario!.startedAt).toBe(startedAt);
    vi.advanceTimersByTime(4000);
    expect(store.pendingAlarms).toHaveLength(0);
    expect(store.activeAlarms.map(a => a.id)).toEqual([previous.id]);
  });

  it('切换仅重置目标设备，其他设备的确认与延后状态保留', () => {
    const other = trigger('critical', 'EXT-01');
    store.snooze(other.id);
    const delayed = store.alarms.find(a => a.id === other.id)!.snoozedUntil;
    const target = trigger('high');
    store.acknowledge(target.id);
    expect(trigger('low').type).toBe('low');
    expect(store.alarms.find(a => a.id === other.id)?.snoozedUntil).toBe(delayed);
    expect(store.alarms.find(a => a.id === other.id)?.resolvedAt).toBeNull();
  });

  it('快速升降方向切换清除旧斜率，形成新告警', () => {
    const first = trigger('rapidUp', 'EXT-02', 13000);
    expect(first.type).toBe('rate');
    store.acknowledge(first.id);
    const next = trigger('rapidDown', 'EXT-02', 13000);
    expect(next.id).not.toBe(first.id);
    expect(next.type).toBe('rate');
    expect(store.devices.find(d => d.id === 'EXT-02')!.slope).toBeLessThan(0);
  });

  it('离线重复注入不重置计时，切换异常后重新计时', () => {
    store.injectScenario('offline', 'EXT-02');
    vi.advanceTimersByTime(3000);
    store.injectScenario('offline', 'EXT-02');
    vi.advanceTimersByTime(2000);
    const previous = store.pendingAlarms[0];
    expect(previous.type).toBe('offline');
    store.acknowledge(previous.id);
    store.injectScenario('offline', 'EXT-02');
    expect(store.pendingAlarms).toHaveLength(0);
    trigger('high');
    store.injectScenario('offline', 'EXT-02');
    vi.advanceTimersByTime(4000);
    expect(store.pendingAlarms).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(store.pendingAlarms[0].id).not.toBe(previous.id);
    expect(store.pendingAlarms[0].type).toBe('offline');
  });

  it('红色确认后保持边框，信号恢复并人工复核后解除', () => {
    const alarm = trigger('critical');
    store.acknowledge(alarm.id);
    expect(store.highestSeverity).toBe('critical');
    expect(store.pendingAlarms).toHaveLength(0);
    expect(store.review(alarm.id, '演示人员', '现场已确认安全')).toContain('尚未恢复');
    store.restoreAll();
    expect(store.highestSeverity).toBe('critical');
    expect(store.reviewAlarms.map(a => a.id)).toContain(alarm.id);
    expect(store.review(alarm.id, '', '')).toContain('请填写');
    expect(store.review(alarm.id, '演示人员', '已核对工况，异常消除')).toBe('');
    expect(store.highestSeverity).toBe('normal');
    expect(store.activeAlarms).toHaveLength(0);
    expect(store.alarms.find(a => a.id === alarm.id)).toMatchObject({ reviewer:'演示人员', reviewNote:'已核对工况，异常消除', resolutionReason:'人工复核解除' });
  });

  it('浏览器暂停采样后统一恢复，不写入瞬时离线事件', () => {
    const before = store.alarms.length;
    vi.setSystemTime(Date.now() + 35000);
    store.restoreAll();
    expect(store.alarms).toHaveLength(before);
    expect(store.devices.every(d => d.online)).toBe(true);
  });

  it('应用重新挂载可以恢复采样，重复启动不会增加定时器', () => {
    store.dispose();
    const lastSeen = store.devices[0].lastSeen;
    store.startMock();
    store.startMock();
    vi.advanceTimersByTime(1000);
    expect(store.running).toBe(true);
    expect(store.devices[0].lastSeen).toBeGreaterThan(lastSeen);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('八个测点正常运行不产生告警，黄色信号恢复自动解除', () => {
    expect(store.devices.filter(d=>d.domain!=='warehouse')).toHaveLength(8);
    expect(store.devices.filter(d=>d.stack)).toHaveLength(192);
    vi.advanceTimersByTime(60000);
    expect(store.activeAlarms).toHaveLength(0);
    trigger('high');
    store.restoreAll();
    expect(store.activeAlarms).toHaveLength(0);
    expect(store.highestSeverity).toBe('normal');
  });

  it('可燃气体只启用高报、高高报与通信异常，拒绝低限与斜率注入', () => {
    store.injectScenario('low','GAS-01');
    store.injectScenario('rapidUp','GAS-01');
    expect(store.devices.find(d => d.id === 'GAS-01')!.scenario).toBeNull();
    const alarm = trigger('high','GAS-01');
    expect(alarm).toMatchObject({ domain:'gas', severity:'warning', type:'high' });
    expect(alarm.threshold).toContain('20');
    expect(alarm.ruleRef).toContain('规则4 / 5');
    expect(store.activeAlarms.filter(a => a.deviceId === 'GAS-01')).toHaveLength(1);
  });

  it('不同装置的参数异常不合成并发事件，同装置两类参数持续超限才升级', () => {
    trigger('high','EXT-01');
    trigger('high','EXT-P1');
    expect(store.alarms.some(a => a.type === 'concurrent')).toBe(false);
    store.restoreAll();
    store.injectConcurrent();
    vi.advanceTimersByTime(1000);
    expect(store.activeAlarms.some(a => a.type === 'concurrent')).toBe(false);
    vi.advanceTimersByTime(2000);
    const combined = store.pendingAlarms[0];
    expect(combined).toMatchObject({ type:'concurrent', severity:'critical', deviceName:'2号萃取罐' });
    expect(combined.reading).toContain('温度');
    expect(combined.reading).toContain('压力');
    store.acknowledge(combined.id);
    expect(store.pendingAlarms).toHaveLength(0);
    expect(store.activeAlarms).toHaveLength(3);
    store.restoreAll();
    expect(store.reviewAlarms.map(a => a.id)).toEqual([combined.id]);
    expect(store.review(combined.id,'演示人员','温压液位已核实恢复正常')).toBe('');
    expect(store.activeAlarms).toHaveLength(0);
  });

  it('并发已确认后，切换同一测点不同异常仍单独再次提醒', () => {
    store.injectConcurrent();
    vi.advanceTimersByTime(3000);
    store.acknowledge(store.pendingAlarms[0].id);
    const next = trigger('low');
    expect(next).toMatchObject({ deviceId:'EXT-02', type:'low', acknowledgedAt:null });
  });

  it('并发关联参数尚未全部恢复时不能提前复核', () => {
    store.injectConcurrent();
    vi.advanceTimersByTime(3000);
    const combined = store.pendingAlarms[0];
    store.acknowledge(combined.id);
    store.injectScenario('normal','EXT-02');
    expect(store.reviewAlarms.some(a => a.id === combined.id)).toBe(false);
    expect(store.review(combined.id,'演示人员','现场检查已完成')).toContain('尚未恢复');
    store.injectScenario('normal','EXT-P1');
    expect(store.reviewAlarms.some(a => a.id === combined.id)).toBe(true);
  });

  it('泄漏信号即时全局红色告警，重复触发去重，不同事件独立提醒', () => {
    store.injectEvent('LEAK-ESS');
    const first = store.pendingAlarms[0];
    expect(first).toMatchObject({ type:'leak', domain:'leak', severity:'critical', source:'视频AI事件 · 模拟' });
    store.acknowledge(first.id);
    store.injectEvent('LEAK-ESS');
    expect(store.pendingAlarms).toHaveLength(0);
    store.injectEvent('LEAK-ETH');
    expect(store.pendingAlarms[0].deviceId).toBe('LEAK-ETH');
    store.injectEvent('LEAK-ESS',false);
    expect(store.reviewAlarms.map(a => a.id)).toContain(first.id);
    store.injectEvent('LEAK-ESS');
    expect(store.alarms.find(a => a.id === first.id)).toMatchObject({ clearedAt:null, acknowledgedAt:null });
    expect(store.review(first.id,'演示人员','现场已核实')).toContain('尚未恢复');
  });
});
