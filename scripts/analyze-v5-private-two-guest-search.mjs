#!/usr/bin/env node
/** Deterministic audit for Experiment 040; no private-room mapping is performed. */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'data', 'reference', 'v5', 'experiments', '040-private-two-guest-search');
const files = fs.readdirSync(dir)
  .filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !['results.json', 'audit.json'].includes(name))
  .sort();
const accepted = []; const rejected = [];
function valid(row) {
  return Boolean(row?.status === 'found' && typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0 &&
    /^[A-Z]{3}$/.test(row.currency ?? '') && row.unit === 'per_private_room_per_night' &&
    row.class === 'hostel_private_room' && ['two_adults', 'two_guests'].includes(row.occupancyBasis) &&
    row.statistic && row.referencePeriod && row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText &&
    row.searchQuery && !/\b(?:starting price|lowest (?:price|rate|cost))\b/i.test(row.evidenceText));
}
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const row = payload.measure;
  const city = payload.city ?? file.replace(/\.json$/, '');
  if (valid(row)) accepted.push({ city, value: row.value, currency: row.currency, occupancyBasis: row.occupancyBasis, statistic: row.statistic, sourceUrl: row.sourceUrl });
  else rejected.push({ city, status: row?.status ?? 'missing', occupancyBasis: row?.occupancyBasis ?? null, reason: row?.reason ?? 'strict explicit two-guest contract failed' });
}
console.log(JSON.stringify({ schemaVersion: 'city-cost-v5-private-two-guest-search-audit-v1', citiesTested: files.length, acceptedCells: accepted.length, accepted, rejected, productMapping: 'none_source_feasibility_only' }, null, 2));
