// Inverts the v1 formulas on the canonical CSV to recover the ten USD anchors for panel cities.
// The CSV is AUD; conversion uses the panel's 25 July 2026 FX, an approximation for an April 2026 dataset that
// is recorded on every row. Diagnostic legacy baseline only; v1.1 serving predictions come from fresh runs.
//   node scripts/city-cost-accuracy/hillclimb/export-csv.mjs <out.jsonl>
import fs from 'node:fs';
import path from 'node:path';
import { repo, hcRoot, readJson, loadPanel, normalizeCity } from './lib.mjs';

const out = process.argv[2];
if (!out) throw Error('Usage: export-csv.mjs <out.jsonl>');
const usdPerAud = 1 / readJson(path.join(hcRoot, 'panel/fx-usd-2026-07-25.raw.json')).usd.aud;
const panelKeys = new Set(loadPanel().map(r => r.cityKey));
const aliases = { 'new york': 'new york city' };
const [header, ...lines] = fs.readFileSync(path.join(repo, 'data/reference/city_costs_app_aud.csv'), 'utf8').trim().split(/\r?\n/);
const cols = header.split(',');
const rows = [];
for (const line of lines) {
  const v = Object.fromEntries(line.split(',').map((x, i) => [cols[i], x]));
  let key = normalizeCity(v.city);
  if (!panelKeys.has(key) && aliases[key]) key = aliases[key];
  if (!panelKeys.has(key)) continue;
  const n = k => Number(v[k]);
  const inexp = n('food_street_food') / 3.6;
  const coffee = n('drink_coffee'), beer = (n('drinks_light') - 2 * coffee) / 2;
  const cocktail = (n('drinks_moderate') - 2 * coffee - 4 * beer) / 2;
  const aud = { beer, coffee, inexp_meal_1p: inexp, midrange_meal_2p: n('food_mid_range') - 3.2 * inexp, cocktail,
    wine_glass: (n('drinks_heavy') - 2 * coffee - 6 * beer - 4 * cocktail) / 2,
    hostel_dorm_1p: n('accom_shared_hostel_dorm') / 2, hostel_private_2p: n('accom_hostel_private_room'),
    hotel_1star_2p: n('accom_1_star'), hotel_3star_2p: n('accom_3_star') };
  rows.push(JSON.stringify({ cityKey: key, city: v.city, country: v.country, run: 'csv', model: 'v1-csv-apr-2026',
    promptVersion: 'llm_prompt_new_cities_1.md', fxNote: 'AUD->USD at 2026-07-25 rate',
    anchors_usd: Object.fromEntries(Object.entries(aud).map(([k, x]) => [k, +(x * usdPerAud).toFixed(4)])) }));
}
fs.writeFileSync(out, rows.join('\n') + '\n');
console.log(`Exported ${rows.length} CSV cities on the panel.`);
