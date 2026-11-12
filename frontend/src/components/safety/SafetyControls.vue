<script setup lang="ts">
import { ref } from 'vue';
import DemoDrawer from './DemoDrawer.vue';
import PsIcon from './PsIcon.vue';
import { useSafetyBridge } from '@/composables/useSafetyBridge';

const store = useSafetyBridge();
const open = ref(false);
</script>

<template>
  <div class="production-controls">
    <button
      class="ps-icon-button"
      type="button"
      :aria-label="store.state.soundEnabled ? '关闭预警声音' : '启用预警声音'"
      :title="store.state.soundEnabled ? '关闭预警声音' : '启用预警声音'"
      @click="store.toggleSound"
    >
      <PsIcon :name="store.state.soundEnabled ? 'Volume2' : 'VolumeX'" :size="17" />
    </button>
    <button class="ps-button ps-button-small" type="button" @click="open = true">
      <PsIcon name="SlidersHorizontal" :size="15" />演示控制台
    </button>
  </div>
  <DemoDrawer v-if="open" :store="store" @close="open = false" />
</template>

<style scoped>
.production-controls { display: flex; align-items: center; gap: 4px; }
</style>
