import { describe, expect, it } from 'vitest';
import {
  resolveDashboardAsOfDate,
  wholeCalendarDaysBetween,
} from '@/lib/dashboard-as-of';

describe('dashboard as-of date', () => {
  it('uses the latest transaction date instead of the current date', () => {
    expect(
      resolveDashboardAsOfDate(
        ['2026-04-01', '2026-04-08', '2026-04-03'],
        '2026-07-12'
      )
    ).toEqual({ date: '2026-04-08', source: 'last_transaction' });
  });

  it('uses the latest valid transaction date, including a future-dated entry', () => {
    expect(resolveDashboardAsOfDate(['2026-07-13'], '2026-07-12')).toEqual({
      date: '2026-07-13',
      source: 'last_transaction',
    });
  });

  it('falls back to today when there are no valid transaction dates', () => {
    expect(resolveDashboardAsOfDate([null, 'not-a-date'], '2026-07-12')).toEqual({
      date: '2026-07-12',
      source: 'today',
    });
  });

  it('calculates whole elapsed calendar days deterministically', () => {
    expect(wholeCalendarDaysBetween('2026-04-01', '2026-04-08')).toBe(7);
    expect(wholeCalendarDaysBetween('2026-04-08', '2026-04-01')).toBe(0);
    expect(wholeCalendarDaysBetween(null, '2026-04-08')).toBe(0);
  });
});
