import { describe, expect, it } from 'vitest';
import { normalizeErrorMessage } from './error-message';

describe('normalizeErrorMessage', () => {
  it('keeps Chinese messages', () => {
    expect(normalizeErrorMessage('设备 ID 不能为空')).toBe('设备 ID 不能为空');
  });

  it('translates common English errors', () => {
    expect(normalizeErrorMessage('Unauthorized', 401)).toBe('未登录或登录已过期');
    expect(normalizeErrorMessage('Failed to fetch')).toBe('网络请求失败，请检查后端服务');
  });

  it('falls back by status code', () => {
    expect(normalizeErrorMessage('Unknown', 403)).toBe('无权限访问');
  });
});
