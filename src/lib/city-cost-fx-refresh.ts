import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { cities, cityEstimates } from '@/db/schema';
import {
  materializeCityCostV11WithFx,
  type CityCostV11AnchorsUsd,
  type CityCostV11FxProvenance,
} from '@/lib/city-cost-methodology-v1-1';

// Recomputes the AUD costs of generated cities at a newer USD to AUD rate, without a model call. Only estimates that
// store their USD anchors (v1.1 and v1.2) can be refreshed; for v1.2 those are the corrected anchors, so the
// correction is preserved. A planner field is updated only when its current value still equals what the active
// estimate produced: a value someone edited by hand is left alone.
export const FX_REFRESHABLE_SOURCES = ['llm_city_generation_v1_1', 'llm_city_generation_v1_2'] as const;
const MONEY_TOLERANCE = 0.005;

type Money = Record<string, number | null | undefined>;

export interface CityFxRefreshPlan {
  /** New planner values for the city row (fields that still match the estimate). */
  cityUpdates: Record<string, number>;
  /** Fields kept because they were edited by hand. */
  manualFields: string[];
  /** Full recomputed estimate values, stored on the estimate so the next refresh can detect edits. */
  estimateData: Record<string, number>;
  anchorsAud: Record<string, number>;
}

/** Pure planning step: what a refresh would change for one city. */
export function planCityFxRefresh(params: {
  anchorsUsd: CityCostV11AnchorsUsd;
  fx: CityCostV11FxProvenance;
  estimateData: Money;
  cityValues: Money;
}): CityFxRefreshPlan {
  const materialized = materializeCityCostV11WithFx(params.anchorsUsd, params.fx);
  const next = materialized.mappedEstimate as Record<string, number>;
  const cityUpdates: Record<string, number> = {};
  const manualFields: string[] = [];

  for (const [field, value] of Object.entries(next)) {
    const produced = params.estimateData[field];
    const current = params.cityValues[field];
    const untouched = typeof produced === 'number' && typeof current === 'number'
      ? Math.abs(produced - current) <= MONEY_TOLERANCE
      : produced === current;
    if (untouched) {
      if (current !== value) cityUpdates[field] = value;
    } else {
      manualFields.push(field);
    }
  }

  return { cityUpdates, manualFields, estimateData: next, anchorsAud: materialized.anchorsAud };
}

export interface CityFxRefreshSummary {
  fx: Pick<CityCostV11FxProvenance, 'snapshotId' | 'asOfDate' | 'audPerUsd' | 'sourceName'>;
  refreshed: number;
  unchanged: number;
  notRefreshable: number;
  manualFieldsKept: number;
  dryRun: boolean;
  cities: Array<{ cityId: string; previousAudPerUsd: number | null; fieldsUpdated: number; manualFields: string[] }>;
}

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Applies a refresh to every city whose active estimate stores USD anchors. */
export function refreshCityCostExchangeRates(fx: CityCostV11FxProvenance, options: { dryRun?: boolean; now?: Date } = {}): CityFxRefreshSummary {
  const dryRun = options.dryRun ?? false;
  const refreshedAt = (options.now ?? new Date()).toISOString();
  const summary: CityFxRefreshSummary = {
    fx: { snapshotId: fx.snapshotId, asOfDate: fx.asOfDate, audPerUsd: fx.audPerUsd, sourceName: fx.sourceName },
    refreshed: 0, unchanged: 0, notRefreshable: 0, manualFieldsKept: 0, dryRun, cities: [],
  };

  const rows = db.select().from(cities).all();
  for (const city of rows) {
    const estimate = city.estimationId
      ? db.select().from(cityEstimates).where(eq(cityEstimates.id, city.estimationId)).get()
      : undefined;
    const anchors = parseJson<{ values?: CityCostV11AnchorsUsd; valuesAud?: Record<string, number> }>(estimate?.anchorsJson ?? null);
    const metadata = parseJson<Record<string, unknown>>(estimate?.metadataJson ?? null) ?? {};
    const estimateData = parseJson<Money>(estimate?.dataJson ?? null);
    if (!estimate || !(FX_REFRESHABLE_SOURCES as readonly string[]).includes(estimate.source) || !anchors?.values || !estimateData) {
      summary.notRefreshable += 1;
      continue;
    }

    const previousFx = (metadata.fx ?? null) as CityCostV11FxProvenance | null;
    if (previousFx && Math.abs(previousFx.audPerUsd - fx.audPerUsd) < 1e-6) {
      summary.unchanged += 1;
      continue;
    }

    const plan = planCityFxRefresh({ anchorsUsd: anchors.values, fx, estimateData, cityValues: city as unknown as Money });
    summary.refreshed += 1;
    summary.manualFieldsKept += plan.manualFields.length;
    summary.cities.push({
      cityId: city.id,
      previousAudPerUsd: previousFx?.audPerUsd ?? null,
      fieldsUpdated: Object.keys(plan.cityUpdates).length,
      manualFields: plan.manualFields,
    });
    if (dryRun) continue;

    const fxHistory = Array.isArray(metadata.fxHistory) ? metadata.fxHistory : [];
    db.transaction((tx) => {
      tx.update(cityEstimates).set({
        dataJson: JSON.stringify(plan.estimateData),
        anchorsJson: JSON.stringify({ ...anchors, valuesAud: plan.anchorsAud }),
        metadataJson: JSON.stringify({
          ...metadata,
          inferredAudPerUsd: fx.audPerUsd,
          fx,
          fxRefreshedAt: refreshedAt,
          fxHistory: previousFx ? [...fxHistory, { ...previousFx, replacedAt: refreshedAt }] : fxHistory,
        }),
      }).where(eq(cityEstimates.id, estimate.id)).run();
      if (Object.keys(plan.cityUpdates).length) {
        tx.update(cities).set(plan.cityUpdates).where(eq(cities.id, city.id)).run();
      }
    });
  }

  return summary;
}
