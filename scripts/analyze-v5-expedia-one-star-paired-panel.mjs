#!/usr/bin/env node
/** Deterministic audit for Experiment 065; no aggregation or model fitting. */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'data', 'reference', 'v5', 'experiments', '065-expedia-one-star-paired-panel');
const classes = ['1', '3'];
const excluded = new Set(['results.json', 'audit.json', 'inputs.json']);
const files = fs.readdirSync(dir)
  .filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !excluded.has(name))
  .sort();

function valid(row, classNumber) {
  return Boolean(
    row?.status === 'found' && Number.isFinite(row.value) && row.value > 0 && /^[A-Z]{3}$/.test(row.currency ?? '') &&
    row.unit === 'per_room_per_night' && row.occupancyBasis === 'explicit_two_adults_source_trend' &&
    row.class === `${classNumber}_star` && row.statistic === 'city_class_average' && row.sourceUrl?.startsWith('http') &&
    row.sourceTitle && row.evidenceText && row.referencePeriod && row.searchQuery &&
    (row.taxStatus === 'included' || row.taxStatus === 'excluded') &&
    !/\b(?:from|starting|lowest|per person|nearby|regional|weekend|this weekend|event)\b/i.test(row.evidenceText),
  );
}

const byClass = Object.fromEntries(classes.map((classNumber) => [classNumber, []]));
const cities = [];
let searchesAttempted = 0;
let searchOperations = 0;
let directReads = 0;
let retries = 0;
let fallbackSources = 0;
let arithmeticOperations = 0;
let currencyConversions = 0;
let crossCityEvidence = 0;

for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const city = payload.city ?? file.replace(/\.json$/, '');
  const measures = {};
  for (const classNumber of classes) {
    const measure = payload.measures?.[`hotel_${classNumber}star_room_2p`] ?? {};
    const accepted = valid(measure, classNumber);
    measures[classNumber] = accepted;
    if (accepted) {
      byClass[classNumber].push({
        city,
        value: measure.value,
        currency: measure.currency,
        taxStatus: measure.taxStatus,
        sourceUrl: measure.sourceUrl,
      });
    }
  }
  const telemetry = payload.telemetry ?? {};
  searchesAttempted += Number(telemetry.searchesAttempted ?? 0);
  searchOperations += Number(telemetry.searchOperations ?? telemetry.searchesAttempted ?? 0);
  directReads += Number(telemetry.directReads ?? 0);
  retries += Number(telemetry.retries ?? 0);
  fallbackSources += Number(telemetry.fallbackSources ?? 0);
  arithmeticOperations += Number(telemetry.arithmeticOperations ?? 0);
  currencyConversions += Number(telemetry.currencyConversions ?? 0);
  crossCityEvidence += Number(telemetry.crossCityEvidence ?? 0);
  cities.push({ city, measures, complete: classes.every((classNumber) => measures[classNumber]) });
}

const classCoverage = Object.fromEntries(classes.map((classNumber) => [classNumber, byClass[classNumber].length]));
const completeCities = cities.filter((city) => city.complete).map((city) => city.city);
const promotionGate = '1-star>=8, 3-star>=8, complete cities>=6';
const promotionGatePassed = classCoverage['1'] >= 8 && classCoverage['3'] >= 8 && completeCities.length >= 6;
const result = {
  schemaVersion: 'city-cost-v5-expedia-one-star-paired-panel-v1',
  citiesTested: files.length,
  searchesAttempted,
  searchOperations,
  directReads,
  retries,
  fallbackSources,
  arithmeticOperations,
  currencyConversions,
  crossCityEvidence,
  classCoverage,
  completeCities,
  promotionGate,
  promotionGatePassed,
  cities,
  byClass,
  productMapping: 'none_source_feasibility_only',
};
fs.writeFileSync(path.join(dir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
