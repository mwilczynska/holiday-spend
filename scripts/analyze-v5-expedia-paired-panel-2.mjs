#!/usr/bin/env node
/** Deterministic audit for Experiment 063; no aggregation or model fitting. */
import fs from 'node:fs';
import path from 'node:path';
const dir = path.join(process.cwd(), 'data', 'reference', 'v5', 'experiments', '063-expedia-paired-panel-2');
const classes = ['2', '3', '4'];
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !['results.json', 'audit.json'].includes(name)).sort();
function valid(row, classNumber) {
  return Boolean(row?.status === 'found' && Number.isFinite(row.value) && row.value > 0 && /^[A-Z]{3}$/.test(row.currency ?? '') &&
    row.unit === 'per_room_per_night' && row.occupancyBasis === 'explicit_two_adults_source_trend' && row.class === `${classNumber}_star` &&
    row.statistic === 'city_class_average' && row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText &&
    row.referencePeriod && row.searchQuery && (row.taxStatus === 'included' || row.taxStatus === 'excluded') &&
    !/\b(?:from|starting|lowest|per person|nearby|regional|weekend|this weekend|event)\b/i.test(row.evidenceText));
}
const byClass = Object.fromEntries(classes.map((classNumber) => [classNumber, []]));
const cities = [];
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const city = payload.city ?? file.replace(/\.json$/, '');
  const measures = {};
  for (const classNumber of classes) {
    const measure = payload.measures?.[`hotel_${classNumber}star_room_2p`] ?? {};
    const accepted = valid(measure, classNumber);
    measures[classNumber] = accepted;
    if (accepted) byClass[classNumber].push({ city, value: measure.value, currency: measure.currency, taxStatus: measure.taxStatus, sourceUrl: measure.sourceUrl });
  }
  cities.push({ city, measures, complete: classes.every((classNumber) => measures[classNumber]) });
}
const classCoverage = Object.fromEntries(classes.map((classNumber) => [classNumber, byClass[classNumber].length]));
const completeCities = cities.filter((city) => city.complete).map((city) => city.city);
const promotionGatePassed = classes.every((classNumber) => classCoverage[classNumber] >= 8) && completeCities.length >= 6;
console.log(JSON.stringify({ schemaVersion: 'city-cost-v5-expedia-paired-panel-2-v1', citiesTested: files.length, classCoverage, completeCities, promotionGate: '2-star>=8, 3-star>=8, 4-star>=8, complete cities>=6', promotionGatePassed, cities, byClass, productMapping: 'none_source_feasibility_only' }, null, 2));
