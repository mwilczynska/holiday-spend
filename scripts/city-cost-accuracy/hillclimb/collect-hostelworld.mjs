// Hostelworld dorm/private references for app-library cities (panel expansion), parsed deterministically.
//   node collect-hostelworld.mjs <cities.json> <out-name> [--delay ms]
// Same parsing and reference rule as collect-accommodation.mjs: median of per-property lowest "Dorms From" and
// "Privates From" prices on the city page (per person; build-panel doubles private prices). Hostelworld redirects
// any continent segment to the canonical page, so a page is accepted only when its final URL ends in the city slug.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { hcRoot, sha256, readJson, normalizeCity, splitOf } from './lib.mjs';

const [citiesFile, outName, ...rest] = process.argv.slice(2);
const delayMs = Number(rest.includes('--delay') ? rest[rest.indexOf('--delay') + 1] : 1500);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const today = new Date().toISOString().slice(0, 10);
const fxFile = 'panel/fx-usd-2026-10-14.raw.json';
const fx = readJson(path.join(hcRoot, fxFile)).usd;
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const regionName = { europe: 'Europe', latin_america: 'Latin America', oceania: 'Oceania', se_asia: 'SEA', north_america: 'North America',
  'north-america': 'North America', east_asia: 'East Asia', middle_east: 'Middle East', south_asia: 'South Asia', africa: 'Africa' };
const countrySlug = { 'United States': ['usa'], 'United Kingdom': ['england', 'scotland', 'wales', 'northern-ireland'],
  'Hong Kong': ['china'], Macau: ['china', 'macau'], 'Czech Republic': ['czech-republic', 'czechia'] };
// Transient network errors are retried with backoff; persistent failures end the run so it can resume later.
async function get(url) {
  for (let i = 0; ; i++) {
    try { return await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en' } }); }
    catch (e) { if (i >= 3) throw e; await new Promise(r => setTimeout(r, 5000 * (i + 1))); }
  }
}
const median = xs => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const cities = readJson(citiesFile);
const outFile = path.join(hcRoot, `panel/${outName}.jsonl`), logFile = path.join(hcRoot, `panel/${outName}.log.json`);
const log = fs.existsSync(logFile) ? readJson(logFile) : [];
const done = new Set(log.map(l => `${l.city}|${l.country}`));
for (const c of cities) {
  if (done.has(`${c.city}|${c.country}`)) continue;
  let entry = { city: c.city, country: c.country, status: 'no-page' };
  for (const cs of countrySlug[c.country] ?? [slug(c.country)]) {
    const res = await get(`https://www.hostelworld.com/st/hostels/europe/${cs}/${slug(c.city)}/`);
    if (res.status === 429 || res.status === 403) { entry.status = `blocked-${res.status}`; break; }
    if (!res.url.replace(/\/$/, '').endsWith(`/${slug(c.city)}`)) continue;
    const body = await res.text();
    const t = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const dorms = [...t.matchAll(/Dorms From ([A-Z]{3})\s?([\d,]+(?:\.\d+)?)/g)].map(m => ({ cur: m[1], v: Number(m[2].replace(/,/g, '')) }));
    const privs = [...t.matchAll(/Privates From ([A-Z]{3})\s?([\d,]+(?:\.\d+)?)/g)].map(m => ({ cur: m[1], v: Number(m[2].replace(/,/g, '')) }));
    const rawDir = path.join(hcRoot, 'panel/raw', today);
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(path.join(rawDir, `hostelworld-${slug(c.city)}-${slug(c.country)}.html.gz`), zlib.gzipSync(body));
    entry = { ...entry, status: 'page', url: res.url, dorms: dorms.length, privates: privs.length };
    const cityKey = normalizeCity(c.city);
    for (const [anchor, list] of [['hostel_dorm_1p', dorms], ['hostel_private_2p', privs]]) {
      if (list.length < 3 || new Set(list.map(x => x.cur)).size !== 1 || !(fx[list[0].cur.toLowerCase()] > 0)) continue;
      const usd = list.map(x => x.v / fx[x.cur.toLowerCase()]);
      fs.appendFileSync(outFile, JSON.stringify({ cityKey, city: c.city, country: c.country, region: regionName[c.region] ?? c.region,
        split: splitOf(cityKey), observedAt: today, capturedAt: new Date().toISOString(), contributors: null, anchor,
        valueUsd: +median(usd).toFixed(4), localValue: median(list.map(x => x.v)), currency: list[0].cur, source: 'hostelworld',
        sourceFamily: 'hostel-platform-listing', sourceUrl: res.url, rawSha256: sha256(body), sampleSize: list.length,
        grade: list.length >= 10 ? 'B' : 'C', fx: { file: fxFile, date: '2026-10-14' },
        notes: `Median of ${list.length} per-property lowest "${anchor === 'hostel_dorm_1p' ? 'Dorms' : 'Privates'} From" prices on the city page, near-term dates.` }) + '\n');
    }
    break;
  }
  if (!entry.status.startsWith('blocked')) log.push(entry);
  fs.writeFileSync(logFile, JSON.stringify(log, null, 1) + '\n');
  if (entry.status.startsWith('blocked')) { console.log(`Stopped: ${entry.status}; rerun later to resume.`); break; }
  await new Promise(r => setTimeout(r, delayMs));
}
console.log(JSON.stringify({ logged: log.length, withDorms: log.filter(l => l.dorms >= 3).length }));
