import { describe, expect, it } from 'vitest';
import { createExpenseLegResolver } from '@/lib/expense-leg-assignment';

const legs = [
  { id: 1, cityId: 'first', startDate: '2026-01-01', endDate: '2026-01-05', nights: 4, sortOrder: 0 },
  { id: 2, cityId: 'second', startDate: null, endDate: null, nights: 3, sortOrder: 1 },
];

describe('expense leg resolver', () => {
  it('derives the itinerary once for bulk date and id lookups', () => {
    const resolver = createExpenseLegResolver(legs);

    expect(resolver.legs[1]).toMatchObject({ startDate: '2026-01-05', endDate: '2026-01-08' });
    expect(resolver.findForDate('2026-01-06')?.id).toBe(2);
    expect(resolver.findForDate('2026-01-06')?.id).toBe(2);
    expect(resolver.resolve({ date: '2025-12-01', legId: 2 })?.id).toBe(2);
  });

  it('preserves reporting-date clamping for explicitly assigned expenses', () => {
    const resolver = createExpenseLegResolver(legs);

    expect(resolver.reportingDate({ date: '2025-12-01', legId: 1 })).toBe('2026-01-01');
    expect(resolver.reportingDate({ date: '2026-01-09', legId: 2 })).toBe('2026-01-08');
    expect(resolver.reportingDate({ date: '2026-01-03' })).toBe('2026-01-03');
  });
});
