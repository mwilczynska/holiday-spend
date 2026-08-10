// One-time M3 holdout scorer. It refuses to read the holdout until the
// candidate hash is present in holdout-seal.json, and refuses a second pass.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const root = process.cwd();
const coefficientsPath = path.join(root, 'data/reference/v6/coefficients-v6.json');
const manifestPath = path.join(root, 'data/reference/v6/validation-manifest-v6.json');
const holdoutPath = path.join(root, 'data/reference/v6/ground-truth/holdout-ledger.json');
const sealPath = path.join(root, 'data/reference/v6/ground-truth/holdout-seal.json');
const csvPath = path.join(root, 'data/reference/city_costs_app_aud.csv');
const fxPath = path.join(root, 'data/reference/fx/city_cost_fx_aud_2026-07-22.json');
const scoresPath = path.join(root, 'data/reference/v6/ground-truth/holdout-scores.json');

const coefficients = JSON.parse(fs.readFileSync(coefficientsPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const seal = JSON.parse(fs.readFileSync(sealPath, 'utf8'));

if (!seal.candidateConfigHash || !seal.candidateCommit) throw new Error('Candidate must be frozen in the holdout seal before scoring.');
if (seal.scoresFile !== null) throw new Error('Holdout has already been scored; a second pass is forbidden.');

const candidateConfiguration = {
  methodologyVersion: coefficients.methodologyVersion,
  productionAnchor: coefficients.productionAnchor,
  shippedCoefficients: coefficients.shippedCoefficients,
  sourceCalibrationOffsets: coefficients.sourceCalibrationOffsets,
};
const candidateHash = `sha256:${crypto.createHash('sha256').update(JSON.stringify(candidateConfiguration)).digest('hex')}`;
if (candidateHash !== seal.candidateConfigHash) throw new Error('Candidate configuration does not match the pre-read holdout seal hash.');

// This is the first read of the holdout in the M3 scoring path.
const holdout = JSON.parse(fs.readFileSync(holdoutPath, 'utf8'));
const fx = JSON.parse(fs.readFileSync(fxPath, 'utf8'));
const v1Rows = Papa.parse(fs.readFileSync(csvPath, 'utf8'), { header: true, skipEmptyLines: true }).data;
const v1ByCity = new Map(v1Rows.map((row) => [row.city, row]));
const cut = manifest.groundTruthPanel.bandCutsAud;
const coeff = coefficients.shippedCoefficients;
const measures = {
  dorm: 'hostel_dorm_bed_1p',
  private: 'hostel_private_room_2p',
  oneStar: 'hotel_1star_room_2p',
  threeStar: 'hotel_3star_room_2p',
  fourStar: 'hotel_4star_room_2p',
};
const v1Measure = {
  dorm: 'accom_shared_hostel_dorm',
  private: 'accom_hostel_private_room',
  oneStar: 'accom_1_star',
  threeStar: 'accom_3_star',
  fourStar: 'accom_4_star',
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const quantile = (values, q) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (position - low);
};
const round = (value, dp = 2) => value === null ? null : Number(value.toFixed(dp));

function scorePairs(pairs) {
  const ape = pairs.map((pair) => Math.abs(pair.predicted - pair.actual) / pair.actual * 100);
  const signed = pairs.map((pair) => (pair.predicted - pair.actual) / pair.actual * 100);
  const result = {
    n: pairs.length,
    medianApePct: round(median(ape)),
    p90ApePct: round(quantile(ape, 0.9)),
    medianSignedErrorPct: round(median(signed)),
  };
  return {
    ...result,
    pass: pairs.length > 0 && result.medianApePct <= 35 && result.p90ApePct <= 75 && Math.abs(result.medianSignedErrorPct) <= 15,
  };
}

function rank(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((value) => {
    const same = sorted.reduce((count, item) => count + (item === value ? 1 : 0), 0);
    const first = sorted.indexOf(value);
    return first + (same - 1) / 2 + 1;
  });
}

function correlation(xs, ys) {
  const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const numerator = xs.reduce((sum, value, index) => sum + (value - xMean) * (ys[index] - yMean), 0);
  const denominator = Math.sqrt(
    xs.reduce((sum, value) => sum + (value - xMean) ** 2, 0) *
      ys.reduce((sum, value) => sum + (value - yMean) ** 2, 0)
  );
  return denominator === 0 ? null : numerator / denominator;
}

function bandsForAmount(amount) {
  return amount <= cut.lowMax ? 'low' : amount <= cut.midMax ? 'mid' : 'high';
}

function toAud(observation) {
  if (observation.currency === 'AUD') return observation.amount;
  const rate = fx.rates?.[observation.currency]?.audPerUnit;
  return typeof rate === 'number' ? observation.amount * rate : null;
}

const predictedByCity = new Map();
const accommodationPairs = Object.fromEntries(Object.keys(measures).map((key) => [key, []]));
const categoryPairs = [];
const bandResults = [];
const attractionCoverage = { found: 0, missing: 0 };

for (const city of holdout.cities) {
  const rows = Object.fromEntries(city.observations.map((observation) => [observation.measure, observation]));
  if (rows.paid_attraction_adult_1?.status === 'found') attractionCoverage.found += 1;
  else attractionCoverage.missing += 1;
  const anchor = rows[measures.threeStar];
  if (!anchor || anchor.status !== 'found') continue;

  const anchorAmount = anchor.amount;
  const predicted = {
    dorm: anchorAmount * coeff.accom_shared_hostel_dorm.k,
    private: anchorAmount * coeff.accom_hostel_private_room.k,
    oneStar: anchorAmount * coeff.accom_1_star.k,
    threeStar: anchorAmount,
    fourStar: anchorAmount * coeff.accom_4_star.k,
  };
  predictedByCity.set(city.city, predicted);

  for (const [key, measure] of Object.entries(measures)) {
    const observation = rows[measure];
    if (!observation || observation.status !== 'found') continue;
    accommodationPairs[key].push({ city: city.city, predicted: predicted[key], actual: observation.amount });
  }

  const commonKeys = Object.keys(measures).filter((key) => rows[measures[key]]?.status === 'found');
  const actualCategory = commonKeys.reduce((sum, key) => sum + rows[measures[key]].amount, 0);
  const predictedCategory = commonKeys.reduce((sum, key) => sum + predicted[key], 0);
  categoryPairs.push({ city: city.city, predicted: predictedCategory, actual: actualCategory });
  const predictedBand = bandsForAmount(anchorAmount);
  bandResults.push({ city: city.city, predictedBand, manifestBand: city.band, exact: predictedBand === city.band });
}

const tierScores = Object.fromEntries(Object.entries(accommodationPairs).map(([key, pairs]) => [key, scorePairs(pairs)]));
const contaminatedThreeStarAccuracy = tierScores.threeStar;
tierScores.threeStar = {
  status: 'not_evaluable',
  contaminatedRawResult: contaminatedThreeStarAccuracy,
  reason: 'The observed three-star Booking value is used as the prediction anchor; 0% APE is self-comparison.',
};
const predictedRanks = rank(categoryPairs.map((pair) => pair.predicted));
const actualRanks = rank(categoryPairs.map((pair) => pair.actual));
const pairwiseTotal = categoryPairs.length * (categoryPairs.length - 1) / 2;
let pairwiseCorrect = 0;
for (let i = 0; i < categoryPairs.length; i += 1) {
  for (let j = i + 1; j < categoryPairs.length; j += 1) {
    if ((categoryPairs[i].predicted - categoryPairs[j].predicted) * (categoryPairs[i].actual - categoryPairs[j].actual) >= 0) pairwiseCorrect += 1;
  }
}
const categoryRanking = {
  n: categoryPairs.length,
  spearmanRho: round(correlation(predictedRanks, actualRanks), 4),
  pairwiseOrderingAccuracy: round(pairwiseCorrect / pairwiseTotal, 4),
  pass: null,
  basis: 'sum of the five accommodation measures available in each holdout city; this is the accommodation-category component only',
  note: 'Upper bound only: the observed three-star Booking row is the dominant term in this sum and is also used as the prediction anchor. This is not an end-to-end ranking measurement without a paired Expedia production-anchor observation.',
};

const exactBandAgreement = bandResults.filter((row) => row.exact).length / bandResults.length;
const bandIndex = { low: 0, mid: 1, high: 2 };
const withinOneBand = bandResults.filter((row) => Math.abs(bandIndex[row.predictedBand] - bandIndex[row.manifestBand]) <= 1).length / bandResults.length;
const contaminatedCostBand = {
  n: bandResults.length,
  exactAgreement: round(exactBandAgreement, 4),
  withinOneBand: withinOneBand,
  basis: 'candidate 3-star anchor compared with manifest cost bands',
};
const costBand = {
  status: 'not_evaluable',
  contaminatedRawResult: contaminatedCostBand,
  reason: 'The candidate three-star value is the holdout observation itself; banding it against the manifest cannot test the production anchor or the method.',
};

const v1Pairs = Object.fromEntries(Object.keys(measures).map((key) => [key, []]));
for (const city of holdout.cities) {
  const rows = Object.fromEntries(city.observations.map((observation) => [observation.measure, observation]));
  const predicted = predictedByCity.get(city.city);
  const v1 = v1ByCity.get(city.city);
  if (!predicted || !v1) continue;
  for (const [key, measure] of Object.entries(measures)) {
    const observation = rows[measure];
    const actual = observation?.status === 'found' ? toAud(observation) : null;
    const rawV1 = Number(v1[v1Measure[key]]) / (key === 'dorm' ? 2 : 1);
    if (actual === null || !Number.isFinite(rawV1)) continue;
    v1Pairs[key].push({ candidate: predicted[key], v1: rawV1, actual });
  }
}
const noRegressionRows = Object.fromEntries(Object.entries(v1Pairs).map(([key, pairs]) => {
  const candidateApe = scorePairs(pairs.map((pair) => ({ predicted: pair.candidate, actual: pair.actual })));
  const v1Ape = scorePairs(pairs.map((pair) => ({ predicted: pair.v1, actual: pair.actual })));
  return [key, { n: pairs.length, candidateMedianApePct: candidateApe.medianApePct, v1MedianApePct: v1Ape.medianApePct, improved: candidateApe.medianApePct < v1Ape.medianApePct }];
}));
const contaminatedThreeStarNoRegression = noRegressionRows.threeStar;
noRegressionRows.threeStar = {
  status: 'not_evaluable',
  contaminatedRawResult: contaminatedThreeStarNoRegression,
  reason: 'The candidate three-star value is the holdout observation itself; its 0% APE and improvement versus v1 are not a method test.',
};
const improvedTiers = Object.values(noRegressionRows).filter((row) => row.improved === true).length;

const contaminationNote = 'The six-measure holdout contains Booking ground truth but no paired Expedia 3-star production-anchor observation. The scorer uses each observed Booking three-star value as the prediction anchor, so any result downstream of that value is contaminated: three-star accuracy, cost-band agreement, and the three-star component of category ranking/no-regression are not evaluable. The conditional ladder errors remain valid because they test the other rungs given a correct anchor.';

const scoreReport = {
  schemaVersion: 'city-cost-v6-holdout-score-v1',
  methodologyVersion: 'v6.0',
  candidateConfigHash: seal.candidateConfigHash,
  candidateCommit: seal.candidateCommit,
  scoredAt: new Date().toISOString(),
  holdoutCities: holdout.cities.length,
  holdoutLedger: 'data/reference/v6/ground-truth/holdout-ledger.json',
  contaminationNote,
  gate2TierAccuracy: {
    status: 'partial_panel_anchor_contaminated',
    evaluableTiers: ['dorm', 'private', 'oneStar', 'fourStar'],
    notEvaluableTiers: ['threeStar'],
    tiers: tierScores,
    note: 'The frozen six-measure holdout supports four conditional ladder tiers. The three-star row is not evaluable because it is both observed ground truth and the prediction anchor. Food, drink and activity product tiers are not present in the ground-truth contract.',
  },
  gate3CityRanking: {
    status: 'upper_bound_only',
    accommodationCategory: categoryRanking,
    foodCategory: { status: 'not_evaluable', reason: 'No food measures in the frozen ground-truth panel.' },
    totalDailyCost: { status: 'not_evaluable', reason: 'The panel has no food or drink measures for a full daily basket.' },
  },
  gate4CostBandAgreement: costBand,
  gate5TripLevelRealism: {
    status: 'not_evaluable',
    reason: 'The six-measure panel does not contain the food and drink inputs required to compose a daily trip total.',
  },
  gate6NoRegressionVsV1: {
    status: 'partial_panel_anchor_contaminated',
    accommodationTiers: noRegressionRows,
    evaluableTiers: Object.keys(noRegressionRows).length - 1,
    improvedAccommodationTiers: improvedTiers,
    requirement: '15 of 19 tiers improved with no tier regressing by more than 10%; three-star is not evaluable and the full gate cannot be evaluated from the six-measure panel.',
  },
  gate8CalibrationIntegrity: {
    status: 'not_evaluable_on_holdout',
    developmentFit: coefficients.sourceCalibrationOffsets.hotel_3star_room_2p.fit,
    reason: 'The sealed holdout contains Booking ground truth but no paired Expedia production-anchor observation.',
  },
  attractionCoverage,
  holdoutReadOnce: true,
};

fs.writeFileSync(scoresPath, `${JSON.stringify(scoreReport, null, 2)}\n`);
seal.status = 'revealed_once';
seal.scoresFile = 'data/reference/v6/ground-truth/holdout-scores.json';
seal.revealedAt = scoreReport.scoredAt;
seal.lockRule = 'Holdout was revealed and scored once against the frozen candidate. Do not tune or rescore.';
fs.writeFileSync(sealPath, `${JSON.stringify(seal, null, 2)}\n`);
console.log(JSON.stringify({ schemaVersion: scoreReport.schemaVersion, candidateConfigHash: scoreReport.candidateConfigHash, gates: ['2', '3', '4', '5', '6'], holdoutReadOnce: true }, null, 2));
