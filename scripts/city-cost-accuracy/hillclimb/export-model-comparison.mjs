// Exports the model comparison shown on the app's Methodology page (src/lib/data/model-comparison-v1-2.json).
//   HC_PANEL=references-r4.jsonl node export-model-comparison.mjs <app-repo> <costs.json> <out.json>
// Accuracy: each lane's dev cities scored with the app's correction for that model (production country table times the
// model factor from city-cost-model-adjustments-v1-2.json), paired by city with GPT-6 Luna's answers (lane 102) under
// the country table alone; 95% paired bootstrap. Measured models' own factors were fitted on these cities with
// shrinkage towards the other models, so their figures are mildly optimistic; held-out confirmation is in the write-up.
// Cost and time: from lane-costs.mjs (estimated app request cost at list prices; test-run wall time).
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, pairedBootstrap, mean } from './lib.mjs';
import { createCorrectionContext } from './correction-lib.mjs';

const [appRepo, costsFile, out] = process.argv.slice(2);
if ((process.env.HC_PANEL || '') !== 'references-r4.jsonl') throw Error('Set HC_PANEL=references-r4.jsonl');
const ctx = createCorrectionContext(appRepo);
const { table, meta, loss } = ctx;
const adj = readJson(path.join(appRepo, 'src/lib/data/city-cost-model-adjustments-v1-2.json'));
const costs = new Map(readJson(costsFile).map(r => [r.lane, r]));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const iso = new Map();
for (const r of readJson(path.join(appRepo, 'src/lib/data/country-metadata.generated.json'))) for (const n of [r.name, ...(r.aliases || [])]) if (!iso.has(norm(n))) iso.set(norm(n), r.iso2);
const ALIAS = { unitedstatesofamerica: 'US', uae: 'AE', czechia: 'CZ', turkiye: 'TR', northmacedonia: 'MK', curacao: 'CW' };
const layer = (k, a) => { const { country, region } = meta.get(k), code = ALIAS[norm(country)] ?? iso.get(norm(country));
  return Math.log((code && table.country[a]?.[code]?.factor) ?? table.region[a]?.[region] ?? table.global[a]); };

const LANES = [
  ['130-s80-haiku-low', 'haiku', 'Haiku', 'Haiku'], ['131-s80-haiku-medium', 'haiku', 'Haiku', 'Haiku'], ['132-s80-haiku-high', 'haiku', 'Haiku', 'Haiku'],
  ['133-s80-haiku-xhigh', 'haiku', 'Haiku', 'Haiku'], ['142-s80-haiku-max', 'haiku', 'Haiku', 'Haiku'],
  ['134-s80-sonnet-low', 'sonnet', 'Sonnet', 'Sonnet'], ['135-s80-sonnet-medium', 'sonnet', 'Sonnet', 'Sonnet'], ['136-s80-sonnet-high', 'sonnet', 'Sonnet', 'Sonnet'],
  ['137-s80-sonnet-xhigh', 'sonnet', 'Sonnet', 'Sonnet'], ['138-s80-sonnet-max', 'sonnet', 'Sonnet', 'Sonnet'],
  ['139-s80-opus-low', 'opus', 'Opus', 'Opus'], ['140-s80-opus-medium', 'opus', 'Opus', 'Opus'], ['141-s80-opus-high', 'opus', 'Opus', 'Opus'],
  ['126-s80-luna-max-exec', 'gpt', 'GPT-6 Luna rerun', 'Luna rerun'], ['128-s80-terra-max', 'gpt', 'GPT-6.1 Terra', 'Terra'], ['127-s80-sol-max', 'gpt', 'GPT-6.2 Sol', 'Sol'],
];
const luna = ctx.answers('102-search-food-drink-luna-r2');
const r3 = x => Math.round(x * 1000) / 1000, r2 = x => Math.round(x * 100) / 100;
const rows = LANES.map(([lane, family, model, shortModel]) => {
  const cand = readJson(path.join(hcRoot, 'iterations', lane, 'candidate.json'));
  const key = String(cand.cliModel).toLowerCase();
  const isReference = new RegExp(adj.reference.match).test(key);
  const entry = isReference ? adj.reference : adj.models.find(m => new RegExp(m.match).test(key));
  const factors = entry?.factors ?? adj.unmeasuredDefault.factors;
  const ans = ctx.answers(lane), keys = [...ans.keys()].filter(k => luna.has(k));
  const mine = Object.fromEntries(keys.map(k => [k, loss(ans, k, (c, a) => layer(c, a) + Math.log(factors[a] ?? 1))]));
  const base = Object.fromEntries(keys.map(k => [k, loss(luna, k, layer)]));
  const b = pairedBootstrap(base, mine), c = costs.get(lane);
  if (!c) throw Error(`no cost row for ${lane}`);
  return { id: lane, family, model, shortModel, effort: cand.effort, cities: keys.length,
    loss: r3(mean(Object.values(mine))), lunaLoss: r3(mean(Object.values(base))),
    diff: r3(-b.meanImprovement), diffLow: r3(-b.upper95), diffHigh: r3(-b.lower95),
    cost: r3(c.appPerCity), costLow: r3(c.appP10), costHigh: r3(c.appP90),
    minutes: r2(c.minP50), minutesLow: r2(c.minP10), minutesHigh: r2(c.minP90),
    correction: isReference ? 'Reference' : entry ? 'Own calibration' : 'Unmeasured default' };
});
const lunaRow = rows.find(r => r.id === '126-s80-luna-max-exec');
const result = { generatedAt: new Date().toISOString().slice(0, 10), countryTable: table.version, modelAdjustments: adj.version,
  referencePanel: 'R4 (dev split, grades A-C)', reference: { model: 'gpt-6-luna', cost: lunaRow.cost, minutes: lunaRow.minutes }, rows };
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(rows.map(r => `${r.model} ${r.effort} n=${r.cities} diff ${r.diff} [${r.diffLow}, ${r.diffHigh}] cost ${r.cost} min ${r.minutes} ${r.correction}`).join('\n'));
