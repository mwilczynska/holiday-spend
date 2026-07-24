import { z } from 'zod';
import {
  CITY_COST_MEASURES,
  cityCostObservationSchema,
  type CityCostObservation,
} from './city-cost-observation';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const currencyCode = /^[A-Z]{3}$/;

export const cityCostFxRateSchema = z.object({
  currency: z.string().regex(currencyCode),
  audPerUnit: z.number().positive(),
  sourceName: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceDate: z.string().regex(isoDate),
  sourceQuote: z.string().min(1),
  derivation: z.enum(['identity', 'direct_quote', 'cross_rate', 'inverted_quote']),
  derivationFormula: z.string().min(1),
});

export const cityCostFxSnapshotSchema = z
  .object({
    schemaVersion: z.literal('city-cost-fx-snapshot-v1'),
    snapshotId: z.string().min(1),
    baseCurrency: z.literal('AUD'),
    asOfDate: z.string().regex(isoDate),
    retrievedAt: z.string().datetime(),
    rates: z.record(z.string().regex(currencyCode), cityCostFxRateSchema),
  })
  .superRefine((snapshot, context) => {
    for (const [currency, rate] of Object.entries(snapshot.rates)) {
      if (rate.currency !== currency) {
        context.addIssue({
          code: 'custom',
          path: ['rates', currency, 'currency'],
          message: `Rate currency ${rate.currency} must match key ${currency}`,
        });
      }
      if (rate.sourceDate > snapshot.asOfDate) {
        context.addIssue({
          code: 'custom',
          path: ['rates', currency, 'sourceDate'],
          message: `Rate date ${rate.sourceDate} cannot be after snapshot date ${snapshot.asOfDate}`,
        });
      }
    }

    const audRate = snapshot.rates.AUD;
    if (!audRate || audRate.audPerUnit !== 1 || audRate.derivation !== 'identity') {
      context.addIssue({
        code: 'custom',
        path: ['rates', 'AUD'],
        message: 'FX snapshots require an AUD identity rate of exactly 1',
      });
    }
  });

export type CityCostFxSnapshot = z.infer<typeof cityCostFxSnapshotSchema>;

export interface NormalizedCityCostObservation {
  observation: CityCostObservation;
  fxSnapshotId: string;
  localCurrency: string;
  sourceToLocalRate: number;
  priceLocal: number;
  reportedLowLocal: number | null;
  reportedHighLocal: number | null;
}

export interface AggregatedCityCostMeasure {
  city: string;
  country: string;
  region: CityCostObservation['region'];
  category: CityCostObservation['category'];
  measure: CityCostObservation['measure'];
  unit: CityCostObservation['unit'];
  travellers: number;
  valueStatus: CityCostObservation['valueStatus'];
  localCurrency: string;
  audPerLocalUnit: number;
  medianLocal: number;
  q25Local: number;
  q75Local: number;
  minLocal: number;
  maxLocal: number;
  medianAud: number;
  q25Aud: number;
  q75Aud: number;
  minAud: number;
  maxAud: number;
  observationCount: number;
  sourceCount: number;
  sourceNames: string[];
  sourceCurrencies: string[];
  observationIds: string[];
  fxSnapshotId: string;
}

export const CITY_COST_V3_TIER_NAMES = [
  'accom_shared_hostel_dorm',
  'accom_hostel_private_room',
  'accom_1_star',
  'accom_2_star',
  'accom_3_star',
  'accom_4_star',
  'food_street_food',
  'food_budget',
  'food_mid_range',
  'food_high_end',
  'drink_coffee',
  'drinks_none',
  'drinks_light',
  'drinks_moderate',
  'drinks_heavy',
  'activities_free',
  'activities_budget',
  'activities_mid_range',
  'activities_high_end',
] as const;

export type CityCostV3TierName = (typeof CITY_COST_V3_TIER_NAMES)[number];

export interface MaterializedCityCostTier {
  amountAud: number | null;
  formula: string;
  parentMeasures: CityCostObservation['measure'][];
  missingMeasures: CityCostObservation['measure'][];
}

export interface MaterializedCityCostV3 {
  schemaVersion: 'city-cost-materialization-v1';
  calculatorVersion: 'city-cost-v3-alpha-1';
  city: string;
  country: string;
  region: CityCostObservation['region'];
  localCurrency: string;
  fxSnapshotId: string;
  tiersAud: Record<CityCostV3TierName, MaterializedCityCostTier>;
  materializedTierCount: number;
  missingMeasures: CityCostObservation['measure'][];
  complete: boolean;
  wideRow: ({ city: string; country: string; region: string } & Record<CityCostV3TierName, number>) | null;
}

export interface CityCostV3Dataset {
  schemaVersion: 'city-cost-materialized-dataset-v1';
  calculatorVersion: 'city-cost-v3-alpha-1';
  dataCutoff: string;
  fxSnapshotId: string;
  fxAsOfDate: string;
  observationSummary: {
    input: number;
    accepted: number;
    rejected: number;
    unreviewed: number;
    direct: number;
    derived: number;
    imputed: number;
  };
  cityCount: number;
  completeCityCount: number;
  requiredTierCells: number;
  materializedTierCells: number;
  tierCoverage: Record<CityCostV3TierName, number>;
  aggregates: AggregatedCityCostMeasure[];
  cities: MaterializedCityCostV3[];
}

function round(value: number, places = 6) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function money(value: number) {
  return round(value, 2);
}

export function quantile(values: number[], probability: number) {
  if (!values.length) throw new Error('Cannot calculate a quantile for an empty sample');
  if (probability < 0 || probability > 1) throw new Error('Quantile probability must be between 0 and 1');

  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const weight = position - lowerIndex;
  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}

export function normalizeCityCostObservation(
  observationInput: CityCostObservation,
  snapshotInput: CityCostFxSnapshot,
  localCurrency: string
): NormalizedCityCostObservation {
  const observation = cityCostObservationSchema.parse(observationInput);
  const snapshot = cityCostFxSnapshotSchema.parse(snapshotInput);
  if (!currencyCode.test(localCurrency)) {
    throw new Error(`Invalid local currency ${localCurrency} for ${observation.city}, ${observation.country}`);
  }
  const sourceRate = snapshot.rates[observation.currency];
  if (!sourceRate) throw new Error(`FX snapshot ${snapshot.snapshotId} has no ${observation.currency} rate`);
  const localRate = snapshot.rates[localCurrency];
  if (!localRate) throw new Error(`FX snapshot ${snapshot.snapshotId} has no ${localCurrency} rate`);

  const unitDivisor = observation.quantity;
  const sourceToLocalRate = sourceRate.audPerUnit / localRate.audPerUnit;
  return {
    observation,
    fxSnapshotId: snapshot.snapshotId,
    localCurrency,
    sourceToLocalRate,
    priceLocal: round((observation.priceAmount / unitDivisor) * sourceToLocalRate),
    reportedLowLocal:
      observation.reportedLow === null
        ? null
        : round((observation.reportedLow / unitDivisor) * sourceToLocalRate),
    reportedHighLocal:
      observation.reportedHigh === null
        ? null
        : round((observation.reportedHigh / unitDivisor) * sourceToLocalRate),
  };
}

const valueStatusPriority: Record<CityCostObservation['valueStatus'], number> = {
  direct: 0,
  derived: 1,
  imputed: 2,
};

export function aggregateCityCostMeasures(
  observations: CityCostObservation[],
  snapshotInput: CityCostFxSnapshot,
  resolveLocalCurrency: (city: string, country: string) => string
): AggregatedCityCostMeasure[] {
  const snapshot = cityCostFxSnapshotSchema.parse(snapshotInput);
  const normalized = observations
    .filter((observation) => observation.reviewerStatus === 'accepted')
    .map((observation) =>
      normalizeCityCostObservation(
        observation,
        snapshot,
        resolveLocalCurrency(observation.city, observation.country)
      )
    );
  const groups = new Map<string, NormalizedCityCostObservation[]>();

  for (const observation of normalized) {
    const raw = observation.observation;
    const key = `${raw.city}|${raw.country}|${raw.measure}`;
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => {
      const bestPriority = Math.min(...group.map((item) => valueStatusPriority[item.observation.valueStatus]));
      const selected = group.filter(
        (item) => valueStatusPriority[item.observation.valueStatus] === bestPriority
      );
      const first = selected[0].observation;
      const units = new Set(selected.map((item) => item.observation.unit));
      const travellerCounts = new Set(selected.map((item) => item.observation.travellers));
      const regions = new Set(selected.map((item) => item.observation.region));
      const localCurrencies = new Set(selected.map((item) => item.localCurrency));
      if (units.size !== 1 || travellerCounts.size !== 1 || regions.size !== 1 || localCurrencies.size !== 1) {
        throw new Error(`Incompatible observations for ${first.city}, ${first.country}, ${first.measure}`);
      }

      const localCurrency = selected[0].localCurrency;
      const audPerLocalUnit = snapshot.rates[localCurrency].audPerUnit;
      const values = selected.map((item) => item.priceLocal);
      const medianLocal = round(quantile(values, 0.5));
      const q25Local = round(quantile(values, 0.25));
      const q75Local = round(quantile(values, 0.75));
      const minLocal = round(Math.min(...values));
      const maxLocal = round(Math.max(...values));
      return {
        city: first.city,
        country: first.country,
        region: first.region,
        category: first.category,
        measure: first.measure,
        unit: first.unit,
        travellers: first.travellers,
        valueStatus: first.valueStatus,
        localCurrency,
        audPerLocalUnit,
        medianLocal,
        q25Local,
        q75Local,
        minLocal,
        maxLocal,
        medianAud: round(medianLocal * audPerLocalUnit),
        q25Aud: round(q25Local * audPerLocalUnit),
        q75Aud: round(q75Local * audPerLocalUnit),
        minAud: round(minLocal * audPerLocalUnit),
        maxAud: round(maxLocal * audPerLocalUnit),
        observationCount: selected.length,
        sourceCount: new Set(selected.map((item) => item.observation.sourceName)).size,
        sourceNames: Array.from(
          new Set(selected.map((item) => item.observation.sourceName))
        ).sort(),
        sourceCurrencies: Array.from(
          new Set(selected.map((item) => item.observation.currency))
        ).sort(),
        observationIds: selected.map((item) => item.observation.observationId).sort(),
        fxSnapshotId: snapshot.snapshotId,
      } satisfies AggregatedCityCostMeasure;
    })
    .sort((a, b) =>
      `${a.city}|${a.country}|${a.measure}`.localeCompare(`${b.city}|${b.country}|${b.measure}`)
    );
}

function tier(
  measures: Map<CityCostObservation['measure'], AggregatedCityCostMeasure>,
  parentMeasures: CityCostObservation['measure'][],
  formula: string,
  calculate: (value: (measure: CityCostObservation['measure']) => number) => number
): MaterializedCityCostTier {
  const missingMeasures = parentMeasures.filter((measure) => !measures.has(measure));
  if (missingMeasures.length) return { amountAud: null, formula, parentMeasures, missingMeasures };
  const value = (measure: CityCostObservation['measure']) => measures.get(measure)!.medianAud;
  return { amountAud: money(calculate(value)), formula, parentMeasures, missingMeasures: [] };
}

export function materializeCityCostV3(
  city: string,
  country: string,
  aggregates: AggregatedCityCostMeasure[]
): MaterializedCityCostV3 {
  const cityAggregates = aggregates.filter(
    (aggregate) => aggregate.city === city && aggregate.country === country
  );
  if (!cityAggregates.length) throw new Error(`No aggregated observations found for ${city}, ${country}`);

  const regions = new Set(cityAggregates.map((aggregate) => aggregate.region));
  const localCurrencies = new Set(cityAggregates.map((aggregate) => aggregate.localCurrency));
  const fxSnapshotIds = new Set(cityAggregates.map((aggregate) => aggregate.fxSnapshotId));
  if (regions.size !== 1 || localCurrencies.size !== 1 || fxSnapshotIds.size !== 1) {
    throw new Error(`Inconsistent region, local currency, or FX snapshot for ${city}, ${country}`);
  }

  const measures = new Map(cityAggregates.map((aggregate) => [aggregate.measure, aggregate]));
  const tiersAud: Record<CityCostV3TierName, MaterializedCityCostTier> = {
    accom_shared_hostel_dorm: tier(
      measures,
      ['hostel_dorm_bed_1p'],
      '2 * hostel_dorm_bed_1p',
      (v) => 2 * v('hostel_dorm_bed_1p')
    ),
    accom_hostel_private_room: tier(
      measures,
      ['hostel_private_room_2p'],
      'hostel_private_room_2p',
      (v) => v('hostel_private_room_2p')
    ),
    accom_1_star: tier(measures, ['hotel_1star_room_2p'], 'hotel_1star_room_2p', (v) => v('hotel_1star_room_2p')),
    accom_2_star: tier(measures, ['hotel_2star_room_2p'], 'hotel_2star_room_2p', (v) => v('hotel_2star_room_2p')),
    accom_3_star: tier(measures, ['hotel_3star_room_2p'], 'hotel_3star_room_2p', (v) => v('hotel_3star_room_2p')),
    accom_4_star: tier(measures, ['hotel_4star_room_2p'], 'hotel_4star_room_2p', (v) => v('hotel_4star_room_2p')),
    food_street_food: tier(
      measures,
      ['street_food_meal_1p'],
      '6 * street_food_meal_1p',
      (v) => 6 * v('street_food_meal_1p')
    ),
    food_budget: tier(
      measures,
      ['street_food_meal_1p', 'inexpensive_restaurant_meal_1p'],
      '4 * street_food_meal_1p + 2 * inexpensive_restaurant_meal_1p',
      (v) => 4 * v('street_food_meal_1p') + 2 * v('inexpensive_restaurant_meal_1p')
    ),
    food_mid_range: tier(
      measures,
      ['street_food_meal_1p', 'inexpensive_restaurant_meal_1p', 'midrange_restaurant_meal_2p'],
      '2 * street_food_meal_1p + 2 * inexpensive_restaurant_meal_1p + midrange_restaurant_meal_2p',
      (v) =>
        2 * v('street_food_meal_1p') +
        2 * v('inexpensive_restaurant_meal_1p') +
        v('midrange_restaurant_meal_2p')
    ),
    food_high_end: tier(
      measures,
      ['inexpensive_restaurant_meal_1p', 'midrange_restaurant_meal_2p', 'premium_restaurant_meal_2p'],
      '2 * inexpensive_restaurant_meal_1p + midrange_restaurant_meal_2p + premium_restaurant_meal_2p',
      (v) =>
        2 * v('inexpensive_restaurant_meal_1p') +
        v('midrange_restaurant_meal_2p') +
        v('premium_restaurant_meal_2p')
    ),
    drink_coffee: tier(measures, ['cappuccino_1'], 'cappuccino_1', (v) => v('cappuccino_1')),
    drinks_none: tier(measures, ['cappuccino_1'], '2 * cappuccino_1', (v) => 2 * v('cappuccino_1')),
    drinks_light: tier(
      measures,
      ['cappuccino_1', 'domestic_draft_beer_1'],
      '2 * cappuccino_1 + 2 * domestic_draft_beer_1',
      (v) => 2 * v('cappuccino_1') + 2 * v('domestic_draft_beer_1')
    ),
    drinks_moderate: tier(
      measures,
      ['cappuccino_1', 'domestic_draft_beer_1', 'cocktail_1'],
      '2 * cappuccino_1 + 4 * domestic_draft_beer_1 + 2 * cocktail_1',
      (v) => 2 * v('cappuccino_1') + 4 * v('domestic_draft_beer_1') + 2 * v('cocktail_1')
    ),
    drinks_heavy: tier(
      measures,
      ['cappuccino_1', 'domestic_draft_beer_1', 'cocktail_1', 'wine_glass_1'],
      '2 * cappuccino_1 + 6 * domestic_draft_beer_1 + 4 * cocktail_1 + 2 * wine_glass_1',
      (v) =>
        2 * v('cappuccino_1') +
        6 * v('domestic_draft_beer_1') +
        4 * v('cocktail_1') +
        2 * v('wine_glass_1')
    ),
    activities_free: tier(measures, [], '0', () => 0),
    activities_budget: tier(
      measures,
      ['paid_attraction_adult_1'],
      '2 * paid_attraction_adult_1',
      (v) => 2 * v('paid_attraction_adult_1')
    ),
    activities_mid_range: tier(
      measures,
      ['half_day_group_activity_adult_1'],
      '2 * half_day_group_activity_adult_1',
      (v) => 2 * v('half_day_group_activity_adult_1')
    ),
    activities_high_end: tier(
      measures,
      ['full_day_premium_activity_adult_1'],
      '2 * full_day_premium_activity_adult_1',
      (v) => 2 * v('full_day_premium_activity_adult_1')
    ),
  };

  const missingMeasures = CITY_COST_MEASURES.filter((measure) => !measures.has(measure));
  const materializedTierCount = Object.values(tiersAud).filter((value) => value.amountAud !== null).length;
  const complete = CITY_COST_V3_TIER_NAMES.every((name) => tiersAud[name].amountAud !== null);
  const wideRow = complete
    ? ({
        city,
        country,
        region: cityAggregates[0].region,
        ...Object.fromEntries(
          CITY_COST_V3_TIER_NAMES.map((name) => [name, tiersAud[name].amountAud as number])
        ),
      } as { city: string; country: string; region: string } & Record<CityCostV3TierName, number>)
    : null;

  return {
    schemaVersion: 'city-cost-materialization-v1',
    calculatorVersion: 'city-cost-v3-alpha-1',
    city,
    country,
    region: cityAggregates[0].region,
    localCurrency: cityAggregates[0].localCurrency,
    fxSnapshotId: cityAggregates[0].fxSnapshotId,
    tiersAud,
    materializedTierCount,
    missingMeasures,
    complete,
    wideRow,
  };
}

export function buildCityCostV3Dataset(
  observationInputs: CityCostObservation[],
  snapshotInput: CityCostFxSnapshot,
  resolveLocalCurrency: (city: string, country: string) => string
): CityCostV3Dataset {
  const snapshot = cityCostFxSnapshotSchema.parse(snapshotInput);
  const observations = observationInputs.map((observation) => cityCostObservationSchema.parse(observation));
  const observationIds = new Set<string>();
  for (const observation of observations) {
    if (observationIds.has(observation.observationId)) {
      throw new Error(`Duplicate observationId ${observation.observationId}`);
    }
    observationIds.add(observation.observationId);
  }

  const aggregates = aggregateCityCostMeasures(observations, snapshot, resolveLocalCurrency);
  const cityPairs = new Map<string, { city: string; country: string }>();
  for (const aggregate of aggregates) {
    cityPairs.set(`${aggregate.city}\u0000${aggregate.country}`, {
      city: aggregate.city,
      country: aggregate.country,
    });
  }
  const cities = Array.from(cityPairs.values())
    .sort((a, b) => `${a.city}|${a.country}`.localeCompare(`${b.city}|${b.country}`))
    .map(({ city, country }) => materializeCityCostV3(city, country, aggregates));

  const tierCoverage = Object.fromEntries(
    CITY_COST_V3_TIER_NAMES.map((name) => [
      name,
      cities.filter((city) => city.tiersAud[name].amountAud !== null).length,
    ])
  ) as Record<CityCostV3TierName, number>;
  const accepted = observations.filter((observation) => observation.reviewerStatus === 'accepted');
  const dataCutoff = [snapshot.retrievedAt, ...observations.map((observation) => observation.retrievedAt)]
    .sort()
    .at(-1)!;

  return {
    schemaVersion: 'city-cost-materialized-dataset-v1',
    calculatorVersion: 'city-cost-v3-alpha-1',
    dataCutoff,
    fxSnapshotId: snapshot.snapshotId,
    fxAsOfDate: snapshot.asOfDate,
    observationSummary: {
      input: observations.length,
      accepted: accepted.length,
      rejected: observations.filter((observation) => observation.reviewerStatus === 'rejected').length,
      unreviewed: observations.filter((observation) => observation.reviewerStatus === 'unreviewed').length,
      direct: accepted.filter((observation) => observation.valueStatus === 'direct').length,
      derived: accepted.filter((observation) => observation.valueStatus === 'derived').length,
      imputed: accepted.filter((observation) => observation.valueStatus === 'imputed').length,
    },
    cityCount: cities.length,
    completeCityCount: cities.filter((city) => city.complete).length,
    requiredTierCells: cities.length * CITY_COST_V3_TIER_NAMES.length,
    materializedTierCells: cities.reduce((total, city) => total + city.materializedTierCount, 0),
    tierCoverage,
    aggregates,
    cities,
  };
}
