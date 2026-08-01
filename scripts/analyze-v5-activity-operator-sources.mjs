#!/usr/bin/env node
/** Deterministic audit for Experiment 044; no scaling, aggregation, or product mapping. */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'data', 'reference', 'v5', 'experiments', '044-activity-operator-sources');
const measures = ['activities_budget', 'activities_mid_range', 'activities_high_end'];
const files = fs.readdirSync(dir)
  .filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !['results.json', 'audit.json'].includes(name))
  .sort();
function valid(row, measure) {
  const budget = measure === 'activities_budget';
  const mid = measure === 'activities_mid_range';
  const high = measure === 'activities_high_end';
  return Boolean(row?.status === 'found' && typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0 &&
    /^[A-Z]{3}$/.test(row.currency ?? '') && row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText &&
    row.referencePeriod && row.searchQuery && row.taxStatus && row.taxStatus !== 'unknown' &&
    (budget ? row.unit === 'per_person_ticket' && row.basis === 'adult_ticket' && row.partyBasis === 'individual_ticket' :
      row.unit === 'per_person_activity' && row.durationHours >= (mid ? 3 : 6) && row.durationHours <= (mid ? 6 : 12) &&
      (mid ? ['half_day_group', 'half_day'].includes(row.basis) && ['group', 'group_equivalent'].includes(row.partyBasis) :
        ['full_day_premium', 'full_day'].includes(row.basis) && ['individual', 'group', 'group_equivalent'].includes(row.partyBasis))));
}
const cities = []; const accepted = Object.fromEntries(measures.map((m) => [m, []])); const rejected = [];
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const city = payload.city ?? file.replace(/\.json$/, '');
  const counts = {};
  for (const measure of measures) {
    const row = payload.measures?.[measure];
    if (valid(row, measure)) { accepted[measure].push({ city, value: row.value, currency: row.currency, durationHours: row.durationHours ?? null, sourceUrl: row.sourceUrl }); counts[measure] = true; }
    else { counts[measure] = false; rejected.push({ city, measure, status: row?.status ?? 'missing', reason: row?.reason ?? 'strict activity definition contract failed' }); }
  }
  cities.push({ city, accepted: counts });
}
console.log(JSON.stringify({ schemaVersion: 'city-cost-v5-activity-operator-sources-audit-v1', citiesTested: files.length, cities, acceptedCells: Object.fromEntries(measures.map((m) => [m, accepted[m].length])), accepted, rejected, productMapping: 'none_source_feasibility_only' }, null, 2));
