// Builds the production correction table for city-cost methodology v1.2 (bundle 022) from the research panel.
//   node build-production-corrections.mjs <out.json> [--app-root <path>]
// Fitted on every panel city with a Luna answer to the 102/202 prompt (333 development + 142 held-out cities, now that
// evaluation is finished), against the primary panel (R3). For each corrected anchor:
//   residual  d = ln(reference) - ln(Luna answer), per city (references averaged in log space)
//   global    = mean d over all cities
//   region    = mean d over the region's cities (global when the region has none)
//   country   = n/(n+k) * mean d over the country's cities + k/(n+k) * region, k = 3
// The table stores multipliers exp(offset). Countries are keyed by ISO 3166-1 alpha-2 using the app's canonical
// country metadata. Owner decisions (16-19 October 2026): correct food, drink, 3-star, 1-star and, from 19 October with
// year-typical hostel references (panel R4, HC_PANEL=references-r4.jsonl), hostels; cocktail and wine stay uncorrected.
//   HC_PANEL=references-r4.jsonl node build-production-corrections.mjs <out.json> --version <version>
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, readJsonl, loadPanel, mean, sha256 } from './lib.mjs';

const args = process.argv.slice(2);
const out = args[0];
if (!out) throw Error('Usage: build-production-corrections.mjs <out.json> [--app-root <path>]');
const appRoot = args.includes('--app-root') ? args[args.indexOf('--app-root') + 1] : path.resolve(hcRoot, '../../..');
const K = 3;
const CORRECTED = ['inexp_meal_1p', 'midrange_meal_2p', 'beer', 'coffee', 'hotel_3star_2p', 'hotel_1star_2p', 'hostel_dorm_1p', 'hostel_private_2p'];
const UNCORRECTED = ['cocktail', 'wine_glass'];
const version = args.includes('--version') ? args[args.indexOf('--version') + 1] : null;
if (!version) throw Error('--version is required (for example v1.2-corrections-2026-10-19)');

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const iso = new Map();
for (const r of readJson(path.join(appRoot, 'src/lib/data/country-metadata.generated.json'))) {
  for (const n of [r.name, ...(r.aliases || [])]) if (!iso.has(norm(n))) iso.set(norm(n), r.iso2);
}
const ALIAS = { unitedstatesofamerica: 'US', uae: 'AE', czechia: 'CZ', turkiye: 'TR', northmacedonia: 'MK', curacao: 'CW' };
const isoOf = country => ALIAS[norm(country)] ?? iso.get(norm(country)) ?? null;

const panel = loadPanel();
const refs = new Map(), meta = new Map();
for (const r of panel) {
  meta.set(r.cityKey, { region: r.region, country: r.country });
  const k = `${r.cityKey}|${r.anchor}`;
  (refs.get(k) ?? refs.set(k, []).get(k)).push(Math.log(r.valueUsd));
}
const sources = ['iterations/102-search-food-drink-luna-r2/predictions.jsonl', 'iterations/202-search-food-drink-luna-test/predictions.jsonl'];
const preds = sources.flatMap(f => readJsonl(path.join(hcRoot, f))).filter(p => p.status === 'valid');

const unknownCountries = new Set();
const table = { global: {}, region: {}, country: {}, cities: {} };
for (const a of CORRECTED) {
  const rows = preds.filter(p => refs.has(`${p.cityKey}|${a}`)).map(p => ({ ...meta.get(p.cityKey), d: mean(refs.get(`${p.cityKey}|${a}`)) - Math.log(p.anchors_usd[a]) }));
  const g = mean(rows.map(x => x.d));
  table.global[a] = +Math.exp(g).toFixed(4);
  table.cities[a] = rows.length;
  const byRegion = {}, byCountry = {};
  for (const x of rows) { (byRegion[x.region] ??= []).push(x.d); (byCountry[x.country] ??= { region: x.region, d: [] }).d.push(x.d); }
  const regionOffset = {};
  table.region[a] = {};
  for (const [r, ds] of Object.entries(byRegion)) { regionOffset[r] = mean(ds); table.region[a][r] = +Math.exp(regionOffset[r]).toFixed(4); }
  table.country[a] = {};
  for (const [c, { region, d }] of Object.entries(byCountry)) {
    const code = isoOf(c);
    if (!code) { unknownCountries.add(c); continue; }
    const w = d.length / (d.length + K);
    table.country[a][code] = { factor: +Math.exp(w * mean(d) + (1 - w) * (regionOffset[region] ?? g)).toFixed(4), cities: d.length, region };
  }
}
if (unknownCountries.size) throw Error(`No ISO code for: ${[...unknownCountries].join(', ')}`);

const panelFile = path.join(hcRoot, 'panel', process.env.HC_PANEL || 'references.jsonl');
const result = {
  version,
  method: 'country-in-region multiplicative correction (bundle 022), k = 3; country factors already include region shrinkage',
  fittedOn: { cities: new Set(preds.map(p => p.cityKey)).size, model: 'gpt-6-luna/max', prompt: 'llm_prompt_new_cities_v1_2.md',
    referencePanel: readJson(path.join(hcRoot, `panel/${path.basename(panelFile).replace('references', 'panel-summary').replace('.jsonl', '.json')}`)).version,
    referencePanelSha256: sha256(fs.readFileSync(panelFile)),
    researchTag: 'city-cost-research-r3-2026-10-17' },
  correctedAnchors: CORRECTED,
  uncorrectedAnchors: UNCORRECTED,
  lookup: 'country factor if present, else region factor, else global factor; anchors not listed are unchanged',
  k: K,
  ...table,
};
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ out, cities: result.fittedOn.cities, global: result.global, countries: Object.keys(result.country.hotel_3star_2p).length }));
