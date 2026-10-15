// Scores a predictions file against the reference panel.
//   node scripts/city-cost-accuracy/hillclimb/score.mjs <predictions.jsonl> [--group model] [--test] [--grades A,B]
// Predictions rows: { cityKey, run, model, promptVersion, anchors_usd: {...} } (extra fields ignored).
// Repeats of one city are averaged in log space per anchor before scoring, so a city counts once.
// --test reads the sealed test split and appends a line to panel/test-access.jsonl; use only at milestones.
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, panelFile, readJsonl, loadPanel, cityLoss, mean, quantile, BUDGET_WEIGHTS, sha256 } from './lib.mjs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--') && !/^[A-Z,]+$/.test(a) && a !== groupArg());
function groupArg() { const i = args.indexOf('--group'); return i >= 0 ? args[i + 1] : null; }
const groupBy = groupArg();
const split = args.includes('--test') ? 'test' : 'dev';
const gi = args.indexOf('--grades');
const grades = gi >= 0 ? args[gi + 1].split(',') : ['A', 'B', 'C'];
if (!file) throw Error('Usage: score.mjs <predictions.jsonl> [--group field] [--test] [--grades A,B]');

if (split === 'test') fs.appendFileSync(path.join(hcRoot, 'panel/test-access.jsonl'), JSON.stringify({
  at: new Date().toISOString(), predictions: file, predictionsSha256: sha256(fs.readFileSync(file)) }) + '\n');

// Reference value per city/anchor: geometric mean across sources (one source in the seed panel).
const refs = new Map();
for (const r of loadPanel().filter(r => r.split === split && grades.includes(r.grade))) {
  if (!refs.has(r.cityKey)) refs.set(r.cityKey, {});
  (refs.get(r.cityKey)[r.anchor] ??= []).push(Math.log(r.valueUsd));
}
const refValues = new Map([...refs].map(([k, a]) => [k, Object.fromEntries(Object.entries(a).map(([an, ls]) => [an, Math.exp(mean(ls))]))]));

const rows = readJsonl(file);
const groups = new Map();
for (const row of rows) {
  if (!refValues.has(row.cityKey)) continue;
  const g = groupBy ? String(row[groupBy]) : 'all';
  if (!groups.has(g)) groups.set(g, new Map());
  const cities = groups.get(g);
  if (!cities.has(row.cityKey)) cities.set(row.cityKey, []);
  cities.get(row.cityKey).push(row.anchors_usd ?? {});
}

const panelSha256 = sha256(fs.readFileSync(panelFile()));
const report = { predictions: path.basename(file), panel: path.basename(panelFile()), split, grades, panelSha256, referenceCities: refValues.size, groups: {} };
for (const [g, cities] of groups) {
  // Primary: expected single-call loss (production makes one call), i.e. the mean of per-run losses per city.
  // Secondary: loss of the log-pooled repeats, which shows how much a k-call ensemble could gain.
  const cityScores = {}, unweighted = {}, pooledScores = {}, logRatios = {};
  for (const [cityKey, runs] of cities) {
    const ref = refValues.get(cityKey);
    cityScores[cityKey] = mean(runs.map(r => cityLoss(ref, r, BUDGET_WEIGHTS).loss));
    unweighted[cityKey] = mean(runs.map(r => cityLoss(ref, r).loss));
    const pooled = {};
    for (const anchor of Object.keys(ref)) {
      const vals = runs.map(r => r[anchor]).filter(v => Number.isFinite(v) && v > 0);
      if (vals.length) pooled[anchor] = Math.exp(mean(vals.map(Math.log)));
    }
    const weighted = cityLoss(ref, pooled, BUDGET_WEIGHTS);
    pooledScores[cityKey] = weighted.loss;
    for (const [anchor, a] of Object.entries(weighted.perAnchor)) if (a.logRatio !== null) (logRatios[anchor] ??= []).push(a.logRatio);
  }
  const losses = Object.values(cityScores);
  report.groups[g] = { cities: losses.length, runs: [...cities.values()].reduce((n, r) => n + r.length, 0),
    primaryLoss: mean(losses), unweightedLoss: mean(Object.values(unweighted)),
    pooledRepeatLoss: mean(Object.values(pooledScores)),
    medianCityLoss: quantile(losses, 0.5), p90CityLoss: quantile(losses, 0.9),
    perAnchor: Object.fromEntries(Object.entries(logRatios).map(([anchor, xs]) => [anchor, {
      n: xs.length, medianAPE: quantile(xs.map(x => Math.abs(Math.exp(x) - 1)), 0.5),
      meanAbsLog: mean(xs.map(Math.abs)), medianBias: quantile(xs, 0.5) }])),
    cityLosses: cityScores };
}
console.log(JSON.stringify(report, null, 2));
