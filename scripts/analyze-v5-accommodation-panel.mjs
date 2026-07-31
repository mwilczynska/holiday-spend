#!/usr/bin/env node
/**
 * Deterministically audits Experiment 024's single-city accommodation panel.
 * This is a retrieval/provenance audit, not a model fit or independent ground truth.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const experimentDir = path.join(root, 'data', 'reference', 'v5', 'experiments', '024-accommodation-ground-truth-panel');
const measures = [
  'accom_shared_hostel_dorm',
  'accom_hostel_private_room',
  'accom_1_star',
  'accom_2_star',
  'accom_3_star',
  'accom_4_star',
];
const expectedClass = {
  accom_shared_hostel_dorm: 'shared_hostel_dorm',
  accom_hostel_private_room: 'hostel_private_room',
  accom_1_star: '1_star',
  accom_2_star: '2_star',
  accom_3_star: '3_star',
  accom_4_star: '4_star',
};

const files = fs.readdirSync(experimentDir)
  .filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && name !== 'results.json' && name !== 'audit.json')
  .sort();
const cities = [];
const rejected = [];

function validFound(row, measure, city, query) {
  if (!row || row.status !== 'found') return false;
  if (row.value === undefined || typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value <= 0) return false;
  if (!/^[A-Z]{3}$/.test(row.currency ?? '')) return false;
  if (row.occupancy !== 'two_adults') return false;
  if (row.class !== expectedClass[measure]) return false;
  if (!/^https?:\/\//.test(row.sourceUrl ?? '')) return false;
  if (!row.sourceTitle || !row.evidenceText) return false;
  if (!query || typeof query !== 'string') return false;
  if (typeof row.unit !== 'string' || !/per_.*_per_night$/.test(row.unit)) return false;
  return true;
}

for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(experimentDir, file), 'utf8'));
  const city = payload.city ?? file.replace(/\.json$/, '');
  const telemetryPath = path.join(experimentDir, `${file.replace(/\.json$/, '')}-telemetry.json`);
  const telemetry = fs.existsSync(telemetryPath) ? JSON.parse(fs.readFileSync(telemetryPath, 'utf8')) : null;
  const telemetryQueries = new Map((telemetry?.queries ?? []).filter((item) => item.measure && item.query).map((item) => [item.measure, item.query]));
  const accepted = [];
  const rejectedMeasures = [];
  for (const measure of measures) {
    const row = payload.measures?.[measure];
    const query = row?.searchQuery ?? telemetryQueries.get(measure);
    if (validFound(row, measure, city, query)) {
      accepted.push({ city, measure, value: row.value, currency: row.currency, sourceUrl: row.sourceUrl, searchQuery: query });
    } else {
      rejectedMeasures.push({ measure, status: row?.status ?? 'missing', reason: row?.reason ?? (!query ? 'exact query provenance missing' : 'strict identity/evidence contract failed') });
    }
  }
  cities.push({ city, acceptedCells: accepted.length, complete: accepted.length === measures.length });
  rejected.push(...rejectedMeasures.map((item) => ({ city, ...item })));
}

const byMeasure = Object.fromEntries(measures.map((measure) => [measure, {
  acceptedRows: 0,
  cities: 0,
}]));
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(experimentDir, file), 'utf8'));
  const city = payload.city ?? file.replace(/\.json$/, '');
  const telemetryPath = path.join(experimentDir, `${file.replace(/\.json$/, '')}-telemetry.json`);
  const telemetry = fs.existsSync(telemetryPath) ? JSON.parse(fs.readFileSync(telemetryPath, 'utf8')) : null;
  const telemetryQueries = new Map((telemetry?.queries ?? []).filter((item) => item.measure && item.query).map((item) => [item.measure, item.query]));
  for (const measure of measures) {
    const row = payload.measures?.[measure];
    const query = row?.searchQuery ?? telemetryQueries.get(measure);
    if (validFound(row, measure, city, query)) {
      byMeasure[measure].acceptedRows += 1;
      byMeasure[measure].cities += 1;
    }
  }
}

const result = {
  schemaVersion: 'city-cost-v5-accommodation-panel-audit-v1',
  source: 'data/reference/v5/experiments/024-accommodation-ground-truth-panel/*.json',
  citiesTested: cities.length,
  acceptedCells: cities.reduce((sum, city) => sum + city.acceptedCells, 0),
  totalCells: cities.length * measures.length,
  completeCities: cities.filter((city) => city.complete).map((city) => city.city),
  cities,
  byMeasure,
  rejected,
  modelGate: {
    matchedCitiesRequired: 30,
    lockedHoldoutRequired: 10,
    completeCityCountMeets30: cities.filter((city) => city.complete).length >= 30,
    verdict: 'retrieval_panel_incomplete_until_30_complete_cities',
  },
};

console.log(JSON.stringify(result, null, 2));
