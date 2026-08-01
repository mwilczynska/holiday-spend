#!/usr/bin/env node
/** Deterministic evidence-adequacy audit; deliberately fits no model. */
import fs from 'node:fs';
import path from 'node:path';

const observationsDir = path.join(process.cwd(), 'data', 'reference', 'observations');
const rows = [];
for (const file of fs.readdirSync(observationsDir).filter((name) => name.endsWith('.jsonl')).sort()) {
  const lines = fs.readFileSync(path.join(observationsDir, file), 'utf8').split(/\r?\n/).filter(Boolean);
  for (const [lineNumber, line] of lines.entries()) {
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row.reviewerStatus !== 'accepted' || row.valueStatus !== 'direct' || !row.city ||
        !Number.isFinite(row.priceAmount) || row.priceAmount <= 0) continue;
    rows.push({ city: row.city, measure: row.measure, category: row.category, unit: row.unit, file, line: lineNumber + 1 });
  }
}

const citySets = new Map();
for (const row of rows) {
  if (!citySets.has(row.measure)) citySets.set(row.measure, new Set());
  citySets.get(row.measure).add(row.city);
}
const coverage = [...citySets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([measure, cities]) => ({
  measure, cities: cities.size, cityNames: [...cities].sort()
}));
const relations = [
  ['hotel_1star_room_2p <- hotel_3star_room_2p', 'hotel_1star_room_2p', 'hotel_3star_room_2p'],
  ['hotel_2star_room_2p <- hotel_3star_room_2p', 'hotel_2star_room_2p', 'hotel_3star_room_2p'],
  ['hotel_4star_room_2p <- hotel_3star_room_2p', 'hotel_4star_room_2p', 'hotel_3star_room_2p'],
  ['hostel_private_room_2p <- hostel_dorm_bed_1p', 'hostel_private_room_2p', 'hostel_dorm_bed_1p'],
  ['half_day_group_activity_adult_1 <- paid_attraction_adult_1', 'half_day_group_activity_adult_1', 'paid_attraction_adult_1'],
  ['full_day_premium_activity_adult_1 <- paid_attraction_adult_1', 'full_day_premium_activity_adult_1', 'paid_attraction_adult_1']
].map(([name, target, predictor]) => {
  const targetCities = citySets.get(target) ?? new Set();
  const predictorCities = citySets.get(predictor) ?? new Set();
  const matchedCities = [...targetCities].filter((city) => predictorCities.has(city)).sort();
  return { name, target, predictor, matchedCities: matchedCities.length, matchedCityNames: matchedCities,
    requiredMatchedCities: 30, requiredLockedHoldoutCities: 10, eligibleForFit: matchedCities.length >= 30 };
});

console.log(JSON.stringify({
  schemaVersion: 'city-cost-v5-model-fit-adequacy-v1',
  source: 'data/reference/observations/*.jsonl',
  rowsScanned: rows.length,
  directMeasureCoverage: coverage,
  relations,
  anyFitEligible: relations.some((relation) => relation.eligibleForFit),
  modelFitted: false,
  productMapping: 'none',
  verdict: relations.some((relation) => relation.eligibleForFit) ? 'promote_to_preregistered_fit' : 'reject_model_fit_adequacy'
}, null, 2));
