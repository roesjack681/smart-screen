/** 后端地址统一从 .env 读取，改 IP/端口只改环境变量即可 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const WS_URL = import.meta.env.VITE_WS_URL;

/** Open API 根路径（不含 /api 前缀，供第三方对接文档展示） */
export const OPEN_API_BASE = API_BASE_URL.startsWith('http')
  ? `${new URL(API_BASE_URL).origin}/open/v1`
  : `${typeof window !== 'undefined' ? window.location.origin : ''}/open/v1`;
