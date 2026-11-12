const STATUS_FALLBACK: Record<number, string> = {
  400: '请求参数错误',
  401: '未登录或登录已过期',
  403: '无权限访问',
  404: '请求的资源不存在',
  409: '数据冲突',
  422: '请求无法处理',
  500: '服务器内部错误',
  502: '网关错误',
  503: '服务暂不可用',
};

const ENGLISH_PATTERNS: Array<{ pattern: RegExp; replace: string | ((match: RegExpMatchArray) => string) }> = [
  { pattern: /should not exist/i, replace: '包含不允许的字段' },
  { pattern: /must not be empty|should not be empty/i, replace: '不能为空' },
  { pattern: /unauthorized/i, replace: '未登录或登录已过期' },
  { pattern: /forbidden/i, replace: '无权限访问' },
  { pattern: /not found/i, replace: '资源不存在' },
  { pattern: /internal server error/i, replace: '服务器内部错误' },
  { pattern: /network error/i, replace: '网络连接失败' },
  { pattern: /failed to fetch/i, replace: '网络请求失败，请检查后端服务' },
];

export function normalizeErrorMessage(message: string, status?: number): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return status ? (STATUS_FALLBACK[status] ?? `请求失败（${status}）`) : '操作失败，请稍后重试';
  }

  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    return trimmed;
  }

  for (const item of ENGLISH_PATTERNS) {
    if (item.pattern.test(trimmed)) {
      return typeof item.replace === 'string' ? item.replace : item.replace(trimmed.match(item.pattern)!);
    }
  }

  if (status && STATUS_FALLBACK[status]) {
    return STATUS_FALLBACK[status];
  }

  return trimmed;
}
