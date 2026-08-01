#!/usr/bin/env node
/** Deterministic audit for Experiment 068; snippet proxy screening only. */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'data', 'reference', 'v5', 'experiments', '068-budgetyourtrip-snippet-proxy');
const excluded = new Set(['results.json', 'audit.json', 'inputs.json']);
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !excluded.has(name)).sort();

function host(url) {
  try { return new URL(url).hostname.replace(/^(?:www|testing)\./, ''); } catch { return ''; }
}

function validProxy(row, semantics) {
  const occupancy = row?.occupancyBasis ?? '';
  return Boolean(
    row?.status === 'proxy_candidate' && Number.isFinite(row.value) && row.value > 0 && /^[A-Z]{3}$/.test(row.currency ?? '') &&
    row.unit === 'per_room_per_night' && row.class === '1_star' && (row.statistic === 'city_average' || row.statistic === 'city_class_average') &&
    row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText && row.referencePeriod &&
    /^(?:included|excluded|before_taxes_and_fees|before_taxes|pre_tax)$/i.test(row.taxStatus ?? '') &&
    /source_defined_double_occupancy/i.test(occupancy) &&
    semantics?.status === 'found' && semantics.sourceUrl?.startsWith('http') && semantics.evidenceText &&
    /(?:two people|two-person|double[- ]occupancy|double occupancy|couple)/i.test(`${semantics.evidenceText} ${semantics.occupancyEvidence ?? ''}`) &&
    host(row.sourceUrl) === host(semantics.sourceUrl),
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
let protocolCompliant = 0;
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const proxy = payload.measures?.hotel_1star_proxy ?? {};
  const semantics = payload.measures?.double_occupancy_semantics ?? {};
  const telemetry = payload.telemetry ?? {};
  const accepted = validProxy(proxy, semantics);
  searchesAttempted += Number(telemetry.searchesAttempted ?? 0);
  searchOperations += Number(telemetry.searchOperations ?? telemetry.searchesAttempted ?? 0);
  directReads += Number(telemetry.directReads ?? 0);
  retries += Number(telemetry.retries ?? 0);
  fallbackSources += Number(telemetry.fallbackSources ?? 0);
  arithmeticOperations += Number(telemetry.arithmeticOperations ?? 0);
  currencyConversions += Number(telemetry.currencyConversions ?? 0);
  crossCityEvidence += Number(telemetry.crossCityEvidence ?? 0);
  if (telemetry.protocolCompliant === true) protocolCompliant += 1;
  cities.push({
    city: payload.city ?? file.replace(/\.json$/, ''),
    accepted,
    proxyStatus: proxy.status ?? 'missing',
    semanticsStatus: semantics.status ?? 'missing',
    reason: proxy.reason ?? semantics.reason ?? null,
  });
}
const acceptedCities = cities.filter((city) => city.accepted).map((city) => city.city);
const result = {
  schemaVersion: 'city-cost-v5-budgetyourtrip-snippet-proxy-v1',
  citiesTested: files.length,
  searchesAttempted,
  searchOperations,
  directReads,
  retries,
  fallbackSources,
  arithmeticOperations,
  currencyConversions,
  crossCityEvidence,
  protocolCompliant,
  acceptedProxyCandidates: acceptedCities.length,
  acceptedCities,
  promotionGate: 'proxy candidates>=8, protocol-compliant cities>=10',
  promotionGatePassed: acceptedCities.length >= 8 && protocolCompliant >= 10,
  cities,
  productMapping: 'none_snippet_proxy_screening_only',
};
fs.writeFileSync(path.join(dir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
