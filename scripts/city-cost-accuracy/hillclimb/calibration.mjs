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
    if (!refs.has(r.cityKey)) refs.set(r.cityKey, { region: r.region, anchors: {} });
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
    for (const [a, logs] of Object.entries(ref.anchors)) if (pc[a]) residuals.push({ city, region: ref.region, anchor: a, r: mean(logs) - mean(pc[a]) });
  }
  cache.set(predictionsFile, residuals);
  return residuals;
}

export function fitFactors(predictionsFile, { exclude = null, shrink = 0, groupBy = null } = {}) {
  const rows = load(path.resolve(hcRoot, predictionsFile)).filter(x => x.city !== exclude);
  const out = {};
  for (const x of rows) {
    const key = groupBy ? `${x.anchor}|${x[groupBy]}` : x.anchor;
    (out[key] ??= []).push(x.r);
  }
  return Object.fromEntries(Object.entries(out).map(([k, rs]) => [k, mean(rs) * rs.length / (rs.length + shrink)]));
}
