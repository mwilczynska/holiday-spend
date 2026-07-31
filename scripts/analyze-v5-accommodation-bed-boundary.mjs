#!/usr/bin/env node
/** Deterministic audit for Experiment 025; no model fitting. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'data', 'reference', 'v5', 'experiments', '025-accommodation-bed-boundary');
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
const files = fs.readdirSync(dir)
  .filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && name !== 'results.json' && name !== 'audit.json')
  .sort();

function queryFor(payload, file, measure) {
  const inline = payload.measures?.[measure]?.searchQuery;
  if (inline) return inline;
  const telemetryPath = path.join(dir, `${file.replace(/\.json$/, '')}-telemetry.json`);
  if (!fs.existsSync(telemetryPath)) return null;
  const telemetry = JSON.parse(fs.readFileSync(telemetryPath, 'utf8'));
  return telemetry.queries?.find((item) => item.measure === measure)?.query ?? null;
}

function valid(row, measure, query) {
  if (!row || row.status !== 'found' || typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value <= 0) return false;
  if (!/^[A-Z]{3}$/.test(row.currency ?? '') || row.class !== expectedClass[measure] || !query) return false;
  if (!row.sourceUrl?.startsWith('http') || !row.sourceTitle || !row.evidenceText) return false;
  if (measure === 'accom_shared_hostel_dorm') return row.unit === 'per_dorm_bed_per_night' && row.occupancy === 'one_adult_bed';
  return row.unit === 'per_room_per_night' && row.occupancy === 'two_adults';
}

const cities = [];
const accepted = [];
const rejected = [];
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const city = payload.city ?? file.replace(/\.json$/, '');
  let acceptedCells = 0;
  for (const measure of measures) {
    const row = payload.measures?.[measure];
    const query = queryFor(payload, file, measure);
    if (valid(row, measure, query)) {
      acceptedCells += 1;
      accepted.push({ city, measure, value: row.value, currency: row.currency, unit: row.unit, scaledTwoPerson: measure === 'accom_shared_hostel_dorm' ? row.value * 2 : null, sourceUrl: row.sourceUrl, searchQuery: query });
    } else {
      rejected.push({ city, measure, status: row?.status ?? 'missing', reason: row?.reason ?? 'strict boundary/provenance contract failed' });
    }
  }
  cities.push({ city, acceptedCells, complete: acceptedCells === measures.length });
}

const byMeasure = Object.fromEntries(measures.map((measure) => [measure, {
  acceptedRows: accepted.filter((row) => row.measure === measure).length,
  cities: new Set(accepted.filter((row) => row.measure === measure).map((row) => row.city)).size,
}]));
const completeCount = cities.filter((city) => city.complete).length;
console.log(JSON.stringify({
  schemaVersion: 'city-cost-v5-accommodation-bed-boundary-audit-v1',
  citiesTested: cities.length,
  acceptedCells: accepted.length,
  totalCells: cities.length * measures.length,
  accepted,
  rejected,
  cities,
  byMeasure,
  modelGate: {
    matchedCitiesRequired: 30,
    lockedHoldoutRequired: 10,
    completeCityCount: completeCount,
    completeCityCountMeets30: completeCount >= 30,
    note: 'Dorm values remain one-bed observed inputs; scaledTwoPerson is a deterministic audit preview, not LLM arithmetic.',
  },
}, null, 2));
