#!/usr/bin/env node
/** Deterministic audit for Experiment 066; no aggregation or model fitting. */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'data', 'reference', 'v5', 'experiments', '066-budgetyourtrip-one-star-semantics');
const excluded = new Set(['results.json', 'audit.json', 'inputs.json']);
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !excluded.has(name)).sort();

function valid(row) {
  return Boolean(
    row?.status === 'found' && Number.isFinite(row.value) && row.value > 0 && /^[A-Z]{3}$/.test(row.currency ?? '') &&
    row.unit === 'per_room_per_night' && row.occupancyBasis === 'explicit_two_adults_page' &&
    row.class === '1_star' && row.statistic === 'city_average' && row.sourceUrl?.startsWith('http') && row.sourceTitle &&
    row.evidenceText && row.occupancyEvidence && row.taxEvidence && row.referencePeriod &&
    (row.taxStatus === 'included' || row.taxStatus === 'excluded') &&
    !/\b(?:from|starting|lowest|per person|nearby|regional|weekend|event)\b/i.test(`${row.evidenceText} ${row.occupancyEvidence}`),
  );
}

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
  const measure = payload.measures?.hotel_1star_semantic ?? {};
  const accepted = valid(measure);
  const telemetry = payload.telemetry ?? {};
  searchesAttempted += Number(telemetry.searchesAttempted ?? 0);
  searchOperations += Number(telemetry.searchOperations ?? telemetry.searchesAttempted ?? 0);
  directReads += Number(telemetry.directReads ?? 0);
  retries += Number(telemetry.retries ?? 0);
  fallbackSources += Number(telemetry.fallbackSources ?? 0);
  arithmeticOperations += Number(telemetry.arithmeticOperations ?? 0);
  currencyConversions += Number(telemetry.currencyConversions ?? 0);
  crossCityEvidence += Number(telemetry.crossCityEvidence ?? 0);
  cities.push({ city: payload.city ?? file.replace(/\.json$/, ''), accepted, status: measure.status ?? 'missing', reason: measure.reason ?? null });
}

const acceptedCities = cities.filter((city) => city.accepted).map((city) => city.city);
const result = {
  schemaVersion: 'city-cost-v5-budgetyourtrip-one-star-semantics-v1',
  citiesTested: files.length,
  searchesAttempted,
  searchOperations,
  directReads,
  retries,
  fallbackSources,
  arithmeticOperations,
  currencyConversions,
  crossCityEvidence,
  acceptedRows: acceptedCities.length,
  acceptedCities,
  promotionGate: 'strict semantic rows>=8, accepted cities>=6',
  promotionGatePassed: acceptedCities.length >= 8 && acceptedCities.length >= 6,
  cities,
  productMapping: 'none_source_semantics_only',
};
fs.writeFileSync(path.join(dir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
