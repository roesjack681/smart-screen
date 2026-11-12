import { createRouter, createWebHistory } from 'vue-router';
import { setupRouterGuards } from './guards';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/layouts/ScreenLayout.vue'),
      meta: { title: '生产安全运行总览' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard',
    },
  ],
});

setupRouterGuards(router);

export default router;
