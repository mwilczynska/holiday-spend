import { afterEach, describe, expect, it, vi } from 'vitest';

const getExchangeRate = vi.fn();
const convertToAud = vi.fn();

vi.mock('@/lib/exchange-rates', () => ({
  getExchangeRate: (...args: unknown[]) => getExchangeRate(...args),
  convertToAud: (...args: unknown[]) => convertToAud(...args),
}));

// The module imports through relative paths, so both specifiers are mocked.
vi.mock('./exchange-rates', () => ({
  getExchangeRate: (...args: unknown[]) => getExchangeRate(...args),
  convertToAud: (...args: unknown[]) => convertToAud(...args),
}));

import { prepareWiseExpenses } from '@/lib/wise-import';
import type { ParsedExpense } from '@/lib/wise-csv-parser';

function row(overrides: Partial<ParsedExpense>): ParsedExpense {
  return {
    date: '2026-03-01',
    amount: 100,
    currency: 'THB',
    sourceAmount: 10,
    sourceCurrency: 'GBP',
    category: 'food',
    subcategory: '',
    description: '',
    merchant: '',
    wiseTxnId: `txn-${Math.random()}`,
    source: 'wise_csv',
    skip: false,
    ...overrides,
  };
}

afterEach(() => {
  getExchangeRate.mockReset();
  convertToAud.mockReset();
});

describe('wise import rate resolution', () => {
  it('fetches each currency and date once regardless of how many rows need it', async () => {
    // Every miss used to await its own request inside a sequential loop. The pairs are knowable
    // up front, so they are resolved once and in parallel.
    getExchangeRate.mockResolvedValue(2);
    convertToAud.mockResolvedValue(0);

    const rows = [
      ...Array.from({ length: 20 }, () => row({ date: '2026-03-01', sourceCurrency: 'GBP' })),
      ...Array.from({ length: 20 }, () => row({ date: '2026-03-02', sourceCurrency: 'GBP' })),
      ...Array.from({ length: 20 }, () => row({ date: '2026-03-01', sourceCurrency: 'USD' })),
    ];

    await prepareWiseExpenses(rows);

    const pairs = new Set(getExchangeRate.mock.calls.map(([currency, date]) => `${currency}:${date}`));
    expect(pairs).toEqual(new Set(['GBP:2026-03-01', 'GBP:2026-03-02', 'USD:2026-03-01']));
    // Three unique pairs, sixty rows.
    expect(getExchangeRate).toHaveBeenCalledTimes(3);
  });

  it('issues the rate requests concurrently rather than one at a time', async () => {
    let inFlight = 0;
    let peak = 0;
    getExchangeRate.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
      return 2;
    });
    convertToAud.mockResolvedValue(0);

    const rows = Array.from({ length: 12 }, (_, i) =>
      row({ date: `2026-03-${String(i + 1).padStart(2, '0')}`, sourceCurrency: 'GBP' })
    );

    await prepareWiseExpenses(rows);

    expect(getExchangeRate).toHaveBeenCalledTimes(12);
    expect(peak).toBeGreaterThan(1);
  });

  it('does not request a rate for rows already in AUD', async () => {
    getExchangeRate.mockResolvedValue(2);
    convertToAud.mockResolvedValue(0);

    await prepareWiseExpenses([
      row({ currency: 'AUD', sourceCurrency: 'AUD', sourceAmount: 50, amount: 50 }),
    ]);

    expect(getExchangeRate).not.toHaveBeenCalled();
  });

  it('leaves a row unresolved rather than inventing a rate when the lookup fails', async () => {
    // Fail closed: the dashboard excludes rows with no AUD conversion instead of treating them
    // as zero, so a missing rate must not become a plausible substitute.
    getExchangeRate.mockRejectedValue(new Error('no rate'));
    convertToAud.mockRejectedValue(new Error('no rate'));

    const result = await prepareWiseExpenses([
      row({ currency: 'THB', sourceCurrency: 'GBP', sourceAmount: 10, amount: 100 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].amountAud).toBeNull();
  });
});
