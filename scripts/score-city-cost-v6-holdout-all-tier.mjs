// One-time all-tier M3 report for the fresh per-measure holdout extension.
//
// The old six-measure holdout is intentionally not read here. A revealed_once
// measure is spent. The fresh extension can validate a fitted ratio only when
// both sides of that ratio are independently found and currency-comparable;
// product-level accuracy additionally needs the production-path prediction
// bundle, which is a separate artifact and must not be inferred from ground
// truth itself.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const coefficientsPath = path.join(root, 'data/reference/v6/coefficients-v6.json');
const manifestPath = path.join(root, 'data/reference/v6/validation-manifest-v6.json');
const extensionPath = path.join(root, 'data/reference/v6/ground-truth/holdout-extension.json');
const sealPath = path.join(root, 'data/reference/v6/ground-truth/holdout-seal.json');
const scoresPath = path.join(root, 'data/reference/v6/ground-truth/holdout-scores-all-tier.json');
const fxPath = path.join(root, 'data/reference/fx/city_cost_fx_aud_2026-07-22.json');

const coefficients = JSON.parse(fs.readFileSync(coefficientsPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const seal = JSON.parse(fs.readFileSync(sealPath, 'utf8'));

if (seal.status !== 'per_measure') throw new Error('All-tier scorer requires the per_measure holdout seal.');
if (seal.scoresFile || seal.allTierScoresFile) throw new Error('The holdout has already been scored; a second pass is forbidden.');
if (!seal.candidateConfigHash || !seal.candidateCommit) throw new Error('Candidate must be frozen before fresh holdout scoring.');
if (!fs.existsSync(extensionPath)) throw new Error('Fresh holdout extension is missing.');

const freshMeasures = Object.entries(seal.measures ?? {})
  .filter(([, entry]) => entry.status === 'sealed_after_collection')
  .map(([measure]) => measure);
if (freshMeasures.length !== 12) throw new Error(`Expected 12 fresh sealed measures; found ${freshMeasures.length}.`);
if (Object.entries(seal.measures ?? {}).some(([, entry]) => entry.status === 'sealed_before_collection')) {
  throw new Error('A fresh holdout measure is still sealed_before_collection.');
}

const candidateConfiguration = {
  methodologyVersion: coefficients.methodologyVersion,
  productionAnchor: coefficients.productionAnchor,
  shippedCoefficients: coefficients.shippedCoefficients,
  sourceCalibrationOffsets: coefficients.sourceCalibrationOffsets,
};
const candidateHash = `sha256:${crypto.createHash('sha256').update(JSON.stringify(candidateConfiguration)).digest('hex')}`;
if (candidateHash !== seal.candidateConfigHash) throw new Error('Candidate configuration does not match the pre-read holdout seal hash.');

// This is the first and only read of the fresh extension. No old holdout file
// is opened anywhere in this script.
const extension = JSON.parse(fs.readFileSync(extensionPath, 'utf8'));
if (extension.status !== 'sealed_after_collection') throw new Error('Fresh holdout extension is not sealed_after_collection.');
if (JSON.stringify(extension.requiredMeasures.slice().sort()) !== JSON.stringify(freshMeasures.slice().sort())) {
  throw new Error('Fresh extension measures do not match the per-measure seal.');
}
const fx = JSON.parse(fs.readFileSync(fxPath, 'utf8'));

const toAud = (row) => {
  if (row.currency === 'AUD') return row.amount;
  const rate = fx.rates?.[row.currency]?.audPerUnit;
  return typeof rate === 'number' && Number.isFinite(rate) ? row.amount * rate : null;
};
const rowsByCity = new Map();
const coverage = Object.fromEntries(freshMeasures.map((measure) => [measure, { found: 0, missing: 0, fxComparable: 0 }]));
for (const city of extension.cities) {
  const rows = new Map((city.observations ?? []).map((row) => [row.measure, row]));
  rowsByCity.set(city.city, rows);
  for (const measure of freshMeasures) {
    const row = rows.get(measure);
    if (row?.status === 'found') {
      coverage[measure].found += 1;
      if (toAud(row) !== null) coverage[measure].fxComparable += 1;
    } else {
      coverage[measure].missing += 1;
    }
  }
}

const ratioRelations = [
  ['street_food_meal_1p', 'inexpensive_restaurant_meal_1p', 'street_food_meal_1p'],
  ['premium_restaurant_meal_2p', 'midrange_restaurant_meal_2p', 'premium_restaurant_meal_2p'],
  ['cocktail_1', 'cappuccino_1', 'cocktail_1'],
  ['wine_glass_1', 'cappuccino_1', 'wine_glass_1'],
];
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const round = (value, dp = 2) => value === null ? null : Number(value.toFixed(dp));
const ratioValidation = {};
for (const [target, anchor, coefficientKey] of ratioRelations) {
  const pairs = [];
  for (const [city, rows] of rowsByCity) {
    const targetRow = rows.get(target);
    const anchorRow = rows.get(anchor);
    if (targetRow?.status !== 'found' || anchorRow?.status !== 'found') continue;
    const targetAud = toAud(targetRow);
    const anchorAud = toAud(anchorRow);
    if (targetAud === null || anchorAud === null || anchorAud <= 0) continue;
    pairs.push({ city, ratio: targetAud / anchorAud });
  }
  const coefficient = coefficients.shippedCoefficients[coefficientKey]?.k ?? null;
  ratioValidation[coefficientKey] = {
    status: pairs.length ? 'evaluable_ratio_only' : 'not_evaluable',
    n: pairs.length,
    fittedCoefficient: coefficient,
    observedRatioMedian: pairs.length ? round(median(pairs.map((pair) => pair.ratio)), 4) : null,
    reason: pairs.length
      ? 'Independent target/anchor ratio validation only; this does not test the production anchor or the full product tier.'
      : 'No city has both independent target and anchor rows with currencies supported by the frozen FX snapshot.',
  };
}

const allTiers = [
  ['accom_shared_hostel_dorm', 'hostel_dorm_bed_1p'], ['accom_hostel_private_room', 'hostel_private_room_2p'],
  ['accom_1_star', 'hotel_1star_room_2p'], ['accom_2_star', 'hotel_2star_room_2p'],
  ['accom_3_star', 'hotel_3star_room_2p'], ['accom_4_star', 'hotel_4star_room_2p'],
  ['food_street_food', 'street_food_meal_1p'], ['food_budget', null], ['food_mid_range', null],
  ['food_high_end', 'premium_restaurant_meal_2p'], ['drink_coffee', 'cappuccino_1'],
  ['drinks_none', null], ['drinks_light', null], ['drinks_moderate', 'cocktail_1'],
  ['drinks_heavy', 'wine_glass_1'], ['activities_free', null],
  ['activities_budget', 'paid_attraction_adult_1'], ['activities_mid_range', 'half_day_group_activity_adult_1'],
  ['activities_high_end', 'full_day_premium_activity_adult_1'],
];
const tierResults = Object.fromEntries(allTiers.map(([tier, measure]) => {
  if (tier === 'activities_free') return [tier, { status: 'not_applicable', reason: 'Definitional zero-cost tier.' }];
  if (!measure || !freshMeasures.includes(measure)) {
    return [tier, {
      status: 'not_evaluable',
      reason: 'This tier depends on an old revealed_once measure or a composed basket. The scorer refuses to reread spent measures, and no production-path prediction bundle is present for the fresh cities.',
    }];
  }
  const rowCoverage = coverage[measure];
  return [tier, {
    status: 'not_evaluable',
    measure,
    found: rowCoverage.found,
    missing: rowCoverage.missing,
    fxComparable: rowCoverage.fxComparable,
    reason: 'Fresh ground truth exists only as an independent observation. No paired production-path prediction was collected for this holdout city, so comparing the row to itself or to another ground-truth row would be circular.',
  }];
}));

const scoreTime = new Date().toISOString();
const contaminationNote = 'This all-tier read is per-measure. The six old accommodation/attraction measures remain revealed_once and are not opened or rescored. The fresh extension contains independent ground truth, but no paired production-path prediction bundle, so product-level accuracy cannot be claimed from a ground-truth-only row. Ratio-only diagnostics are evaluable only where both sides are independently found and frozen-FX comparable.';
const scoreReport = {
  schemaVersion: 'city-cost-v6-holdout-all-tier-score-v1',
  methodologyVersion: manifest.methodologyVersion,
  candidateConfigHash: seal.candidateConfigHash,
  candidateCommit: seal.candidateCommit,
  scoredAt: scoreTime,
  holdoutCities: extension.cities.length,
  freshMeasures,
  contaminationNote,
  holdoutReadOnce: true,
  coverage,
  ratioValidation,
  tiers: tierResults,
  gate2TierAccuracy: {
    status: 'not_evaluable',
    reason: 'No production-path prediction bundle was collected for the fresh measures; old revealed_once measures are not reread.',
    tiers: tierResults,
  },
  gate3CityRanking: {
    status: 'not_evaluable',
    reason: 'A full city basket requires the old revealed_once accommodation and attraction values plus production-path predictions for the fresh measures; per-measure seal integrity forbids reopening the old values.',
  },
  gate4CostBandAgreement: {
    status: 'not_evaluable',
    reason: 'The production anchor and old accommodation rows are sealed as revealed_once; the fresh extension has no production-path prediction bundle.',
  },
  gate5TripLevelRealism: {
    status: 'not_evaluable',
    reason: 'A 10-city product basket cannot be composed without production-path predictions and the spent old measures.',
  },
  gate6NoRegressionVsV1: {
    status: 'not_evaluable',
    reason: 'No valid candidate-versus-ground-truth comparison exists without the production-path prediction bundle; the old six-measure comparison remains in the historical score file.',
  },
};

fs.writeFileSync(scoresPath, `${JSON.stringify(scoreReport, null, 2)}\n`);
for (const measure of freshMeasures) {
  const entry = seal.measures[measure];
  entry.status = 'revealed_once';
  entry.scoresFile = 'data/reference/v6/ground-truth/holdout-scores-all-tier.json';
  entry.candidateConfigHash = seal.candidateConfigHash;
  entry.candidateCommit = seal.candidateCommit;
  entry.revealedAt = scoreTime;
}
seal.status = 'revealed_once';
seal.allTierScoresFile = 'data/reference/v6/ground-truth/holdout-scores-all-tier.json';
seal.revealedAt = scoreTime;
seal.lockRule = 'All fresh measures were revealed once after the single candidate freeze. Gates 2-6 are not_evaluable without paired production-path predictions; do not tune or rescore.';
fs.writeFileSync(sealPath, `${JSON.stringify(seal, null, 2)}\n`);
console.log(JSON.stringify({ schemaVersion: scoreReport.schemaVersion, candidateConfigHash: seal.candidateConfigHash, freshMeasuresReadOnce: freshMeasures.length, gates: ['2', '3', '4', '5', '6'], productionPredictionsRead: false }, null, 2));
