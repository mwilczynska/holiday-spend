import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const manifestPath = path.join(root, 'data/reference/v6/validation-manifest-v6.json');
const ledgerPath = path.join(root, 'data/reference/v6/ground-truth/development-ledger.json');
const holdoutSealPath = path.join(root, 'data/reference/v6/ground-truth/holdout-seal.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const ledgerGitArgument = process.argv.find((argument) => argument.startsWith('--ledger-git='));
const ledger = ledgerGitArgument
  ? JSON.parse(execFileSync('git', ['show', ledgerGitArgument.slice('--ledger-git='.length)], { encoding: 'utf8' }))
  : JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const holdoutSeal = JSON.parse(fs.readFileSync(holdoutSealPath, 'utf8'));

const measures = manifest.groundTruthPanel.measuresPerCity;
const development = manifest.groundTruthPanel.development.cities;
const holdout = manifest.groundTruthPanel.lockedHoldout.cities;
const missingStatuses = new Set(['not_found', 'blocked', 'stale', 'class_absent']);
const accommodationMeasures = new Set(measures.filter((measure) => measure !== 'paid_attraction_adult_1'));
const errors = [];
const warnings = [];
let foundObservations = 0;
let pendingSlots = 0;
const foundRows = [];
const accommodationByCity = new Map();
const accommodationRatios = {
  hostel_dorm_bed_1p: 0.1626,
  hostel_private_room_2p: 0.5919,
  hotel_1star_room_2p: 0.6663,
  hotel_3star_room_2p: 1,
  hotel_4star_room_2p: 1.3372,
};
const currentAccommodationSelectionRule = 'booking_top_picks_firstpage_median_v2';
const supersededAccommodationSelectionRule = 'booking_price_asc_median_v1';
const accommodationClassOrder = [
  'hostel_dorm_bed_1p',
  'hostel_private_room_2p',
  'hotel_1star_room_2p',
  'hotel_3star_room_2p',
  'hotel_4star_room_2p',
];

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const validUrl = (value) => typeof value === 'string' && /^https?:\/\//.test(value);
const validDateTime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const key = (city, measure) => `${city}\u001f${measure}`;
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

function issue(message) {
  errors.push(message);
}

if (ledger.schemaVersion !== 'city-cost-v6-ground-truth-ledger-v2') issue('Unexpected development ledger schemaVersion');
if (ledger.panel !== 'development') issue('Development ledger must declare panel=development');
if (ledger.referenceWindow?.arrival !== '2026-09-17' || ledger.referenceWindow?.departure !== '2026-09-18') {
  issue('Ledger reference window does not match the frozen manifest');
}
if (JSON.stringify(ledger.requiredMeasures) !== JSON.stringify(measures)) issue('Ledger requiredMeasures do not match the frozen manifest');
if (ledger.sourcePolicy?.accommodationGroundTruthSource !== 'Booking.com') issue('Ledger sourcePolicy must identify Booking.com accommodation ground truth');
if (ledger.sourcePolicy?.productionAccommodationAnchor !== 'Expedia') issue('Ledger sourcePolicy must identify Expedia as the production accommodation anchor');
if (ledger.sourcePolicy?.offsetDirection !== 'Booking -> Expedia') issue('Ledger sourcePolicy must declare the Booking -> Expedia offset direction');
if (ledger.sourcePolicy?.minimumCitiesForOffset !== 12) issue('Ledger sourcePolicy must require at least 12 cities for the Booking -> Expedia offset');
for (const field of ['samplePrices', 'listPriceAmount', 'dealLabels', 'classInventoryCount', 'selectionRule']) {
  if (!ledger.observationContract?.accommodationFound?.includes(field)) issue(`Ledger accommodation contract must include ${field}`);
}

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
      foundRows.push({ city: cityEntry.city, observation });
      if (!(typeof observation.amount === 'number' && Number.isFinite(observation.amount) && observation.amount > 0)) issue(`${cityEntry.city}/${measure}: found rows need a positive amount`);
      if (!(typeof observation.currency === 'string' && /^[A-Z]{3}$/.test(observation.currency))) issue(`${cityEntry.city}/${measure}: found rows need an ISO currency`);
      if (!validUrl(observation.sourceUrl)) issue(`${cityEntry.city}/${measure}: found rows need a source URL`);
      if (!validDateTime(observation.retrievedAt)) issue(`${cityEntry.city}/${measure}: found rows need retrievedAt`);
      if (!observation.taxStatus || typeof observation.taxStatus !== 'string') issue(`${cityEntry.city}/${measure}: found rows need taxStatus`);
      if (!observation.evidenceText) issue(`${cityEntry.city}/${measure}: found rows need evidenceText`);
      if (accommodationMeasures.has(measure)) {
        if (observation.checkIn !== '2026-09-17' || observation.checkOut !== '2026-09-18') issue(`${cityEntry.city}/${measure}: accommodation quote dates must match the frozen window`);
        if (!observation.propertyName) issue(`${cityEntry.city}/${measure}: accommodation rows need propertyName`);
        if (!Array.isArray(observation.samplePrices) || observation.samplePrices.length < 1 || observation.samplePrices.length > 50) {
          issue(`${cityEntry.city}/${measure}: accommodation rows need 1 to 50 samplePrices`);
        } else if (observation.samplePrices.some((price) => !(typeof price === 'number' && Number.isFinite(price) && price > 0))) {
          issue(`${cityEntry.city}/${measure}: samplePrices must contain only positive numbers`);
        } else if (Math.abs(observation.amount - median(observation.samplePrices)) > 0.01) {
          issue(`${cityEntry.city}/${measure}: amount must equal the median of samplePrices`);
        }
        if (!(observation.listPriceAmount === null || (typeof observation.listPriceAmount === 'number' && Number.isFinite(observation.listPriceAmount) && observation.listPriceAmount > 0))) {
          issue(`${cityEntry.city}/${measure}: listPriceAmount must be a positive number or null`);
        }
        if (!Array.isArray(observation.dealLabels) || observation.dealLabels.some((label) => typeof label !== 'string')) {
          issue(`${cityEntry.city}/${measure}: dealLabels must be an array of strings`);
        }
        if (![currentAccommodationSelectionRule, supersededAccommodationSelectionRule].includes(observation.selectionRule)) {
          issue(`${cityEntry.city}/${measure}: selectionRule must be ${currentAccommodationSelectionRule}`);
        } else if (!(Number.isInteger(observation.classInventoryCount) && observation.classInventoryCount > 0) && observation.selectionRule === currentAccommodationSelectionRule) {
          issue(`${cityEntry.city}/${measure}: classInventoryCount must be a positive integer`);
        } else if (!(Number.isInteger(observation.classInventoryCount) && observation.classInventoryCount > 0)) {
          warnings.push(`Legacy accommodation row lacks classInventoryCount: ${cityEntry.city}/${measure}`);
        } else if (observation.selectionRule === supersededAccommodationSelectionRule) {
          warnings.push(`Superseded accommodation selection rule: ${cityEntry.city}/${measure}`);
        }
        if (!accommodationByCity.has(cityEntry.city)) accommodationByCity.set(cityEntry.city, new Map());
        accommodationByCity.get(cityEntry.city).set(measure, observation);
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
    if (!seen.has(key(entry.city, measure))) {
      pendingSlots += 1;
      warnings.push(`Pending slot: ${entry.city}/${measure}`);
    }
  }
}

const audPattern = /\bAUD\s*([0-9]+(?:[.,][0-9]+)?)/gi;
for (const { city, observation } of foundRows) {
  const figures = [...String(observation.evidenceText ?? '').matchAll(audPattern)]
    .map((match) => Number(match[1].replace(',', '.')))
    .filter((value) => Number.isFinite(value));
  const samplePrices = Array.isArray(observation.samplePrices) ? observation.samplePrices : [];
  const listPriceFigures = observation.selectionRule === currentAccommodationSelectionRule
    ? [...String(observation.evidenceText ?? '').matchAll(/\blist\s+AUD\s+([0-9]+(?:[.,][0-9]+)?)/gi)]
      .map((match) => Number(match[1].replace(',', '.')))
    : [];
  const excludedPrices = [...samplePrices, observation.listPriceAmount, ...listPriceFigures].filter((value) => Number.isFinite(value));
  if (figures.filter((value) => !excludedPrices.some((excludedPrice) => Math.abs(excludedPrice - value) < 0.01)).some((value) => value < observation.amount)) {
    warnings.push(`Sub-amount AUD figure in evidence: ${city}/${observation.measure}`);
  }
}

for (const [city, byMeasure] of accommodationByCity) {
  const rows = accommodationClassOrder.map((measure) => byMeasure.get(measure));
  if (rows.length !== accommodationClassOrder.length || rows.some((row) => !row)) continue;
  if (new Set(rows.map((row) => row.currency)).size === 1) {
    const inversion = rows.some((row, index) => index > 0 && rows[index - 1].amount >= row.amount);
    if (inversion) warnings.push(`Intra-city accommodation class inversion: ${city}`);
    const anchor = byMeasure.get('hotel_3star_room_2p');
    for (const measure of accommodationClassOrder.filter((value) => value !== 'hotel_3star_room_2p')) {
      const ratio = byMeasure.get(measure).amount / anchor.amount;
      const fitted = accommodationRatios[measure];
      if (ratio > fitted * 2 || ratio < fitted * 0.5) {
        warnings.push(`Accommodation ratio outside fitted band: ${city}/${measure} ratio=${ratio.toFixed(3)} fitted=${fitted.toFixed(3)}`);
      }
    }
  }
}

if (holdoutSeal.schemaVersion !== 'city-cost-v6-ground-truth-holdout-seal-v1') issue('Unexpected holdout seal schemaVersion');
if (holdoutSeal.methodologyVersion !== 'v6.0') issue('Holdout seal methodologyVersion must be v6.0');
if (holdoutSeal.manifestPath !== 'data/reference/v6/validation-manifest-v6.json') issue('Holdout seal manifestPath must identify the frozen v6 manifest');
if (holdoutSeal.status === 'sealed_before_collection') {
  if (holdoutSeal.resultsFile !== null || holdoutSeal.scoresFile !== null) issue('Pre-collection holdout seal must not expose result or score files');
} else if (holdoutSeal.status === 'sealed_after_collection') {
  if (typeof holdoutSeal.resultsFile !== 'string' || !holdoutSeal.resultsFile) issue('Collected holdout seal must name its sealed results file');
  if (holdoutSeal.scoresFile !== null) issue('Collected holdout seal must not expose score files');
  if (typeof holdoutSeal.resultsFile === 'string' && !fs.existsSync(path.join(root, holdoutSeal.resultsFile))) issue('Collected holdout results file is missing');
} else {
  issue('Holdout seal must be sealed_before_collection or sealed_after_collection');
}
if (holdoutSeal.cityCount !== holdout.length || holdoutSeal.requiredMeasureCount !== measures.length) issue('Holdout seal counts do not match the frozen manifest');

const report = {
  schemaVersion: 'city-cost-v6-ground-truth-validation-v1',
  developmentCities: development.length,
  requiredMeasures: measures.length,
  foundObservations,
  pendingSlots,
  errors,
  warnings,
  substanceWarningCount: warnings.filter((warning) => !warning.startsWith('Pending slot:')).length,
  holdoutInspected: false,
  complete: errors.length === 0 && pendingSlots === 0,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length || (process.argv.includes('--require-complete') && !report.complete)) process.exitCode = 1;
