#!/usr/bin/env node
/** Deterministic audit for Experiment 037; no scaling or product mapping. */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const dir = path.join(root, 'data', 'reference', 'v5', 'experiments', '037-activity-definition-matched');
const measures = ['activity_budget_ticket', 'activity_mid_half_day', 'activity_high_full_day'];
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && name !== 'results.json' && name !== 'audit.json').sort();
const accepted = []; const rejected = [];
function valid(row) { return Boolean(row?.status === 'found' && typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0 && /^[A-Z]{3}$/.test(row.currency ?? '') && ['per_person', 'one_person', 'two_people', 'two_adults', 'explicit_two_adults', 'group_two_adults'].includes(row.partyBasis) && row.duration && row.activityBasis && row.referencePeriod && row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText && row.searchQuery); }
for (const file of files) { const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); const city = payload.city ?? file.replace(/\.json$/, ''); for (const measure of measures) { const row = payload.measures?.[measure]; if (valid(row)) accepted.push({ city, measure, value: row.value, currency: row.currency, unit: row.unit, partyBasis: row.partyBasis, duration: row.duration, activityBasis: row.activityBasis, referencePeriod: row.referencePeriod, sourceUrl: row.sourceUrl, searchQuery: row.searchQuery }); else rejected.push({ city, measure, status: row?.status ?? 'missing', reason: row?.reason ?? 'strict definition-matched activity contract failed' }); } }
const completeCities = [...new Set(accepted.map((row) => row.city))].filter((city) => new Set(accepted.filter((row) => row.city === city).map((row) => row.measure)).size === measures.length);
console.log(JSON.stringify({ schemaVersion: 'city-cost-v5-activity-definition-matched-audit-v1', citiesTested: files.length, acceptedCells: accepted.length, totalCells: files.length * measures.length, completeCities, accepted, rejected, productMapping: 'none_definition_matched_source_feasibility_only', activitiesFree: { basis: 'definitional', value: 0 } }, null, 2));
