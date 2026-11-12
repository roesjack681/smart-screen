import type { Router } from 'vue-router';
import { BRAND } from '@/config/brand';

export function setupRouterGuards(router: Router): void {
  router.beforeEach((to) => {
    const title = typeof to.meta.title === 'string' ? to.meta.title : '';
    document.title = title ? `${title} · ${BRAND.name}` : BRAND.name;
    return true;
  });
}
