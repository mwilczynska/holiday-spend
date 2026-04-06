import { db } from '@/db';
import { exchangeRates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const FRANKFURTER_BASE = 'https://api.frankfurter.app';

export async function getExchangeRate(
  fromCurrency: string,
  date: string,
  toCurrency: string = 'AUD'
): Promise<number> {
  if (fromCurrency === toCurrency) return 1;

  // Check cache
  const cached = await db
    .select()
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.date, date),
        eq(exchangeRates.fromCurrency, fromCurrency),
        eq(exchangeRates.toCurrency, toCurrency)
      )
    )
    .get();

  if (cached) return cached.rate;

  // Fetch from frankfurter.app
  try {
    const res = await fetch(
      `${FRANKFURTER_BASE}/${date}?from=${fromCurrency}&to=${toCurrency}`
    );
    if (!res.ok) {
      // Try latest rate as fallback
      const fallbackRes = await fetch(
        `${FRANKFURTER_BASE}/latest?from=${fromCurrency}&to=${toCurrency}`
      );
      if (!fallbackRes.ok) throw new Error('Exchange rate fetch failed');
      const fallbackData = await fallbackRes.json();
      const rate = fallbackData.rates[toCurrency];
      // Cache it
      await db.insert(exchangeRates).values({
        date,
        fromCurrency,
        toCurrency,
        rate,
      }).onConflictDoNothing();
      return rate;
    }

    const data = await res.json();
    const rate = data.rates[toCurrency];

    // Cache it
    await db.insert(exchangeRates).values({
      date,
      fromCurrency,
      toCurrency,
      rate,
    }).onConflictDoNothing();

    return rate;
  } catch (error) {
    console.error('Exchange rate error:', error);
    throw new Error(`Could not fetch exchange rate for ${fromCurrency} -> ${toCurrency} on ${date}`);
  }
}

export async function convertToAud(
  amount: number,
  currency: string,
  date: string
): Promise<number> {
  if (currency === 'AUD') return amount;
  const rate = await getExchangeRate(currency, date);
  return amount * rate;
}
