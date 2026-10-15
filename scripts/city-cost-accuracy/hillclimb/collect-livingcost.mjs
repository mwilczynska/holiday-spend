// R2 second food/drink source family: livingcost.org city pages, parsed deterministically.
//   node collect-livingcost.mjs [--only cityKey,...] [--delay ms]
// Items (USD as displayed): "Lunch Menu" -> inexp_meal_1p, "Dinner in a Restaurant, for 2" -> midrange_meal_2p,
// "Beer in a Pub, 0.5 L" -> beer, "Cappuccino" -> coffee. A set lunch menu is close to, not identical with, an
// inexpensive-restaurant meal; the mapping is recorded on each row.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { hcRoot, sha256, loadPanel, splitOf } from './lib.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const today = new Date().toISOString().slice(0, 10);
const args = process.argv.slice(2);
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const delayMs = args.includes('--delay') ? Number(args[args.indexOf('--delay') + 1]) : 3000;
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const countrySlug = { 'United States': 'united-states', 'United Kingdom': 'united-kingdom', 'South Korea': 'south-korea', 'Hong Kong': 'hong-kong' };
const override = { 'bali ubud': 'indonesia/ubud', 'new york city': 'united-states/ny/new-york', marrakech: 'morocco/marrakesh', 'ho chi minh city': 'vietnam/ho-chi-minh', penang: 'malaysia/george-town', 'hong kong': 'hong-kong/hong-kong',
  singapore: 'singapore/singapore' };
const url = c => `https://livingcost.org/cost/${override[c.cityKey] ?? `${countrySlug[c.country] ?? slug(c.country)}/${slug(c.city)}`}`;
const items = [
  ['inexp_meal_1p', /Lunch Menu \$([\d,]+(?:\.\d+)?)/, 'Lunch Menu (set lunch) mapped to inexpensive-restaurant meal.'],
  ['midrange_meal_2p', /Dinner in a Restaurant, for 2 \$([\d,]+(?:\.\d+)?)/, 'Dinner in a restaurant for two.'],
  ['beer', /Beer in a Pub, 0\.5 L[^$]*\$([\d,]+(?:\.\d+)?)/, 'Beer in a pub, 0.5 L.'],
  ['coffee', /Cappuccino \$([\d,]+(?:\.\d+)?)/, 'Cappuccino.'],
];

const cities = [...new Map(loadPanel().map(r => [r.cityKey, r])).values()].filter(c => !only || only.has(c.cityKey));
const rows = [], log = [];
for (const c of cities) {
  try {
    let res = await fetch(url(c), { headers: { 'user-agent': UA, 'accept-language': 'en' }, redirect: 'follow' });
    if (res.status === 404) {
      // Large cities sit under a region segment; take the link from the country page.
      const cs = countrySlug[c.country] ?? slug(c.country);
      const page = await (await fetch(`https://livingcost.org/cost/${cs}`, { headers: { 'user-agent': UA } })).text();
      const m = page.match(new RegExp(`https://livingcost\.org/cost/${cs}/[a-z-]+/${slug(c.city)}(?=")`));
      if (m) res = await fetch(m[0], { headers: { 'user-agent': UA, 'accept-language': 'en' }, redirect: 'follow' });
    }
    const body = await res.text();
    const rawDir = path.join(hcRoot, 'panel/raw', today);
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(path.join(rawDir, `livingcost-${c.cityKey.replace(/ /g, '-')}.html.gz`), zlib.gzipSync(body));
    const t = body.replace(/<[^>]*>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
    const found = {};
    for (const [anchor, re, note] of items) {
      const m = t.match(re);
      if (!m) continue;
      found[anchor] = Number(m[1].replace(/,/g, ''));
      rows.push({ cityKey: c.cityKey, city: c.city, country: c.country, region: c.region, anchor, valueUsd: found[anchor],
        localValue: null, currency: 'USD', source: 'livingcost', sourceFamily: 'cost-aggregator-livingcost', sourceUrl: res.url,
        rawSha256: sha256(body), observedAt: today, capturedAt: new Date().toISOString(), contributors: null, sampleSize: null,
        grade: anchor === 'inexp_meal_1p' ? 'C' : 'B', split: splitOf(c.cityKey), fx: null, notes: note });
    }
    log.push({ city: c.cityKey, status: res.status, url: res.url, found: Object.keys(found).length });
  } catch (e) { log.push({ city: c.cityKey, error: String(e) }); }
  await new Promise(r => setTimeout(r, delayMs));
}
// Re-runs replace rows for the cities they processed and keep the rest of the day's file.
const outFile = path.join(hcRoot, `panel/r2-livingcost-${today}.jsonl`);
const kept = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  .filter(r => !cities.some(c => c.cityKey === r.cityKey)) : [];
fs.writeFileSync(outFile, [...kept, ...rows].map(r => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(path.join(hcRoot, `panel/r2-livingcost-${today}.log.json`), JSON.stringify(log, null, 1) + '\n');
console.log(`${rows.length} rows for ${new Set(rows.map(r => r.cityKey)).size} cities`);
for (const l of log.filter(l => l.error || l.found < 4)) console.log('GAP', JSON.stringify(l));
