import type { DeviceStatus, SafetyDevice } from '@/types/safety';

export function formatTime(timestamp: number, seconds = true): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Hong_Kong',
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' as const } : {}),
    hour12: false,
  }).format(new Date(timestamp));
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date(timestamp))
    .replaceAll('/', '-');
}

export function metricValue(device: SafetyDevice): string {
  return Number(device.value).toFixed(device.unit === 'MPa' ? 3 : 1);
}

export const statusNames: Record<DeviceStatus, string> = {
  normal: '运行正常',
  warning: '预警',
  critical: '报警',
  offline: '离线',
};
