#!/usr/bin/env node
/** Deterministic audit for Experiment 060; no aggregation or model fitting. */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'data', 'reference', 'v5', 'experiments', '060-expedia-four-star-gap-panel');
const recoveryCities = new Set(['Buenos Aires', 'Budapest', 'Cape Town', 'Sydney', 'Tokyo']);
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && !name.endsWith('-telemetry.json') && !['results.json', 'audit.json'].includes(name)).sort();
function valid(row) {
  return Boolean(row?.status === 'found' && Number.isFinite(row.value) && row.value > 0 && /^[A-Z]{3}$/.test(row.currency ?? '') &&
    row.unit === 'per_room_per_night' && row.occupancyBasis === 'explicit_two_adults_source_trend' && row.class === '4_star' &&
    row.statistic === 'city_class_average' && row.sourceUrl?.startsWith('http') && row.sourceTitle && row.evidenceText &&
    row.referencePeriod && row.searchQuery && (row.taxStatus === 'included' || row.taxStatus === 'excluded') &&
    !/\b(?:from|starting|lowest|per person|nearby|regional|weekend|this weekend|event)\b/i.test(row.evidenceText));
}
const rows = [];
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  rows.push({ city: payload.city ?? file.replace(/\.json$/, ''), accepted: valid(payload.measure), value: valid(payload.measure) ? payload.measure.value : null, currency: valid(payload.measure) ? payload.measure.currency : null, taxStatus: valid(payload.measure) ? payload.measure.taxStatus : null });
}
const accepted = rows.filter((row) => row.accepted);
const recoveries = accepted.filter((row) => recoveryCities.has(row.city));
const promotionGatePassed = accepted.length >= 8 && recoveries.length >= 4;
console.log(JSON.stringify({ schemaVersion: 'city-cost-v5-expedia-four-star-gap-v1', citiesTested: rows.length, acceptedRows: accepted.length, recoveryCities: [...recoveryCities], acceptedRecoveries: recoveries.map((row) => row.city), recoveryCount: recoveries.length, promotionGate: 'overall>=8/12 and recovery>=4/5', promotionGatePassed, rows, productMapping: 'none_coverage_repair_only' }, null, 2));
