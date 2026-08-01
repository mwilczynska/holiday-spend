#!/usr/bin/env node
/** Deterministic audit for Experiment 043; no basket aggregation or product mapping. */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'data', 'reference', 'v5', 'experiments', '043-google-hotels-one-star');
const files = fs.readdirSync(dir)
  .filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !['results.json', 'audit.json'].includes(name))
  .sort();
function valid(row) {
  return Boolean(row?.status === 'found' && row.class === '1_star' && row.occupancyBasis === 'explicit_two_adults' &&
    typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0 && /^[A-Z]{3}$/.test(row.currency ?? '') &&
    row.unit === 'per_room_per_night' && row.sourceUrl?.startsWith('https://www.google.com/travel/hotels/') &&
    row.sourceTitle && row.evidenceText && row.taxStatus && row.taxStatus !== 'unknown' && row.referencePeriod && row.searchQuery &&
    !/\b(?:starting price|lowest (?:price|rate|cost))\b/i.test(row.evidenceText));
}
const cities = []; const accepted = []; const rejected = [];
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const rows = payload.propertyQuotes ?? [];
  const good = rows.filter(valid);
  const city = payload.city ?? file.replace(/\.json$/, '');
  cities.push({ city, propertiesAttempted: rows.length, acceptedQuotes: good.length });
  accepted.push(...good.map((row) => ({ city, propertyName: row.propertyName, value: row.value, currency: row.currency, taxStatus: row.taxStatus, sourceUrl: row.sourceUrl })));
  rejected.push(...rows.filter((row) => !valid(row)).map((row) => ({ city, propertyName: row.propertyName ?? null, status: row.status ?? 'missing', reason: row.reason ?? 'strict Google Hotels contract failed' })));
}
console.log(JSON.stringify({ schemaVersion: 'city-cost-v5-google-hotels-one-star-audit-v1', citiesTested: files.length, cities, acceptedQuotes: accepted.length, accepted, rejected, productMapping: 'none_ground_truth_property_panel_only' }, null, 2));
