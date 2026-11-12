import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { BRAND } from '@/config/brand';

export const useAppConfigStore = defineStore('appConfig', () => {
  const platformName = ref<string>(BRAND.name);
  const loaded = ref(true);

  const displayName = computed(() => platformName.value || BRAND.name);

  function applyBranding(name: string): void {
    const next = name.trim() || BRAND.name;
    platformName.value = next;
    document.title = next;
  }

  return {
    platformName,
    displayName,
    loaded,
    applyBranding,
  };
});
