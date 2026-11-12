import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

/** 解析 Vite 开发代理目标 */
function apiProxyTarget(env: Record<string, string>): string {
  if (env.VITE_API_PROXY_TARGET) {
    return env.VITE_API_PROXY_TARGET;
  }
  const apiBaseUrl = env.VITE_API_BASE_URL;
  if (apiBaseUrl?.startsWith('http')) {
    return new URL(apiBaseUrl).origin;
  }
  return 'http://127.0.0.1:3000';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = apiProxyTarget(env);

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5173,
      /** 允许任意 Host（局域网 IP、公网 IP、内网穿透域名等） */
      allowedHosts: true,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
