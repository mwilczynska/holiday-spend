// Diagnose the existing development food score. This is analysis only: it
// never reads a holdout, changes coefficients, or makes production calls.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scorePath = path.join(root, 'data/reference/v6/experiments/005-development-in-sample-score/results.json');
const predictionResultsPath = path.join(root, 'data/reference/v6/experiments/006-development-prediction-spine/results.json');
const predictionDir = path.join(root, 'data/reference/v6/experiments/006-development-prediction-spine/cities');
const coefficientsPath = path.join(root, 'data/reference/v6/coefficients-v6.json');
const outputPath = path.join(root, 'data/reference/v6/m3-food-basket-diagnostic.json');

const score = JSON.parse(fs.readFileSync(scorePath, 'utf8'));
const predictionResults = JSON.parse(fs.readFileSync(predictionResultsPath, 'utf8'));
const coefficients = JSON.parse(fs.readFileSync(coefficientsPath, 'utf8'));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

function round(value, places = 4) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function ratioMetrics(ratios) {
  const signed = ratios.map((ratio) => (ratio - 1) * 100);
  const ape = signed.map((value) => Math.abs(value));
  return {
    n: ratios.length,
    medianPredictionToTruth: round(median(ratios)),
    medianApePct: round(median(ape), 2),
    p90ApePct: round(percentile(ape, 0.9), 2),
    maxApePct: round(Math.max(...ape), 2),
    medianSignedErrorPct: round(median(signed), 2),
    residualDispersionPct: {
      min: round(Math.min(...signed), 2),
      q25: round(percentile(signed, 0.25), 2),
      q75: round(percentile(signed, 0.75), 2),
      max: round(Math.max(...signed), 2),
    },
  };
}

const predictions = new Map();
for (const row of predictionResults.rows ?? []) {
  const file = path.join(predictionDir, `${slug(row.city)}.json`);
  if (fs.existsSync(file)) predictions.set(row.city, readJson(file).materialization);
}

const foodTiers = ['food_budget', 'food_mid_range', 'food_high_end'];
const beverageBoundary = Object.fromEntries(foodTiers.map((tier) => {
  const rows = score.tiers[tier].rows ?? [];
  const scenarios = {
    food_only: rows.map((row) => row.predictionAud / row.truthAud),
    plus_drinks_none: rows.map((row) => (row.predictionAud + predictions.get(row.city).tiersAud.drinks_none.amountAud) / row.truthAud),
    plus_drinks_light: rows.map((row) => (row.predictionAud + predictions.get(row.city).tiersAud.drinks_light.amountAud) / row.truthAud),
  };
  return [tier, Object.fromEntries(Object.entries(scenarios).map(([name, ratios]) => [name, ratioMetrics(ratios)]))];
}));

function regressionRows(tier) {
  return (score.tiers[tier].rows ?? []).map((row) => {
    const materialization = predictions.get(row.city);
    return {
      city: row.city,
      inexpensive: materialization.anchors.inexpensive_restaurant_meal_1p.valueAud,
      midrange: materialization.anchors.midrange_restaurant_meal_2p.valueAud,
      truth: row.truthAud,
    };
  });
}

function sumOfSquares(rows, weights) {
  return rows.reduce((sum, row) => sum + (row.truth - weights.inexpensive * row.inexpensive - weights.midrange * row.midrange) ** 2, 0);
}

function fitUnconstrained(rows) {
  let xx = 0;
  let xy = 0;
  let yy = 0;
  let xt = 0;
  let yt = 0;
  for (const row of rows) {
    xx += row.inexpensive ** 2;
    xy += row.inexpensive * row.midrange;
    yy += row.midrange ** 2;
    xt += row.inexpensive * row.truth;
    yt += row.midrange * row.truth;
  }
  const determinant = xx * yy - xy ** 2;
  if (Math.abs(determinant) < 1e-9) return null;
  return {
    inexpensive: (xt * yy - yt * xy) / determinant,
    midrange: (yt * xx - xt * xy) / determinant,
  };
}

function fitNonNegative(rows) {
  const unconstrained = fitUnconstrained(rows);
  const candidates = [];
  if (unconstrained && unconstrained.inexpensive >= 0 && unconstrained.midrange >= 0) {
    candidates.push({ ...unconstrained, mode: 'nonnegative_ols' });
  }
  const inexpensiveDenominator = rows.reduce((sum, row) => sum + row.inexpensive ** 2, 0);
  const midrangeDenominator = rows.reduce((sum, row) => sum + row.midrange ** 2, 0);
  if (inexpensiveDenominator > 0) {
    candidates.push({
      inexpensive: rows.reduce((sum, row) => sum + row.inexpensive * row.truth, 0) / inexpensiveDenominator,
      midrange: 0,
      mode: 'nnls_inexpensive_only',
    });
  }
  if (midrangeDenominator > 0) {
    candidates.push({
      inexpensive: 0,
      midrange: rows.reduce((sum, row) => sum + row.midrange * row.truth, 0) / midrangeDenominator,
      mode: 'nnls_midrange_only',
    });
  }
  if (!candidates.length) throw new Error('Cannot fit an empty food basket regression.');
  return candidates.sort((a, b) => sumOfSquares(rows, a) - sumOfSquares(rows, b))[0];
}

function predict(row, weights) {
  return weights.inexpensive * row.inexpensive + weights.midrange * row.midrange;
}

function metricsForWeights(rows, weights) {
  return ratioMetrics(rows.map((row) => predict(row, weights) / row.truth));
}

function basketFit(tier, currentWeights) {
  const rows = regressionRows(tier);
  const fullFit = fitNonNegative(rows);
  const unconstrained = fitUnconstrained(rows);
  const looRows = rows.map((row, index) => {
    const training = rows.filter((_, candidateIndex) => candidateIndex !== index);
    const fit = fitNonNegative(training);
    return {
      city: row.city,
      fitMode: fit.mode,
      predictionToTruth: round(predict(row, fit) / row.truth),
    };
  });
  const currentLoo = metricsForWeights(rows, currentWeights);
  const reweightedLoo = ratioMetrics(looRows.map((row) => row.predictionToTruth));
  return {
    n: rows.length,
    featureDefinition: 'effective weights on inexpensive_restaurant_meal_1p and midrange_restaurant_meal_2p; no intercept; non-negative least squares',
    currentEffectiveWeights: currentWeights,
    fittedEffectiveWeights: {
      inexpensive: round(fullFit.inexpensive),
      midrange: round(fullFit.midrange),
      fitMode: fullFit.mode,
    },
    unconstrainedOls: unconstrained ? {
      inexpensive: round(unconstrained.inexpensive),
      midrange: round(unconstrained.midrange),
    } : null,
    fullPanelFit: metricsForWeights(rows, fullFit),
    currentLoo,
    reweightedLoo,
    looFitModes: Object.fromEntries(looRows.map((row) => [row.city, row.fitMode])),
    comparison: {
      medianApeDeltaPct: round(reweightedLoo.medianApePct - currentLoo.medianApePct, 2),
      p90ApeDeltaPct: round(reweightedLoo.p90ApePct - currentLoo.p90ApePct, 2),
      beatsCurrentOnMedianApe: reweightedLoo.medianApePct < currentLoo.medianApePct,
      beatsCurrentOnP90Ape: reweightedLoo.p90ApePct < currentLoo.p90ApePct,
      beatsCurrentOnBoth: reweightedLoo.medianApePct < currentLoo.medianApePct && reweightedLoo.p90ApePct < currentLoo.p90ApePct,
    },
    rows: looRows,
  };
}

const streetK = coefficients.shippedCoefficients.street_food_meal_1p.k;
const premiumK = coefficients.shippedCoefficients.premium_restaurant_meal_2p.k;
const basketFits = {
  food_mid_range: basketFit('food_mid_range', { inexpensive: round(2 + 2 * streetK), midrange: 1 }),
  food_high_end: basketFit('food_high_end', { inexpensive: 2, midrange: round(1 + premiumK) }),
};

const numbeoAnchors = [
  'inexpensive_restaurant_meal_1p',
  'midrange_restaurant_meal_2p',
  'cappuccino_1',
  'domestic_draft_beer_1',
  'mcmeal_combo',
];
const regionalCoverage = new Map();
for (const [city, materialization] of predictions) {
  const region = materialization.region ?? 'unknown';
  const bucket = regionalCoverage.get(region) ?? { cities: 0, observed: Object.fromEntries(numbeoAnchors.map((anchor) => [anchor, 0])), allFiveObserved: 0 };
  bucket.cities += 1;
  for (const anchor of numbeoAnchors) {
    if (materialization.anchors[anchor]?.status === 'observed') bucket.observed[anchor] += 1;
  }
  if (numbeoAnchors.every((anchor) => materialization.anchors[anchor]?.status === 'observed')) bucket.allFiveObserved += 1;
  regionalCoverage.set(region, bucket);
}
const regionalCoverageRows = Object.fromEntries([...regionalCoverage.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([region, bucket]) => [
  region,
  {
    cities: bucket.cities,
    ratesPct: Object.fromEntries(numbeoAnchors.map((anchor) => [anchor, round(bucket.observed[anchor] / bucket.cities * 100, 1)])),
    observedCounts: bucket.observed,
    allFiveObserved: bucket.allFiveObserved,
    allFiveRatePct: round(bucket.allFiveObserved / bucket.cities * 100, 1),
  },
]));

const output = {
  schemaVersion: 'city-cost-v6-food-basket-diagnostic-v1',
  methodologyVersion: 'v6.0',
  panel: '25-city development panel; existing prediction bundles and BYT truth only',
  inSample: true,
  holdoutRead: false,
  beverageBoundary,
  basketFits,
  identifiability: {
    note: 'Street food is a fixed multiple of inexpensive food and premium is a fixed multiple of midrange. Raw basket weights are therefore collinear; the reported regressions fit identifiable effective weights and do not change the shipped basket.',
    midRangeCurrentRawWeights: { street: 2, inexpensive: 2, midrange: 1 },
    highEndCurrentRawWeights: { inexpensive: 2, midrange: 1, premium: 1 },
  },
  numbeoObservationRatesByRegion: regionalCoverageRows,
  overallNumbeoObservationRates: Object.fromEntries(numbeoAnchors.map((anchor) => {
    const observed = [...predictions.values()].filter((materialization) => materialization.anchors[anchor]?.status === 'observed').length;
    return [anchor, { observed, total: predictions.size, ratePct: round(observed / predictions.size * 100, 1) }];
  })),
  sourceFiles: [
    'data/reference/v6/experiments/005-development-in-sample-score/results.json',
    'data/reference/v6/experiments/006-development-prediction-spine/cities/',
    'data/reference/v6/coefficients-v6.json',
  ],
};

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, midRange: basketFits.food_mid_range.comparison, highEnd: basketFits.food_high_end.comparison }, null, 2));
