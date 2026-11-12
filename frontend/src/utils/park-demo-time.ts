function localDateAt(time: string, daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const [hours, minutes] = time.split(':').map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

/** Generate demo timestamps relative to the user's local date so the dashboard stays presentable. */
export function parkDemoDateTime(time: string, daysAgo = 0): string {
  const date = localDateAt(time, daysAgo);

  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parkDemoTimeAt(time: string, daysAgo = 0): number {
  return localDateAt(time, daysAgo).getTime();
}

export function createParkDemoClock(): number {
  return parkDemoTimeAt('09:00');
}
