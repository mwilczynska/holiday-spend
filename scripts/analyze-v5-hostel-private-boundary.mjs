#!/usr/bin/env node
/** Deterministic audit for Experiment 039; no product mapping is performed. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'data', 'reference', 'v5', 'experiments', '039-hostel-private-boundary');
const files = fs.readdirSync(dir)
  .filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !['results.json', 'audit.json'].includes(name))
  .sort();

const measures = ['accom_shared_hostel_dorm', 'accom_hostel_private_room'];
const accepted = Object.fromEntries(measures.map((measure) => [measure, []]));
const rejected = Object.fromEntries(measures.map((measure) => [measure, []]));

function valid(row, measure) {
  const privateRoom = measure === 'accom_hostel_private_room';
  return Boolean(
    row?.status === 'found' &&
      typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0 &&
      /^[A-Z]{3}$/.test(row.currency ?? '') &&
      row.unit === (privateRoom ? 'per_private_room_per_night' : 'per_dorm_bed_per_night') &&
      row.class === (privateRoom ? 'hostel_private_room' : 'shared_hostel_dorm') &&
      (!privateRoom || ['two_adults', 'two_guests'].includes(row.occupancyBasis)) &&
      row.statistic && row.referencePeriod && row.sourceUrl?.startsWith('http') &&
      row.sourceTitle && row.evidenceText && row.searchQuery &&
      // Directory/page titles often contain “from $X” for SEO even when the
      // evidence snippet reports a central average. Apply the lowest-price
      // guard to the evidence itself, not the title.
      !/\b(?:starting price|lowest (?:price|rate|cost))\b/i.test(row.evidenceText),
  );
}

for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const city = payload.city ?? file.replace(/\.json$/, '');
  for (const measure of measures) {
    const row = payload.measures?.[measure];
    if (valid(row, measure)) accepted[measure].push({ city, value: row.value, currency: row.currency, occupancyBasis: row.occupancyBasis, statistic: row.statistic, sourceUrl: row.sourceUrl });
    else rejected[measure].push({ city, status: row?.status ?? 'missing', occupancyBasis: row?.occupancyBasis ?? null, reason: row?.reason ?? 'strict boundary contract failed' });
  }
}

const completeCities = files
  .map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')))
  .filter((payload) => measures.every((measure) => valid(payload.measures?.[measure], measure)))
  .map((payload) => payload.city);

console.log(JSON.stringify({
  schemaVersion: 'city-cost-v5-hostel-private-boundary-audit-v1',
  citiesTested: files.length,
  acceptedCells: Object.fromEntries(measures.map((measure) => [measure, accepted[measure].length])),
  completeCities,
  accepted,
  rejected,
  productMapping: 'none_source_feasibility_only',
}, null, 2));
