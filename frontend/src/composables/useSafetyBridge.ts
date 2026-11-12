import { computed, reactive } from 'vue';
import { storeToRefs } from 'pinia';
import { useSafetyStore } from '@/stores/safety';

/**
 * 把 Pinia store 适配成原大屏组件期望的 createSafetyStore 形态：
 * store.state.* / store.activeAlarms.value / store.deviceStatus()
 */
export function useSafetyBridge() {
  const safety = useSafetyStore();
  const refs = storeToRefs(safety);

  const state = reactive({
    devices: refs.devices,
    alarms: refs.alarms,
    orders: refs.orders,
    time: refs.time,
    running: refs.running,
    autoDemo: refs.autoDemo,
    soundEnabled: refs.soundEnabled,
    notice: refs.notice,
    selectedDeviceId: refs.selectedDeviceId,
    monitoringSince: refs.monitoringSince,
  });

  return {
    state,
    activeAlarms: computed(() => safety.activeAlarms),
    pendingAlarms: computed(() => safety.pendingAlarms),
    selectedDevice: computed(() => safety.selectedDevice),
    highestSeverity: computed(() => safety.highestSeverity),
    deviceStatus: safety.deviceStatus,
    startMock: safety.startMock,
    stopMock: safety.stopMock,
    process: safety.process,
    ingestSample: safety.ingestSample,
    injectScenario: safety.injectScenario,
    restoreAll: safety.restoreAll,
    acknowledge: safety.acknowledge,
    snooze: safety.snooze,
    updateRules: safety.updateRules,
    createOrder: safety.createOrder,
    startOrder: safety.startOrder,
    completeOrder: safety.completeOrder,
    toggleSound: safety.toggleSound,
    notify: safety.notify,
    dispose: safety.dispose,
  };
}

export type SafetyBridge = ReturnType<typeof useSafetyBridge>;
