/** 仅允许站内相对路径，防止开放重定向 */
export function sanitizeRedirect(raw: unknown, fallback = '/dashboard'): string {
  if (typeof raw !== 'string') return fallback;
  const path = raw.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return fallback;
  }
  return path;
}

/** Ant Design Modal @ok：校验/请求失败时保持弹窗打开 */
export function keepModalOpen(error?: unknown): Promise<never> {
  return Promise.reject(error ?? new Error('modal-keep-open'));
}
