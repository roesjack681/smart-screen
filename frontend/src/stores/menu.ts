import { defineStore } from 'pinia';
import { ref } from 'vue';
import { DEFAULT_MENU_ROUTES } from '@/config/menu';
import type { RouteMenuItem } from '@/types/system';

export const useMenuStore = defineStore('menu', () => {
  const routes = ref<RouteMenuItem[]>([]);
  const loaded = ref(false);

  function loadRoutes(force = false): void {
    if (loaded.value && !force) return;
    routes.value = DEFAULT_MENU_ROUTES;
    loaded.value = true;
  }

  function clear(): void {
    routes.value = [];
    loaded.value = false;
  }

  return { routes, loaded, loadRoutes, clear };
});
