import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { withCityPriceRevisions } from '@/lib/analytics/history';
import { cities, cityEstimates, countries } from '@/db/schema';
import type { CityCostV11AnchorsUsd, CityCostV11FxProvenance } from '@/lib/city-cost-methodology-v1-1';
import {
  CITY_COST_V12_CORRECTION_VERSION,
  applyCityCostV12Correction,
  resolveCityCostV12Correction,
} from '@/lib/city-cost-methodology-v1-2';
import { planCityFxRefresh } from '@/lib/city-cost-fx-refresh';

// Re-applies the current v1.2 correction table to every v1.2 city from its stored raw (model) USD anchors, at the
// exchange rate the estimate already stores. No model call. Used when the correction table changes, for example when
// hostel factors were added on 19 October 2026. As with the exchange-rate refresh, a planner field is updated only when
// its current value still equals what the active estimate produced; hand-edited values are kept.

type Money = Record<string, number | null | undefined>;

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export interface CityRecorrectSummary {
  correctionVersion: string;
  recorrected: number;
  unchanged: number;
  notApplicable: number;
  manualFieldsKept: number;
  dryRun: boolean;
  cities: Array<{ cityId: string; previousVersion: string | null; fieldsUpdated: number; manualFields: string[] }>;
}

export function recorrectCityCosts(options: { dryRun?: boolean; now?: Date } = {}): CityRecorrectSummary {
  const dryRun = options.dryRun ?? false;
  const at = (options.now ?? new Date()).toISOString();
  const summary: CityRecorrectSummary = {
    correctionVersion: CITY_COST_V12_CORRECTION_VERSION, recorrected: 0, unchanged: 0, notApplicable: 0, manualFieldsKept: 0, dryRun, cities: [],
  };
  const countryNames = new Map(db.select({ id: countries.id, name: countries.name }).from(countries).all().map((row) => [row.id, row.name]));

  for (const city of db.select().from(cities).all()) {
    const estimate = city.estimationId
      ? db.select().from(cityEstimates).where(eq(cityEstimates.id, city.estimationId)).get()
      : undefined;
    const anchors = parseJson<{ values?: CityCostV11AnchorsUsd; rawValues?: CityCostV11AnchorsUsd; correction?: { version?: string } }>(estimate?.anchorsJson ?? null);
    const metadata = parseJson<Record<string, unknown>>(estimate?.metadataJson ?? null) ?? {};
    const estimateData = parseJson<Money>(estimate?.dataJson ?? null);
    const fx = (metadata.fx ?? null) as CityCostV11FxProvenance | null;
    const countryName = countryNames.get(city.countryId);
    if (!estimate || estimate.source !== 'llm_city_generation_v1_2' || !anchors?.rawValues || !estimateData || !fx || !countryName) {
      summary.notApplicable += 1;
      continue;
    }
    const previousVersion = anchors.correction?.version ?? null;
    if (previousVersion === CITY_COST_V12_CORRECTION_VERSION) {
      summary.unchanged += 1;
      continue;
    }

    const correction = resolveCityCostV12Correction(countryName, String(metadata.region ?? ''));
    const corrected = applyCityCostV12Correction(anchors.rawValues, correction);
    const plan = planCityFxRefresh({ anchorsUsd: corrected, fx, estimateData, cityValues: city as unknown as Money });
    summary.recorrected += 1;
    summary.manualFieldsKept += plan.manualFields.length;
    summary.cities.push({ cityId: city.id, previousVersion, fieldsUpdated: Object.keys(plan.cityUpdates).length, manualFields: plan.manualFields });
    if (dryRun) continue;

    const history = Array.isArray(metadata.correctionHistory) ? metadata.correctionHistory : [];
    withCityPriceRevisions([city.id], (tx) => {
      tx.update(cityEstimates).set({
        dataJson: JSON.stringify(plan.estimateData),
        anchorsJson: JSON.stringify({ ...anchors, values: corrected, valuesAud: plan.anchorsAud, correction }),
        metadataJson: JSON.stringify({
          ...metadata,
          correctionRefreshedAt: at,
          correctionHistory: [...history, { version: previousVersion, replacedAt: at, values: anchors.values ?? null }],
        }),
      }).where(eq(cityEstimates.id, estimate.id)).run();
      if (Object.keys(plan.cityUpdates).length) tx.update(cities).set(plan.cityUpdates).where(eq(cities.id, city.id)).run();
    });
  }
  return summary;
}
