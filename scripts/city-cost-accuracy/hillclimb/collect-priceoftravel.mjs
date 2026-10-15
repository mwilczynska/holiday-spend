// Independent hand-researched family: Price of Travel city guides (priceoftravel.com/<city>-price-guide).
//   node collect-priceoftravel.mjs [--only cityKey,...] [--delay ms]
// Parsed deterministically from the page text (USD ranges). Reference = geometric mean of each range.
// Hotel table rows are in star order 1..5; 1-star -> hotel_1star_2p, 3-star -> hotel_3star_2p. "Hostel Bed" ->
// hostel_dorm_1p. "Budget dinner" -> inexp_meal_1p and "Beer (pint|...)" -> beer, both with recorded definitional
// gaps. Ranges are wide, so every row is grade C.
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

// Resolve guide URLs from the site's own index links rather than guessing.
const index = await (await fetch('https://www.priceoftravel.com/world-cities-by-price-backpacker-index/', { headers: { 'user-agent': UA } })).text();
const guides = [...new Set([...index.matchAll(/https:\/\/www\.priceoftravel\.com\/([a-z-]+)-price-guide/g)].map(m => m[1]))];
const alias = { 'new york city': 'new-york-city', 'bali ubud': 'bali', 'ho chi minh city': 'ho-chi-minh-city' };
const geo = ([lo, hi]) => Math.sqrt(lo * hi);
const cities = [...new Map(loadPanel().map(r => [r.cityKey, r])).values()].filter(c => !only || only.has(c.cityKey));
const rows = [], log = [];
for (const c of cities) {
  const want = alias[c.cityKey] ?? slug(c.city);
  const g = guides.find(x => x === want) ?? guides.find(x => x.startsWith(want));
  if (!g) { log.push({ city: c.cityKey, missing: 'no guide link' }); continue; }
  try {
    const res = await fetch(`https://www.priceoftravel.com/${g}-price-guide`, { headers: { 'user-agent': UA }, redirect: 'follow' });
    const body = await res.text();
    const rawDir = path.join(hcRoot, 'panel/raw', today);
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(path.join(rawDir, `priceoftravel-${c.cityKey.replace(/ /g, '-')}.html.gz`), zlib.gzipSync(body));
    const t = body.replace(/<[^>]*>/g, ' ').replace(/&#8217;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
    const base = { cityKey: c.cityKey, city: c.city, country: c.country, region: c.region, currency: 'USD', localValue: null,
      source: 'priceoftravel', sourceFamily: 'hand-researched-travel-guide', sourceUrl: res.url, rawSha256: sha256(body),
      observedAt: today, capturedAt: new Date().toISOString(), contributors: null, sampleSize: null, grade: 'C',
      split: splitOf(c.cityKey), fx: null };
    const found = [];
    const hotel = t.match(/Hotel Prices Rating Price\(USD\) ((?:[\d.]+ - [\d.]+ ){5})/);
    if (hotel) {
      const ranges = [...hotel[1].matchAll(/([\d.]+) - ([\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
      for (const [anchor, i] of [['hotel_1star_2p', 0], ['hotel_3star_2p', 2]]) {
        rows.push({ ...base, anchor, valueUsd: +geo(ranges[i]).toFixed(4), range: ranges[i],
          notes: `${i + 1}-star row of the guide's hotel price table (USD range, geometric mean).` });
        found.push(anchor);
      }
    }
    const pick = (re, anchor, note) => {
      const m = t.match(re);
      if (!m) return;
      const r = [Number(m[m.length - 2]), Number(m[m.length - 1])];
      rows.push({ ...base, anchor, valueUsd: +geo(r).toFixed(4), range: r, notes: note.replace('$1', m[1] ?? '') });
      found.push(anchor);
    };
    pick(/Hostel Bed ([\d.]+) - ([\d.]+)/, 'hostel_dorm_1p', 'Hostel bed range (geometric mean).');
    pick(/Budget dinner [^0-9]{0,400}?([\d.]+) - ([\d.]+)/, 'inexp_meal_1p', 'Budget dinner range mapped to inexpensive-restaurant meal (geometric mean).');
    pick(/Beer \(([^)]{1,30})\) [^0-9]{0,400}?([\d.]+) - ([\d.]+)/, 'beer', 'Beer ($1) range (geometric mean); serving size differs from 0.5 L.');
    log.push({ city: c.cityKey, guide: g, status: res.status, found });
  } catch (e) { log.push({ city: c.cityKey, error: String(e) }); }
  await new Promise(r => setTimeout(r, delayMs));
}
const outFile = path.join(hcRoot, `panel/r2-priceoftravel-${today}.jsonl`);
const kept = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  .filter(r => !cities.some(c => c.cityKey === r.cityKey)) : [];
fs.writeFileSync(outFile, [...kept, ...rows].map(r => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(path.join(hcRoot, `panel/r2-priceoftravel-${today}.log.json`), JSON.stringify(log, null, 1) + '\n');
console.log(`${rows.length} rows for ${new Set(rows.map(r => r.cityKey)).size} cities; guides indexed ${guides.length}`);
for (const l of log.filter(l => l.missing || l.error || (l.found && l.found.length < 5))) console.log('GAP', JSON.stringify(l));
