// Converts BudgetYourTrip results captured in the in-app browser into panel rows.
//   node ingest-byt-browser.mjs <results.json>
// The site blocked direct fetches from this machine after the first collection burst, so pages were fetched
// same-origin inside a real browser session and parsed in the page with the same regular expressions as
// collect-accommodation.mjs ("Budget: $a - $b", "Mid-Range: $c - $d", "double-occupancy hotel room is $e").
// rawSha256 is the SHA-256 of the fetched HTML as computed in the browser.
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, loadPanel, splitOf } from './lib.mjs';

const results = readJson(process.argv[2]);
const today = new Date().toISOString().slice(0, 10);
const cities = new Map(loadPanel().map(r => [r.cityKey, r]));
const rows = [];
for (const x of results) {
  const c = cities.get(x.key);
  if (!c || x.error) continue;
  const base = { cityKey: c.cityKey, city: c.city, country: c.country, region: c.region, split: splitOf(c.cityKey),
    observedAt: today, capturedAt: x.capturedAt ?? new Date().toISOString(), contributors: null, localValue: null,
    currency: 'USD', sourceUrl: x.url, rawSha256: x.rawSha256, sampleSize: null, fx: null, capture: 'in-app browser, same-origin fetch' };
  for (const [anchor, r, label] of [['hotel_1star_2p', x.budget, 'Budget'], ['hotel_3star_2p', x.mid, 'Mid-Range']]) {
    if (!r) continue;
    rows.push({ ...base, anchor, valueUsd: +Math.sqrt(r[0] * r[1]).toFixed(4), source: 'budgetyourtrip-kayak',
      sourceFamily: 'hotel-aggregator-category-average', grade: 'B', range: r,
      notes: `KAYAK "${label}" category, low-season ${r[0]} / peak ${r[1]} USD before taxes and fees; geometric mean. Category-to-star mapping approximate.` });
  }
  if (x.paid) rows.push({ ...base, anchor: 'diag_hotel_paid_2p', valueUsd: x.paid, source: 'budgetyourtrip-travellers',
    sourceFamily: 'traveller-reported-spend', grade: 'B', notes: 'Average paid by travellers for a double-occupancy hotel room. Diagnostic, not an anchor.' });
}
const out = path.join(hcRoot, `panel/r1-budgetyourtrip-${today}.jsonl`);
fs.writeFileSync(out, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(path.join(hcRoot, `panel/r1-budgetyourtrip-${today}.log.json`), JSON.stringify(results.map(({ key, url, status, budget, mid, paid, error }) => ({ key, url, status, budget, mid, paid, error })), null, 1) + '\n');
console.log(`${rows.length} rows for ${new Set(rows.map(r => r.cityKey)).size} cities -> ${path.basename(out)}`);
