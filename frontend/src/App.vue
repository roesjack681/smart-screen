<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue';
import { RouterView } from 'vue-router';
import GlobalAlertHost from '@/components/safety/GlobalAlertHost.vue';
import AlarmDetail from '@/components/safety/AlarmDetail.vue';
import { useSafetyBridge } from '@/composables/useSafetyBridge';
import type { SafetyAlarm } from '@/types/safety';

// 监测与通知驻留根组件，切换任何业务页面都继续运行。
const safety = useSafetyBridge();
const detail = shallowRef<SafetyAlarm | null>(null);
onMounted(safety.startMock);
onBeforeUnmount(safety.dispose);
</script>

<template>
  <RouterView />
  <GlobalAlertHost :store="safety" @details="detail = $event" />
  <AlarmDetail v-if="detail" :store="safety" :alarm="detail" @close="detail = null" />
</template>
