// Deterministic score for experiment 001. This script reads only the unsealed
// experiment responses, the development Booking ledger, the frozen FX snapshot,
// and experiment inputs. It never reads the holdout ledger or score file.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const experimentDir = path.join(root, 'data/reference/v6/experiments/001-expedia-production-anchor');
const inputsPath = path.join(experimentDir, 'inputs.json');
const resultsPath = path.join(experimentDir, 'results.json');
const inputs = JSON.parse(fs.readFileSync(inputsPath, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(path.join(root, 'data/reference/v6/ground-truth/development-ledger.json'), 'utf8'));
const fx = JSON.parse(fs.readFileSync(path.join(root, inputs.fxSnapshot), 'utf8'));
const usdAud = fx.rates.USD.audPerUnit;
const offset = inputs.frozenExpediaToBookingMultiplier;

function slug(city) {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function p90(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.9) - 1)];
}

const rows = inputs.cities.map(({ city, country }) => {
  const raw = JSON.parse(fs.readFileSync(path.join(experimentDir, `${slug(city)}.json`), 'utf8'));
  const bookingCity = ledger.cities.find((entry) => entry.city === city);
  const booking = bookingCity?.observations?.find((entry) => entry.measure === inputs.measure);
  if (!booking) throw new Error(`Missing Booking development anchor for ${city}`);
  const telemetry = JSON.parse(fs.readFileSync(path.join(experimentDir, `${slug(city)}-telemetry.json`), 'utf8'));
  const fact = raw.measures[inputs.measure];
  if (raw.city !== city || raw.country !== country) throw new Error(`City identity mismatch for ${city}`);
  if (raw.directPageReads !== 0 || telemetry.directPageReads !== 0) throw new Error(`Direct page read reported for ${city}`);
  const base = {
    city,
    country,
    retrievalStatus: raw.retrievalStatus,
    measureStatus: fact.status,
    searchesUsed: raw.searchesUsed,
    providerCalls: telemetry.providerCalls,
    directPageReads: raw.directPageReads,
  };
  if (fact.status !== 'observed') return base;
  if (fact.currency !== 'USD') throw new Error(`Unexpected currency for ${city}: ${fact.currency}`);
  const rawAud = fact.value * usdAud;
  const predictedBookingAud = rawAud * offset;
  const signedErrorPct = ((predictedBookingAud - booking.amount) / booking.amount) * 100;
  return {
    ...base,
    expediaValue: fact.value,
    currency: fact.currency,
    rawAud: round(rawAud),
    bookingGroundTruthAud: booking.amount,
    predictedBookingAud: round(predictedBookingAud),
    signedErrorPct: round(signedErrorPct),
    apePct: round(Math.abs(signedErrorPct)),
  };
});

const observed = rows.filter((row) => row.measureStatus === 'observed');
const ape = observed.map((row) => row.apePct);
const signed = observed.map((row) => row.signedErrorPct);
const searches = rows.reduce((sum, row) => sum + row.searchesUsed, 0);
const providerCalls = rows.reduce((sum, row) => sum + row.providerCalls, 0);
const summary = {
  primaryCities: rows.length,
  observedCities: observed.length,
  missingCities: rows.length - observed.length,
  providerCalls,
  searchesUsed: searches,
  directPageReads: rows.reduce((sum, row) => sum + row.directPageReads, 0),
  blocks: rows.filter((row) => row.retrievalStatus === 'blocked').length,
  medianApePct: round(median(ape)),
  p90ApePct: round(p90(ape)),
  maxApePct: round(Math.max(...ape)),
  medianSignedErrorPct: round(median(signed)),
};
const acceptance = {
  minimumObservedCities: 12,
  observedCitiesPass: summary.observedCities >= 12,
  medianApeMaxPct: 25,
  medianApePass: summary.medianApePct <= 25,
  medianSignedErrorBandPct: [-15, 15],
  medianSignedErrorPass: summary.medianSignedErrorPct >= -15 && summary.medianSignedErrorPct <= 15,
  directPageReadsPass: summary.directPageReads === 0,
  searchBudgetPass: summary.searchesUsed <= rows.length * 25,
  accepted:
    summary.observedCities >= 12 &&
    summary.medianApePct <= 25 &&
    summary.medianSignedErrorPct >= -15 &&
    summary.medianSignedErrorPct <= 15 &&
    summary.directPageReads === 0 &&
    summary.searchesUsed <= rows.length * 25,
};

const output = {
  schemaVersion: 'city-cost-v6-expedia-production-anchor-results-v1',
  experiment: inputs.experiment,
  scoredFrom: {
    rawResponseDirectory: 'data/reference/v6/experiments/001-expedia-production-anchor',
    developmentLedger: 'data/reference/v6/ground-truth/development-ledger.json',
    fxSnapshot: inputs.fxSnapshot,
    fxCurrency: 'USD',
    fxAudPerUnit: usdAud,
    frozenExpediaToBookingMultiplier: offset,
  },
  holdoutRead: false,
  duplicateResponsesExcluded: ['cape-town-duplicate-discarded.json'],
  summary,
  acceptance,
  rows,
};

if (process.argv.includes('--check')) {
  const existing = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  if (JSON.stringify(existing) !== JSON.stringify(output)) throw new Error('Experiment results are not deterministic.');
  console.log(JSON.stringify({ check: 'pass', observedCities: summary.observedCities, medianApePct: summary.medianApePct }, null, 2));
} else {
  fs.writeFileSync(resultsPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ resultsPath, observedCities: summary.observedCities, medianApePct: summary.medianApePct }, null, 2));
}
