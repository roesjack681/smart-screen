import type { AlcoholSummary } from '@/types/park';

export function createAlcoholSummary(): AlcoholSummary {
  return {
    gasPointTotal: 24,
    gasAlarmPoints: 2,
    leakPendingReview: 1,
    lastAbnormalAt: '2026-11-11 09:18',
  };
}
