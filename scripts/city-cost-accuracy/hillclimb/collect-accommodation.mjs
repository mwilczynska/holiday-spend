// R1 accommodation references, collected and parsed deterministically (no model involvement).
//   node collect-accommodation.mjs [--only cityKey,...]
// Sources:
//  - Hostelworld city page: every listed hostel's "Dorms From" and "Privates From" price. Reference = median across
//    properties. These are lowest available prices for near-term dates; currency follows the requester's region.
//  - BudgetYourTrip city page: KAYAK-derived hotel price ranges by budget category (low season - peak season,
//    USD, before taxes and fees). Reference = geometric mean of the low/peak pair. Budget -> 1-star anchor,
//    Mid-Range -> 3-star anchor (category mapping is approximate and recorded on each row).
// Raw pages are gzipped under panel/raw/ (gitignored); rows record the raw SHA-256 so values can be re-derived.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { hcRoot, sha256, readJson, loadPanel, splitOf } from './lib.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const today = new Date().toISOString().slice(0, 10);
const args = process.argv.slice(2);
const sources = args.includes('--sources') ? args[args.indexOf('--sources') + 1].split(',') : ['hostelworld', 'budgetyourtrip'];
const delayMs = args.includes('--delay') ? Number(args[args.indexOf('--delay') + 1]) : 1500;
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
// Latest published daily FX; the file name carries the date the source reports.
const fxRes = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
if (!fxRes.ok) throw Error(`FX fetch failed ${fxRes.status}`);
const fxText = await fxRes.text();
const fxFile = path.join(hcRoot, `panel/fx-usd-${JSON.parse(fxText).date}.raw.json`);
if (!fs.existsSync(fxFile)) fs.writeFileSync(fxFile, fxText);
const fx = readJson(fxFile).usd;
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const continent = { Jordan: 'asia', Israel: 'asia', Egypt: 'africa', Morocco: 'africa', 'South Africa': 'africa',
  Australia: 'oceania', 'United States': 'north-america', Canada: 'north-america', Colombia: 'south-america',
  Argentina: 'south-america', Peru: 'south-america', Chile: 'south-america', Brazil: 'south-america' };
const asia = ['Indonesia', 'China', 'South Korea', 'Philippines', 'Thailand', 'Sri Lanka', 'Vietnam', 'Hong Kong', 'Nepal',
  'Malaysia', 'Japan', 'India', 'Cambodia', 'Singapore', 'Taiwan', 'Laos', 'Georgia'];
const hwCountry = { 'United States': 'usa', 'United Kingdom': null, 'South Korea': 'south-korea', 'Hong Kong': 'china' };
const hwOverride = { edinburgh: 'europe/scotland/edinburgh', london: 'europe/england/london', 'new york city': 'north-america/usa/new-york',
  'bali ubud': 'asia/indonesia/ubud', 'hong kong': 'asia/china/hong-kong', 'ho chi minh city': 'asia/vietnam/ho-chi-minh',
  singapore: 'asia/singapore/singapore', 'koh samui': 'asia/thailand/koh-samui', penang: 'asia/malaysia/penang', cebu: 'asia/philippines/cebu-city' };
const bytCountry = { 'United States': 'united-states-of-america', 'United Kingdom': 'united-kingdom', 'South Korea': 'south-korea',
  'Hong Kong': 'hong-kong', Singapore: 'singapore' };
const bytOverride = { 'bali ubud': 'indonesia/ubud', 'hong kong': 'hong-kong/hong-kong', singapore: 'singapore/singapore',
  'ho chi minh city': 'vietnam/ho-chi-minh-city', 'new york city': 'united-states-of-america/new-york-city', cebu: 'philippines/cebu-city' };
const hwUrl = c => `https://www.hostelworld.com/st/hostels/${hwOverride[c.cityKey] ?? `${continent[c.country] ?? (asia.includes(c.country) ? 'asia' : 'europe')}/${hwCountry[c.country] ?? slug(c.country)}/${slug(c.city)}`}/`;
const bytUrl = c => `https://www.budgetyourtrip.com/${bytOverride[c.cityKey] ?? `${bytCountry[c.country] ?? slug(c.country)}/${slug(c.city)}`}`;

async function get(url, name) {
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en' }, redirect: 'follow' });
  const body = await res.text();
  const rawDir = path.join(hcRoot, 'panel/raw', today);
  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(path.join(rawDir, `${name}.html.gz`), zlib.gzipSync(body));
  return { status: res.status, finalUrl: res.url, body, rawSha256: sha256(body) };
}
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/&#8364;/g, '€').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const median = xs => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const toUsd = (v, cur) => { const r = fx[cur.toLowerCase()]; if (!(r > 0)) throw Error(`No FX ${cur}`); return v / r; };
const amount = s => Number(s.replace(/,/g, ''));

const cities = [...new Map(loadPanel().map(r => [r.cityKey, r])).values()].filter(c => !only || only.has(c.cityKey));
const rows = [], log = [];
for (const c of cities) {
  const base = { cityKey: c.cityKey, city: c.city, country: c.country, region: c.region, split: splitOf(c.cityKey),
    observedAt: today, capturedAt: new Date().toISOString(), contributors: null };
  // Hostelworld
  if (sources.includes('hostelworld')) try {
    const page = await get(hwUrl(c), `hostelworld-${c.cityKey.replace(/ /g, '-')}`);
    const t = text(page.body);
    const dorms = [...t.matchAll(/Dorms From ([A-Z]{3})\s?([\d,]+(?:\.\d+)?)/g)].map(m => ({ cur: m[1], v: amount(m[2]) }));
    const privs = [...t.matchAll(/Privates From ([A-Z]{3})\s?([\d,]+(?:\.\d+)?)/g)].map(m => ({ cur: m[1], v: amount(m[2]) }));
    log.push({ city: c.cityKey, source: 'hostelworld', status: page.status, url: page.finalUrl, dorms: dorms.length, privates: privs.length });
    for (const [anchor, list] of [['hostel_dorm_1p', dorms], ['hostel_private_2p', privs]]) {
      if (list.length < 3 || new Set(list.map(x => x.cur)).size !== 1) continue;
      const usd = list.map(x => toUsd(x.v, x.cur));
      rows.push({ ...base, anchor, valueUsd: +median(usd).toFixed(4), localValue: median(list.map(x => x.v)), currency: list[0].cur,
        source: 'hostelworld', sourceFamily: 'hostel-platform-listing', sourceUrl: page.finalUrl, rawSha256: page.rawSha256,
        sampleSize: list.length, grade: list.length >= 10 ? 'B' : 'C', fx: { file: `panel/${path.basename(fxFile)}`, date: readJson(fxFile).date },
        notes: `Median of ${list.length} per-property lowest "${anchor === 'hostel_dorm_1p' ? 'Dorms' : 'Privates'} From" prices on the city page, near-term dates.` });
    }
  } catch (e) { log.push({ city: c.cityKey, source: 'hostelworld', error: String(e) }); }
  // BudgetYourTrip
  if (sources.includes('budgetyourtrip')) try {
    const page = await get(bytUrl(c), `budgetyourtrip-${c.cityKey.replace(/ /g, '-')}`);
    const t = text(page.body);
    const range = label => { const m = t.match(new RegExp(`${label}: \\$([\\d,]+) - \\$([\\d,]+)`)); return m ? [amount(m[1]), amount(m[2])] : null; };
    const budget = range('Budget'), mid = range('Mid-Range');
    const paid = t.match(/typical double-occupancy hotel room is \$([\d,]+)/);
    log.push({ city: c.cityKey, source: 'budgetyourtrip', status: page.status, url: page.finalUrl, budget, mid, paid: paid?.[1] ?? null });
    for (const [anchor, r, label] of [['hotel_1star_2p', budget, 'Budget'], ['hotel_3star_2p', mid, 'Mid-Range']]) {
      if (!r) continue;
      rows.push({ ...base, anchor, valueUsd: +Math.sqrt(r[0] * r[1]).toFixed(4), localValue: null, currency: 'USD',
        source: 'budgetyourtrip-kayak', sourceFamily: 'hotel-aggregator-category-average', sourceUrl: page.finalUrl,
        rawSha256: page.rawSha256, sampleSize: null, grade: 'B', fx: null, range: r,
        notes: `KAYAK "${label}" category, low-season ${r[0]} / peak ${r[1]} USD before taxes and fees; geometric mean. Category-to-star mapping approximate.` });
    }
    if (paid) rows.push({ ...base, anchor: 'diag_hotel_paid_2p', valueUsd: amount(paid[1]), localValue: null, currency: 'USD',
      source: 'budgetyourtrip-travellers', sourceFamily: 'traveller-reported-spend', sourceUrl: page.finalUrl, rawSha256: page.rawSha256,
      sampleSize: null, grade: 'B', fx: null, notes: 'Average paid by travellers for a double-occupancy hotel room. Diagnostic, not an anchor.' });
  } catch (e) { log.push({ city: c.cityKey, source: 'budgetyourtrip', error: String(e) }); }
  await new Promise(r => setTimeout(r, delayMs));
}
const out = path.join(hcRoot, `panel/r1-${sources.join('+')}-${today}.jsonl`);
fs.writeFileSync(out, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(path.join(hcRoot, `panel/r1-${sources.join('+')}-${today}.log.json`), JSON.stringify(log, null, 1) + '\n');
console.log(`${rows.length} rows for ${new Set(rows.map(r => r.cityKey)).size} cities -> ${path.basename(out)}`);
for (const l of log.filter(l => l.error || (l.source === 'hostelworld' && l.dorms < 3) || (l.source === 'budgetyourtrip' && !l.mid))) console.log('GAP', JSON.stringify(l));
