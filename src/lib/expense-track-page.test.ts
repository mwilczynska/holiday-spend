import { describe, expect, it } from 'vitest';
import { buildExpenseExportHref, buildExpenseTrackPageMetadata } from '@/lib/expense-track-page';

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

describe('expense export href', () => {
  const none = { category: 'all', source: 'all', from: '', to: '' };

  it('exports everything when no filter is applied', () => {
    expect(buildExpenseExportHref(none)).toBe('/api/export?format=csv');
  });

  it('carries the active filters so the download matches the visible list', () => {
    expect(
      buildExpenseExportHref({ category: 'food', source: 'wise_csv', from: '2026-03-01', to: '2026-03-31' })
    ).toBe('/api/export?format=csv&cat=food&source=wise_csv&from=2026-03-01&to=2026-03-31');
  });

  it('treats "all" as unset rather than a category named all', () => {
    expect(buildExpenseExportHref({ ...none, category: 'all', source: 'manual' })).toBe(
      '/api/export?format=csv&source=manual'
    );
  });

  it('applies a one-sided date range', () => {
    expect(buildExpenseExportHref({ ...none, from: '2026-03-01' })).toBe(
      '/api/export?format=csv&from=2026-03-01'
    );
    expect(buildExpenseExportHref({ ...none, to: '2026-03-31' })).toBe(
      '/api/export?format=csv&to=2026-03-31'
    );
  });
});
