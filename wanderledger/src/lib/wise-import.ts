import { getExchangeRate } from './exchange-rates';
import type { ParsedExpense } from './wise-csv-parser';

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

async function buildAudResolver(parsed: ParsedExpense[]) {
  const rateCache = new Map<string, number | null>();

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

  return aggregated;
}
