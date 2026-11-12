import { API_BASE_URL } from '@/config/api';
import { normalizeErrorMessage } from '@/utils/error-message';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function STATUS_FALLBACK_MESSAGE(status: number): string {
  const map: Record<number, string> = {
    400: '请求参数错误',
    403: '无权限访问',
    404: '请求的资源不存在',
    500: '服务器内部错误',
  };
  return map[status] ?? `请求失败（${status}）`;
}

/** 预留：后续接真实 API 时使用，当前前端以本地 mock 为主 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  let body: unknown;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const msg =
      (body as { message?: string | string[] })?.message ?? STATUS_FALLBACK_MESSAGE(res.status);
    const raw = Array.isArray(msg) ? msg.join('；') : String(msg);
    throw new ApiError(normalizeErrorMessage(raw, res.status), res.status, body);
  }

  return body as T;
}
