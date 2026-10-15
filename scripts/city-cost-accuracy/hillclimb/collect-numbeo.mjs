// Numbeo food/drink references for app-library cities, fetched with displayCurrency=USD and parsed
// deterministically. Used to expand the panel (R3) and to re-capture R0 cities for a drift check.
//   node collect-numbeo.mjs <cities.json> <out-name> [--delay ms] [--min-contributors n]
// cities.json: [{ city, country, region }]. Rows below the contributor floor are dropped (default 10).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { hcRoot, sha256, readJson, normalizeCity, splitOf } from './lib.mjs';

const [citiesFile, outName, ...rest] = process.argv.slice(2);
const opt = (n, d) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : d; };
const delayMs = Number(opt('delay', 5000));
const minContributors = Number(opt('min-contributors', 10));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const today = new Date().toISOString().slice(0, 10);
const regionName = { europe: 'Europe', latin_america: 'Latin America', oceania: 'Oceania', se_asia: 'SEA',
  north_america: 'North America', 'north-america': 'North America', east_asia: 'East Asia', middle_east: 'Middle East',
  south_asia: 'South Asia', africa: 'Africa' };
const ascii = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const slugs = c => {
  const base = ascii(c.city).replace(/\s*\(.*\)\s*/g, ' ').trim().replace(/\s+/g, '-');
  const country = ascii(c.country).replace(/\s+/g, '-');
  return [...new Set([base, `${base}-${country}`])];
};
// Labels are matched literally. Numbeo honours displayCurrency=USD only for some URL forms, so the amount after
// a label is either "$12.34" (USD) or "12.34 <symbol>" in the country's own currency (library currency_code),
// converted with the frozen 14 October 2026 FX.
const items = [
  ['inexp_meal_1p', 'Meal at an Inexpensive Restaurant '],
  ['midrange_meal_2p', 'Meal for Two at a Mid-Range Restaurant (Three Courses, Without Drinks) '],
  ['beer', 'Domestic Draft Beer (0.5 Liter) '],
  ['coffee', 'Cappuccino (Regular Size) '],
];
const fxFile = 'panel/fx-usd-2026-10-14.raw.json';
const fx = readJson(path.join(hcRoot, fxFile)).usd;
function amountAfter(t, label, currency) {
  const i = t.indexOf(label);
  if (i < 0) return null;
  const s = t.slice(i + label.length, i + label.length + 40);
  let m = s.match(/^\$([\d,]+(?:\.\d+)?)/);
  if (m) return { usd: Number(m[1].replace(/,/g, '')), local: null, cur: 'USD' };
  m = s.match(/^([\d,]+(?:\.\d+)?)/);
  if (!m || !currency || !(fx[currency.toLowerCase()] > 0)) return null;
  const local = Number(m[1].replace(/,/g, ''));
  return { usd: local / fx[currency.toLowerCase()], local, cur: currency };
}
const grade = n => n >= 50 ? 'A' : n >= 20 ? 'B' : 'C';

const cities = readJson(citiesFile);
const outFile = path.join(hcRoot, `panel/${outName}.jsonl`);
const logFile = path.join(hcRoot, `panel/${outName}.log.json`);
// Resumable: cities already logged are skipped.
const log = fs.existsSync(logFile) ? readJson(logFile) : [];
const done = new Set(log.map(l => `${l.city}|${l.country}`));
let consecutive429 = 0;
for (const c of cities) {
  if (done.has(`${c.city}|${c.country}`)) continue;
  let entry = { city: c.city, country: c.country, status: 'no-page' };
  for (const s of slugs(c)) {
    const url = `https://www.numbeo.com/cost-of-living/in/${encodeURIComponent(s)}?displayCurrency=USD`;
    const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en' } });
    if (res.status === 429) { entry = { ...entry, status: 'rate-limited' }; consecutive429++; break; }
    consecutive429 = 0;
    const body = await res.text();
    if (!body.includes('Meal at an Inexpensive Restaurant')) { await new Promise(r => setTimeout(r, delayMs)); continue; }
    const t = body.replace(/<[^>]*>/g, ' ').replace(/&#36;/g, '$').replace(/\s+/g, ' ');
    const contributors = Number(t.match(/(\d+) different contributors/)?.[1] ?? 0);
    const lastUpdate = t.match(/Last update: ([A-Za-z0-9 ]+?\d{4})/)?.[1] ?? null;
    const rawDir = path.join(hcRoot, 'panel/raw', today);
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(path.join(rawDir, `numbeo-${normalizeCity(c.city).replace(/ /g, '-')}-${normalizeCity(c.country).replace(/ /g, '-')}.html.gz`), zlib.gzipSync(body));
    entry = { ...entry, status: 'page', url: res.url, contributors, lastUpdate, found: 0 };
    if (contributors >= minContributors) {
      const cityKey = normalizeCity(c.city);
      for (const [anchor, label] of items) {
        const a = amountAfter(t, label, c.currency);
        if (!a || !(a.usd > 0)) continue;
        entry.found++;
        fs.appendFileSync(outFile, JSON.stringify({ cityKey, city: c.city, country: c.country, region: regionName[c.region] ?? c.region,
          anchor, valueUsd: +a.usd.toFixed(4), localValue: a.local, currency: a.cur, source: 'numbeo',
          sourceFamily: 'crowdsourced-cost-index', sourceUrl: res.url, rawSha256: sha256(body), observedAt: lastUpdate,
          capturedAt: new Date().toISOString(), contributors, grade: grade(contributors), split: splitOf(cityKey),
          fx: a.cur === 'USD' ? null : { file: fxFile, date: '2026-10-14' },
          notes: a.cur === 'USD' ? 'Numbeo USD display (Numbeo conversion at capture).' : `Numbeo local-currency display, converted at frozen FX.` }) + '\n');
      }
    }
    break;
  }
  log.push(entry);
  fs.writeFileSync(logFile, JSON.stringify(log, null, 1) + '\n');
  if (consecutive429 >= 3) { console.log('Stopping after repeated 429s; rerun later to resume.'); break; }
  await new Promise(r => setTimeout(r, delayMs));
}
const counts = log.reduce((a, l) => ({ ...a, [l.status]: (a[l.status] ?? 0) + 1 }), {});
console.log(JSON.stringify({ logged: log.length, counts, accepted: log.filter(l => l.found >= 4).length }));
