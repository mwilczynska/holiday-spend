import { describe, expect, it } from 'vitest';
import { buildExpenseTrackPageMetadata } from '@/lib/expense-track-page';

describe('expense track page metadata', () => {
  it('pages rows without narrowing full-filter totals or bulk IDs', () => {
    const expenses = [
      { id: 3, amount: 10, amountAud: null, currency: 'AUD', isExcluded: 0 },
      { id: 2, amount: 20, amountAud: 22, currency: 'USD', isExcluded: 0 },
      { id: 1, amount: 30, amountAud: 31, currency: 'USD', isExcluded: 1 },
    ];

    expect(buildExpenseTrackPageMetadata(expenses, 0, 2)).toEqual({
      pageIds: [3, 2],
      totalCount: 3,
      totalAud: 32,
      expenseIds: [3, 2, 1],
    });
    expect(buildExpenseTrackPageMetadata(expenses, 1, 2).pageIds).toEqual([1]);
  });

  it('fails closed for invalid pagination', () => {
    expect(() => buildExpenseTrackPageMetadata([], -1, 50)).toThrow();
  });
});
