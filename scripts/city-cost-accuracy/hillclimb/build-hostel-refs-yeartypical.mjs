// Year-typical hostel references (owner request, 19 October 2026).
//   node build-hostel-refs-yeartypical.mjs <out-name>
// Hostelworld references (r1 + r3 files) are city-page "from" prices captured on 15 October 2026 for near-term dates.
// Hostelworld's dated search needs private API credentials, so the seasonal level is taken from the same city's
// Booking.com prices over six stay dates (November 2026 to July 2027, collected for the hotel references):
//   factor = exp(mean ln(window median) - mean ln(November window medians)), with at least 5 usable windows;
//   otherwise the median factor of the city's region; otherwise 1.
// Assumption, recorded on every row: hostel prices move across the year like hotel prices in the same city.
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, readJsonl, mean, quantile } from './lib.mjs';

const outName = process.argv[2];
if (!outName) throw Error('Usage: build-hostel-refs-yeartypical.mjs <out-name>');
const windows = readJson(path.join(hcRoot, 'panel/booking-windows-partial-2026-10-16.raw.json')).filter(x => !x.error);
const ok = w => w.median > 0 && w.kept >= 6;
const cityFactor = new Map();
for (const c of windows) {
  const ws = (c.windows || []).filter(ok);
  const nov = ws.filter(w => w.checkin.startsWith('2026-11'));
  if (ws.length < 5 || !nov.length) continue;
  cityFactor.set(c.key, Math.exp(mean(ws.map(w => Math.log(w.median))) - mean(nov.map(w => Math.log(w.median)))));
}
const sources = ['panel/r1-hostelworld-2026-10-15.jsonl', 'panel/r3-hostelworld-2026-10-15.jsonl'];
const rows = sources.flatMap(f => readJsonl(path.join(hcRoot, f)));
const byRegion = {};
for (const r of rows) if (cityFactor.has(r.cityKey)) (byRegion[r.region] ??= new Set()).add(r.cityKey);
const regionFactor = Object.fromEntries(Object.entries(byRegion).map(([region, keys]) => [region,
  Math.exp(quantile([...keys].map(k => Math.log(cityFactor.get(k))), 0.5))]));

const out = rows.map(r => {
  const own = cityFactor.get(r.cityKey);
  const factor = own ?? regionFactor[r.region] ?? 1;
  const basis = own ? 'city (Booking.com six-window shape)' : regionFactor[r.region] ? `region median (${r.region})` : 'none';
  return { ...r, valueUsd: +(r.valueUsd * factor).toFixed(4), nearTermValueUsd: r.valueUsd, seasonalFactor: +factor.toFixed(4), seasonalBasis: basis,
    notes: `${r.notes} Scaled to a year-typical level by ${factor.toFixed(3)} (${basis}); assumes hostel prices follow the city's hotel seasonality.` };
});
fs.writeFileSync(path.join(hcRoot, `panel/${outName}.jsonl`), out.map(r => JSON.stringify(r)).join('\n') + '\n');
const factors = out.map(r => r.seasonalFactor);
console.log(JSON.stringify({ rows: out.length, cityFactors: cityFactor.size, ownFactorRows: out.filter(r => r.seasonalBasis.startsWith('city')).length,
  medianFactor: +quantile(factors, 0.5).toFixed(3), regionFactor: Object.fromEntries(Object.entries(regionFactor).map(([k, v]) => [k, +v.toFixed(3)])) }));
