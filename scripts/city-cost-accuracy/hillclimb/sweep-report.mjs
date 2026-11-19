// Model/effort sweep report. For each lane iteration, scores the answered tasks against the dev panel on the lane's
// city sample, paired with Luna (102) on the same cities, and summarises completion, time, tokens and searches from
// run.json (claude -p dispatch records).
//   node sweep-report.mjs <app-repo> <lane-iteration>... [--luna 102-search-food-drink-luna-r2]
// Columns: raw loss; loss with the production v1.2 correction table applied unchanged (what a user choosing that model
// gets today; the table was fitted on Luna answers for 475 cities including these, so Luna's row is in-sample);
// paired difference from Luna on the cities both answered (positive = this lane worse).
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, readJsonl, loadPanel, cityLoss, mean, quantile, BUDGET_WEIGHTS, ANCHORS, pairedBootstrap } from './lib.mjs';

const [appRepo, ...rest] = process.argv.slice(2);
const lunaId = rest.includes('--luna') ? rest[rest.indexOf('--luna') + 1] : '102-search-food-drink-luna-r2';
const lanes = rest.filter((a, i) => !a.startsWith('--') && rest[i - 1] !== '--luna');
const table = readJson(path.join(appRepo, 'src/lib/data/city-cost-corrections-v1-2.json'));

const refs = new Map(), meta = new Map();
for (const r of loadPanel().filter(r => r.split === 'dev' && ['A', 'B', 'C'].includes(r.grade))) {
  if (!refs.has(r.cityKey)) refs.set(r.cityKey, {});
  (refs.get(r.cityKey)[r.anchor] ??= []).push(Math.log(r.valueUsd));
  if (!meta.has(r.cityKey)) meta.set(r.cityKey, { country: r.country, region: r.region });
}
const ref = new Map([...refs].map(([k, a]) => [k, Object.fromEntries(Object.entries(a).map(([an, l]) => [an, Math.exp(mean(l))]))]));

const parse = raw => { try { return JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } } };
function answers(iteration) {
  const dir = path.join(hcRoot, 'iterations', iteration), out = new Map(), runs = [];
  for (const t of readJson(path.join(dir, 'freeze.json')).tasks) {
    const td = path.join(dir, 'tasks', t.id), f = path.join(td, 'response.json');
    let status = 'missing', anchors = null;
    if (fs.existsSync(f)) {
      const a = parse(fs.readFileSync(f, 'utf8'))?.anchors_usd;
      status = a && ANCHORS.every(k => Number.isFinite(a[k]) && a[k] > 0) ? 'valid' : 'invalid';
      if (status === 'valid') anchors = Object.fromEntries(ANCHORS.map(k => [k, a[k]]));
    }
    out.set(t.cityKey, { status, anchors });
    const rf = path.join(td, 'run.json');
    if (fs.existsSync(rf)) runs.push({ status, run: readJson(rf) });
  }
  return { out, runs };
}
function corrected(anchors, cityKey) {
  const { country, region } = meta.get(cityKey);
  return Object.fromEntries(Object.entries(anchors).map(([a, v]) => {
    if (!table.correctedAnchors.includes(a)) return [a, v];
    const f = table.country?.[a]?.[country] ?? table.region?.[a]?.[region] ?? table.global?.[a] ?? 1;
    return [a, v * f];
  }));
}
const losses = (m, keys, fix) => Object.fromEntries(keys.map(k => [k, cityLoss(ref.get(k), fix ? corrected(m.get(k).anchors, k) : m.get(k).anchors, BUDGET_WEIGHTS).loss]));
const q = (xs, p) => xs.length ? quantile(xs, p) : null;
const fmt = (x, d = 3) => x === null || x === undefined || Number.isNaN(x) ? '-' : x.toFixed(d);

const luna = answers(lunaId).out;
const rows = [];
for (const lane of lanes) {
  const { out, runs } = answers(lane);
  const cand = readJson(path.join(hcRoot, 'iterations', lane, 'candidate.json'));
  const total = out.size, valid = [...out.values()].filter(v => v.status === 'valid').length;
  const keys = [...out.keys()].filter(k => out.get(k).status === 'valid' && ref.has(k) && luna.get(k)?.status === 'valid');
  const usage = runs.filter(r => r.status === 'valid').map(r => {
    const a = r.run.attempts?.at(-1) ?? {}; const u = Object.values(a.modelUsage ?? {})[0] ?? {};
    return { min: (a.ms ?? NaN) / 60000, out: u.outputTokens ?? NaN, search: (a.toolCalls ?? []).filter(c => c.name === 'WebSearch').length, cost: a.costUsdList ?? Object.values(a.modelUsage ?? {}).reduce((s, x) => s + (x.costUSD ?? 0), 0) };
  });
  const col = f => usage.map(f).filter(Number.isFinite);
  const res = { lane, model: cand.cliModel, effort: cand.effort, answered: `${valid}/${total}`, paired: keys.length };
  if (keys.length >= 2) {
    for (const [name, fix] of [['raw', false], ['prodTable', true]]) {
      const mine = losses(out, keys, fix), base = losses(luna, keys, fix), b = pairedBootstrap(base, mine);
      res[`${name}Loss`] = mean(Object.values(mine)); res[`${name}Luna`] = mean(Object.values(base));
      res[`${name}DiffVsLuna`] = -b.meanImprovement; res[`${name}CI`] = [-b.upper95, -b.lower95];
    }
  }
  Object.assign(res, { minP50: q(col(u => u.min), 0.5), minMax: Math.max(...col(u => u.min)), outP50: q(col(u => u.out), 0.5),
    outP90: q(col(u => u.out), 0.9), outMax: Math.max(...col(u => u.out)), over64k: col(u => u.out).filter(x => x > 64000).length,
    over128k: col(u => u.out).filter(x => x > 128000).length, over600s: col(u => u.min).filter(x => x > 10).length,
    searchP50: q(col(u => u.search), 0.5), searchMax: Math.max(...col(u => u.search)), over6Searches: col(u => u.search).filter(x => x > 6).length,
    listCostPerCity: mean(col(u => u.cost)) });
  rows.push(res);
}
console.log(JSON.stringify(rows, null, 2));
console.error('\nlane | model/effort | answered | raw (Luna) | +vs Luna [95%] | prod table (Luna) | +vs Luna [95%] | min p50/max | out p50/p90/max | >64k/>128k | >600s | searches p50/max (>6) | $/city');
for (const r of rows) console.error([r.lane, `${r.model}/${r.effort}`, r.answered, `${fmt(r.rawLoss)} (${fmt(r.rawLuna)})`,
  `${fmt(r.rawDiffVsLuna)} [${fmt(r.rawCI?.[0])}, ${fmt(r.rawCI?.[1])}]`, `${fmt(r.prodTableLoss)} (${fmt(r.prodTableLuna)})`,
  `${fmt(r.prodTableDiffVsLuna)} [${fmt(r.prodTableCI?.[0])}, ${fmt(r.prodTableCI?.[1])}]`, `${fmt(r.minP50, 1)}/${fmt(r.minMax, 1)}`,
  `${Math.round(r.outP50 ?? 0)}/${Math.round(r.outP90 ?? 0)}/${Math.round(r.outMax)}`, `${r.over64k}/${r.over128k}`, r.over600s,
  `${r.searchP50}/${r.searchMax} (${r.over6Searches})`, fmt(r.listCostPerCity, 3)].join(' | '));
