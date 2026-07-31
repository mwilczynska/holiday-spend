#!/usr/bin/env node
/**
 * Deterministically audits the accepted direct activity observations used by v5.
 * This is an evidence-count audit, not a model fit and not a source retrieval.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const observationsDir = path.join(root, 'data', 'reference', 'observations');
const measures = [
  'paid_attraction_adult_1',
  'half_day_group_activity_adult_1',
  'full_day_premium_activity_adult_1',
];

const rows = [];
for (const file of fs.readdirSync(observationsDir).filter((name) => name.endsWith('.jsonl'))) {
  const contents = fs.readFileSync(path.join(observationsDir, file), 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    if (row.reviewerStatus === 'accepted' && row.valueStatus === 'direct' && measures.includes(row.measure)) {
      rows.push(row);
    }
  }
}

const byMeasure = Object.fromEntries(measures.map((measure) => {
  const matched = rows.filter((row) => row.measure === measure);
  return [measure, {
    rows: matched.length,
    cities: new Set(matched.map((row) => row.city)).size,
  }];
}));

const cities = new Set(rows.map((row) => row.city));
const completeCities = [...cities].filter((city) => measures.every((measure) =>
  rows.some((row) => row.city === city && row.measure === measure),
));

const result = {
  schemaVersion: 'city-cost-v5-activity-ground-truth-audit-v1',
  source: 'data/reference/observations/*.jsonl',
  acceptedDirectActivityRows: rows.length,
  activityCities: cities.size,
  byMeasure,
  completeCities,
  modelGate: {
    matchedCitiesRequired: 30,
    lockedHoldoutRequired: 10,
    allMeasuresHaveAtLeast30Cities: measures.every((measure) => byMeasure[measure].cities >= 30),
    completeCityCountMeets30: completeCities.length >= 30,
  },
  verdict: 'reject_activity_model_fit',
  note: 'This audit counts accepted direct observations only. activities_free remains definitional zero; search feasibility is documented separately in Experiment 020.',
};

console.log(JSON.stringify(result, null, 2));
