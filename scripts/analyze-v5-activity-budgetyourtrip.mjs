#!/usr/bin/env node
/** Deterministic audit for Experiment 035; no two-person scaling or tier fit. */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const dir = path.join(root, 'data', 'reference', 'v5', 'experiments', '035-activity-budgetyourtrip');
const measures = ['activity_average_per_person_day', 'activities_budget_per_person_day', 'activities_mid_per_person_day', 'activities_high_per_person_day'];
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && name !== 'results.json' && name !== 'audit.json').sort();
const accepted = []; const rejected = [];
function valid(row) { return Boolean(row?.status === 'found' && typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0 && /^[A-Z]{3}$/.test(row.currency ?? '') && row.unit === 'per_person_per_day' && ['one_person', 'two_people'].includes(row.partyBasis) && row.scope && row.referencePeriod && row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText && row.searchQuery); }
for (const file of files) { const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); const city = payload.city ?? file.replace(/\.json$/, ''); for (const measure of measures) { const row = payload.measures?.[measure]; if (valid(row)) accepted.push({ city, measure, value: row.value, currency: row.currency, partyBasis: row.partyBasis, scope: row.scope, referencePeriod: row.referencePeriod, sourceUrl: row.sourceUrl, searchQuery: row.searchQuery }); else rejected.push({ city, measure, status: row?.status ?? 'missing', reason: row?.reason ?? 'strict activity contract failed' }); } }
const completeCities = [...new Set(accepted.map((row) => row.city))].filter((city) => new Set(accepted.filter((row) => row.city === city).map((row) => row.measure)).size === measures.length);
console.log(JSON.stringify({ schemaVersion: 'city-cost-v5-activity-budgetyourtrip-audit-v1', citiesTested: files.length, acceptedCells: accepted.length, totalCells: files.length * measures.length, completeCities, accepted, rejected, onePersonRows: accepted.filter((row) => row.partyBasis === 'one_person').length, twoPersonRows: accepted.filter((row) => row.partyBasis === 'two_people').length, productMapping: 'none_source_feasibility_only', activitiesFree: { basis: 'definitional', value: 0 } }, null, 2));
