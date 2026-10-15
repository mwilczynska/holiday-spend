// Builds the seed reference panel from the Numbeo snapshots captured 25-26 July 2026 for the v4 programme
// (data/reference/dry-run). No network access; FX comes from the saved 25 July 2026 snapshot.
// Output: research/city-cost-accuracy/hillclimb/panel/references.jsonl (one row per city/anchor/source).
import fs from 'node:fs';
import path from 'node:path';
import { repo, hcRoot, readJson, sha256, normalizeCity, splitOf } from './lib.mjs';

const fxFile = path.join(hcRoot, 'panel/fx-usd-2026-07-25.raw.json');
const fx = readJson(fxFile).usd; // units of currency per 1 USD
const toUsd = (amount, currency) => {
  const rate = fx[currency.toLowerCase()];
  if (!(rate > 0)) throw Error(`No FX for ${currency}`);
  return amount / rate;
};

const sources = ['phase-0a-numbeo-anchors', 'phase-0d-numbeo-expanded-sample', 'phase-0e-stage1-numbeo-sample',
  'phase-0f-stage2-numbeo-sample'];
// Numbeo item -> v1.1 anchor. Beer is Numbeo's 0.5 L domestic draught; v1.1 asks for "one standard serving",
// a known definitional gap recorded on every beer row.
const mapping = { inexp: 'inexp_meal_1p', midrange: 'midrange_meal_2p', beer: 'beer', cappuccino: 'coffee' };
const grade = contributors => contributors >= 50 ? 'A' : contributors >= 20 ? 'B' : 'C';

const byCity = new Map();
for (const name of sources) {
  const file = `data/reference/dry-run/${name}.json`;
  const doc = readJson(path.join(repo, file));
  for (const c of doc.cities ?? []) {
    if (!c.currency) continue;
    const flat = c.anchors ? { inexp: c.anchors.inexp_meal_1p, midrange: c.anchors.midrange_meal_2p,
      beer: c.anchors.beer_draft_0_5l, cappuccino: c.anchors.cappuccino,
      contributors: c.quality?.contributors, lastUpdate: c.quality?.lastUpdate } : c;
    const key = normalizeCity(c.city);
    // Later captures of the same city replace earlier ones; the file order above is capture order.
    byCity.set(key, { city: c.city, region: c.region, currency: c.currency, file, capturedAt: doc.capturedAt, ...flat });
  }
}

// Countries come from the canonical CSV (the Numbeo samples mostly omit them); the prompt needs one.
const countryOf = new Map(fs.readFileSync(path.join(repo, 'data/reference/city_costs_app_aud.csv'), 'utf8')
  .trim().split(/\r?\n/).slice(1).map(line => line.split(',')).map(([city, country]) => [normalizeCity(city), country]));
const countryAliases = { 'new york': 'United States', denpasar: 'Indonesia' };

const rows = [];
for (const [cityKey, c] of [...byCity].sort()) {
  const country = c.country ?? countryOf.get(cityKey) ?? countryAliases[cityKey];
  if (!country) throw Error(`No country for ${c.city}`);
  for (const [item, anchor] of Object.entries(mapping)) {
    const local = c[item];
    if (!(local > 0)) continue;
    rows.push({ cityKey, city: c.city, country, region: c.region, anchor, valueUsd: +toUsd(local, c.currency).toFixed(4),
      localValue: local, currency: c.currency, source: 'numbeo', sourceFamily: 'crowdsourced-cost-index',
      sourceUrl: `https://www.numbeo.com/cost-of-living/in/${c.city.replace(/ /g, '-')}`,
      observedAt: c.lastUpdate ?? null, capturedAt: c.capturedAt, provenanceFile: c.file,
      contributors: c.contributors ?? null, grade: grade(c.contributors ?? 0), split: splitOf(cityKey),
      fx: { file: 'panel/fx-usd-2026-07-25.raw.json', date: '2026-07-25' },
      notes: anchor === 'beer' ? 'Numbeo domestic draught 0.5 L; v1.1 asks for one standard serving.' : null });
  }
}

const out = path.join(hcRoot, 'panel/r0-numbeo.jsonl');
const text = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
fs.writeFileSync(out, text);
const cities = [...new Set(rows.map(r => r.cityKey))];
const summary = { builtFrom: sources.map(s => `data/reference/dry-run/${s}.json`), fxSha256: sha256(fs.readFileSync(fxFile)),
  referencesSha256: sha256(text), rows: rows.length, cities: cities.length,
  dev: cities.filter(k => splitOf(k) === 'dev').length, test: cities.filter(k => splitOf(k) === 'test').length,
  grades: Object.fromEntries(['A', 'B', 'C'].map(g => [g, new Set(rows.filter(r => r.grade === g).map(r => r.cityKey)).size])) };
fs.writeFileSync(path.join(hcRoot, 'panel/seed-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
