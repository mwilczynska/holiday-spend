#!/usr/bin/env node
/** Deterministic audit for Experiment 053; compares strict and selector-relaxed statuses only. */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'data', 'reference', 'v5', 'experiments', '053-selector-occupancy-audit');
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !['results.json', 'audit.json'].includes(name)).sort();
function candidate(row) {
  return Boolean(row?.propertyName && Number.isFinite(row.value) && row.value > 0 &&
    /^[A-Z]{3}$/.test(row.currency ?? '') && row.unit === 'per_room_per_night' && row.class === '3_star' &&
    row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText && row.referencePeriod &&
    row.searchQuery && row.taxStatus && row.taxStatus !== 'unknown' &&
    !/\b(?:from|starting|lowest|per person|multiple rooms?|suite|hostel|dorm|nearby|average)\b/i.test(row.evidenceText));
}
const strict = [];
const relaxed = [];
const rejected = [];
const cities = [];
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const city = payload.city ?? file.replace(/\.json$/, '');
  const measure = payload.measure ?? {};
  const isRelaxed = measure.selectorRelaxedStatus === 'found' && candidate(measure);
  const isStrict = measure.strictStatus === 'found' && measure.occupancyBasis === 'explicit_two_adults_one_room' && candidate(measure);
  cities.push({ city, strict: isStrict, selectorRelaxed: isRelaxed });
  if (isStrict) strict.push({ city, value: measure.value, currency: measure.currency, propertyName: measure.propertyName });
  if (isRelaxed) relaxed.push({ city, value: measure.value, currency: measure.currency, propertyName: measure.propertyName });
  if (!isRelaxed) rejected.push({ city, reason: measure.reason ?? 'selector-relaxed contract failed' });
}
const strictOnlyFailures = cities.filter((row) => !row.strict && row.selectorRelaxed).length;
console.log(JSON.stringify({
  schemaVersion: 'city-cost-v5-selector-occupancy-audit-v1',
  citiesTested: files.length,
  strictCities: strict.length,
  selectorRelaxedCities: relaxed.length,
  strictOnlyFailures,
  promotionGate: '8 of 12 selector-relaxed candidates and at least 6 strict failures attributable solely to omitted room wording',
  promotionGatePassed: relaxed.length >= 8 && strictOnlyFailures >= 6,
  cities,
  strict,
  selectorRelaxed: relaxed,
  rejected,
  productMapping: 'none_semantic_audit_only'
}, null, 2));
