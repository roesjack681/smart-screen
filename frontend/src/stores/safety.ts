import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { makeDevices, makeHistory, makeOrders, makePastAlarms, normalValue } from '@/data/safety/mock';
import type {
  CreateOrderInput,
  DeviceStatus,
  MaintenanceOrder,
  SafetyAlarm,
  SafetyDevice,
  SafetyRules,
  ScenarioKind,
} from '@/types/safety';
import { AlarmEngine, evaluateDevice, validateRules } from '@/utils/safety/rules';

const STORAGE_KEY = 'm5-safety-demo-v1';

export const useSafetyStore = defineStore('safety', () => {
  const nowFn = () => Date.now();
  const startTime = nowFn();
  const devices = ref<SafetyDevice[]>(makeDevices(startTime));
  const orders = ref<MaintenanceOrder[]>([]);
  const alarms = ref<SafetyAlarm[]>([]);
  const time = ref(startTime);
  const running = ref(false);
  const autoDemo = ref(false);
  const soundEnabled = ref(false);
  const notice = ref('');
  const selectedDeviceId = ref(devices.value[0]?.id ?? '');
  const monitoringSince = ref(startTime);

  let saved: { rules?: Record<string, SafetyRules>; orders?: MaintenanceOrder[] } | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    saved = null;
  }

  if (saved?.rules) {
    for (const device of devices.value) {
      const rules = saved.rules[device.id];
      if (rules && !validateRules(rules)) device.rules = { ...rules };
    }
  }

  const validOrders =
    Array.isArray(saved?.orders) &&
    saved!.orders!.every(
      (o) =>
        o?.id &&
        devices.value.some((d) => d.id === o.deviceId) &&
        ['pending', 'inprogress', 'completed'].includes(o.status),
    );
  orders.value = validOrders ? saved!.orders! : makeOrders(startTime);

  for (const order of orders.value) {
    if (order.status === 'inprogress') {
      const device = devices.value.find((d) => d.id === order.deviceId);
      if (device) device.maintenance = true;
    }
  }

  const engine = new AlarmEngine(makePastAlarms(startTime));
  alarms.value = engine.snapshot();

  let timer: ReturnType<typeof setInterval> | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let audioContext: AudioContext | null = null;
  let autoAt = startTime + 30000;
  let autoIndex = 0;
  let disposed = false;

  function syncAlarms(): void {
    alarms.value = engine.snapshot();
  }

  function persist(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          rules: Object.fromEntries(devices.value.map((d) => [d.id, d.rules])),
          orders: orders.value,
        }),
      );
    } catch {
      notify('浏览器未允许本地保存，本次操作仍然生效');
    }
  }

  function notify(message: string): void {
    notice.value = message;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      notice.value = '';
    }, 4200);
  }

  function playSound(): void {
    if (!soundEnabled.value || !audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.06, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.36);
  }

  async function toggleSound(): Promise<void> {
    if (soundEnabled.value) {
      soundEnabled.value = false;
      return;
    }
    try {
      const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContext ||= new AudioCtor();
      await audioContext.resume();
      soundEnabled.value = true;
      playSound();
    } catch {
      notify('当前浏览器无法启用声音，弹窗提示继续生效');
    }
  }

  function ingestSample(deviceId: string, sample: { t: number; value: number }): boolean {
    const device = devices.value.find((d) => d.id === deviceId);
    if (!device || !Number.isFinite(sample?.value) || !Number.isFinite(sample?.t) || sample.t <= device.lastSeen) {
      return false;
    }
    device.value = sample.value;
    device.lastSeen = sample.t;
    device.online = true;
    device.history.push({ t: sample.t, value: sample.value });
    device.history = device.history.filter((s) => s.t >= sample.t - 6 * 60000).slice(-361);
    return true;
  }

  function process(nowValue: number): void {
    time.value = nowValue;
    let shouldSound = false;
    for (const device of devices.value) {
      const result = engine.update(device, nowValue);
      device.online = result.online;
      device.slope = result.slope;
      if (result.events.some((e) => e.kind === 'created' || e.kind === 'escalated')) shouldSound = true;
    }
    syncAlarms();
    if (shouldSound) playSound();
  }

  function injectScenario(kind: ScenarioKind, deviceId = selectedDeviceId.value, silent = false): void {
    const device = devices.value.find((d) => d.id === deviceId);
    if (!device) return;
    if (device.maintenance && kind !== 'normal') {
      notify('该设备处于维护模式，新告警已抑制；请先完成维护或选择其他设备');
      return;
    }
    const t = nowFn();
    const offset = device.unit === 'MPa' ? 0.02 : device.unit === 'mm/s' ? 0.3 : 2;
    if (kind === 'normal') {
      device.scenario = null;
      device.history = makeHistory(device, t, (t - startTime) / 1000);
      device.value = device.history.at(-1)!.value;
      device.lastSeen = t;
      device.online = true;
    } else {
      const center =
        kind === 'high'
          ? device.rules.high + offset
          : kind === 'low'
            ? device.rules.low - offset
            : kind === 'critical'
              ? device.rules.criticalHigh + offset
              : device.value;
      device.scenario = { kind, startedAt: t, center };
      if (kind === 'high' || kind === 'low' || kind === 'critical') {
        device.history = makeHistory(device, t, 0, center);
        device.value = center;
        device.lastSeen = t;
      }
    }
    process(t);
    if (!silent) {
      notify(
        kind === 'normal'
          ? `${device.name}已恢复正常工况`
          : `${device.name}已切换演示工况，监测服务将按规则自动判定`,
      );
    }
  }

  function tick(): void {
    const t = nowFn();
    const seconds = (t - startTime) / 1000;
    for (const device of devices.value) {
      const scenario = device.scenario;
      if (scenario?.kind === 'offline') continue;
      let value = normalValue(device, seconds);
      if (scenario) {
        const elapsed = (t - scenario.startedAt) / 1000;
        const rate = (device.rules.slopeCritical * 1.65) / 60;
        if (scenario.kind === 'rapidUp') value = scenario.center + elapsed * rate;
        else if (scenario.kind === 'rapidDown') value = scenario.center - elapsed * rate;
        else value = scenario.center + Math.sin(elapsed / 10) * (device.unit === 'MPa' ? 0.001 : 0.03);
      }
      ingestSample(device.id, { t, value });
    }
    process(t);
    if (autoDemo.value && t >= autoAt) {
      restoreAll(true);
      const kinds: ScenarioKind[] = ['high', 'critical', 'rapidUp', 'offline'];
      const candidate = devices.value.find((d) => !d.maintenance && d.unit === '℃');
      if (candidate) injectScenario(kinds[autoIndex++ % kinds.length], candidate.id, true);
      autoAt = t + 30000;
    }
  }

  function startMock(): void {
    if (timer || disposed) return;
    running.value = true;
    timer = setInterval(tick, 1000);
  }

  function stopMock(): void {
    if (timer) clearInterval(timer);
    timer = null;
    running.value = false;
  }

  function restoreAll(silent = false): void {
    for (const device of devices.value) injectScenario('normal', device.id, true);
    if (!silent) notify('所有设备已恢复正常工况，恢复记录已更新');
  }

  function acknowledge(id: string): void {
    engine.acknowledge(id, nowFn());
    syncAlarms();
    notify('已确认告警，风险恢复前仍会提示');
  }

  function snooze(id: string): void {
    engine.snooze(id, nowFn());
    syncAlarms();
    notify('弹窗已收起，未恢复且未确认的告警将在 60 秒后再次提醒');
  }

  function updateRules(deviceId: string, values: SafetyRules): string {
    const error = validateRules(values);
    if (error) return error;
    const device = devices.value.find((d) => d.id === deviceId);
    if (!device) return '设备不存在';
    device.rules = { ...values };
    persist();
    process(nowFn());
    notify('规则已保存并生效');
    return '';
  }

  function createOrder(input: CreateOrderInput): { error?: string; order?: MaintenanceOrder } {
    const device = devices.value.find((d) => d.id === input.deviceId);
    if (!device) return { error: '请选择设备' };
    if (!input.title?.trim() || !input.owner?.trim()) return { error: '请填写工单标题和负责人' };
    if (!Number.isFinite(input.plannedAt)) return { error: '请选择计划日期' };
    if (input.alarmId) {
      const duplicate = orders.value.find((o) => o.alarmId === input.alarmId && o.status !== 'completed');
      if (duplicate) {
        notify('该告警已关联维护工单');
        return { order: duplicate };
      }
    }
    const order: MaintenanceOrder = {
      ...input,
      id: `WO-${nowFn()}-${orders.value.length + 1}`,
      title: input.title.trim(),
      owner: input.owner.trim(),
      status: 'pending',
      createdAt: nowFn(),
    };
    orders.value.unshift(order);
    persist();
    notify('维护工单已创建');
    return { order };
  }

  function startOrder(id: string): string {
    const order = orders.value.find((o) => o.id === id);
    if (!order || order.status !== 'pending') return '工单状态不允许开始';
    if (orders.value.some((o) => o.deviceId === order.deviceId && o.status === 'inprogress')) {
      return '该设备已有维修中的工单';
    }
    const device = devices.value.find((d) => d.id === order.deviceId);
    if (!device) return '设备不存在';
    order.status = 'inprogress';
    order.startedAt = nowFn();
    device.maintenance = true;
    persist();
    notify('已进入维护模式，新告警暂停产生，现有告警继续跟踪');
    return '';
  }

  function completeOrder(id: string, result: string, checks: boolean[]): string {
    const order = orders.value.find((o) => o.id === id);
    if (!order || order.status !== 'inprogress') return '请先开始维护';
    if (!result?.trim()) return '请填写维修与验收结果';
    if (!Array.isArray(checks) || checks.length !== 3 || !checks.every(Boolean)) {
      return '请完成全部三项验收确认';
    }
    const device = devices.value.find((d) => d.id === order.deviceId);
    if (!device) return '设备不存在';
    const current = evaluateDevice(device, nowFn());
    if (
      !current.online ||
      current.signals.some((signal) => signal.severity) ||
      alarms.value.some((a) => a.deviceId === device.id && !a.resolvedAt)
    ) {
      return '设备仍离线、读数异常或有未恢复告警，请先恢复工况后验收';
    }
    order.status = 'completed';
    order.result = result.trim();
    order.completedAt = nowFn();
    order.acceptance = [...checks];
    device.maintenance = false;
    device.lastService = nowFn();
    device.nextService = nowFn() + 30 * 86400000;
    persist();
    notify('维护已验收，设备恢复监测');
    return '';
  }

  const activeAlarms = computed(() => alarms.value.filter((a) => !a.resolvedAt));
  const pendingAlarms = computed(() =>
    activeAlarms.value
      .filter((a) => !a.acknowledgedAt && a.snoozedUntil <= time.value)
      .sort(
        (a, b) =>
          (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1) ||
          b.startedAt - a.startedAt,
      ),
  );
  const selectedDevice = computed(
    () => devices.value.find((d) => d.id === selectedDeviceId.value) || devices.value[0],
  );
  const highestSeverity = computed(() =>
    activeAlarms.value.some((a) => a.severity === 'critical')
      ? 'critical'
      : activeAlarms.value.length
        ? 'warning'
        : 'normal',
  );

  function deviceStatus(device: SafetyDevice): DeviceStatus {
    if (device.maintenance) return 'maintenance';
    if (activeAlarms.value.some((a) => a.deviceId === device.id && a.severity === 'critical')) return 'critical';
    if (!device.online) return 'offline';
    if (activeAlarms.value.some((a) => a.deviceId === device.id)) return 'warning';
    return 'normal';
  }

  function dispose(): void {
    stopMock();
    disposed = true;
    if (toastTimer) clearTimeout(toastTimer);
    void audioContext?.close();
  }

  return {
    devices,
    orders,
    alarms,
    time,
    running,
    autoDemo,
    soundEnabled,
    notice,
    selectedDeviceId,
    monitoringSince,
    activeAlarms,
    pendingAlarms,
    selectedDevice,
    highestSeverity,
    deviceStatus,
    startMock,
    stopMock,
    process,
    ingestSample,
    injectScenario,
    restoreAll,
    acknowledge,
    snooze,
    updateRules,
    createOrder,
    startOrder,
    completeOrder,
    toggleSound,
    notify,
    dispose,
  };
});
