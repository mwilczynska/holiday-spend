// Builds R3 hotel references from booking-platform captures (definition fixed 16 October 2026, before the window
// data was collected; see PROGRAM.md section 10b).
//   node build-hotel-refs.mjs --booking <main.raw.json> [...] --trip <trip.raw.json> [...] --windows <windows.raw.json> [...] --out <name>
// For each city:
//   march3 = geometric mean of the available platform 3-star medians for 9-11 March 2027 (Booking.com median;
//            trip.com paid median), each requiring at least 6 kept listings.
//   factor = exp(mean over the six stay windows of ln(Booking.com window median) - ln(Booking.com March median)),
//            requiring at least 4 windows with 6+ kept listings; otherwise the median factor of the city's region
//            (from cities that have one); otherwise 1.
//   hotel_3star_2p = march3 * factor; hotel_1star_2p = Booking.com decent-property p25 (March) * factor.
// Rows record the platform values, spread (|ln trip/booking|), factor and its source, so reference noise is visible.
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, loadPanel, splitOf, mean, quantile } from './lib.mjs';

const args = process.argv.slice(2);
const list = flag => { const out = []; let on = false; for (const a of args) { if (a.startsWith('--')) on = a === flag; else if (on) out.push(a); } return out; };
const outName = list('--out')[0];
if (!outName) throw Error('--out required');
const panel = new Map(loadPanel().map(r => [r.cityKey, r]));
const byKey = files => { const m = new Map(); for (const f of files) for (const x of readJson(f)) if (x.key && !x.error) m.set(x.key, x); return m; };
const booking = byKey(list('--booking')), trip = byKey(list('--trip')), windows = byKey(list('--windows'));
const ok = (v, n) => v > 0 && n >= 6;

const factors = new Map();
for (const [key, w] of windows) {
  const b = booking.get(key)?.classes?.['3star'];
  if (!b || !ok(b.median, b.kept)) continue;
  const logs = (w.windows || []).filter(x => ok(x.median, x.kept)).map(x => Math.log(x.median / b.median));
  if (logs.length >= 4) factors.set(key, { factor: Math.exp(mean(logs)), windows: logs.length });
}
const regionFactor = new Map();
for (const [key, f] of factors) { const r = panel.get(key)?.region; if (r) (regionFactor.get(r) ?? regionFactor.set(r, []).get(r)).push(Math.log(f.factor)); }
const regionMedian = r => regionFactor.has(r) ? Math.exp(quantile(regionFactor.get(r), 0.5)) : null;

const rows = [];
for (const key of new Set([...booking.keys(), ...trip.keys()])) {
  const c = panel.get(key);
  if (!c) continue;
  const b3 = booking.get(key)?.classes?.['3star'], t3 = trip.get(key)?.classes?.['3star'], bd = booking.get(key)?.classes?.decent;
  const parts = [];
  if (b3 && ok(b3.median, b3.kept)) parts.push(['booking', b3.median]);
  if (t3 && ok(t3.paidMedian, t3.kept)) parts.push(['trip', t3.paidMedian]);
  const f = factors.get(key);
  const factor = f ? f.factor : (regionMedian(c.region) ?? 1);
  const factorSource = f ? `city (${f.windows} windows)` : regionMedian(c.region) ? `region median (${c.region})` : 'none';
  const base = { cityKey: key, city: c.city, country: c.country, region: c.region, split: splitOf(key), currency: 'USD', fx: null,
    contributors: null, localValue: null, source: 'booking-platforms', sourceFamily: 'booking-platform-search', observedAt: '2026-10-16',
    stay: 'March 2027 Tue-Thu base, scaled by six Nov 2026-Jul 2027 windows', factor: +factor.toFixed(4), factorSource };
  if (parts.length) {
    const march = Math.exp(mean(parts.map(p => Math.log(p[1]))));
    const spread = parts.length === 2 ? Math.abs(Math.log(parts[0][1] / parts[1][1])) : null;
    rows.push({ ...base, anchor: 'hotel_3star_2p', valueUsd: +(march * factor).toFixed(2), platforms: Object.fromEntries(parts), platformSpread: spread,
      sampleSize: parts.length, grade: parts.length === 2 && spread < 0.3 ? 'A' : 'B',
      notes: `Geometric mean of ${parts.map(p => p[0]).join(' + ')} March 3-star medians (member prices incl. taxes), times year-typical factor.` });
  }
  if (bd && ok(bd.p25, bd.kept)) rows.push({ ...base, anchor: 'hotel_1star_2p', valueUsd: +(bd.p25 * factor).toFixed(2), platforms: { booking: bd.p25 },
    sampleSize: bd.kept, grade: 'B', notes: 'Booking.com 25th-percentile price of decent hotels/guest houses/B&Bs (any class, rated 7+), March, times year-typical factor.' });
}
fs.writeFileSync(path.join(hcRoot, `panel/${outName}.jsonl`), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
console.log(JSON.stringify({ rows: rows.length, cities: new Set(rows.map(r => r.cityKey)).size, cityFactors: factors.size,
  medianFactor: factors.size ? +Math.exp(quantile([...factors.values()].map(f => Math.log(f.factor)), 0.5)).toFixed(3) : null }));
