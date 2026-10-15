// Converts in-browser BudgetYourTrip captures for library expansion cities ("City|Country" keys) into panel rows,
// with the same mapping as ingest-byt-browser.mjs (Budget -> 1-star, Mid-Range -> 3-star, geometric mean, grade B).
//   node ingest-byt-expansion.mjs <results.json> <out-name>
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, normalizeCity, splitOf } from './lib.mjs';

const [file, outName] = process.argv.slice(2);
const regionName = { europe: 'Europe', latin_america: 'Latin America', oceania: 'Oceania', se_asia: 'SEA', north_america: 'North America',
  'north-america': 'North America', east_asia: 'East Asia', middle_east: 'Middle East', south_asia: 'South Asia', africa: 'Africa' };
const lib = new Map(readJson(path.join(hcRoot, 'panel/library-cities.json')).map(c => [`${c.city}|${c.country}`, c]));
const rows = [];
for (const x of readJson(file)) {
  const c = lib.get(x.key);
  if (!c) continue;
  const cityKey = normalizeCity(c.city);
  const base = { cityKey, city: c.city, country: c.country, region: regionName[c.region] ?? c.region, split: splitOf(cityKey),
    observedAt: x.capturedAt.slice(0, 10), capturedAt: x.capturedAt, contributors: null, localValue: null, currency: 'USD',
    sourceUrl: x.url, rawSha256: x.rawSha256, sampleSize: null, fx: null, capture: 'in-app browser, same-origin fetch' };
  for (const [anchor, r, label] of [['hotel_1star_2p', x.budget, 'Budget'], ['hotel_3star_2p', x.mid, 'Mid-Range']]) {
    if (!r) continue;
    rows.push({ ...base, anchor, valueUsd: +Math.sqrt(r[0] * r[1]).toFixed(4), source: 'budgetyourtrip-kayak',
      sourceFamily: 'hotel-aggregator-category-average', grade: 'B', range: r,
      notes: `KAYAK "${label}" category, low-season ${r[0]} / peak ${r[1]} USD before taxes and fees; geometric mean. Category-to-star mapping approximate.` });
  }
  if (x.paid) rows.push({ ...base, anchor: 'diag_hotel_paid_2p', valueUsd: x.paid, source: 'budgetyourtrip-travellers',
    sourceFamily: 'traveller-reported-spend', grade: 'B', notes: 'Average paid by travellers for a double-occupancy hotel room. Diagnostic, not an anchor.' });
}
fs.writeFileSync(path.join(hcRoot, `panel/${outName}.jsonl`), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
console.log(`${rows.length} rows for ${new Set(rows.map(r => r.cityKey)).size} cities`);
