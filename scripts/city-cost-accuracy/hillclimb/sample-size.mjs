// How many cities does a model/effort comparison need? Two questions, answered from data already collected.
//   node sample-size.mjs <app-repo> <lane-iteration>... [--luna 102-search-food-drink-luna-r2] [--reps 300]
// 1. Paired noise. For each lane, scores every answered city with the lane's own per-anchor correction fitted
//    leave-one-city-out on the lane's other cities (the sweep's "own fit"), pairs it with Luna on the same cities, and
//    reports the standard deviation of the per-city difference and the number of cities a paired test needs to detect
//    a given mean difference (two-sided 5%, 80% power: n = ((1.960 + 0.842) * sd / delta)^2).
// 2. Correction learning curve. On Luna's full dev lane, fits a correction on n random cities and scores the cities
//    left out, for the per-anchor (global) form and the production country-in-region form (k = 3). Shows how many
//    cities a model-specific table needs before it approaches the table fitted on every city.
// Corrected anchors are the production table's correctedAnchors; cocktail and wine stay uncorrected.
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, loadPanel, cityLoss, mean, quantile, BUDGET_WEIGHTS, ANCHORS } from './lib.mjs';

const [appRepo, ...rest] = process.argv.slice(2);
const opt = (n, f) => (rest.includes(`--${n}`) ? rest[rest.indexOf(`--${n}`) + 1] : f);
const lunaId = opt('luna', '102-search-food-drink-luna-r2');
const reps = Number(opt('reps', 300));
const lanes = rest.filter((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--'));
const corrected = readJson(path.join(appRepo, 'src/lib/data/city-cost-corrections-v1-2.json')).correctedAnchors;

const refs = new Map(), meta = new Map();
for (const r of loadPanel().filter(r => r.split === 'dev' && ['A', 'B', 'C'].includes(r.grade))) {
  if (!refs.has(r.cityKey)) refs.set(r.cityKey, {});
  (refs.get(r.cityKey)[r.anchor] ??= []).push(Math.log(r.valueUsd));
  if (!meta.has(r.cityKey)) meta.set(r.cityKey, { country: r.country, region: r.region });
}
const ref = new Map([...refs].map(([k, a]) => [k, Object.fromEntries(Object.entries(a).map(([an, l]) => [an, Math.exp(mean(l))]))]));

const parse = raw => { try { return JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } } };
function answers(iteration) {
  const dir = path.join(hcRoot, 'iterations', iteration), out = new Map();
  for (const t of readJson(path.join(dir, 'freeze.json')).tasks) {
    if (t.repeat !== 1 || !ref.has(t.cityKey)) continue;
    const f = path.join(dir, 'tasks', t.id, 'response.json');
    if (!fs.existsSync(f)) continue;
    const a = parse(fs.readFileSync(f, 'utf8'))?.anchors_usd;
    if (a && ANCHORS.every(k => Number.isFinite(a[k]) && a[k] > 0)) out.set(t.cityKey, Object.fromEntries(ANCHORS.map(k => [k, a[k]])));
  }
  return out;
}
// residual = log reference - log prediction, per city and corrected anchor
const residual = (ans, k, a) => (ref.get(k)[a] && ans.get(k)[a] ? Math.log(ref.get(k)[a] / ans.get(k)[a]) : null);
function fit(ans, train, form) {
  const g = {}, reg = {}, cty = {};
  for (const k of train) for (const a of corrected) {
    const r = residual(ans, k, a); if (r === null) continue;
    const { region, country } = meta.get(k);
    (g[a] ??= []).push(r); ((reg[a] ??= {})[region] ??= []).push(r); ((cty[a] ??= {})[country] ??= []).push(r);
  }
  return (k, a) => {
    if (!g[a]) return 0;
    const gm = mean(g[a]);
    if (form === 'global') return gm;
    const { region, country } = meta.get(k);
    const rm = reg[a][region] ? mean(reg[a][region]) : gm, cr = cty[a][country];
    if (!cr) return rm;
    const w = cr.length / (cr.length + 3);
    return w * mean(cr) + (1 - w) * rm;
  };
}
const lossWith = (ans, k, off) => cityLoss(ref.get(k), Object.fromEntries(ANCHORS.map(a => [a, corrected.includes(a) ? ans.get(k)[a] * Math.exp(off(k, a)) : ans.get(k)[a]])), BUDGET_WEIGHTS).loss;
const looLosses = (ans, keys, form = 'global') => Object.fromEntries(keys.map(k => [k, lossWith(ans, k, fit(ans, keys.filter(x => x !== k), form))]));
const sd = xs => { const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); };
const nFor = (s, delta) => Math.ceil(((1.96 + 0.8416) * s / delta) ** 2);
const f3 = x => x.toFixed(3);

const luna = answers(lunaId);
console.log('1. Paired noise against Luna, own per-anchor correction fitted leave-one-city-out on the lane\'s cities');
console.log('lane | cities | own-fit loss (Luna) | mean diff | sd of diff | cities for 80% power at diff 0.015 / 0.03 / 0.05');
const allSd = [];
for (const lane of lanes) {
  const ans = answers(lane), keys = [...ans.keys()].filter(k => luna.has(k));
  if (keys.length < 5) { console.log(`${lane} | ${keys.length} | too few`); continue; }
  const mine = looLosses(ans, keys), base = looLosses(luna, keys), d = keys.map(k => mine[k] - base[k]), s = sd(d);
  allSd.push(s);
  console.log([lane, keys.length, `${f3(mean(Object.values(mine)))} (${f3(mean(Object.values(base)))})`, f3(mean(d)), f3(s),
    [0.015, 0.03, 0.05].map(x => nFor(s, x)).join(' / ')].join(' | '));
}
if (allSd.length) console.log(`median sd of paired difference ${f3(quantile(allSd, 0.5))}`);

// Learning curve on Luna's full dev lane.
const all = [...luna.keys()];
let state = 19112026;
const rand = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
const shuffle = xs => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const none = mean(all.map(k => lossWith(luna, k, () => 0)));
console.log(`\n2. Correction learning curve on ${lunaId} (${all.length} dev cities, ${reps} random draws per size)`);
console.log(`no correction ${f3(none)}; leave-one-out on all cities: per-anchor ${f3(mean(Object.values(looLosses(luna, all, 'global'))))}, country-in-region ${f3(mean(Object.values(looLosses(luna, all, 'cir'))))}`);
console.log('fit cities | held-out loss per-anchor (p10-p90) | country-in-region (p10-p90)');
for (const n of [10, 20, 40, 60, 80, 120, 160, 240].filter(n => n < all.length - 20)) {
  const res = { global: [], cir: [] };
  for (let r = 0; r < reps; r++) {
    const s = shuffle(all), train = s.slice(0, n), test = s.slice(n);
    for (const form of ['global', 'cir']) { const off = fit(luna, train, form); res[form].push(mean(test.map(k => lossWith(luna, k, off)))); }
  }
  const show = xs => `${f3(mean(xs))} (${f3(quantile(xs, 0.1))}-${f3(quantile(xs, 0.9))})`;
  console.log(`${n} | ${show(res.global)} | ${show(res.cir)}`);
}

// 3. Transfer: Luna's country-in-region table (fitted on Luna's dev cities other than the scored city) plus the lane's
//    own per-anchor shift relative to it, fitted leave-one-city-out on the lane's other cities. If this approaches the
//    country-level table, a new model needs only a small sample to get a model-specific correction.
const lunaCir = new Map();
const lunaOff = k => { if (!lunaCir.has(k)) lunaCir.set(k, fit(luna, all.filter(x => x !== k), 'cir')); return lunaCir.get(k); };
function transferLosses(ans, keys) {
  return Object.fromEntries(keys.map(k => {
    const train = keys.filter(x => x !== k), shift = {};
    for (const a of corrected) {
      const rs = train.map(j => { const r = residual(ans, j, a); return r === null ? null : r - lunaOff(j)(j, a); }).filter(r => r !== null);
      shift[a] = rs.length ? mean(rs) : 0;
    }
    return [k, lossWith(ans, k, (c, a) => lunaOff(k)(c, a) + shift[a])];
  }));
}
console.log('\n3. Luna country table plus the lane\'s own per-anchor shift (leave-one-city-out), against Luna with its own table');
console.log('lane | cities | transfer loss | own per-anchor loss | Luna with Luna table | diff vs Luna (sd)');
for (const lane of lanes) {
  const ans = answers(lane), keys = [...ans.keys()].filter(k => luna.has(k));
  if (keys.length < 5) continue;
  const t = transferLosses(ans, keys), o = looLosses(ans, keys), l = Object.fromEntries(keys.map(k => [k, lossWith(luna, k, lunaOff(k))]));
  const d = keys.map(k => t[k] - l[k]);
  console.log([lane, keys.length, f3(mean(Object.values(t))), f3(mean(Object.values(o))), f3(mean(Object.values(l))), `${f3(mean(d))} (${f3(sd(d))})`].join(' | '));
}
