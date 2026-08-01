#!/usr/bin/env node
/** Deterministic pooled Expedia evidence audit; never fits coefficients. */
import fs from 'node:fs';
import path from 'node:path';

const roots = [
  ['028', 'data/reference/v5/experiments/028-expedia-class-trends'],
  ['029', 'data/reference/v5/experiments/029-expedia-class-panel'],
  ['059', 'data/reference/v5/experiments/059-expedia-class-panel'],
  ['060', 'data/reference/v5/experiments/060-expedia-four-star-gap-panel'],
  ['061', 'data/reference/v5/experiments/061-expedia-paired-panel'],
  ['063', 'data/reference/v5/experiments/063-expedia-paired-panel-2'],
];
const classNumbers = ['1', '2', '3', '4'];
const rows = [];

function filesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !['results.json', 'audit.json'].includes(name));
}
function legacyAccepted(measure, classNumber) {
  const evidence = `${measure?.evidenceText ?? ''}`;
  return measure?.status === 'found' && Number.isFinite(measure.value) && measure.value > 0 &&
    /^[A-Z]{3}$/.test(measure.currency ?? '') && measure.unit === 'per_room_per_night' &&
    measure.class === `${classNumber}_star` && measure.occupancy === 'two_adults' && measure.sourceUrl?.startsWith('http') &&
    /(?:excludes|excluding) taxes and fees/i.test(evidence) && measure.referencePeriod && measure.searchQuery;
}
function strictAccepted(measure, classNumber) {
  return measure?.status === 'found' && Number.isFinite(measure.value) && measure.value > 0 &&
    /^[A-Z]{3}$/.test(measure.currency ?? '') && measure.unit === 'per_room_per_night' &&
    measure.class === `${classNumber}_star` && measure.occupancyBasis === 'explicit_two_adults_source_trend' &&
    measure.statistic === 'city_class_average' && measure.sourceUrl?.startsWith('http') && measure.sourceTitle &&
    measure.evidenceText && measure.referencePeriod && measure.searchQuery &&
    (measure.taxStatus === 'included' || measure.taxStatus === 'excluded') &&
    !/\b(?:from|starting|lowest|per person|nearby|regional|weekend|this weekend|event)\b/i.test(measure.evidenceText);
}

for (const [experiment, relativeDir] of roots) {
  const dir = path.join(process.cwd(), relativeDir);
  for (const file of filesIn(dir)) {
    const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    for (const classNumber of classNumbers) {
      const measure = payload.measures?.[`hotel_${classNumber}star_room_2p`] ?? payload.measures?.[`expedia_${classNumber}_star`] ?? {};
      const accepted = experiment === '028' || experiment === '029' ? legacyAccepted(measure, classNumber) : strictAccepted(measure, classNumber);
      if (!accepted) continue;
      rows.push({ experiment, city: payload.city, classNumber, value: measure.value, currency: measure.currency, taxStatus: measure.taxStatus ?? 'excluded', sourceUrl: measure.sourceUrl, sourceTitle: measure.sourceTitle ?? null, retrievalDate: payload.retrievalDate, legacy: experiment === '028' || experiment === '029' });
    }
  }
}

const preference = { '028': 1, '029': 2, '059': 3, '060': 4, '061': 5, '063': 6 };
const chosen = new Map();
for (const row of rows) {
  const key = `${row.city}\u0000${row.classNumber}`;
  const prior = chosen.get(key);
  if (!prior || preference[row.experiment] > preference[prior.experiment]) chosen.set(key, row);
}
const pooled = [...chosen.values()];
const byClass = Object.fromEntries(classNumbers.map((classNumber) => [classNumber, pooled.filter((row) => row.classNumber === classNumber)]));
const cityNames = [...new Set(pooled.map((row) => row.city))].sort();
const completeCities = cityNames.filter((city) => classNumbers.slice(1).every((classNumber) => pooled.some((row) => row.city === city && row.classNumber === classNumber)));
const pairs = {
  hotel_2_from_3: cityNames.filter((city) => [2, 3].every((n) => pooled.some((row) => row.city === city && row.classNumber === `${n}`))),
  hotel_4_from_3: cityNames.filter((city) => [3, 4].every((n) => pooled.some((row) => row.city === city && row.classNumber === `${n}`))),
  hostel_or_one_star: cityNames.filter((city) => pooled.some((row) => row.city === city && row.classNumber === '1')),
};
const basisCounts = Object.fromEntries([...new Set(pooled.map((row) => row.taxStatus))].sort().map((basis) => [basis, pooled.filter((row) => row.taxStatus === basis).length]));
const relationshipEligibility = Object.fromEntries(Object.entries(pairs).map(([name, cities]) => [name, { matchedCities: cities.length, requiredMatchedCities: 30, requiredLockedHoldoutCities: 10, fitEligible: cities.length >= 30, cities }]));
console.log(JSON.stringify({ schemaVersion: 'city-cost-v5-expedia-pooled-ceiling-v1', sourceExperiments: roots.map(([experiment]) => experiment), rawAcceptedRows: rows.length, deduplicatedRows: pooled.length, uniqueCities: cityNames.length, byClass: Object.fromEntries(classNumbers.map((classNumber) => [classNumber, { rows: byClass[classNumber].length, cities: [...new Set(byClass[classNumber].map((row) => row.city))].sort() }])), completeCities, completeCityCount: completeCities.length, basisCounts, relationshipEligibility, anyFitEligible: Object.values(relationshipEligibility).some((entry) => entry.fitEligible), productMapping: 'none_pooled_ceiling_only' }, null, 2));
