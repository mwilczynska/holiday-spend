#!/usr/bin/env node
/** Deterministic audit for Experiment 050; no scaling or product mapping. */
import fs from 'node:fs';
import path from 'node:path';
const dir = path.join(process.cwd(), 'data', 'reference', 'v5', 'experiments', '050-tax-resolved-activity-ticket');
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !['results.json', 'audit.json'].includes(name)).sort();
function valid(row) { return Boolean(row?.status === 'found' && typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0 && /^[A-Z]{3}$/.test(row.currency ?? '') && row.unit === 'per_person_ticket' && row.basis === 'adult_ticket' && row.partyBasis === 'individual_ticket' && row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText && row.referencePeriod && row.searchQuery && ['included', 'excluded'].includes(row.taxStatus) && !/\b(?:from|starting|lowest)\b/i.test(row.evidenceText)); }
const accepted = []; const rejected = []; const cities = [];
for (const file of files) { const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); const city = payload.city ?? file.replace(/\.json$/, ''); if (valid(payload.measure)) accepted.push({ city, value: payload.measure.value, currency: payload.measure.currency, sourceUrl: payload.measure.sourceUrl }); else rejected.push({ city, status: payload.measure?.status ?? 'missing', reason: payload.measure?.reason ?? 'strict tax-resolved ticket contract failed' }); cities.push({ city, accepted: valid(payload.measure) }); }
console.log(JSON.stringify({ schemaVersion: 'city-cost-v5-tax-resolved-activity-ticket-audit-v1', citiesTested: files.length, acceptedCities: accepted.length, promotionGate: '4 of 6 strict tickets', promotionGatePassed: accepted.length >= 4, cities, accepted, rejected, productMapping: 'none_source_feasibility_only' }, null, 2));
