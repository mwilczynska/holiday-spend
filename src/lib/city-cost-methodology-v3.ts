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

export interface CityCostSourceChannelSummary {
  sourceChannel: CityCostObservation['sourceType'];
  observationCount: number;
  sourceCount: number;
  sourceNames: string[];
  observationIds: string[];
  medianLocal: number;
  q25Local: number;
  q75Local: number;
  medianAud: number;
}

export const REQUIRED_ACCOMMODATION_SEASONS = ['low', 'shoulder', 'high'] as const;
export const MIN_ACCOMMODATION_OBSERVATIONS_PER_SEASON = 5;
export const MIN_ACCOMMODATION_CROSS_SEASON_PANEL_OVERLAP_PCT = 60;

export interface CityCostSeasonSummary {
  season: (typeof REQUIRED_ACCOMMODATION_SEASONS)[number];
  observationCount: number;
  sourceCount: number;
  sourceNames: string[];
  observationIds: string[];
  medianLocal: number;
  q25Local: number;
  q75Local: number;
  medianAud: number;
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
  selectedSourceChannel: CityCostObservation['sourceType'];
  availableSourceChannels: CityCostObservation['sourceType'][];
  sourceChannelSummaries: CityCostSourceChannelSummary[];
  sourceDisagreement: {
    thresholdPct: number;
    maxAbsoluteDifferencePct: number | null;
    flagged: boolean;
  };
  seasonCoverage: {
    requiredSeasons: (typeof REQUIRED_ACCOMMODATION_SEASONS)[number][];
    availableSeasons: (typeof REQUIRED_ACCOMMODATION_SEASONS)[number][];
    minimumObservationsPerSeason: number | null;
    sampleSizeComplete: boolean;
    crossSeasonPanelOverlapPct: number | null;
    minimumCrossSeasonPanelOverlapPct: number | null;
    panelOverlapComplete: boolean;
    complete: boolean;
    weightingMethod: 'equal_weight_median_of_season_medians' | 'not_applicable';
    summaries: CityCostSeasonSummary[];
  };
  eligibleForMaterialization: boolean;
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
  availableObservationCount: number;
  sourceCount: number;
  sourceNames: string[];
  sourceCurrencies: string[];
  observationIds: string[];
  availableObservationIds: string[];
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
  /**
   * Weakest valueStatus among the inputs that produced this cell. A tier resting
   * on any imputed input is model-backed, not observed, and must never be
   * presented as direct evidence. Null when the cell did not materialize.
   */
  evidenceBasis: CityCostObservation['valueStatus'] | null;
  /** Inputs that were imputed rather than observed, empty when fully observed. */
  imputedMeasures: CityCostObservation['measure'][];
}

export interface MaterializedCityCostV3 {
  schemaVersion: 'city-cost-materialization-v1';
  calculatorVersion: 'city-cost-v3-alpha-3';
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
  calculatorVersion: 'city-cost-v3-alpha-3';
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
  qualitySummary: {
    crossChannelMeasureCount: number;
    flaggedSourceDisagreementCount: number;
    completeSeasonAccommodationMeasureCount: number;
    incompleteSeasonAccommodationMeasureCount: number;
  };
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

export const SOURCE_CHANNEL_DISAGREEMENT_THRESHOLD_PCT = 25;

const sourceChannelPriority: Record<
  CityCostObservation['category'],
  Record<CityCostObservation['sourceType'], number>
> = {
  accommodation: {
    official_website: 0,
    official_api: 1,
    published_dataset: 2,
    marketplace_api: 3,
    crowdsourced_api: 4,
    manual_menu_sample: 5,
    delivery_platform_menu: 6,
    derived_model: 7,
  },
  food: {
    published_dataset: 0,
    crowdsourced_api: 1,
    manual_menu_sample: 2,
    official_api: 3,
    official_website: 4,
    marketplace_api: 5,
    delivery_platform_menu: 6,
    derived_model: 7,
  },
  drinks: {
    published_dataset: 0,
    crowdsourced_api: 1,
    manual_menu_sample: 2,
    official_api: 3,
    official_website: 4,
    marketplace_api: 5,
    delivery_platform_menu: 6,
    derived_model: 7,
  },
  activities: {
    official_website: 0,
    official_api: 1,
    marketplace_api: 2,
    published_dataset: 3,
    crowdsourced_api: 4,
    manual_menu_sample: 5,
    delivery_platform_menu: 6,
    derived_model: 7,
  },
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
      const provenanceSelected = group.filter(
        (item) => valueStatusPriority[item.observation.valueStatus] === bestPriority
      );
      const first = provenanceSelected[0].observation;
      const units = new Set(provenanceSelected.map((item) => item.observation.unit));
      const travellerCounts = new Set(provenanceSelected.map((item) => item.observation.travellers));
      const regions = new Set(provenanceSelected.map((item) => item.observation.region));
      const localCurrencies = new Set(provenanceSelected.map((item) => item.localCurrency));
      if (units.size !== 1 || travellerCounts.size !== 1 || regions.size !== 1 || localCurrencies.size !== 1) {
        throw new Error(`Incompatible observations for ${first.city}, ${first.country}, ${first.measure}`);
      }

      const selectedSourceChannel = provenanceSelected
        .map((item) => item.observation.sourceType)
        .sort(
          (a, b) =>
            sourceChannelPriority[first.category][a] - sourceChannelPriority[first.category][b] ||
            a.localeCompare(b)
        )[0];
      const selected = provenanceSelected.filter(
        (item) => item.observation.sourceType === selectedSourceChannel
      );
      const localCurrency = selected[0].localCurrency;
      const audPerLocalUnit = snapshot.rates[localCurrency].audPerUnit;
      const sourceChannelGroups = new Map<
        CityCostObservation['sourceType'],
        NormalizedCityCostObservation[]
      >();
      for (const item of provenanceSelected) {
        const channel = item.observation.sourceType;
        const channelGroup = sourceChannelGroups.get(channel) ?? [];
        channelGroup.push(item);
        sourceChannelGroups.set(channel, channelGroup);
      }
      const isDirectAccommodation =
        first.category === 'accommodation' && first.valueStatus === 'direct';
      const sourceChannelSummaries = Array.from(sourceChannelGroups.entries())
        .map(([sourceChannel, channelGroup]) => {
          const rawChannelValues = channelGroup.map((item) => item.priceLocal);
          const channelValues = isDirectAccommodation
            ? REQUIRED_ACCOMMODATION_SEASONS.flatMap((season) => {
                const seasonValues = channelGroup
                  .filter((item) => item.observation.season === season)
                  .map((item) => item.priceLocal);
                return seasonValues.length ? [quantile(seasonValues, 0.5)] : [];
              })
            : rawChannelValues;
          const channelMedianLocal = round(quantile(channelValues, 0.5));
          return {
            sourceChannel,
            observationCount: channelGroup.length,
            sourceCount: new Set(channelGroup.map((item) => item.observation.sourceName)).size,
            sourceNames: Array.from(
              new Set(channelGroup.map((item) => item.observation.sourceName))
            ).sort(),
            observationIds: channelGroup
              .map((item) => item.observation.observationId)
              .sort(),
            medianLocal: channelMedianLocal,
            q25Local: round(quantile(channelValues, 0.25)),
            q75Local: round(quantile(channelValues, 0.75)),
            medianAud: round(channelMedianLocal * audPerLocalUnit),
          } satisfies CityCostSourceChannelSummary;
        })
        .sort(
          (a, b) =>
            sourceChannelPriority[first.category][a.sourceChannel] -
              sourceChannelPriority[first.category][b.sourceChannel] ||
            a.sourceChannel.localeCompare(b.sourceChannel)
        );
      const values = selected.map((item) => item.priceLocal);
      const requiresSeasonCoverage = isDirectAccommodation;
      const seasonSummaries = requiresSeasonCoverage
        ? REQUIRED_ACCOMMODATION_SEASONS.flatMap((season) => {
            const seasonGroup = selected.filter((item) => item.observation.season === season);
            if (!seasonGroup.length) return [];
            const seasonValues = seasonGroup.map((item) => item.priceLocal);
            const seasonMedianLocal = round(quantile(seasonValues, 0.5));
            return [
              {
                season,
                observationCount: seasonGroup.length,
                sourceCount: new Set(seasonGroup.map((item) => item.observation.sourceName)).size,
                sourceNames: Array.from(
                  new Set(seasonGroup.map((item) => item.observation.sourceName))
                ).sort(),
                observationIds: seasonGroup
                  .map((item) => item.observation.observationId)
                  .sort(),
                medianLocal: seasonMedianLocal,
                q25Local: round(quantile(seasonValues, 0.25)),
                q75Local: round(quantile(seasonValues, 0.75)),
                medianAud: round(seasonMedianLocal * audPerLocalUnit),
              } satisfies CityCostSeasonSummary,
            ];
          })
        : [];
      const seasonSampleSizeComplete =
        !requiresSeasonCoverage ||
        REQUIRED_ACCOMMODATION_SEASONS.every(
          (season) =>
            seasonSummaries.find((summary) => summary.season === season)?.observationCount !==
              undefined &&
            seasonSummaries.find((summary) => summary.season === season)!.observationCount >=
              MIN_ACCOMMODATION_OBSERVATIONS_PER_SEASON
        );
      const seasonPropertySets = requiresSeasonCoverage
        ? REQUIRED_ACCOMMODATION_SEASONS.map(
            (season) =>
              new Set(
                selected
                  .filter((item) => item.observation.season === season)
                  .map((item) => item.observation.sourceRecordId)
                  .filter((recordId): recordId is string => recordId !== null)
              )
          )
        : [];
      const largestSeasonPanelSize = seasonPropertySets.length
        ? Math.max(...seasonPropertySets.map((set) => set.size))
        : 0;
      const commonPropertyCount = seasonPropertySets.length
        ? Array.from(seasonPropertySets[0]).filter((recordId) =>
            seasonPropertySets.slice(1).every((set) => set.has(recordId))
          ).length
        : 0;
      const crossSeasonPanelOverlapPct =
        requiresSeasonCoverage && largestSeasonPanelSize > 0
          ? round((commonPropertyCount / largestSeasonPanelSize) * 100, 2)
          : null;
      const panelOverlapComplete =
        !requiresSeasonCoverage ||
        (seasonPropertySets.every((set) => set.size > 0) &&
          crossSeasonPanelOverlapPct !== null &&
          crossSeasonPanelOverlapPct >= MIN_ACCOMMODATION_CROSS_SEASON_PANEL_OVERLAP_PCT);
      const seasonCoverageComplete = seasonSampleSizeComplete && panelOverlapComplete;
      const aggregationValues = requiresSeasonCoverage
        ? seasonSummaries.map((summary) => summary.medianLocal)
        : values;
      const medianLocal = round(quantile(aggregationValues, 0.5));
      const q25Local = round(quantile(aggregationValues, 0.25));
      const q75Local = round(quantile(aggregationValues, 0.75));
      const minLocal = round(Math.min(...aggregationValues));
      const maxLocal = round(Math.max(...aggregationValues));
      const channelDifferences = sourceChannelSummaries.map((summary) =>
        medianLocal === 0
          ? summary.medianLocal === 0
            ? 0
            : null
          : Math.abs((summary.medianLocal / medianLocal - 1) * 100)
      );
      const maxAbsoluteDifferencePct = channelDifferences.some((difference) => difference === null)
        ? null
        : round(Math.max(...(channelDifferences as number[])), 2);
      return {
        city: first.city,
        country: first.country,
        region: first.region,
        category: first.category,
        measure: first.measure,
        unit: first.unit,
        travellers: first.travellers,
        valueStatus: first.valueStatus,
        selectedSourceChannel,
        availableSourceChannels: sourceChannelSummaries.map((summary) => summary.sourceChannel),
        sourceChannelSummaries,
        sourceDisagreement: {
          thresholdPct: SOURCE_CHANNEL_DISAGREEMENT_THRESHOLD_PCT,
          maxAbsoluteDifferencePct,
          flagged:
            sourceChannelSummaries.length > 1 &&
            (maxAbsoluteDifferencePct === null ||
              maxAbsoluteDifferencePct > SOURCE_CHANNEL_DISAGREEMENT_THRESHOLD_PCT),
        },
        seasonCoverage: {
          requiredSeasons: requiresSeasonCoverage ? [...REQUIRED_ACCOMMODATION_SEASONS] : [],
          availableSeasons: seasonSummaries.map((summary) => summary.season),
          minimumObservationsPerSeason: requiresSeasonCoverage
            ? MIN_ACCOMMODATION_OBSERVATIONS_PER_SEASON
            : null,
          sampleSizeComplete: seasonSampleSizeComplete,
          crossSeasonPanelOverlapPct,
          minimumCrossSeasonPanelOverlapPct: requiresSeasonCoverage
            ? MIN_ACCOMMODATION_CROSS_SEASON_PANEL_OVERLAP_PCT
            : null,
          panelOverlapComplete,
          complete: seasonCoverageComplete,
          weightingMethod: requiresSeasonCoverage
            ? 'equal_weight_median_of_season_medians'
            : 'not_applicable',
          summaries: seasonSummaries,
        },
        eligibleForMaterialization: seasonCoverageComplete,
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
        availableObservationCount: provenanceSelected.length,
        sourceCount: new Set(selected.map((item) => item.observation.sourceName)).size,
        sourceNames: Array.from(
          new Set(selected.map((item) => item.observation.sourceName))
        ).sort(),
        sourceCurrencies: Array.from(
          new Set(selected.map((item) => item.observation.currency))
        ).sort(),
        observationIds: selected.map((item) => item.observation.observationId).sort(),
        availableObservationIds: provenanceSelected
          .map((item) => item.observation.observationId)
          .sort(),
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
  if (missingMeasures.length) {
    return {
      amountAud: null,
      formula,
      parentMeasures,
      missingMeasures,
      evidenceBasis: null,
      imputedMeasures: [],
    };
  }
  const value = (measure: CityCostObservation['measure']) => measures.get(measure)!.medianAud;
  const inputs = parentMeasures.map((measure) => measures.get(measure)!);
  const imputedMeasures = parentMeasures.filter(
    (measure) => measures.get(measure)!.valueStatus === 'imputed'
  );
  // The cell is only as strong as its weakest input.
  const evidenceBasis = inputs.some((input) => input.valueStatus === 'imputed')
    ? ('imputed' as const)
    : inputs.some((input) => input.valueStatus === 'derived')
      ? ('derived' as const)
      : ('direct' as const);
  return {
    amountAud: money(calculate(value)),
    formula,
    parentMeasures,
    missingMeasures: [],
    evidenceBasis,
    imputedMeasures,
  };
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

  const measures = new Map(
    cityAggregates
      .filter((aggregate) => aggregate.eligibleForMaterialization)
      .map((aggregate) => [aggregate.measure, aggregate])
  );
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
    calculatorVersion: 'city-cost-v3-alpha-3',
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
    calculatorVersion: 'city-cost-v3-alpha-3',
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
    qualitySummary: {
      crossChannelMeasureCount: aggregates.filter(
        (aggregate) => aggregate.availableSourceChannels.length > 1
      ).length,
      flaggedSourceDisagreementCount: aggregates.filter(
        (aggregate) => aggregate.sourceDisagreement.flagged
      ).length,
      completeSeasonAccommodationMeasureCount: aggregates.filter(
        (aggregate) =>
          aggregate.seasonCoverage.requiredSeasons.length > 0 && aggregate.seasonCoverage.complete
      ).length,
      incompleteSeasonAccommodationMeasureCount: aggregates.filter(
        (aggregate) =>
          aggregate.seasonCoverage.requiredSeasons.length > 0 && !aggregate.seasonCoverage.complete
      ).length,
    },
    aggregates,
    cities,
  };
}
