// Builds the v1.2 per-model adjustment layer that sits on top of the production country table.
//   HC_PANEL=references-r4.jsonl node build-model-adjustments.mjs <app-repo> <out.json> --version <version> [--config model-adjustment-lanes.json]
// Method (two-layer analysis, 19 November 2026):
//   shift(lane, anchor) = mean over the lane's dev cities of ln(reference) - ln(answer) - ln(production country factor)
//   model shift          = mean of its lanes' shifts (efforts pooled)
//   pooled               = mean of the measured models' shifts (each model weighted equally; the reference model is 0)
//   measured model       = w * own + (1 - w) * pooled over the other models, w = n / (n + 20), n = distinct cities
//   unmeasured default   = 0.5 * pooled over all measured models
// References: dev split, grades A to C, the R4 panel the production table was built on. Factors are exp(shift).
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, mean, sha256 } from './lib.mjs';
import { createCorrectionContext } from './correction-lib.mjs';

const [appRepo, out, ...rest] = process.argv.slice(2);
const opt = (n, f) => (rest.includes(`--${n}`) ? rest[rest.indexOf(`--${n}`) + 1] : f);
const version = opt('version', null);
if (!appRepo || !out || !version) throw Error('Usage: build-model-adjustments.mjs <app-repo> <out.json> --version <version>');
if ((process.env.HC_PANEL || 'references.jsonl') !== 'references-r4.jsonl') throw Error('Set HC_PANEL=references-r4.jsonl (the panel the production table was built on)');
const K_CALIBRATION = 20, DEFAULT_LAMBDA = 0.5;
const configFile = path.resolve(hcRoot, opt('config', 'model-adjustment-lanes.json'));
const config = readJson(configFile);
const ctx = createCorrectionContext(appRepo);
const { table, corrected, residual, meta } = ctx;

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const iso = new Map();
for (const r of readJson(path.join(appRepo, 'src/lib/data/country-metadata.generated.json'))) for (const n of [r.name, ...(r.aliases || [])]) if (!iso.has(norm(n))) iso.set(norm(n), r.iso2);
const ALIAS = { unitedstatesofamerica: 'US', uae: 'AE', czechia: 'CZ', turkiye: 'TR', northmacedonia: 'MK', curacao: 'CW' };
const isoOf = c => ALIAS[norm(c)] ?? iso.get(norm(c)) ?? null;
// Production country layer, looked up as the app does: country, else region, else global.
const layer = (k, a) => {
  const { country, region } = meta.get(k), code = isoOf(country);
  const f = (code && table.country[a]?.[code]?.factor) ?? table.region[a]?.[region] ?? table.global[a];
  return Math.log(f);
};

function laneShift(lane) {
  const ans = ctx.answers(lane);
  const keys = [...ans.keys()];
  return { keys, shift: Object.fromEntries(corrected.map(a => {
    const rs = keys.map(k => { const r = residual(ans, k, a); return r === null ? null : r - layer(k, a); }).filter(r => r !== null);
    return [a, rs.length ? mean(rs) : 0];
  })) };
}

const models = config.models.map(m => {
  const lanes = m.lanes.map(l => ({ lane: l, ...laneShift(l) }));
  const cities = new Set(lanes.flatMap(l => l.keys));
  if (!cities.size) throw Error(`${m.id}: no answered dev cities in ${m.lanes.join(', ')}`);
  return { ...m, lanes, cities: cities.size, own: Object.fromEntries(corrected.map(a => [a, mean(lanes.map(l => l.shift[a]))])) };
});
const pooledOver = ms => Object.fromEntries(corrected.map(a => [a, mean(ms.map(m => m.own[a]))]));
const round = x => +x.toFixed(4);
const factors = s => Object.fromEntries(corrected.map(a => [a, round(Math.exp(s[a]))]));
const pooledAll = pooledOver(models);

const result = {
  version,
  countryLayer: table.version,
  method: `Two-layer v1.2 correction: country factor (${table.version}) x model factor. Measured model: exp(w x own shift + (1 - w) x pooled shift of the other measured models), w = n / (n + ${K_CALIBRATION}). Unmeasured model: exp(${DEFAULT_LAMBDA} x pooled shift of all measured models). Reference model: 1.`,
  fittedOn: { referencePanel: 'R4', referencePanelSha256: sha256(fs.readFileSync(path.join(hcRoot, 'panel', 'references-r4.jsonl'))),
    split: 'dev', grades: 'A-C', prompt: 'llm_prompt_new_cities_v1_2.md', fittedAt: new Date().toISOString().slice(0, 10) },
  correctedAnchors: corrected,
  reference: { ...config.reference, factors: Object.fromEntries(corrected.map(a => [a, 1])) },
  unmeasuredDefault: { lambda: DEFAULT_LAMBDA, models: models.map(m => m.id), factors: factors(Object.fromEntries(corrected.map(a => [a, DEFAULT_LAMBDA * pooledAll[a]])))},
  models: models.map(m => {
    const others = pooledOver(models.filter(x => x !== m)), w = m.cities / (m.cities + K_CALIBRATION);
    return { id: m.id, label: m.label, match: m.match, cities: m.cities, lanes: m.lanes.map(l => l.lane), weight: round(w),
      factors: factors(Object.fromEntries(corrected.map(a => [a, w * m.own[a] + (1 - w) * others[a]]))) };
  }),
};
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ out, version, default: result.unmeasuredDefault.factors, models: result.models.map(m => ({ id: m.id, cities: m.cities, factors: m.factors })) }, null, 1));
