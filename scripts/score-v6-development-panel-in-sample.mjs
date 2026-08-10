// Score only the unsealed development panel. This script never reads a holdout.
// It deliberately reports blocked tiers rather than turning circular or partial
// evidence into a score.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ledger = JSON.parse(fs.readFileSync(path.join(root, 'data/reference/v6/ground-truth/development-ledger.json'), 'utf8'));
const fx = JSON.parse(fs.readFileSync(path.join(root, 'data/reference/fx/city_cost_fx_aud_2026-07-22.json'), 'utf8'));
const predictionResultsPath = path.join(root, 'data/reference/v6/experiments/002-production-prediction-bundle/results.json');
const predictionResults = JSON.parse(fs.readFileSync(predictionResultsPath, 'utf8'));
const predictionDir = path.join(root, 'data/reference/v6/experiments/002-production-prediction-bundle/cities');
const bytDir = path.join(root, 'data/reference/v6/experiments/003-budgetyourtrip-tier-panel/cities');
const outputPath = path.join(root, 'data/reference/v6/experiments/005-development-in-sample-score.json');

const tierNames = [
  'accom_shared_hostel_dorm', 'accom_hostel_private_room', 'accom_1_star', 'accom_2_star', 'accom_3_star', 'accom_4_star',
  'food_street_food', 'food_budget', 'food_mid_range', 'food_high_end', 'drink_coffee', 'drinks_none', 'drinks_light',
  'drinks_moderate', 'drinks_heavy', 'activities_free', 'activities_budget', 'activities_mid_range', 'activities_high_end',
];
const accommodationMeasures = {
  accom_shared_hostel_dorm: ['hostel_dorm_bed_1p', 2], accom_hostel_private_room: ['hostel_private_room_2p', 1],
  accom_1_star: ['hotel_1star_room_2p', 1], accom_2_star: ['hotel_2star_room_2p', 1],
  accom_3_star: ['hotel_3star_room_2p', 1], accom_4_star: ['hotel_4star_room_2p', 1],
};
const bytFood = { food_budget: 'food_budget_per_person_day', food_mid_range: 'food_mid_per_person_day', food_high_end: 'food_high_per_person_day' };

function median(values) { const s = [...values].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; }
function round(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function aud(value, currency) { const rate = currency === 'AUD' ? 1 : fx.rates?.[currency]?.audPerUnit; return Number.isFinite(rate) && Number.isFinite(value) ? value * rate : null; }
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

const truthByCity = new Map();
for (const city of ledger.cities) {
  const truth = {};
  for (const observation of city.observations ?? []) {
    if (observation.status !== 'found') continue;
    const amount = aud(observation.amount, observation.currency);
    if (amount === null) continue;
    for (const [tier, [measure, multiplier]] of Object.entries(accommodationMeasures)) {
      if (observation.measure === measure) truth[tier] = amount * multiplier;
    }
    if (observation.measure === 'paid_attraction_adult_1') truth.activities_budget = amount * 2;
  }
  const bytFile = path.join(bytDir, `${slug(city.city)}.json`);
  if (fs.existsSync(bytFile)) {
    const byt = readJson(bytFile);
    for (const [tier, measure] of Object.entries(bytFood)) {
      const row = byt.measures?.[measure];
      if (row?.status === 'found' && row.currency === 'USD') truth[tier] = row.value * fx.rates.USD.audPerUnit * 2;
    }
  }
  truthByCity.set(city.city, truth);
}

const predictions = new Map();
for (const row of predictionResults.rows ?? []) {
  const file = path.join(predictionDir, `${slug(row.city)}.json`);
  if (fs.existsSync(file)) predictions.set(row.city, readJson(file));
}

const blockedReasons = {
  activities_free: 'definitional; no empirical score required',
  drink_coffee: 'no independent full-basket drink truth; Expatistan cocktail does not validate Numbeo coffee',
  drinks_none: 'no independent full-basket drink truth', drinks_light: 'no accepted Expatistan neighbourhood-pub beer rows',
  drinks_moderate: 'cocktail-only evidence cannot validate the full coffee/beer/cocktail basket',
  drinks_heavy: 'wine glass was intentionally excluded and no independent full basket exists',
  activities_mid_range: 'BudgetYourTrip is the production source; no independent half-day tier source',
  activities_high_end: 'BudgetYourTrip is the production source; no independent full-day tier source',
  food_street_food: 'no direct daily tier truth; street-food relation is checked only through the BYT food basket',
};

const tierScores = {};
for (const tier of tierNames) {
  const rows = [];
  for (const city of ledger.cities) {
    const prediction = predictions.get(city.city)?.materialization?.tiersAud?.[tier]?.amountAud;
    const truth = truthByCity.get(city.city)?.[tier];
    if (Number.isFinite(prediction) && Number.isFinite(truth) && truth > 0) {
      rows.push({ city: city.city, predictionAud: round(prediction), truthAud: round(truth), apePct: round(Math.abs(prediction - truth) / truth * 100), signedErrorPct: round((prediction - truth) / truth * 100) });
    }
  }
  if (rows.length) {
    tierScores[tier] = { status: 'evaluable_in_sample', n: rows.length, medianApePct: median(rows.map((row) => row.apePct)), medianSignedErrorPct: median(rows.map((row) => row.signedErrorPct)), rows };
  } else {
    tierScores[tier] = { status: predictionResults.foundCities ? 'blocked_no_pair' : 'blocked_no_prediction_bundle', n: 0, reason: blockedReasons[tier] ?? 'Prediction bundle has no materialized city rows; no score is possible.' };
  }
}

const output = {
  schemaVersion: 'city-cost-v6-development-in-sample-score-v1', methodologyVersion: 'v6.0',
  panel: 'development', inSample: true, holdout: false, scoredAt: new Date().toISOString(),
  predictionBundle: predictionResultsPath, predictionCoverage: { totalCities: predictionResults.totalCities, materializedCities: predictionResults.foundCities },
  truthSources: { accommodation: 'development-ledger.json', food: '003-budgetyourtrip-tier-panel', activitiesBudget: 'development-ledger.json official attraction rows', activitiesMidHigh: 'blocked as circular BYT production source', drinks: '004-expatistan-drink-panel plus no accepted beer rows' },
  note: 'This report is labelled IN-SAMPLE and is not holdout validation. No spent holdout file was read.',
  tiers: tierScores,
};
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, materializedCities: predictionResults.foundCities, evaluableTiers: Object.values(tierScores).filter((row) => row.status === 'evaluable_in_sample').length, blockedTiers: Object.values(tierScores).filter((row) => row.status !== 'evaluable_in_sample').length }, null, 2));
