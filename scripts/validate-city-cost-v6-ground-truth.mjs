import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'data/reference/v6/validation-manifest-v6.json');
const ledgerPath = path.join(root, 'data/reference/v6/ground-truth/development-ledger.json');
const holdoutSealPath = path.join(root, 'data/reference/v6/ground-truth/holdout-seal.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const holdoutSeal = JSON.parse(fs.readFileSync(holdoutSealPath, 'utf8'));

const measures = manifest.groundTruthPanel.measuresPerCity;
const development = manifest.groundTruthPanel.development.cities;
const holdout = manifest.groundTruthPanel.lockedHoldout.cities;
const missingStatuses = new Set(['not_found', 'blocked', 'stale', 'class_absent']);
const accommodationMeasures = new Set(measures.filter((measure) => measure !== 'paid_attraction_adult_1'));
const errors = [];
const warnings = [];
let foundObservations = 0;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const validUrl = (value) => typeof value === 'string' && /^https?:\/\//.test(value);
const validDateTime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const key = (city, measure) => `${city}\u001f${measure}`;

function issue(message) {
  errors.push(message);
}

if (ledger.schemaVersion !== 'city-cost-v6-ground-truth-ledger-v1') issue('Unexpected development ledger schemaVersion');
if (ledger.panel !== 'development') issue('Development ledger must declare panel=development');
if (ledger.referenceWindow?.arrival !== '2026-09-17' || ledger.referenceWindow?.departure !== '2026-09-18') {
  issue('Ledger reference window does not match the frozen manifest');
}
if (JSON.stringify(ledger.requiredMeasures) !== JSON.stringify(measures)) issue('Ledger requiredMeasures do not match the frozen manifest');

const expectedDevelopment = new Map(development.map((entry) => [entry.city, entry]));
const expectedHoldout = new Set(holdout.map((entry) => entry.city));
const ledgerCities = new Set();
const seen = new Set();

if (!Array.isArray(ledger.cities)) issue('Ledger cities must be an array');
for (const cityEntry of ledger.cities ?? []) {
  if (!cityEntry || typeof cityEntry.city !== 'string') {
    issue('Every ledger city must have a city name');
    continue;
  }
  if (ledgerCities.has(cityEntry.city)) issue(`Duplicate ledger city: ${cityEntry.city}`);
  ledgerCities.add(cityEntry.city);
  const expected = expectedDevelopment.get(cityEntry.city);
  if (!expected) {
    issue(`City is not in the development panel: ${cityEntry.city}`);
  } else {
    if (cityEntry.region !== expected.region) issue(`${cityEntry.city}: region does not match manifest`);
    if (cityEntry.band !== expected.band) issue(`${cityEntry.city}: band does not match manifest`);
  }

  if (!Array.isArray(cityEntry.observations)) {
    issue(`${cityEntry.city}: observations must be an array`);
    continue;
  }
  for (const observation of cityEntry.observations) {
    const measure = observation?.measure;
    const observationKey = key(cityEntry.city, measure);
    if (!measures.includes(measure)) issue(`${cityEntry.city}: unsupported measure ${measure}`);
    if (seen.has(observationKey)) issue(`Duplicate observation: ${cityEntry.city}/${measure}`);
    seen.add(observationKey);

    const status = observation?.status;
    if (status === 'found') {
      foundObservations += 1;
      if (!(typeof observation.amount === 'number' && Number.isFinite(observation.amount) && observation.amount > 0)) issue(`${cityEntry.city}/${measure}: found rows need a positive amount`);
      if (!(typeof observation.currency === 'string' && /^[A-Z]{3}$/.test(observation.currency))) issue(`${cityEntry.city}/${measure}: found rows need an ISO currency`);
      if (!validUrl(observation.sourceUrl)) issue(`${cityEntry.city}/${measure}: found rows need a source URL`);
      if (!validDateTime(observation.retrievedAt)) issue(`${cityEntry.city}/${measure}: found rows need retrievedAt`);
      if (!observation.taxStatus || typeof observation.taxStatus !== 'string') issue(`${cityEntry.city}/${measure}: found rows need taxStatus`);
      if (!observation.evidenceText) issue(`${cityEntry.city}/${measure}: found rows need evidenceText`);
      if (accommodationMeasures.has(measure)) {
        if (observation.checkIn !== '2026-09-17' || observation.checkOut !== '2026-09-18') issue(`${cityEntry.city}/${measure}: accommodation quote dates must match the frozen window`);
        if (!observation.propertyName) issue(`${cityEntry.city}/${measure}: accommodation rows need propertyName`);
      }
      if (measure === 'paid_attraction_adult_1' && observation.propertyName !== undefined && observation.propertyName === '') issue(`${cityEntry.city}/${measure}: empty propertyName is not allowed`);
    } else if (!missingStatuses.has(status)) {
      issue(`${cityEntry.city}/${measure}: status must be found or an explicit missingness status`);
    } else if (Object.keys(observation).some((field) => !['measure', 'status', 'reason', 'attempts', 'lastAttemptAt'].includes(field))) {
      issue(`${cityEntry.city}/${measure}: missingness rows may not carry a price or source payload`);
    }

    if (expectedHoldout.has(cityEntry.city)) issue(`Holdout city appeared in development ledger: ${cityEntry.city}`);
  }
}

for (const entry of development) {
  if (!ledgerCities.has(entry.city)) issue(`Missing development city: ${entry.city}`);
  for (const measure of measures) {
    if (!seen.has(key(entry.city, measure))) warnings.push(`Pending slot: ${entry.city}/${measure}`);
  }
}

if (holdoutSeal.schemaVersion !== 'city-cost-v6-ground-truth-holdout-seal-v1') issue('Unexpected holdout seal schemaVersion');
if (holdoutSeal.status !== 'sealed_before_collection') issue('Holdout seal must remain sealed_before_collection until candidate freeze');
if (holdoutSeal.resultsFile !== null || holdoutSeal.scoresFile !== null) issue('Holdout seal must not expose result or score files');
if (holdoutSeal.cityCount !== holdout.length || holdoutSeal.requiredMeasureCount !== measures.length) issue('Holdout seal counts do not match the frozen manifest');

const report = {
  schemaVersion: 'city-cost-v6-ground-truth-validation-v1',
  developmentCities: development.length,
  requiredMeasures: measures.length,
  foundObservations,
  pendingSlots: warnings.length,
  errors,
  warnings,
  holdoutInspected: false,
  complete: errors.length === 0 && warnings.length === 0,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length || (process.argv.includes('--require-complete') && warnings.length)) process.exitCode = 1;
