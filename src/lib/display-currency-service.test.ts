import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { exchangeRates, userPreferences } from '@/db/schema';
vi.mock('@/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('@/db/schema');
  const sqlite = new Database(':memory:');
  sqlite.exec(`CREATE TABLE user_preferences (user_id TEXT PRIMARY KEY, planner_group_size INTEGER DEFAULT 2,
    display_currency TEXT DEFAULT 'AUD', llm_max_output_tokens INTEGER, llm_request_timeout_ms INTEGER,
    created_at TEXT, updated_at TEXT);
    CREATE TABLE exchange_rates (date TEXT, from_currency TEXT, to_currency TEXT, rate REAL,
    PRIMARY KEY(date, from_currency, to_currency));`);
  return { db: drizzle(sqlite, { schema }) };
});
const observation = { base: 'AUD', date: '2026-10-19', rates: { EUR: 0.6, USD: 0.7, JPY: 100 } };
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
  const { db } = await import('@/db'); db.delete(userPreferences).run(); db.delete(exchangeRates).run();
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(observation))));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('current display rates and account preference', () => {
  it('validates base, real date, age, finite rates and weekend observations', async () => {
    const { parseLatestDisplayRates: parse } = await import('./display-currency-service');
    expect(parse(observation).rates.EUR).toBe(0.6);
    expect(parse({ ...observation, date: '2026-10-16' }).date).toBe('2026-10-16');
    for (const invalid of [null, { ...observation, base: 'USD' }, { ...observation, date: '2026-02-30' },
      { ...observation, date: '2026-10-01' }, { ...observation, date: '2026-10-21' },
      { ...observation, rates: { EUR: 0, USD: '0.7', JPY: -1 } }]) expect(() => parse(invalid)).toThrow();
  });
  it('shares a current fetch and writes cache rows under the actual observation date', async () => {
    const { getLatestDisplayRates } = await import('./display-currency-service');
    await Promise.all([getLatestDisplayRates(), getLatestDisplayRates()]);
    await getLatestDisplayRates(); expect(fetch).toHaveBeenCalledTimes(1);
    const { db } = await import('@/db');
    const cached = db.select().from(exchangeRates).all();
    expect(cached).toHaveLength(3);
    expect(cached.find(row => row.toCurrency === 'EUR')).toMatchObject({ date: '2026-10-19', fromCurrency: 'AUD', rate: 0.6 });
    vi.advanceTimersByTime(3600001); await getLatestDisplayRates(); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('persists per user, preserves other settings and leaves budgets alone', async () => {
    const { db } = await import('@/db');
    db.insert(userPreferences).values({ userId: 'owner', plannerGroupSize: 4, llmMaxOutputTokens: 64000 }).run();
    const { getDisplayCurrencyState, saveDisplayCurrency } = await import('./display-currency-service');
    expect((await getDisplayCurrencyState('other')).currency).toBe('AUD');
    expect(fetch).not.toHaveBeenCalled();
    await saveDisplayCurrency('owner', 'EUR');
    expect(await getDisplayCurrencyState('owner')).toMatchObject({ currency: 'EUR', rate: 0.6, asOf: '2026-10-19' });
    expect(db.select().from(userPreferences).where(eq(userPreferences.userId, 'owner')).get()).toMatchObject({ plannerGroupSize: 4, llmMaxOutputTokens: 64000 });
    expect((await getDisplayCurrencyState('other')).currency).toBe('AUD');
  });
  it('rejects missing rates and failed switches without saving parity or a new preference', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Provider unavailable'));
    const { currencyStateFor, saveDisplayCurrency, getDisplayCurrencyState } = await import('./display-currency-service');
    expect(await currencyStateFor('EUR')).toMatchObject({ currency: 'EUR', rate: null, error: 'Provider unavailable' });
    await expect(saveDisplayCurrency('owner', 'EUR')).rejects.toThrow('Provider unavailable');
    expect((await getDisplayCurrencyState('owner')).currency).toBe('AUD');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ...observation, rates: { USD: 0.7 } })));
    await expect(saveDisplayCurrency('owner', 'EUR')).rejects.toThrow(/No current rate/);
    expect((await getDisplayCurrencyState('owner')).currency).toBe('AUD');
  });
});

// These focused route fixtures omit prices/history tables. Full history atomicity is covered in analytics/history.test.ts.
vi.mock('@/lib/analytics/history', async () => {
  const { db } = await import('@/db');
  return { withPlanRevision: (_user: string, _action: string, mutate: Parameters<typeof db.transaction>[0]) => db.transaction(mutate) };
});
