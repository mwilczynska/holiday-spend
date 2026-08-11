// Build v6.1 direct tier-vector priors from the normalized development
// fixtures. This script never reads the shipping CSV and never inverts v1.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, 'data/reference/v6/experiments/008-v6-1-development-fixtures');
const INPUTS = path.join(FIXTURE_DIR, 'inputs.json');
const FX_PATH = path.join(ROOT, 'data/reference/fx/city_cost_fx_aud_2026-07-22.json');
const COEFFICIENTS_PATH = path.join(ROOT, 'data/reference/v6/coefficients-v6.json');
const MANIFEST_PATH = path.join(ROOT, 'data/reference/v6/validation-manifest-v6.json');
const OUT_PATH = path.join(ROOT, 'data/reference/v6/priors-v6-1.json');
const CHECK = process.argv.includes('--check');

const ACCOMMODATION_TIERS = {
  accom_shared_hostel_dorm: ['accom_shared_hostel_dorm', true],
  accom_hostel_private_room: ['accom_hostel_private_room', false],
  accom_1_star: ['accom_1_star', false],
  accom_2_star: ['accom_2_star', false],
  accom_4_star: ['accom_4_star', false],
};

const FOOD_MEASURES = {
  byt_food_budget_per_person_day: 'food_budget',
  byt_food_mid_per_person_day: 'food_mid_range',
  byt_food_high_per_person_day: 'food_high_end',
};

const ACTIVITY_MEASURES = {
  byt_activities_budget_per_person_day: 'activities_budget',
  byt_activities_mid_per_person_day: 'activities_mid_range',
  byt_activities_high_per_person_day: 'activities_high_end',
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeRegion(region) {
  const key = String(region ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  const aliases = {
    'se asia': 'SEA', sea: 'SEA', 'east asia': 'East Asia', 'south asia': 'South Asia',
    'middle east': 'Middle East', africa: 'Africa', europe: 'Europe', 'latin america': 'Latin America',
    'north america': 'North America', oceania: 'Oceania',
  };
  return aliases[key] ?? String(region ?? 'unknown').trim();
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function add(buckets, key, tier, value) {
  if (!Number.isFinite(value) || value < 0) return;
  const group = buckets[key] ?? (buckets[key] = {});
  (group[tier] ??= []).push(value);
}

function collapse(buckets) {
  return Object.fromEntries(Object.entries(buckets).map(([key, tiers]) => [
    key,
    Object.fromEntries(Object.entries(tiers).map(([tier, values]) => [tier, round(median(values))])),
  ]));
}

function sourceValue(response, measure, fx, exclusions, city, source) {
  const observation = response.measures?.[measure];
  if (observation?.status !== 'observed') return null;
  const rate = observation.currency === 'AUD' ? 1 : fx.rates?.[observation.currency]?.audPerUnit;
  if (!Number.isFinite(rate)) {
    exclusions.push({ city, source, measure, currency: observation.currency ?? null, reason: 'missing_frozen_fx_rate' });
    return null;
  }
  if (!Number.isFinite(observation.value)) throw new Error(`Observed ${city}/${source}/${measure} has no value.`);
  return observation.value * rate;
}

function addAccommodation(city, region, band, responses, buckets, fx, coefficients, exclusions) {
  const hotel3 = sourceValue(responses.expedia_3star, 'hotel_3star_room_2p', fx, exclusions, city, 'expedia_3star');
  if (hotel3 === null) return;
  const calibrated = hotel3 * coefficients.sourceCalibrationOffsets.hotel_3star_room_2p.expediaToBookingMultiplier;
  add(buckets.regionBand, `${region}|${band}`, 'accom_3_star', calibrated);
  add(buckets.region, region, 'accom_3_star', calibrated);
  add(buckets.global, 'global', 'accom_3_star', calibrated);
  for (const [tier, [coefficientName, multiplyBy]] of Object.entries(ACCOMMODATION_TIERS)) {
    const coefficient = coefficients.shippedCoefficients[coefficientName];
    if (!coefficient || !Number.isFinite(coefficient.k)) throw new Error(`Missing accommodation coefficient ${coefficientName}.`);
    const value = calibrated * coefficient.k * (multiplyBy ? 2 : 1);
    add(buckets.regionBand, `${region}|${band}`, tier, value);
    add(buckets.region, region, tier, value);
    add(buckets.global, 'global', tier, value);
  }
}

function addFood(region, band, city, response, buckets, fx, coefficients, exclusions) {
  const streetRelation = coefficients.shippedCoefficients.street_food_meal_1p;
  const streetK = (6 * streetRelation.k) / (4 * streetRelation.k + 2);
  for (const [measure, tier] of Object.entries(FOOD_MEASURES)) {
    const value = sourceValue(response, measure, fx, exclusions, city, 'budgetyourtrip_daily_tiers');
    if (value === null) continue;
    const tierValue = value * 2;
    add(buckets.regionBand, `${region}|${band}`, tier, tierValue);
    add(buckets.region, region, tier, tierValue);
    add(buckets.global, 'global', tier, tierValue);
    if (tier === 'food_budget') {
      const street = tierValue * streetK;
      add(buckets.regionBand, `${region}|${band}`, 'food_street_food', street);
      add(buckets.region, region, 'food_street_food', street);
      add(buckets.global, 'global', 'food_street_food', street);
    }
  }
}

function addActivities(region, band, city, response, buckets, fx, exclusions) {
  for (const [measure, tier] of Object.entries(ACTIVITY_MEASURES)) {
    const value = sourceValue(response, measure, fx, exclusions, city, 'budgetyourtrip_daily_tiers');
    if (value === null) continue;
    const tierValue = value * 2;
    add(buckets.regionBand, `${region}|${band}`, tier, tierValue);
    add(buckets.region, region, tier, tierValue);
    add(buckets.global, 'global', tier, tierValue);
  }
  for (const bucket of [buckets.regionBand[`${region}|${band}`], buckets.region[region], buckets.global.global]) {
    if (bucket) bucket.activities_free = [0];
  }
}

function addDrinks(region, band, city, response, buckets, fx, coefficients, exclusions) {
  const coffee = sourceValue(response, 'cappuccino_1', fx, exclusions, city, 'numbeo_drinks');
  const beer = sourceValue(response, 'domestic_draft_beer_1', fx, exclusions, city, 'numbeo_drinks');
  if (coffee === null && beer === null) return;
  const cocktail = coffee === null ? null : coffee * coefficients.shippedCoefficients.cocktail_1.k;
  const tiers = {
    ...(coffee === null ? {} : { drink_coffee: coffee, drinks_none: coffee * 2 }),
    ...(coffee !== null && beer !== null ? {
      drinks_light: coffee * 2 + beer * 2,
      drinks_moderate: coffee * 2 + beer * 4 + cocktail * 2,
      drinks_heavy: coffee * 2 + beer * 6 + cocktail * 4,
    } : {}),
  };
  for (const [tier, value] of Object.entries(tiers)) {
    add(buckets.regionBand, `${region}|${band}`, tier, value);
    add(buckets.region, region, tier, value);
    add(buckets.global, 'global', tier, value);
  }
}

function main() {
  const inputs = readJson(INPUTS);
  const fx = readJson(FX_PATH);
  const coefficients = readJson(COEFFICIENTS_PATH);
  const manifest = readJson(MANIFEST_PATH);
  const buckets = { regionBand: {}, region: {}, global: {} };
  const exclusions = [];
  const observedBySource = {};
  const cities = inputs.cities ?? [];

  for (const cityRow of cities) {
    const city = cityRow.city;
    const region = normalizeRegion(cityRow.region);
    const band = cityRow.band;
    const citySlug = slug(city);
    const responseDir = path.join(FIXTURE_DIR, 'spine', citySlug);
    const responses = {
      expedia_3star: readJson(path.join(responseDir, 'expedia_3star.json')),
      budgetyourtrip_daily_tiers: readJson(path.join(responseDir, 'budgetyourtrip_daily_tiers.json')),
      numbeo_drinks: readJson(path.join(responseDir, 'numbeo_drinks.json')),
    };
    for (const response of Object.values(responses)) {
      for (const [measure, observation] of Object.entries(response.measures ?? {})) {
        if (observation.status === 'observed') observedBySource[measure] = (observedBySource[measure] ?? 0) + 1;
      }
    }
    addAccommodation(city, region, band, responses, buckets, fx, coefficients, exclusions);
    addFood(region, band, city, responses.budgetyourtrip_daily_tiers, buckets, fx, coefficients, exclusions);
    addActivities(region, band, city, responses.budgetyourtrip_daily_tiers, buckets, fx, exclusions);
    addDrinks(region, band, city, responses.numbeo_drinks, buckets, fx, coefficients, exclusions);
  }

  const output = {
    schemaVersion: 'city-cost-v6-1-priors-v1',
    methodologyVersion: 'v6.1',
    generatedAt: '2026-08-10',
    sourcePolicy: 'Direct source-native v6.1 development fixtures only: Expedia 3-star calibrated accommodation, BudgetYourTrip labelled daily food/activity tiers, and Numbeo cappuccino/beer. No city_costs_app_aud.csv read, no algebraic inversion and no holdout read.',
    fallbackOrder: 'region|band -> region -> global',
    bandCuts: manifest.groundTruthPanel.bandCutsAud,
    byRegionBand: {},
    byRegion: {},
    global: {},
    tierValuesByRegionBand: collapse(buckets.regionBand),
    tierValuesByRegion: collapse(buckets.region),
    tierValuesGlobal: collapse(buckets.global).global ?? {},
    sourceCounts: {
      developmentCities: cities.length,
      observedByMeasure: observedBySource,
      fallbackTierVectorFields: Object.keys(collapse(buckets.global).global ?? {}).length,
      excludedRows: exclusions.length,
    },
    excludedRows: exclusions,
    excludedCurrencies: [...new Set(exclusions.map((row) => row.currency).filter(Boolean))].sort(),
    provenance: {
      accommodationCalibration: 'coefficients-v6.json sourceCalibrationOffsets.hotel_3star_room_2p.expediaToBookingMultiplier',
      foodTwoPersonConversion: 'BudgetYourTrip per-person/day values multiplied by 2',
      activityTwoPersonConversion: 'BudgetYourTrip per-person/day values multiplied by 2',
      streetFoodCompatibility: '(6 * coefficients-v6.street_food_meal_1p.k) / (4 * coefficients-v6.street_food_meal_1p.k + 2)',
      cocktailRelation: 'coefficients-v6.cocktail_1.k * cappuccino_1',
      frozenFx: 'data/reference/fx/city_cost_fx_aud_2026-07-22.json',
    },
  };

  if (CHECK) {
    if (!fs.existsSync(OUT_PATH)) throw new Error(`Missing generated priors: ${OUT_PATH}`);
    const existing = fs.readFileSync(OUT_PATH, 'utf8');
    const expected = `${JSON.stringify(output, null, 2)}\n`;
    if (existing !== expected) throw new Error('v6.1 priors are stale; run the generator without --check.');
    console.log(JSON.stringify({ passed: true, output: path.relative(ROOT, OUT_PATH).replaceAll('\\', '/'), fields: output.sourceCounts.fallbackTierVectorFields }, null, 2));
    return;
  }

  writeJson(OUT_PATH, output);
  console.log(JSON.stringify({ passed: true, output: path.relative(ROOT, OUT_PATH).replaceAll('\\', '/'), fields: output.sourceCounts.fallbackTierVectorFields, excludedRows: exclusions.length }, null, 2));
}

main();
