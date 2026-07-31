import { describe, expect, it } from 'vitest';
import { calcBurnRate } from '@/lib/burn-rate';

describe('burn-rate reference date', () => {
  it('anchors rolling windows to the last transaction date when provided', () => {
    const result = calcBurnRate(70, 7, {
      expenses: [{ date: '2026-04-01', amountAud: 70 }],
      days: 7,
      asOfDate: '2026-04-08',
    });

    expect(result.tripAvg).toBe(10);
    expect(result.windowAvg).toBe(10);
  });
});
