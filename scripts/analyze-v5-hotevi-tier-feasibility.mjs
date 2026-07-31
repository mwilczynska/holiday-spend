#!/usr/bin/env node
/** Deterministic audit for Experiment 027; grouped tiers are never product classes. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'data', 'reference', 'v5', 'experiments', '027-hotevi-tier-feasibility');
const measures = ['hotevi_budget_1_2_star', 'hotevi_mid_3_star', 'hotevi_luxury_4_5_star'];
const files = fs.readdirSync(dir)
  .filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && name !== 'results.json' && name !== 'audit.json')
  .sort();
const rows = [];
const rejected = [];

function queryFor(payload, file, measure) {
  const inline = payload.measures?.[measure]?.searchQuery;
  if (inline) return inline;
  const telemetryPath = path.join(dir, `${file.replace(/\.json$/, '')}-telemetry.json`);
  if (!fs.existsSync(telemetryPath)) return null;
  const telemetry = JSON.parse(fs.readFileSync(telemetryPath, 'utf8'));
  return telemetry.queries?.find((item) => item.measure === measure)?.query ?? null;
}

function valid(row, measure, query) {
  return Boolean(
    row?.status === 'found' && typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0 &&
      /^[A-Z]{3}$/.test(row.currency ?? '') && row.unit === 'per_room_per_night' &&
      row.tier && row.tier === ({
        hotevi_budget_1_2_star: 'budget_1_2_star',
        hotevi_mid_3_star: 'mid_3_star',
        hotevi_luxury_4_5_star: 'luxury_4_5_star',
      })[measure] && row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText &&
      row.referencePeriod && query,
  );
}

for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const city = payload.city ?? file.replace(/\.json$/, '');
  for (const measure of measures) {
    const row = payload.measures?.[measure];
    const query = queryFor(payload, file, measure);
    if (valid(row, measure, query)) {
      rows.push({ city, measure, value: row.value, currency: row.currency, occupancyBasis: row.occupancyBasis, referencePeriod: row.referencePeriod, sourceUrl: row.sourceUrl, searchQuery: query });
    } else {
      rejected.push({ city, measure, status: row?.status ?? 'missing', reason: row?.reason ?? 'strict HOTEVI city/tier/month/source contract failed' });
    }
  }
}

const byMeasure = Object.fromEntries(measures.map((measure) => [measure, {
  acceptedRows: rows.filter((row) => row.measure === measure).length,
  cities: new Set(rows.filter((row) => row.measure === measure).map((row) => row.city)).size,
}]));
console.log(JSON.stringify({
  schemaVersion: 'city-cost-v5-hotevi-tier-feasibility-audit-v1',
  citiesTested: files.length,
  acceptedCells: rows.length,
  totalCells: files.length * measures.length,
  accepted: rows,
  rejected,
  byMeasure,
  productMapping: 'none_without_definition-matched_calibration',
  note: 'Grouped HOTEVI tiers remain source facts only; they are not accom_1_star–accom_4_star observations.',
}, null, 2));
