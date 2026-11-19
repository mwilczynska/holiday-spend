// Scores lanes under the production two-layer correction: the country table alone (what non-Luna models got before
// the model layer), the unmeasured-model default, and the lane's own model factor, each paired with the country table
// alone by city (95% paired bootstrap).
//   HC_PANEL=references-r4.jsonl node score-adjustments.mjs <app-repo> <adjustments.json> <lane>... [--test]
// --test scores the sealed held-out split and appends one line per lane to panel/test-access.jsonl. The production
// country table was fitted on held-out Luna answers too, so on --test it is in-sample for every arm alike; the model
// factors were fitted on development cities only, so the comparison measures the model layer out of sample.
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, mean, sha256, pairedBootstrap } from './lib.mjs';
import { createCorrectionContext } from './correction-lib.mjs';

const args = process.argv.slice(2);
const test = args.includes('--test');
const [appRepo, adjFile, ...lanes] = args.filter(a => a !== '--test');
const ctx = createCorrectionContext(appRepo, { split: test ? 'test' : 'dev' });
const { table, corrected, meta, loss } = ctx;
const adj = readJson(adjFile);
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const iso = new Map();
for (const r of readJson(path.join(appRepo, 'src/lib/data/country-metadata.generated.json'))) for (const n of [r.name, ...(r.aliases || [])]) if (!iso.has(norm(n))) iso.set(norm(n), r.iso2);
const ALIAS = { unitedstatesofamerica: 'US', uae: 'AE', czechia: 'CZ', turkiye: 'TR', northmacedonia: 'MK', curacao: 'CW' };
const layer = (k, a) => { const { country, region } = meta.get(k), code = ALIAS[norm(country)] ?? iso.get(norm(country));
  return Math.log((code && table.country[a]?.[code]?.factor) ?? table.region[a]?.[region] ?? table.global[a]); };
const withFactors = factors => (k, a) => layer(k, a) + Math.log(factors?.[a] ?? 1);
const f3 = x => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(3);

console.log(`${test ? 'HELD-OUT' : 'dev'} cities, adjustments ${adj.version} on country layer ${adj.countryLayer}`);
console.log('lane | model entry | cities | country table only | + default | + model factor | model vs table only [95%]');
const out = [];
for (const lane of lanes) {
  const cand = readJson(path.join(hcRoot, 'iterations', lane, 'candidate.json'));
  const ans = ctx.answers(lane), keys = [...ans.keys()];
  const key = String(cand.cliModel ?? '').toLowerCase();
  const entry = new RegExp(adj.reference.match).test(key) ? adj.reference : adj.models.find(m => new RegExp(m.match).test(key));
  const per = { table: {}, def: {}, model: {} };
  for (const k of keys) {
    per.table[k] = loss(ans, k, withFactors(null));
    per.def[k] = loss(ans, k, withFactors(adj.unmeasuredDefault.factors));
    per.model[k] = loss(ans, k, withFactors(entry?.factors ?? adj.unmeasuredDefault.factors));
  }
  const b = pairedBootstrap(per.table, per.model);
  const row = { lane, entry: entry?.id ?? 'default', cities: keys.length, table: mean(Object.values(per.table)), def: mean(Object.values(per.def)),
    model: mean(Object.values(per.model)), diff: [-b.meanImprovement, -b.upper95, -b.lower95] };
  out.push(row);
  console.log([lane, row.entry, row.cities, row.table.toFixed(3), row.def.toFixed(3), row.model.toFixed(3), `${f3(row.diff[0])} [${f3(row.diff[1])}, ${f3(row.diff[2])}]`].join(' | '));
  if (test) fs.appendFileSync(path.join(hcRoot, 'panel/test-access.jsonl'), JSON.stringify({ at: new Date().toISOString(), purpose: 'two-layer model adjustment confirmation',
    lane, adjustments: adj.version, adjustmentsSha256: sha256(fs.readFileSync(adjFile)) }) + '\n');
}
console.error(JSON.stringify(out));
