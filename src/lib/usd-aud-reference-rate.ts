import { createHash } from 'node:crypto';
import type { CityCostV11FxProvenance } from '@/lib/city-cost-methodology-v1-1';

// Exchange-rate refreshes use the European Central Bank's daily euro reference rates: official, free and keyless.
// The RBA's statistics tables refuse automated downloads, so they cannot back a scheduled server refresh; new city
// generation still records the RBA observation returned by the model. The ECB cross rate agreed with the RBA within
// 0.1% when this was adopted (16 October 2026: 1.4370 vs 1.4378 AUD per USD).
export const ECB_DAILY_RATES_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

export interface EcbUsdAudObservation {
  asOfDate: string;
  usdPerEur: number;
  audPerEur: number;
}

export function parseEcbDailyRates(xml: string): EcbUsdAudObservation {
  const date = xml.match(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
  const rate = (currency: string) => {
    const match = xml.match(new RegExp(`<Cube\\s+currency=['"]${currency}['"]\\s+rate=['"]([\\d.]+)['"]`));
    const value = match ? Number(match[1]) : NaN;
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  const usdPerEur = rate('USD');
  const audPerEur = rate('AUD');
  if (!date || usdPerEur === null || audPerEur === null) {
    throw new Error('The ECB daily rates file did not contain a dated USD and AUD rate.');
  }
  return { asOfDate: date, usdPerEur, audPerEur };
}

export function ecbObservationToFxProvenance(observation: EcbUsdAudObservation): CityCostV11FxProvenance {
  const audPerUsd = Math.round((observation.audPerEur / observation.usdPerEur) * 1_000_000) / 1_000_000;
  if (!Number.isFinite(audPerUsd) || audPerUsd < 0.5 || audPerUsd > 5) {
    throw new Error(`ECB cross rate ${audPerUsd} AUD per USD is outside the plausible range.`);
  }
  const derivationFormula = 'AUD per USD = (AUD per EUR) / (USD per EUR)';
  return {
    snapshotId: `ecb-fx-${observation.asOfDate}`,
    asOfDate: observation.asOfDate,
    baseCurrency: 'USD',
    currency: 'AUD',
    audPerUsd,
    sourceName: 'European Central Bank euro reference rates',
    sourceUrl: ECB_DAILY_RATES_URL,
    sourceDate: observation.asOfDate,
    sourceQuote: `1 EUR = ${observation.usdPerEur} USD; 1 EUR = ${observation.audPerEur} AUD`,
    derivation: 'Exchange-rate refresh: stored USD anchors reconverted at the latest ECB cross rate by the server.',
    derivationFormula,
    contentHash: createHash('sha256').update(JSON.stringify({ ...observation, audPerUsd, derivationFormula })).digest('hex'),
  };
}

export async function fetchLatestUsdAudFx(fetchImpl: typeof fetch = fetch, timeoutMs = 15_000): Promise<CityCostV11FxProvenance> {
  const response = await fetchImpl(ECB_DAILY_RATES_URL, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`ECB daily rates request failed with HTTP ${response.status}.`);
  return ecbObservationToFxProvenance(parseEcbDailyRates(await response.text()));
}
