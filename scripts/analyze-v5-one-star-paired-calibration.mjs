#!/usr/bin/env node
/** Deterministic audit for Experiment 041; no calibration or product mapping is performed. */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'data', 'reference', 'v5', 'experiments', '041-one-star-paired-calibration');
const files = fs.readdirSync(dir)
  .filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !['results.json', 'audit.json'].includes(name))
  .sort();
function validStatistic(row) {
  return Boolean(row?.status === 'found' && typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0 &&
    /^[A-Z]{3}$/.test(row.currency ?? '') && row.unit === 'per_room_per_night' && row.class === '1_star' &&
    row.occupancyBasis === 'unknown_source_default' && row.statistic === 'city_average' && row.sourceUrl?.startsWith('http') &&
    row.sourceTitle && row.evidenceText && row.referencePeriod && row.searchQuery &&
    !/\b(?:starting price|lowest (?:price|rate|cost))\b/i.test(row.evidenceText));
}
function validQuote(row) {
  return Boolean(row?.status === 'found' && typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0 &&
    /^[A-Z]{3}$/.test(row.currency ?? '') && row.unit === 'per_room_per_night' && row.class === '1_star' &&
    row.occupancyBasis === 'explicit_two_adults' && row.sourceUrl?.startsWith('http') && row.sourceTitle &&
    row.evidenceText && row.referencePeriod && row.searchQuery &&
    !/\b(?:starting price|lowest (?:price|rate|cost))\b/i.test(row.evidenceText));
}
const rows = []; const paired = []; const rejected = [];
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const statistic = validStatistic(payload.cityStatistic) ? payload.cityStatistic : null;
  const quotes = (payload.explicitQuotes ?? []).filter(validQuote);
  const city = payload.city ?? file.replace(/\.json$/, '');
  rows.push({ city, cityStatistic: statistic, explicitQuoteCount: quotes.length });
  if (statistic && quotes.length) paired.push({ city, cityStatistic: statistic, explicitQuotes: quotes });
  else rejected.push({ city, cityStatisticFound: Boolean(statistic), explicitQuoteCount: quotes.length, reason: 'paired strict contract failed' });
}
console.log(JSON.stringify({ schemaVersion: 'city-cost-v5-one-star-paired-calibration-audit-v1', citiesTested: files.length, cityStatisticCells: rows.filter((row) => row.cityStatistic).length, explicitQuoteCities: rows.filter((row) => row.explicitQuoteCount > 0).length, pairedCities: paired.length, paired, rows, rejected, productMapping: 'none_source_feasibility_only' }, null, 2));
