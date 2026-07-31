#!/usr/bin/env node
/** Deterministic audit for Experiment 032; does not aggregate property quotes. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'data', 'reference', 'v5', 'experiments', '032-one-star-property-basket');
const files = fs.readdirSync(dir)
  .filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && name !== 'results.json' && name !== 'audit.json')
  .sort();
const accepted = [];
const rejected = [];
function valid(row) {
  return Boolean(row?.propertyName && typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0
    && /^[A-Z]{3}$/.test(row.currency ?? '') && row.unit === 'per_room_per_night'
    && row.occupancyBasis === 'explicit_two_adults' && row.class === '1_star' && row.referencePeriod
    && row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText && row.searchQuery);
}
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const city = payload.city ?? file.replace(/\.json$/, '');
  for (const row of payload.propertyQuotes ?? []) {
    if (valid(row)) accepted.push({ city, propertyName: row.propertyName, value: row.value, currency: row.currency,
      referencePeriod: row.referencePeriod, sourceUrl: row.sourceUrl, searchQuery: row.searchQuery });
    else rejected.push({ city, propertyName: row.propertyName ?? null, reason: 'strict explicit two-adult 1-star property contract failed' });
  }
  for (const row of payload.rejected ?? []) rejected.push({ city, source: row.source ?? null, reason: row.reason ?? 'model rejected' });
}
console.log(JSON.stringify({
  schemaVersion: 'city-cost-v5-one-star-property-basket-audit-v1',
  citiesTested: files.length,
  qualifyingProperties: accepted.length,
  citiesWithQualifyingProperties: [...new Set(accepted.map((row) => row.city))].length,
  accepted,
  rejected,
  productMapping: 'none_without_city_level_basket_validation',
}, null, 2));
