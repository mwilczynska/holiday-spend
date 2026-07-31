#!/usr/bin/env node
/** Deterministic audit for Experiment 033; source evidence only. */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const dir = path.join(root, 'data', 'reference', 'v5', 'experiments', '033-one-star-aggregators');
const measures = ['trip_one_star_average', 'hotelscombined_one_star_average', 'budgetyourtrip_one_star_average'];
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && name !== 'results.json' && name !== 'audit.json').sort();
const accepted = []; const rejected = [];
function valid(row) { return Boolean(row?.status === 'found' && typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0 && /^[A-Z]{3}$/.test(row.currency ?? '') && row.unit === 'per_room_per_night' && row.class === '1_star' && row.referencePeriod && row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText && row.searchQuery); }
for (const file of files) { const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); const city = payload.city ?? file.replace(/\.json$/, ''); for (const measure of measures) { const row = payload.measures?.[measure]; if (valid(row)) accepted.push({ city, measure, value: row.value, currency: row.currency, occupancyBasis: row.occupancyBasis, referencePeriod: row.referencePeriod, sourceUrl: row.sourceUrl, searchQuery: row.searchQuery }); else rejected.push({ city, measure, status: row?.status ?? 'missing', reason: row?.reason ?? 'strict aggregator contract failed' }); } }
console.log(JSON.stringify({ schemaVersion: 'city-cost-v5-one-star-aggregator-audit-v1', citiesTested: files.length, acceptedCells: accepted.length, totalCells: files.length * measures.length, accepted, rejected, explicitTwoAdultRows: accepted.filter((row) => row.occupancyBasis === 'explicit_two_adults').length, sourceDefaultOrUnknownRows: accepted.filter((row) => row.occupancyBasis !== 'explicit_two_adults').length, productMapping: 'none_source_feasibility_only' }, null, 2));
