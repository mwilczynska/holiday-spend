import { convertToAud, getExchangeRate } from './exchange-rates';
import { runWithConcurrency } from './bulk-transport-estimation';
import type { ParsedExpense } from './wise-csv-parser';

/**
 * Frankfurter is a small free API. Eight in flight keeps the import quick without hammering it;
 * the previous behaviour was one request at a time.
 */
const RATE_FETCH_CONCURRENCY = 8;

type ParsedWithAud = ParsedExpense & { amountAud: number | null };

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function findNearestRate(
  date: string,
  datedRates: Array<{ date: string; rate: number }>
): number | null {
  if (datedRates.length === 0) return null;

  const exact = datedRates.find((entry) => entry.date === date);
  if (exact) return exact.rate;

  let best: { distance: number; rate: number } | null = null;
  const target = new Date(date).getTime();

  for (const entry of datedRates) {
    const distance = Math.abs(new Date(entry.date).getTime() - target);
    if (!best || distance < best.distance) {
      best = { distance, rate: entry.rate };
    }
  }

  return best?.rate ?? null;
}

async function buildAudResolver(parsed: ParsedExpense[], rateCache = new Map<string, number | null>()) {
  /**
   * Every rate this import needs, resolved up front and in parallel.
   *
   * Each `convertMemo` miss used to `await` its own HTTPS call inside a sequential loop, so a
   * cold import cost one round trip per distinct currency and date in the file, one after
   * another. On the 408-row sample that was 150 requests and about 81 seconds. The pairs are
   * knowable before any conversion happens, so they are fetched concurrently instead and every
   * later lookup hits the cache.
   *
   * `getExchangeRate` still writes each rate to the `exchange_rates` table, so a second import
   * of overlapping dates stays cheap.
   */
  const requiredPairs = new Map<string, { currency: string; date: string }>();
  for (const expense of parsed) {
    if (!expense.date) continue;
    // Mirror the resolver's first choice rather than fetching both currencies for every row:
    // it converts from the source currency when the row has one, and only falls back to the
    // target currency if that fails. Prefetching both cost 39% more requests to a free API for
    // rates most rows never used.
    const currency =
      expense.sourceAmount && expense.sourceCurrency ? expense.sourceCurrency : expense.currency;
    if (!currency || currency === 'AUD') continue;
    requiredPairs.set(`${currency}:${expense.date}`, { currency, date: expense.date });
  }

  const pending = Array.from(requiredPairs.entries()).filter(([key]) => !rateCache.has(key));
  await runWithConcurrency(pending, RATE_FETCH_CONCURRENCY, async ([key, pair]) => {
    try {
      rateCache.set(key, await getExchangeRate(pair.currency, pair.date));
    } catch {
      // Left null so the existing implied-rate fallback still applies.
      rateCache.set(key, null);
    }
  });

  const convertMemo = async (amount: number, currency: string, date: string): Promise<number> => {
    if (currency === 'AUD') return amount;

    const key = `${currency}:${date}`;
    let rate = rateCache.get(key);

    if (rate === undefined) {
      try {
        rate = await getExchangeRate(currency, date);
      } catch {
        rate = null;
      }
      rateCache.set(key, rate);
    }

    if (rate == null) {
      throw new Error(`Unsupported rate for ${currency} on ${date}`);
    }

    return amount * rate;
  };

  const impliedRateBuckets = new Map<string, number[]>();

  for (const expense of parsed) {
    if (!expense.date || expense.amount <= 0) continue;
    if (!expense.sourceAmount || !expense.sourceCurrency) continue;

    try {
      const sourceAud = await convertMemo(expense.sourceAmount, expense.sourceCurrency, expense.date);
      const impliedRate = sourceAud / expense.amount;
      const key = `${expense.currency}:${expense.date}`;
      const bucket = impliedRateBuckets.get(key) ?? [];
      bucket.push(impliedRate);
      impliedRateBuckets.set(key, bucket);
    } catch {
      // Leave unresolved; a later row for the same currency/date may provide an implied rate.
    }
  }

  const impliedRatesByCurrency = new Map<string, Array<{ date: string; rate: number }>>();
  for (const [key, values] of Array.from(impliedRateBuckets.entries())) {
    const [currency, date] = key.split(':');
    const bucket = impliedRatesByCurrency.get(currency) ?? [];
    bucket.push({ date, rate: average(values) });
    impliedRatesByCurrency.set(currency, bucket);
  }

  for (const entries of Array.from(impliedRatesByCurrency.values())) {
    entries.sort(
      (a: { date: string; rate: number }, b: { date: string; rate: number }) =>
        a.date.localeCompare(b.date)
    );
  }

  return async (expense: ParsedExpense): Promise<number | null> => {
    if (expense.currency === 'AUD') return expense.amount;

    if (expense.sourceAmount && expense.sourceCurrency) {
      try {
        return await convertMemo(expense.sourceAmount, expense.sourceCurrency, expense.date);
      } catch {
        // Fall through to target currency or implied-rate conversion.
      }
    }

    try {
      return await convertMemo(expense.amount, expense.currency, expense.date);
    } catch {
      const datedRates = impliedRatesByCurrency.get(expense.currency) ?? [];
      const impliedRate = findNearestRate(expense.date, datedRates);
      return impliedRate != null ? expense.amount * impliedRate : null;
    }
  };
}

export async function prepareWiseExpenses(parsed: ParsedExpense[]): Promise<ParsedWithAud[]> {
  const resolveAud = await buildAudResolver(parsed);
  const grouped = new Map<string, ParsedWithAud[]>();

  for (const expense of parsed) {
    const amountAud = await resolveAud(expense);
    const enriched = { ...expense, amountAud };
    const group = grouped.get(expense.wiseTxnId) ?? [];
    group.push(enriched);
    grouped.set(expense.wiseTxnId, group);
  }

  const aggregated: ParsedWithAud[] = [];

  for (const group of Array.from(grouped.values())) {
    const first = group[0];
    if (!first) continue;

    const currencies = Array.from(new Set(group.map((item: ParsedWithAud) => item.currency)));
    const totalAmount = group.reduce((sum: number, item: ParsedWithAud) => sum + item.amount, 0);
    const totalAud = group.reduce((sum: number, item: ParsedWithAud) => sum + (item.amountAud ?? 0), 0);
    const hasAud = group.some((item: ParsedWithAud) => item.amountAud != null);

    aggregated.push({
      ...first,
      amount: totalAmount,
      currency: currencies.length === 1 ? currencies[0] : 'AUD',
      amountAud: hasAud ? totalAud : null,
    });
  }

  for (const expense of aggregated) {
    if (expense.amountAud != null || expense.currency === 'AUD' || !expense.date) continue;

    try {
      expense.amountAud = await convertToAud(expense.amount, expense.currency, expense.date);
    } catch {
      expense.amountAud = null;
    }
  }

  return aggregated;
}
