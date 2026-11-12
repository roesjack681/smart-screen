import type { RouteMenuItem } from '@/types/system';

/** 本地静态侧边栏（无后端） */
export const DEFAULT_MENU_ROUTES: RouteMenuItem[] = [
  {
    id: 1,
    parentId: null,
    name: '生产安全总览',
    path: '/dashboard',
    icon: 'DashboardOutlined',
    permission: null,
  },
  {
    id: 2,
    parentId: null,
    name: '设备维护',
    path: '/maintenance',
    icon: 'ToolOutlined',
    permission: null,
  },
];
