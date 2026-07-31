#!/usr/bin/env node
/** Deterministic audit for Experiment 028; no fitting. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const experimentName = process.env.CITY_COST_V5_EXPEDIA_EXPERIMENT ?? '028-expedia-class-trends';
const dir = path.join(root, 'data', 'reference', 'v5', 'experiments', experimentName);
const measures = ['expedia_1_star', 'expedia_2_star', 'expedia_3_star', 'expedia_4_star'];
const files = fs.readdirSync(dir)
  .filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && name !== 'results.json' && name !== 'audit.json')
  .sort();
const rows = [];
const rejected = [];
const expectedClass = Object.fromEntries(measures.map((measure) => [measure, measure.replace('expedia_', '')]));

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
      /^[A-Z]{3}$/.test(row.currency ?? '') && row.unit === 'per_room_per_night' && row.occupancy === 'two_adults' &&
      row.class === expectedClass[measure] && row.referencePeriod && row.sourceUrl?.startsWith('http') &&
      row.sourceTitle && row.evidenceText && query,
  );
}

for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const city = payload.city ?? file.replace(/\.json$/, '');
  for (const measure of measures) {
    const row = payload.measures?.[measure];
    const query = queryFor(payload, file, measure);
    if (valid(row, measure, query)) rows.push({ city, measure, value: row.value, currency: row.currency, referencePeriod: row.referencePeriod, sourceUrl: row.sourceUrl, searchQuery: query });
    else rejected.push({ city, measure, status: row?.status ?? 'missing', reason: row?.reason ?? 'strict Expedia class-trend contract failed' });
  }
}

console.log(JSON.stringify({
  schemaVersion: 'city-cost-v5-expedia-class-trend-audit-v1',
  experiment: experimentName,
  citiesTested: files.length,
  acceptedCells: rows.length,
  totalCells: files.length * measures.length,
  accepted: rows,
  rejected,
  completeCities: files.filter((file) => measures.every((measure) => rows.some((row) => row.city === (JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')).city ?? file.replace(/\.json$/, '')) && row.measure === measure))).map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')).city ?? file.replace(/\.json$/, '')),
  note: 'Rows are retrieval feasibility evidence only; no accommodation ratio is fitted.',
}, null, 2));
