import { countryInRegionOffset } from '../../../../../scripts/city-cost-accuracy/hillclimb/calibration.mjs';
import { readJsonl, loadPanel, mean } from '../../../../../scripts/city-cost-accuracy/hillclimb/lib.mjs';
import path from 'node:path';
import { hcRoot } from '../../../../../scripts/city-cost-accuracy/hillclimb/lib.mjs';
// Bundle 022 plus a pooled-slope, per-region-intercept log-linear correction for the anchors whose raw spread is too
// wide (hostels and 1-star), fitted leave-one-city-out on 102's raw answers.
const P = 'iterations/102-search-food-drink-luna-r2/predictions.jsonl';
const SLOPED = new Set(['hostel_dorm_1p', 'hostel_private_2p', 'hotel_1star_2p']);
const refs = new Map();
for (const r of loadPanel().filter(r => r.split === 'dev')) { const k = `${r.cityKey}|${r.anchor}`; (refs.get(k) ?? refs.set(k, { region: r.region, v: [] }).get(k)).v.push(Math.log(r.valueUsd)); }
const pts = {};
for (const p of readJsonl(path.join(hcRoot, P))) if (p.status === 'valid') for (const a of SLOPED) {
  const r = refs.get(`${p.cityKey}|${a}`); if (r) (pts[a] ??= []).push({ city: p.cityKey, region: r.region, x: Math.log(p.anchors_usd[a]), y: mean(r.v) });
}
function fit(a, exclude, region) {
  const d = pts[a].filter(q => q.city !== exclude);
  const mx = mean(d.map(q => q.x)), my = mean(d.map(q => q.y));
  let sxy = 0, sxx = 0; for (const q of d) { sxy += (q.x - mx) * (q.y - my); sxx += (q.x - mx) ** 2; }
  const b = sxy / sxx, ga = my - b * mx;
  const rr = d.filter(q => q.region === region).map(q => q.y - b * q.x);
  const ia = rr.length ? (rr.length * mean(rr) + 3 * ga) / (rr.length + 3) : ga;
  return { a: ia, b };
}
export default (anchors, ctx) => Object.fromEntries(Object.entries(anchors).map(([a, v]) => {
  if (SLOPED.has(a) && pts[a]) { const f = fit(a, ctx.cityKey, ctx.region); return [a, Math.exp(f.a + f.b * Math.log(v))]; }
  const o = countryInRegionOffset(P, { exclude: ctx.cityKey, anchor: a, country: ctx.country, region: ctx.region, k: 3 });
  return [a, o === null ? v : v * Math.exp(o)];
}));
