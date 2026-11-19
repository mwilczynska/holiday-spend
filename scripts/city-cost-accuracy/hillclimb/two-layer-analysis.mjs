// Two-layer correction: a shared country layer (Luna's country-in-region table) plus a per-model shift of one log
// offset per corrected anchor. Answers four questions from existing lanes, all scored against Luna's own
// country-in-region fit on the same cities (the shared layer is always fitted on Luna's dev cities other than the
// scored city, so it is never in-sample).
//   node two-layer-analysis.mjs <app-repo> [--luna 102-search-food-drink-luna-r2] [--calibration 40] [--seed sweep-2026-11-19]
// A. Today: Luna's layer with no shift (what every non-Luna model gets now).
// B. Pooled default for an unmeasured model: the mean shift of the other model families' lanes (each family weighted
//    equally), leave-one-model-out, so the scored model contributed nothing.
// C. Calibrated: the lane's own shift fitted on the first --calibration cities of the hash order and scored on the
//    lane's other cities (out of sample). Lanes with no cities beyond the calibration set use leave-one-city-out.
// D. Model-level shift: one shift per model pooled over all its efforts (leave-one-city-out), against the lane's own
//    effort-specific shift (leave-one-city-out), to show whether effort needs its own entry.
import { sha256, mean, pairedBootstrap } from './lib.mjs';
import { createCorrectionContext } from './correction-lib.mjs';

const [appRepo, ...rest] = process.argv.slice(2);
const opt = (n, f) => (rest.includes(`--${n}`) ? rest[rest.indexOf(`--${n}`) + 1] : f);
const lunaId = opt('luna', '102-search-food-drink-luna-r2');
const calibrationN = Number(opt('calibration', 40));
const seed = opt('seed', 'sweep-2026-11-19');
const ctx = createCorrectionContext(appRepo);
const { corrected, residual, fitCountryInRegion, loss } = ctx;

const LANES = [
  ['haiku', 'low', '130-s80-haiku-low'], ['haiku', 'medium', '131-s80-haiku-medium'], ['haiku', 'high', '132-s80-haiku-high'],
  ['haiku', 'xhigh', '133-s80-haiku-xhigh'], ['haiku', 'max', '142-s80-haiku-max'],
  ['sonnet', 'low', '134-s80-sonnet-low'], ['sonnet', 'medium', '135-s80-sonnet-medium'], ['sonnet', 'high', '136-s80-sonnet-high'],
  ['sonnet', 'xhigh', '137-s80-sonnet-xhigh'], ['sonnet', 'max', '138-s80-sonnet-max'],
  ['opus', 'low', '139-s80-opus-low'], ['opus', 'medium', '140-s80-opus-medium'], ['opus', 'high', '141-s80-opus-high'],
  ['sol', 'max', opt('sol', '121-sweep-sol-max')], ['terra', 'max', opt('terra', '122-sweep-terra-max')],
].map(([model, effort, lane]) => ({ model, effort, lane, ans: ctx.answers(lane) }));

const luna = ctx.answers(lunaId), lunaKeys = [...luna.keys()];
const lunaLayerCache = new Map();
const lunaLayer = k => { if (!lunaLayerCache.has(k)) lunaLayerCache.set(k, fitCountryInRegion(luna, lunaKeys.filter(x => x !== k))); return lunaLayerCache.get(k); };
const order = keys => [...keys].sort((a, b) => sha256(`${seed}|${a}`).localeCompare(sha256(`${seed}|${b}`)));

// Shift: mean over cities of (residual - Luna layer), per corrected anchor; the Luna layer for city j excludes j.
function shift(ans, cities) {
  return Object.fromEntries(corrected.map(a => {
    const rs = cities.map(j => { const r = residual(ans, j, a); return r === null ? null : r - lunaLayer(j)(j, a); }).filter(r => r !== null);
    return [a, rs.length ? mean(rs) : 0];
  }));
}
const scored = (ans, k, s) => loss(ans, k, (c, a) => lunaLayer(k)(c, a) + (s[a] ?? 0));
const keysOf = l => [...l.ans.keys()].filter(k => luna.has(k));

// Per-lane full shifts (all cities) for pooling.
for (const l of LANES) l.fullShift = shift(l.ans, keysOf(l));
function pooledExcluding(model) {
  const fams = [...new Set(LANES.filter(l => l.model !== model).map(l => l.model))];
  const famShift = fams.map(m => { const ls = LANES.filter(l => l.model === m); return Object.fromEntries(corrected.map(a => [a, mean(ls.map(l => l.fullShift[a]))])); });
  return Object.fromEntries(corrected.map(a => [a, mean(famShift.map(s => s[a]))]));
}

const f3 = x => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(3);
const rows = [];
console.log(`Scored against Luna with its own country layer on the same cities. Calibration: first ${calibrationN} cities by hash order (seed ${seed}).`);
console.log('lane | cities scored | raw | A today (Luna layer) | B pooled default | C calibrated (out of sample) | D model-level shift | Luna | B vs A [95%] | C vs Luna [95%]');
for (const l of LANES) {
  const keys = keysOf(l);
  const ordered = order(keys), cal = ordered.slice(0, calibrationN), test = ordered.slice(calibrationN);
  const outOfSample = test.length >= 10;
  const evalKeys = outOfSample ? test : keys;
  const calShift = outOfSample ? shift(l.ans, cal) : null;
  const pooled = pooledExcluding(l.model);
  const sameModel = LANES.filter(x => x.model === l.model);
  const per = { raw: {}, A: {}, B: {}, C: {}, D: {}, luna: {} };
  for (const k of evalKeys) {
    per.raw[k] = loss(l.ans, k, () => 0);
    per.A[k] = scored(l.ans, k, {});
    per.B[k] = scored(l.ans, k, pooled);
    per.C[k] = scored(l.ans, k, outOfSample ? calShift : shift(l.ans, keys.filter(x => x !== k)));
    const modelShift = Object.fromEntries(corrected.map(a => [a, mean(sameModel.map(x => shift(x.ans, keysOf(x).filter(c => c !== k))[a]))]));
    per.D[k] = scored(l.ans, k, modelShift);
    per.luna[k] = loss(luna, k, lunaLayer(k));
  }
  const m = o => mean(Object.values(o));
  const bA = pairedBootstrap(per.A, per.B), cL = pairedBootstrap(per.luna, per.C);
  const row = { lane: l.lane, model: l.model, effort: l.effort, cities: evalKeys.length, outOfSample, raw: m(per.raw), today: m(per.A), pooled: m(per.B),
    calibrated: m(per.C), modelLevel: m(per.D), luna: m(per.luna), pooledVsToday: [-bA.meanImprovement, -bA.upper95, -bA.lower95],
    calibratedVsLuna: [-cL.meanImprovement, -cL.upper95, -cL.lower95], calibrationShift: outOfSample ? calShift : l.fullShift, pooledShift: pooled };
  rows.push(row);
  console.log([l.lane, `${evalKeys.length}${outOfSample ? '' : ' (LOO)'}`, row.raw.toFixed(3), row.today.toFixed(3), row.pooled.toFixed(3), row.calibrated.toFixed(3),
    row.modelLevel.toFixed(3), row.luna.toFixed(3), `${f3(row.pooledVsToday[0])} [${f3(row.pooledVsToday[1])}, ${f3(row.pooledVsToday[2])}]`,
    `${f3(row.calibratedVsLuna[0])} [${f3(row.calibratedVsLuna[1])}, ${f3(row.calibratedVsLuna[2])}]`].join(' | '));
}
const avg = k => mean(rows.map(r => r[k]));
console.log(`mean over lanes: raw ${avg('raw').toFixed(3)}, today ${avg('today').toFixed(3)}, pooled ${avg('pooled').toFixed(3)}, calibrated ${avg('calibrated').toFixed(3)}, model-level ${avg('modelLevel').toFixed(3)}, Luna ${avg('luna').toFixed(3)}`);
console.log('pooled beats today in', rows.filter(r => r.pooled < r.today).length, 'of', rows.length, 'lanes');
console.error(JSON.stringify(rows));

// E. Scaled default: lambda x pooled shift for an unmeasured model (lambda 0 = today, 1 = full pooled).
// F. Shrunk calibration: the 40-city own shift blended towards the pooled default with weight n / (n + k).
console.log('\nE. Unmeasured-model default lambda x pooled (leave-one-model-out): mean loss over lanes | worst lane change vs today');
const evalSets = LANES.map(l => { const keys = keysOf(l), ord = order(keys), test = ord.slice(calibrationN);
  return { l, oos: test.length >= 10, evalKeys: test.length >= 10 ? test : keys, cal: ord.slice(0, calibrationN), keys, pooled: pooledExcluding(l.model) }; });
for (const lambda of [0, 0.25, 0.5, 0.75, 1]) {
  const per = evalSets.map(e => mean(e.evalKeys.map(k => scored(e.l.ans, k, Object.fromEntries(corrected.map(a => [a, lambda * e.pooled[a]]))))));
  const today = evalSets.map(e => mean(e.evalKeys.map(k => scored(e.l.ans, k, {}))));
  const worst = Math.max(...per.map((p, i) => p - today[i]));
  const fams = [...new Set(LANES.map(l => l.model))].map(m => mean(per.filter((_, i) => evalSets[i].l.model === m)));
  console.log(`lambda ${lambda}: mean ${mean(per).toFixed(4)}, per-model-mean ${mean(fams).toFixed(4)}, worst lane ${f3(worst)}`);
}
console.log('\nF. Calibrated shift = w x own 40-city shift + (1 - w) x pooled, w = n / (n + k): mean loss over out-of-sample lanes');
const oos = evalSets.filter(e => e.oos);
const calShifts = oos.map(e => shift(e.l.ans, e.cal));
for (const k of [0, 10, 20, 40, 80, Infinity]) {
  const per = oos.map((e, i) => { const n = e.cal.length, w = k === Infinity ? 0 : n / (n + k);
    const s = Object.fromEntries(corrected.map(a => [a, w * calShifts[i][a] + (1 - w) * e.pooled[a]]));
    return mean(e.evalKeys.map(c => scored(e.l.ans, c, s))); });
  console.log(`k ${k}: mean ${mean(per).toFixed(4)} | ${oos.map((e, i) => `${e.l.model}-${e.l.effort} ${per[i].toFixed(3)}`).join(', ')}`);
}
