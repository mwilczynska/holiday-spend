#!/usr/bin/env node
/** Deterministic audit for Experiment 048; no aggregation or product mapping. */
import fs from 'node:fs';
import path from 'node:path';
const dir = path.join(process.cwd(), 'data', 'reference', 'v5', 'experiments', '048-private-hostel-broad-panel');
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !['results.json', 'audit.json'].includes(name)).sort();
function valid(row) {
  return Boolean(row?.status === 'found' && row.propertyName && typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0 &&
    /^[A-Z]{3}$/.test(row.currency ?? '') && row.unit === 'per_room_per_night' && row.occupancyBasis === 'explicit_two_adults' &&
    row.class === 'hostel_private_room' && row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText && row.referencePeriod &&
    row.searchQuery && row.taxStatus && row.taxStatus !== 'unknown' && !/\b(?:from|starting|lowest)\b/i.test(row.evidenceText));
}
const accepted = []; const rejected = []; const cities = [];
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); const city = payload.city ?? file.replace(/\.json$/, '');
  if (valid(payload.measure)) accepted.push({ city, value: payload.measure.value, currency: payload.measure.currency, propertyName: payload.measure.propertyName, sourceUrl: payload.measure.sourceUrl });
  else rejected.push({ city, status: payload.measure?.status ?? 'missing', reason: payload.measure?.reason ?? 'strict private-hostel contract failed' });
  cities.push({ city, accepted: valid(payload.measure) });
}
console.log(JSON.stringify({ schemaVersion: 'city-cost-v5-private-hostel-broad-panel-audit-v1', citiesTested: files.length, acceptedCities: accepted.length, promotionGate: '6 of 12 strict quotes', promotionGatePassed: accepted.length >= 6, cities, accepted, rejected, productMapping: 'none_property_ground_truth_only' }, null, 2));
