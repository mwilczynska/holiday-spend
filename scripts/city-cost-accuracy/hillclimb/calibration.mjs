// Leave-one-city-out multiplicative calibration, shared by calibration transforms.
// fitFactors(predictionsFile, { exclude, shrink, groupBy }) returns per-anchor (optionally per-group) log offsets
// fitted on dev panel cities other than `exclude`. Offsets are the mean log(reference / prediction) of each city's
// log-pooled repeats, shrunk towards zero by n / (n + shrink) so thin cells move little.
import path from 'node:path';
import { hcRoot, readJsonl, loadPanel, mean } from './lib.mjs';

const cache = new Map();
function load(predictionsFile) {
  if (cache.has(predictionsFile)) return cache.get(predictionsFile);
  const refs = new Map();
  for (const r of loadPanel().filter(r => r.split === 'dev')) {
    if (!refs.has(r.cityKey)) refs.set(r.cityKey, { region: r.region, country: r.country, anchors: {} });
    (refs.get(r.cityKey).anchors[r.anchor] ??= []).push(Math.log(r.valueUsd));
  }
  const preds = new Map();
  for (const p of readJsonl(predictionsFile)) {
    if (p.status && p.status !== 'valid') continue;
    if (!preds.has(p.cityKey)) preds.set(p.cityKey, {});
    for (const [a, v] of Object.entries(p.anchors_usd)) (preds.get(p.cityKey)[a] ??= []).push(Math.log(v));
  }
  // residual[city][anchor] = mean log ref - mean log prediction
  const residuals = [];
  for (const [city, ref] of refs) {
    const pc = preds.get(city);
    if (!pc) continue;
    for (const [a, logs] of Object.entries(ref.anchors)) if (pc[a]) residuals.push({ city, region: ref.region, country: ref.country, anchor: a, r: mean(logs) - mean(pc[a]) });
  }
  cache.set(predictionsFile, residuals);
  return residuals;
}

// hierarchical: with groupBy, shrink each group's offset towards the anchor's global offset with weight
// n / (n + hierarchical), and fall back to the global offset for groups with no other cities.
export function fitFactors(predictionsFile, { exclude = null, shrink = 0, groupBy = null, hierarchical = null } = {}) {
  const rows = load(path.resolve(hcRoot, predictionsFile)).filter(x => x.city !== exclude);
  const out = {}, global = {};
  for (const x of rows) {
    const key = groupBy ? `${x.anchor}|${x[groupBy]}` : x.anchor;
    (out[key] ??= []).push(x.r);
    (global[x.anchor] ??= []).push(x.r);
  }
  if (groupBy && hierarchical !== null) {
    const g = Object.fromEntries(Object.entries(global).map(([a, rs]) => [a, mean(rs)]));
    return new Proxy(Object.fromEntries(Object.entries(out).map(([k, rs]) => {
      const w = rs.length / (rs.length + hierarchical);
      return [k, w * mean(rs) + (1 - w) * g[k.split('|')[0]]];
    })), { get: (t, k) => (k in t ? t[k] : typeof k === 'string' ? g[k.split('|')[0]] : undefined) });
  }
  return Object.fromEntries(Object.entries(out).map(([k, rs]) => [k, mean(rs) * rs.length / (rs.length + shrink)]));
}

// Two-level factors: country offsets shrunk towards their region's offset with weight n / (n + k), where the region
// offset is the plain per-region mean; a country with no other dev city takes its region's offset, and a region with
// none takes the global anchor offset. Leave-one-city-out like fitFactors.
export function countryInRegionOffset(predictionsFile, { exclude, anchor, country, region, k = 3 }) {
  const rows = load(path.resolve(hcRoot, predictionsFile)).filter(x => x.city !== exclude && x.anchor === anchor);
  if (!rows.length) return null;
  const g = mean(rows.map(x => x.r));
  const rr = rows.filter(x => x.region === region).map(x => x.r);
  const reg = rr.length ? mean(rr) : g;
  const cr = rows.filter(x => x.country === country).map(x => x.r);
  if (!cr.length) return reg;
  const w = cr.length / (cr.length + k);
  return w * mean(cr) + (1 - w) * reg;
}
