// Generate v6 regional/band priors from direct development evidence.
// This intentionally does not read or algebraically invert the shipping CSV.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ledgerPath = path.join(root, 'data/reference/v6/ground-truth/development-ledger.json');
const bytDir = path.join(root, 'data/reference/v6/experiments/003-budgetyourtrip-tier-panel/cities');
const fxPath = path.join(root, 'data/reference/fx/city_cost_fx_aud_2026-07-22.json');
const manifestPath = path.join(root, 'data/reference/v6/validation-manifest-v6.json');
const outPath = path.join(root, 'data/reference/v6/priors-v6.json');

const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const fx = JSON.parse(fs.readFileSync(fxPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const bandCuts = manifest.groundTruthPanel.bandCutsAud;

const anchors = [
  'hostel_dorm_bed_1p', 'hostel_private_room_2p', 'hotel_1star_room_2p', 'hotel_2star_room_2p',
  'hotel_3star_room_2p', 'hotel_4star_room_2p', 'street_food_meal_1p', 'inexpensive_restaurant_meal_1p',
  'midrange_restaurant_meal_2p', 'mcmeal_combo', 'premium_restaurant_meal_2p', 'cappuccino_1',
  'domestic_draft_beer_1', 'cocktail_1', 'wine_glass_1', 'paid_attraction_adult_1',
  'half_day_group_activity_adult_1', 'full_day_premium_activity_adult_1',
];
const tierMap = {
  food_budget_per_person_day: 'food_budget',
  food_mid_per_person_day: 'food_mid_range',
  food_high_per_person_day: 'food_high_end',
  activities_budget_per_person_day: 'activities_budget',
  activities_mid_per_person_day: 'activities_mid_range',
  activities_high_per_person_day: 'activities_high_end',
};
const bytAnchorMap = {
  activities_budget_per_person_day: 'paid_attraction_adult_1',
  activities_mid_per_person_day: 'half_day_group_activity_adult_1',
  activities_high_per_person_day: 'full_day_premium_activity_adult_1',
};

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
function round(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function audAmount(observation) {
  if (observation?.status !== 'found' || !Number.isFinite(observation.amount)) return null;
  const rate = observation.currency === 'AUD' ? 1 : fx.rates?.[observation.currency]?.audPerUnit;
  return Number.isFinite(rate) ? observation.amount * rate : null;
}
function add(bucket, key, measure, value) {
  if (!Number.isFinite(value) || value < 0) return;
  const group = bucket[key] ?? (bucket[key] = {});
  (group[measure] ??= []).push(value);
}
function collapse(bucket) {
  return Object.fromEntries(Object.entries(bucket).map(([key, values]) => [
    key,
    Object.fromEntries(Object.entries(values).map(([measure, numbers]) => [measure, round(median(numbers))])),
  ]));
}

const anchorGlobal = {};
const anchorRegion = {};
const anchorRegionBand = {};
const tierGlobal = {};
const tierRegion = {};
const tierRegionBand = {};
const sourceCounts = { ledgerFoundRows: 0, ledgerAudRows: 0, ledgerUnconvertibleRows: 0, bytFoundRows: 0 };

for (const city of ledger.cities) {
  const region = normalizeRegion(city.region);
  const band = city.band ?? null;
  const regionKey = region;
  const regionBandKey = band ? `${region}|${band}` : null;
  for (const observation of city.observations ?? []) {
    if (observation.status !== 'found') continue;
    sourceCounts.ledgerFoundRows += 1;
    const value = audAmount(observation);
    if (value === null) { sourceCounts.ledgerUnconvertibleRows += 1; continue; }
    sourceCounts.ledgerAudRows += 1;
    if (anchors.includes(observation.measure)) {
      add(anchorGlobal, 'global', observation.measure, value);
      add(anchorRegion, regionKey, observation.measure, value);
      if (regionBandKey) add(anchorRegionBand, regionBandKey, observation.measure, value);
    }
  }
  const bytFile = path.join(bytDir, `${city.city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`);
  if (!fs.existsSync(bytFile)) continue;
  const byt = JSON.parse(fs.readFileSync(bytFile, 'utf8'));
  for (const [measure, observation] of Object.entries(byt.measures ?? {})) {
    const tier = tierMap[measure];
    if (!tier || observation.status !== 'found' || observation.currency !== 'USD') continue;
    const value = observation.value * (fx.rates.USD?.audPerUnit ?? 0) * 2;
    if (!Number.isFinite(value) || value <= 0) continue;
    sourceCounts.bytFoundRows += 1;
    add(tierGlobal, 'global', tier, value);
    add(tierRegion, regionKey, tier, value);
    if (regionBandKey) add(tierRegionBand, regionBandKey, tier, value);
    const anchor = bytAnchorMap[measure];
    if (anchor) {
      const anchorValue = value / 2;
      add(anchorGlobal, 'global', anchor, anchorValue);
      add(anchorRegion, regionKey, anchor, anchorValue);
      if (regionBandKey) add(anchorRegionBand, regionBandKey, anchor, anchorValue);
    }
  }
}

const output = {
  schemaVersion: 'city-cost-v6-priors-v1',
  methodologyVersion: 'v6.0',
  generatedAt: '2026-08-10',
  sourcePolicy: 'Direct AUD-convertible observations from the 25-city development ledger plus labelled BudgetYourTrip tier values. No city_costs_app_aud.csv reads, inversion or self-derived refresh output.',
  fallbackOrder: 'region|band -> region -> global',
  bandCuts,
  byRegionBand: collapse(anchorRegionBand),
  byRegion: collapse(anchorRegion),
  global: collapse(anchorGlobal).global ?? {},
  tierValuesByRegionBand: collapse(tierRegionBand),
  tierValuesByRegion: collapse(tierRegion),
  tierValuesGlobal: collapse(tierGlobal).global ?? {},
  sourceCounts,
  bytTierBasis: 'BudgetYourTrip per-person/day USD source values multiplied by 2 only to compare with the two-person product tier; activity values are production-source diagnostics, not independent ground truth.',
};
fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ outPath, sourceCounts, regionCount: Object.keys(output.byRegion).length }, null, 2));
