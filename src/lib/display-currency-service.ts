import { db } from '@/db';
import { exchangeRates, userPreferences } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { FRANKFURTER_BASE } from './exchange-rates';
import { DEFAULT_CURRENCY_STATE, isDisplayCurrency, validDisplayRate, type DisplayCurrency, type DisplayCurrencyState } from './display-currency';
interface LatestRates { date: string; rates: Record<string, number> }
let latest: { value: LatestRates; expires: number } | null = null;
let pending: Promise<LatestRates> | null = null;
export function parseLatestDisplayRates(value: unknown, now = new Date()): LatestRates {
  const data = value as { base?: unknown; date?: unknown; rates?: Record<string, unknown> } | null;
  const date = typeof data?.date === 'string' ? data.date : '';
  const timestamp = Date.parse(date + 'T00:00:00Z'), age = now.getTime() - timestamp;
  if (data?.base !== 'AUD' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0,10) !== date || age < 0 || age > 7 * 86400000
    || !data.rates || typeof data.rates !== 'object' || Array.isArray(data.rates)) {
    throw new Error('Current exchange rates are unavailable or out of date.');
  }
  const rates: Record<string, number> = { AUD: 1 };
  for (const [currency, rate] of Object.entries(data.rates)) {
    if (currency !== 'AUD' && isDisplayCurrency(currency) && validDisplayRate(rate)) rates[currency] = rate;
  }
  if (Object.keys(rates).length < 2) throw new Error('The exchange-rate response contained no usable rates.');
  return { date, rates };
}
/** Reuse the expense provider and SQLite cache, always under the observation date, never "latest". */
export async function getLatestDisplayRates(): Promise<LatestRates> {
  if (latest && latest.expires > Date.now()) return latest.value;
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch(FRANKFURTER_BASE + '/latest?from=AUD', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Exchange-rate request failed (HTTP ' + response.status + ').');
    const value = parseLatestDisplayRates(await response.json());
    db.transaction(tx => {
      for (const [currency, rate] of Object.entries(value.rates)) {
        if (currency === 'AUD') continue;
        tx.insert(exchangeRates).values({ date: value.date, fromCurrency: 'AUD', toCurrency: currency, rate }).onConflictDoNothing().run();
      }
    });
    latest = { value, expires: Date.now() + 3600000 };
    return value;
  })();
  try { return await pending; } finally { pending = null; }
}
export async function currencyStateFor(currency: DisplayCurrency): Promise<DisplayCurrencyState> {
  if (currency === 'AUD') return { ...DEFAULT_CURRENCY_STATE };
  try {
    const rates = await getLatestDisplayRates();
    if (!validDisplayRate(rates.rates[currency])) throw new Error('No current rate is available for ' + currency + '.');
    return { currency, rate: rates.rates[currency], asOf: rates.date, error: null };
  } catch (error) {
    return { currency, rate: null, asOf: null, error: error instanceof Error ? error.message : 'Exchange rates unavailable.' };
  }
}
export async function getDisplayCurrencyState(userId: string): Promise<DisplayCurrencyState> {
  const row = db.select({ currency: userPreferences.displayCurrency }).from(userPreferences).where(eq(userPreferences.userId, userId)).get();
  return currencyStateFor(isDisplayCurrency(row?.currency) ? row.currency : 'AUD');
}
export class CurrencyRateUnavailableError extends Error {}
export async function saveDisplayCurrency(userId: string, currency: DisplayCurrency): Promise<DisplayCurrencyState> {
  const state = await currencyStateFor(currency);
  if (state.rate == null) throw new CurrencyRateUnavailableError(state.error ?? 'Current exchange rate unavailable.');
  db.insert(userPreferences).values({ userId, displayCurrency: currency }).onConflictDoUpdate({
    target: userPreferences.userId, set: { displayCurrency: currency, updatedAt: new Date().toISOString() },
  }).run();
  return state;
}
