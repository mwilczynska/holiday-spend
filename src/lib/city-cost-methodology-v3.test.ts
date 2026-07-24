import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import type { CityCostObservation } from './city-cost-observation';
import {
  aggregateCityCostMeasures,
  buildCityCostV3Dataset,
  cityCostFxSnapshotSchema,
  MIN_ACCOMMODATION_OBSERVATIONS_PER_SEASON,
  materializeCityCostV3,
  normalizeCityCostObservation,
  quantile,
  REQUIRED_ACCOMMODATION_SEASONS,
  type CityCostFxSnapshot,
} from './city-cost-methodology-v3';

const fxSnapshot: CityCostFxSnapshot = {
  schemaVersion: 'city-cost-fx-snapshot-v1',
  snapshotId: 'test-fx',
  baseCurrency: 'AUD',
  asOfDate: '2026-07-22',
  retrievedAt: '2026-07-24T00:00:00.000Z',
  rates: {
    AUD: {
      currency: 'AUD',
      audPerUnit: 1,
      sourceName: 'Identity',
      sourceUrl: 'https://example.com/aud',
      sourceDate: '2026-07-22',
      sourceQuote: '1 AUD = 1 AUD',
      derivation: 'identity',
      derivationFormula: '1',
    },
    EUR: {
      currency: 'EUR',
      audPerUnit: 1.6,
      sourceName: 'Example bank',
      sourceUrl: 'https://example.com/eur',
      sourceDate: '2026-07-22',
      sourceQuote: '1 EUR = 1.6 AUD',
      derivation: 'direct_quote',
      derivationFormula: '1.6',
    },
    USD: {
      currency: 'USD',
      audPerUnit: 0.8,
      sourceName: 'Example bank',
      sourceUrl: 'https://example.com/usd',
      sourceDate: '2026-07-22',
      sourceQuote: '1 USD = 0.8 AUD',
      derivation: 'direct_quote',
      derivationFormula: '0.8',
    },
  },
};

const resolveAud = () => 'AUD';

function observation(
  measure: CityCostObservation['measure'],
  priceAmount: number,
  overrides: Partial<CityCostObservation> = {}
): CityCostObservation {
  const category = measure.startsWith('hostel') || measure.startsWith('hotel')
    ? 'accommodation'
    : measure.includes('meal')
      ? 'food'
      : ['cappuccino_1', 'domestic_draft_beer_1', 'cocktail_1', 'wine_glass_1'].includes(measure)
        ? 'drinks'
        : 'activities';
  const unit = category === 'accommodation'
    ? measure === 'hostel_dorm_bed_1p'
      ? 'per_bed_night'
      : 'per_room_night'
    : category === 'activities'
      ? 'per_person_ticket'
      : measure.includes('restaurant_meal_2p')
        ? 'per_two_person_meal'
        : 'per_person_item';

  return {
    schemaVersion: 'city-cost-observation-v1',
    observationId: `obs-${measure}-${priceAmount}-${overrides.valueStatus ?? 'direct'}`,
    batchId: 'test-batch',
    city: 'Test City',
    country: 'Testland',
    region: 'Europe',
    category,
    measure,
    valueStatus: 'direct',
    priceAmount,
    currency: 'AUD',
    unit,
    travellers: measure.endsWith('_2p') || measure.includes('room_2p') ? 2 : 1,
    quantity: 1,
    taxStatus: 'included',
    sourceName: 'Fixture source',
    sourceType: 'official_website',
    sourceAccess: category === 'accommodation' ? 'public_property' : 'public_official',
    sourceTermsUrl: null,
    sourceUrl: 'https://example.com/source',
    sourceRecordId: category === 'accommodation' ? `property-${priceAmount}` : null,
    retrievedAt: '2026-07-24T00:00:00.000Z',
    priceValidFrom: '2026-07-01',
    priceValidTo: null,
    reportedLow: null,
    reportedHigh: null,
    sampleSize: null,
    resultCount: null,
    checkIn: category === 'accommodation' ? '2026-10-01' : null,
    checkOut: category === 'accommodation' ? '2026-10-08' : null,
    quoteCaptureDate: category === 'accommodation' ? '2026-07-03' : null,
    bookingLeadDays: category === 'accommodation' ? 90 : null,
    stayNights: category === 'accommodation' ? 7 : null,
    season: category === 'accommodation' ? 'shoulder' : 'not_applicable',
    searchRadiusKm: category === 'accommodation' ? 5 : null,
    minimumReviewScore: null,
    bookerCountry: category === 'accommodation' ? 'AU' : null,
    samplingFrameId: category === 'accommodation' ? 'test-panel-v1' : null,
    rateAccess: category === 'accommodation' ? 'public' : 'not_applicable',
    rateCondition: category === 'accommodation' ? 'flexible' : 'not_applicable',
    extractionMethod: 'browser_research',
    extractorVersion: 'test',
    parentObservationIds: [],
    derivationMethod: null,
    modelVersion: null,
    predictionLower: null,
    predictionUpper: null,
    reviewerStatus: 'accepted',
    exclusionReason: null,
    notes: '',
    ...overrides,
  };
}

const accommodationWindows = {
  low: { checkIn: '2026-10-22', checkOut: '2026-10-29', quoteCaptureDate: '2026-07-24' },
  shoulder: { checkIn: '2027-02-08', checkOut: '2027-02-15', quoteCaptureDate: '2026-11-10' },
  high: { checkIn: '2027-07-12', checkOut: '2027-07-19', quoteCaptureDate: '2027-04-13' },
} as const;

function accommodationPanel(
  measure: CityCostObservation['measure'],
  priceAmount: number,
  seasons: readonly (keyof typeof accommodationWindows)[] = REQUIRED_ACCOMMODATION_SEASONS
) {
  return seasons.flatMap((season) =>
    Array.from({ length: MIN_ACCOMMODATION_OBSERVATIONS_PER_SEASON }, (_, index) =>
      observation(measure, priceAmount, {
        observationId: `obs-${measure}-${season}-${index}`,
        sourceName: `Property ${index + 1}`,
        sourceRecordId: `property-${index + 1}`,
        season,
        ...accommodationWindows[season],
      })
    )
  );
}

describe('city cost methodology v3', () => {
  it('validates an AUD-based frozen FX snapshot', () => {
    expect(cityCostFxSnapshotSchema.parse(fxSnapshot).rates.AUD.audPerUnit).toBe(1);
  });

  it('validates the checked-in official FX snapshot and its cross-rate arithmetic', () => {
    const snapshot = cityCostFxSnapshotSchema.parse(
      JSON.parse(fs.readFileSync('data/reference/fx/city_cost_fx_aud_2026-07-22.json', 'utf8'))
    );
    expect(snapshot.rates.EUR.audPerUnit).toBe(1.6312);
    expect(snapshot.rates.USD.audPerUnit).toBeCloseTo(1.6312 / 1.1408, 12);
    expect(snapshot.rates.CZK.audPerUnit).toBeCloseTo(1.6312 / 24.166, 12);
    expect(snapshot.rates.DKK.audPerUnit).toBeCloseTo(1.6312 / 7.4757, 12);
    expect(snapshot.rates.THB.audPerUnit).toBeCloseTo(1.6312 / 38.57, 12);
    expect(snapshot.rates.VND.audPerUnit).toBeCloseTo(1 / 18206, 12);
    expect(snapshot.rates.CNY.audPerUnit).toBeCloseTo(1.6312 / 7.7266, 12);
    expect(snapshot.rates.NZD.audPerUnit).toBeCloseTo(1.6312 / 1.9608, 12);
    expect(snapshot.rates.TZS.audPerUnit).toBeCloseTo(1 / 1848.9043, 12);
  });

  it('normalizes price, range, and quantity into the declared city-local currency', () => {
    const normalized = normalizeCityCostObservation(
      observation('cappuccino_1', 10, {
        currency: 'EUR',
        quantity: 2,
        reportedLow: 8,
        reportedHigh: 12,
      }),
      fxSnapshot,
      'AUD'
    );
    expect(normalized.localCurrency).toBe('AUD');
    expect(normalized.sourceToLocalRate).toBe(1.6);
    expect(normalized.priceLocal).toBe(8);
    expect(normalized.reportedLowLocal).toBe(6.4);
    expect(normalized.reportedHighLocal).toBe(9.6);
  });

  it('uses linear quantiles and median aggregation', () => {
    expect(quantile([1, 2, 8, 10], 0.25)).toBe(1.75);
    expect(quantile([1, 2, 8, 10], 0.5)).toBe(5);
  });

  it('aggregates in city-local currency before applying the publication FX rate', () => {
    const aggregates = aggregateCityCostMeasures(
      [
        observation('cappuccino_1', 10, { currency: 'USD' }),
        observation('cappuccino_1', 7, {
          observationId: 'eur-coffee',
          currency: 'EUR',
        }),
      ],
      fxSnapshot,
      () => 'EUR'
    );

    expect(aggregates[0].localCurrency).toBe('EUR');
    expect(aggregates[0].medianLocal).toBe(6);
    expect(aggregates[0].medianAud).toBe(9.6);
    expect(aggregates[0].sourceCurrencies).toEqual(['EUR', 'USD']);
  });

  it('prefers direct observations over imputed values for the same measure', () => {
    const aggregates = aggregateCityCostMeasures(
      [
        observation('cappuccino_1', 4),
        observation('cappuccino_1', 100, {
          observationId: 'imputed-coffee',
          valueStatus: 'imputed',
          sourceType: 'derived_model',
          sourceUrl: null,
          extractionMethod: 'statistical_model',
          modelVersion: 'test-model',
          predictionLower: 80,
          predictionUpper: 120,
        }),
      ],
      fxSnapshot,
      resolveAud
    );
    expect(aggregates).toHaveLength(1);
    expect(aggregates[0].medianAud).toBe(4);
    expect(aggregates[0].valueStatus).toBe('direct');
  });

  it('selects the primary source channel and flags material cross-channel disagreement', () => {
    const aggregates = aggregateCityCostMeasures(
      [
        observation('cappuccino_1', 4, {
          observationId: 'numbeo-coffee',
          sourceName: 'Numbeo',
          sourceType: 'published_dataset',
        }),
        observation('cappuccino_1', 8, {
          observationId: 'menu-coffee',
          sourceName: 'Cafe menu',
          sourceType: 'manual_menu_sample',
        }),
      ],
      fxSnapshot,
      resolveAud
    );

    expect(aggregates[0].selectedSourceChannel).toBe('published_dataset');
    expect(aggregates[0].medianLocal).toBe(4);
    expect(aggregates[0].observationCount).toBe(1);
    expect(aggregates[0].availableObservationCount).toBe(2);
    expect(aggregates[0].availableSourceChannels).toEqual([
      'published_dataset',
      'manual_menu_sample',
    ]);
    expect(aggregates[0].sourceDisagreement).toEqual({
      thresholdPct: 25,
      maxAbsoluteDifferencePct: 100,
      flagged: true,
    });
  });

  it('keeps partial accommodation panels visible but ineligible for materialization', () => {
    const aggregates = aggregateCityCostMeasures(
      accommodationPanel('hotel_3star_room_2p', 120, ['shoulder']),
      fxSnapshot,
      resolveAud
    );
    const result = materializeCityCostV3('Test City', 'Testland', aggregates);

    expect(aggregates[0].seasonCoverage).toMatchObject({
      requiredSeasons: ['low', 'shoulder', 'high'],
      availableSeasons: ['shoulder'],
      complete: false,
      minimumObservationsPerSeason: 5,
    });
    expect(aggregates[0].eligibleForMaterialization).toBe(false);
    expect(result.tiersAud.accom_3_star.amountAud).toBeNull();
    expect(result.missingMeasures).toContain('hotel_3star_room_2p');
  });

  it('equal-weights the three seasonal medians for a complete accommodation panel', () => {
    const observations = REQUIRED_ACCOMMODATION_SEASONS.flatMap((season) =>
      accommodationPanel(
        'hotel_3star_room_2p',
        season === 'low' ? 80 : season === 'shoulder' ? 120 : 240,
        [season]
      )
    );
    const aggregates = aggregateCityCostMeasures(observations, fxSnapshot, resolveAud);
    const result = materializeCityCostV3('Test City', 'Testland', aggregates);

    expect(aggregates[0].seasonCoverage.complete).toBe(true);
    expect(aggregates[0].seasonCoverage.summaries.map((summary) => summary.medianLocal)).toEqual([
      80,
      120,
      240,
    ]);
    expect(aggregates[0].medianLocal).toBe(120);
    expect(aggregates[0].seasonCoverage.crossSeasonPanelOverlapPct).toBe(100);
    expect(result.tiersAud.accom_3_star.amountAud).toBe(120);
  });

  it('requires cross-season property overlap instead of accepting three unrelated samples', () => {
    const observations = REQUIRED_ACCOMMODATION_SEASONS.flatMap((season) =>
      accommodationPanel('hotel_3star_room_2p', 120, [season]).map((item, index) => ({
        ...item,
        sourceRecordId: `${season}-property-${index + 1}`,
      }))
    );
    const aggregates = aggregateCityCostMeasures(observations, fxSnapshot, resolveAud);
    const result = materializeCityCostV3('Test City', 'Testland', aggregates);

    expect(aggregates[0].seasonCoverage).toMatchObject({
      sampleSizeComplete: true,
      crossSeasonPanelOverlapPct: 0,
      minimumCrossSeasonPanelOverlapPct: 60,
      panelOverlapComplete: false,
      complete: false,
    });
    expect(aggregates[0].eligibleForMaterialization).toBe(false);
    expect(result.tiersAud.accom_3_star.amountAud).toBeNull();
  });

  it('materializes every tier from complete primitive observations', () => {
    const values: Record<CityCostObservation['measure'], number> = {
      hostel_dorm_bed_1p: 20,
      hostel_private_room_2p: 60,
      hotel_1star_room_2p: 70,
      hotel_2star_room_2p: 90,
      hotel_3star_room_2p: 120,
      hotel_4star_room_2p: 180,
      street_food_meal_1p: 5,
      inexpensive_restaurant_meal_1p: 10,
      midrange_restaurant_meal_2p: 50,
      premium_restaurant_meal_2p: 100,
      cappuccino_1: 4,
      domestic_draft_beer_1: 6,
      cocktail_1: 14,
      wine_glass_1: 10,
      paid_attraction_adult_1: 20,
      half_day_group_activity_adult_1: 60,
      full_day_premium_activity_adult_1: 150,
    };
    const aggregates = aggregateCityCostMeasures(
      Object.entries(values).flatMap(([measure, value]) =>
        measure.startsWith('hostel') || measure.startsWith('hotel')
          ? accommodationPanel(measure as CityCostObservation['measure'], value)
          : [observation(measure as CityCostObservation['measure'], value)]
      ),
      fxSnapshot,
      resolveAud
    );
    const result = materializeCityCostV3('Test City', 'Testland', aggregates);

    expect(result.complete).toBe(true);
    expect(result.materializedTierCount).toBe(19);
    expect(result.tiersAud.accom_shared_hostel_dorm.amountAud).toBe(40);
    expect(result.tiersAud.food_mid_range.amountAud).toBe(80);
    expect(result.tiersAud.drinks_heavy.amountAud).toBe(120);
    expect(result.tiersAud.activities_high_end.amountAud).toBe(300);
    expect(result.wideRow?.drink_coffee).toBe(4);
  });

  it('returns explicit missing measures instead of publishing a partial wide row', () => {
    const aggregates = aggregateCityCostMeasures(
      [observation('cappuccino_1', 4), observation('domestic_draft_beer_1', 6)],
      fxSnapshot,
      resolveAud
    );
    const result = materializeCityCostV3('Test City', 'Testland', aggregates);

    expect(result.complete).toBe(false);
    expect(result.wideRow).toBeNull();
    expect(result.tiersAud.drinks_light.amountAud).toBe(20);
    expect(result.tiersAud.drinks_moderate.amountAud).toBeNull();
    expect(result.missingMeasures).toContain('cocktail_1');
  });

  it('builds a deterministic dataset summary without publishing incomplete wide rows', () => {
    const dataset = buildCityCostV3Dataset(
      [observation('cappuccino_1', 4), observation('domestic_draft_beer_1', 6)],
      fxSnapshot,
      resolveAud
    );

    expect(dataset.observationSummary).toMatchObject({ input: 2, accepted: 2, direct: 2 });
    expect(dataset.calculatorVersion).toBe('city-cost-v3-alpha-3');
    expect(dataset.cityCount).toBe(1);
    expect(dataset.completeCityCount).toBe(0);
    expect(dataset.requiredTierCells).toBe(19);
    expect(dataset.materializedTierCells).toBe(4);
    expect(dataset.qualitySummary).toEqual({
      crossChannelMeasureCount: 0,
      flaggedSourceDisagreementCount: 0,
      completeSeasonAccommodationMeasureCount: 0,
      incompleteSeasonAccommodationMeasureCount: 0,
    });
    expect(dataset.tierCoverage.drinks_light).toBe(1);
    expect(dataset.cities[0].wideRow).toBeNull();
  });

  it('rejects duplicate observation identifiers before materialization', () => {
    const duplicate = observation('cappuccino_1', 4);
    expect(() => buildCityCostV3Dataset([duplicate, duplicate], fxSnapshot, resolveAud)).toThrow(
      'Duplicate observationId'
    );
  });
});
