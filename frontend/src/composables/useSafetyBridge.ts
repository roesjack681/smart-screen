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
    events: refs.events,
    alarms: refs.alarms,
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
    reviewAlarms: computed(() => safety.reviewAlarms),
    pendingAlarms: computed(() => safety.pendingAlarms),
    selectedDevice: computed(() => safety.selectedDevice),
    highestSeverity: computed(() => safety.highestSeverity),
    deviceStatus: safety.deviceStatus,
    startMock: safety.startMock,
    stopMock: safety.stopMock,
    process: safety.process,
    ingestSample: safety.ingestSample,
    injectScenario: safety.injectScenario,
    injectEvent: safety.injectEvent,
    injectConcurrent: safety.injectConcurrent,
    restoreAll: safety.restoreAll,
    selectDevice: safety.selectDevice,
    recordInspection: safety.recordInspection,
    setStackException: safety.setStackException,
    setAutoDemo: safety.setAutoDemo,
    acknowledge: safety.acknowledge,
    snooze: safety.snooze,
    review: safety.review,
    updateRules: safety.updateRules,
    toggleSound: safety.toggleSound,
    notify: safety.notify,
    dispose: safety.dispose,
  };
}

export type SafetyBridge = ReturnType<typeof useSafetyBridge>;
