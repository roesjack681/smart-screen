import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { makeDevices, makeEvents, makeHistory, makePastAlarms, normalValue } from '@/data/safety/mock';
import type {
  DeviceStatus,
  SafetyAlarm,
  SafetyDevice,
  SafetyRules,
  ScenarioKind,
} from '@/types/safety';
import { AlarmEngine, validateRules } from '@/utils/safety/rules';

const STORAGE_KEY = 'm5-safety-demo-v2';

export const useSafetyStore = defineStore('safety', () => {
  const nowFn = () => Date.now();
  const startTime = nowFn();
  const devices = ref<SafetyDevice[]>(makeDevices(startTime));
  const events = ref(makeEvents(startTime));
  const alarms = ref<SafetyAlarm[]>([]);
  const time = ref(startTime);
  const running = ref(false);
  const autoDemo = ref(false);
  const soundEnabled = ref(false);
  const notice = ref('');
  const selectedDeviceId = ref(devices.value[0]?.id ?? '');
  const monitoringSince = ref(startTime);

  let saved: { rules?: Record<string, SafetyRules> } | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    saved = null;
  }

  if (saved?.rules) {
    for (const device of devices.value) {
      const rules = saved.rules[device.id];
      if (device.domain!=='warehouse' && rules && !validateRules(rules)) device.rules = { ...rules };
    }
  }

  const engine = new AlarmEngine(makePastAlarms(startTime));
  alarms.value = engine.snapshot();

  let timer: ReturnType<typeof setInterval> | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let audioContext: AudioContext | null = null;
  let autoAt = startTime + 30000;
  let autoIndex = 0;

  function syncAlarms(): void {
    alarms.value = engine.snapshot();
  }

  function persist(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          rules: Object.fromEntries(devices.value.map((d) => [d.id, d.rules])),
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
      if (result.events.some((e) => e.kind !== 'resolved')) shouldSound = true;
    }
    const relatedEvents = [
      ...engine.updateConcurrent(devices.value, nowValue),
      ...events.value.flatMap(event => engine.updateEvent(event, nowValue)),
    ];
    if (relatedEvents.some(event => event.kind !== 'resolved')) shouldSound = true;
    syncAlarms();
    if (shouldSound) playSound();
  }

  function injectScenario(kind: ScenarioKind, deviceId = selectedDeviceId.value, silent = false): void {
    const device = devices.value.find((d) => d.id === deviceId);
    if (!device) return;
    if ((kind === 'low' && !device.supportsLow) || ((kind === 'rapidUp' || kind === 'rapidDown') && !device.supportsRate)) {
      notify('该监测对象未启用低限或变化速率场景，请选择适用的模拟异常');
      return;
    }
    if (kind !== 'normal' && device.scenario?.kind === kind) {
      if (!silent) notify(`${device.name}正在演示该异常，继续跟踪当前告警`);
      return;
    }
    const t = nowFn();
    const offset = device.domain==='warehouse'?0.4:device.unit === 'MPa' ? 0.02 : 2;
    // 切换演示异常时结束该设备上一轮；同一异常重复注入保持确认和延后状态。
    if (kind !== 'normal') {
      const healthyValue = device.baseline;
      device.scenario = null;
      device.value = healthyValue;
      device.lastSeen = t;
      device.online = true;
      device.history = makeHistory(device, t).map((sample) => ({ t: sample.t, value: healthyValue }));
      engine.resetDemoDevice(device.id, t);
    }
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
          : `${device.name}已切换异常场景，满足持续时间后将再次提醒`,
      );
    }
  }

  function injectEvent(eventId: string, active = true): void {
    const event = events.value.find(item => item.id === eventId);
    if (!event) return;
    if (event.active === active) {
      notify(active ? '该泄漏信号已触发，继续跟踪当前事件' : '该泄漏信号已处于正常状态');
      return;
    }
    event.active = active;
    event.changedAt = nowFn();
    process(event.changedAt);
    notify(active ? `${event.name}模拟信号已触发，请核查处置建议` : '泄漏信号已恢复，红色事件仍需人工复核');
  }

  function injectConcurrent(): void {
    injectScenario('high', 'EXT-02', true);
    injectScenario('high', 'EXT-P1', true);
    selectDevice('EXT-02');
    notify('2号萃取罐温度、压力已同时超限，满足持续时间后触发红色并发告警');
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
      const candidate = devices.value.find((d) => d.unit === '℃');
      if (candidate) injectScenario(kinds[autoIndex++ % kinds.length], candidate.id, true);
      autoAt = t + 30000;
    }
  }

  function startMock(): void {
    if (timer) return;
    running.value = true;
    timer = setInterval(tick, 1000);
  }

  function stopMock(): void {
    if (timer) clearInterval(timer);
    timer = null;
    running.value = false;
  }

  function restoreAll(silent = false): void {
    const t = nowFn();
    // 统一恢复后再判定，避免逐个刷新时把其他测点的旧采样记为离线。
    for (const device of devices.value) {
      device.scenario = null;
      device.history = makeHistory(device, t, (t - startTime) / 1000);
      device.value = device.history.at(-1)!.value;
      device.lastSeen = t;
      device.online = true;
    }
    for (const event of events.value) { event.active = false; event.changedAt = t; }
    process(t);
    if (!silent) notify('全部模拟信号已恢复；红色事件请在详情中完成现场复核');
  }

  function selectDevice(deviceId: string): void {
    if (devices.value.some((device) => device.id === deviceId)) selectedDeviceId.value = deviceId;
  }

  function recordInspection(deviceId:string):void {
    const device=devices.value.find(d=>d.id===deviceId);
    if(!device?.stack)return;
    device.stack.checkedAt=nowFn();
    notify('已记录本次模拟温检，异常提醒仍需按处置流程跟进');
  }
  function setStackException(deviceId:string, enabled:boolean):void {
    const device=devices.value.find(d=>d.id===deviceId);
    if(!device?.stack)return;
    device.stack.ambientException=enabled;
    process(nowFn());
    notify('已更新模拟环境例外条件；仍需每日温检并核实现场情况');
  }

  function setAutoDemo(enabled: boolean): void {
    autoDemo.value = enabled;
    autoAt = nowFn() + 30000;
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

  function review(id: string, reviewer: string, note: string): string {
    const error = engine.review(id, reviewer, note, nowFn());
    if (!error) { syncAlarms(); notify('已记录现场复核结果，当前红色事件已解除'); }
    return error;
  }

  function updateRules(deviceId: string, values: SafetyRules): string {
    const error = validateRules(values);
    if (error) return error;
    const device = devices.value.find((d) => d.id === deviceId);
    if (!device) return '设备不存在';
    if(device.domain==='warehouse')return '仓储32/35℃依据资料固定，工艺阈值可另行配置';
    device.rules = { ...values };
    persist();
    process(nowFn());
    notify('规则已保存并生效');
    return '';
  }

  const activeAlarms = computed(() => alarms.value.filter((a) => !a.resolvedAt));
  const reviewAlarms = computed(() => activeAlarms.value.filter(a => a.severity === 'critical' && a.clearedAt));
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
    if (activeAlarms.value.some((a) => a.deviceId === device.id && a.severity === 'critical')) return 'critical';
    if (!device.online) return 'offline';
    if (activeAlarms.value.some((a) => a.deviceId === device.id)) return 'warning';
    return 'normal';
  }

  function dispose(): void {
    stopMock();
    if (toastTimer) clearTimeout(toastTimer);
    void audioContext?.close();
    audioContext = null;
    soundEnabled.value = false;
  }

  return {
    devices,
    events,
    alarms,
    time,
    running,
    autoDemo,
    soundEnabled,
    notice,
    selectedDeviceId,
    monitoringSince,
    activeAlarms,
    reviewAlarms,
    pendingAlarms,
    selectedDevice,
    highestSeverity,
    deviceStatus,
    startMock,
    stopMock,
    process,
    ingestSample,
    injectScenario,
    injectEvent,
    injectConcurrent,
    restoreAll,
    selectDevice,
    recordInspection,
    setStackException,
    setAutoDemo,
    acknowledge,
    snooze,
    review,
    updateRules,
    toggleSound,
    notify,
    dispose,
  };
});
