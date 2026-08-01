#!/usr/bin/env node
/** Deterministic audit for Experiment 055; no aggregation or model fitting. */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'data', 'reference', 'v5', 'experiments', '055-skyscanner-class-panel');
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !['results.json', 'audit.json'].includes(name)).sort();
const classes = ['1', '2', '3', '4'];
function valid(row, classNumber) {
  return Boolean(row?.status === 'found' && Number.isFinite(row.value) && row.value > 0 && /^[A-Z]{3}$/.test(row.currency ?? '') &&
    row.unit === 'per_room_per_night' && row.occupancyBasis === 'explicit_two_adults_one_room' && row.class === `${classNumber}_star` &&
    row.statistic === 'city_class_average' && row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText &&
    row.referencePeriod && row.searchQuery && row.taxStatus && row.taxStatus !== 'unknown' &&
    !/\b(?:from|starting|lowest|per person|nearby|regional|weekend|this weekend|event)\b/i.test(row.evidenceText));
}
const cities = [];
const byClass = Object.fromEntries(classes.map((classNumber) => [classNumber, []]));
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const city = payload.city ?? file.replace(/\.json$/, '');
  const row = { city, measures: {} };
  for (const classNumber of classes) {
    const measure = payload.measures?.[`hotel_${classNumber}star_room_2p`] ?? {};
    const accepted = valid(measure, classNumber);
    row.measures[classNumber] = accepted;
    if (accepted) byClass[classNumber].push({ city, value: measure.value, currency: measure.currency, sourceUrl: measure.sourceUrl });
  }
  row.complete = classes.every((classNumber) => row.measures[classNumber]);
  cities.push(row);
}
const classCoverage = Object.fromEntries(classes.map((classNumber) => [classNumber, byClass[classNumber].length]));
const completeCities = cities.filter((city) => city.complete).map((city) => city.city);
const promotionGatePassed = classCoverage['1'] >= 6 && classCoverage['2'] >= 6 && classCoverage['3'] >= 8 && classCoverage['4'] >= 8 && completeCities.length >= 6;
console.log(JSON.stringify({ schemaVersion: 'city-cost-v5-skyscanner-class-panel-v1', citiesTested: files.length, classCoverage, completeCities, promotionGate: '1-star>=6, 2-star>=6, 3-star>=8, 4-star>=8, complete cities>=6', promotionGatePassed, cities, byClass, productMapping: 'none_source_feasibility_only' }, null, 2));
