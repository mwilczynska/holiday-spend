// Converts an Expatistan capture (owner's Chrome, 17 October 2026) into panel rows.
//   node ingest-expatistan.mjs <capture.raw.txt> <out-name>
// Capture lines: cityKey~status~slug~page heading~grade~contributors~cocktail~pub beer~cappuccino~date, where each
// price is "local|(page USD)". Anchor: cocktail <- "1 cocktail drink in downtown club" (a club price, which may sit
// above the app's "standard cocktail at a bar or restaurant"; recorded in notes). Diagnostic rows (diag_*) keep the
// pub beer and expat-area cappuccino so Expatistan's level can be compared with Numbeo's.
// Expatistan serves the nearest spelling match for unknown cities (Santorini -> Katerini, Bath -> Szombathely), so a
// page is kept only if both its country and its city name match the panel city (or a listed alias). Local amounts
// are converted with the frozen 14 October FX table; the page's own rounded USD figure is a check (20% tolerance).
// Grades: A = "abundant and consistent data", C = "small amount of data", B = other notes.
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, loadPanel, splitOf } from './lib.mjs';

const [capFile, outName] = process.argv.slice(2);
if (!capFile || !outName) throw Error('Usage: ingest-expatistan.mjs <capture.raw.txt> <out-name>');
const fx = readJson(path.join(hcRoot, 'panel/fx-usd-2026-10-14.raw.json')).usd;
const panel = new Map(loadPanel().map(r => [r.cityKey, r]));
// Country currencies from the app's canonical metadata (panel rows record the capture currency, not the country's).
const currency = {};
for (const r of readJson(path.join(hcRoot, '../../../src/lib/data/country-metadata.generated.json'))) if (r.currencyCode) for (const n of [r.name, ...(r.aliases || [])]) currency[n] ??= r.currencyCode;
Object.assign(currency, { Bahamas: 'BSD', 'Costa Rica': 'CRC', Curacao: 'ANG', Cyprus: 'EUR', Barbados: 'BBD', Kenya: 'KES',
  Myanmar: 'MMK', Qatar: 'QAR', Samoa: 'WST', Seychelles: 'SCR', Guatemala: 'GTQ', 'United States': 'USD', Ecuador: 'USD', Panama: 'PAB', Cuba: 'USD',
  Cambodia: 'KHR', Bulgaria: 'BGN' }); // Expatistan still quotes Cambodian prices in riels and Bulgarian prices in leva
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const COUNTRY = { unitedstatesofamerica: 'unitedstates', netherlandsantilles: 'curacao', macedonia: 'northmacedonia', czechrepublic: 'czechia', turkiye: 'turkey', uae: 'unitedarabemirates' };
const cn = s => COUNTRY[norm(s)] ?? norm(s);
// Page city names accepted for panel cities whose name differs.
const CITY_ALIAS = { penang: 'georgetownpenang', 'bali ubud': 'ubud', 'bali ubud canggu': 'ubud', lombok: 'mataram', fez: 'fes',
  'xi an': 'xian', brighton: 'brightonandhove', cebu: 'cebucity', kaohsiung: 'kaohsiungcity', taichung: 'taichungcity', tainan: 'tainancity',
  'puerto princesa': 'puertoprincesacity', wroclaw: 'wrocaw', gdansk: 'gdansk' };
// Same name and country but a different place (state given on the page).
const WRONG_PLACE = new Set(['san antonio']);

function amount(text) {
  if (!text || /^-/.test(text)) return null;
  let s = (text.match(/\d[\d.,]*/) || [''])[0].replace(/[.,]$/, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '');
  else if (s.includes(',')) s = /,\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  const v = Number(s);
  return Number.isFinite(v) && v > 0 ? v : null;
}

const rows = [], rejects = [];
for (const line of fs.readFileSync(capFile, 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const f = line.split('~');
  const [key, status, slug, heading, grade, contributors, ...prices] = f;
  const c = panel.get(key);
  if (!c) continue;
  if (f.length < 10 || !heading) { rejects.push({ key, reason: `no page (${status}, tried ${slug})` }); continue; }
  const parts = heading.split(',').map(s => s.trim());
  const pageCity = parts[0], pageCountry = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  if (cn(pageCountry) !== cn(c.country)) { rejects.push({ key, reason: `country mismatch: page "${heading}"` }); continue; }
  const want = CITY_ALIAS[key] ?? norm(key);
  if (WRONG_PLACE.has(key) || !(norm(pageCity).includes(want) || want.includes(norm(pageCity)))) { rejects.push({ key, reason: `city mismatch: page "${heading}"` }); continue; }
  const code = currency[c.country];
  const rate = code === 'USD' ? 1 : fx[(code || '').toLowerCase()];
  if (!(rate > 0)) { rejects.push({ key, reason: `no FX for ${c.country} (${code})` }); continue; }
  const items = { cocktail: prices[0], diag_beer_pub: prices[1], diag_cappuccino_expat: prices[2] };
  for (const [anchor, text] of Object.entries(items)) {
    const [localText, usdText] = (text || '').split('|');
    const local = amount(localText);
    if (!local) continue;
    const usd = local / rate;
    const pageUsd = usdText ? amount(usdText) : null;
    if (pageUsd && Math.abs(Math.log(usd / pageUsd)) > Math.log(1.2)) { rejects.push({ key, anchor, reason: `FX check failed: ${localText} -> ${usd.toFixed(2)} vs page ${usdText}` }); continue; }
    rows.push({ cityKey: key, city: c.city, country: c.country, region: c.region, split: splitOf(key), anchor, valueUsd: +usd.toFixed(2),
      currency: code, localValue: local, fx: rate, contributors: Number(contributors) || null, source: 'expatistan', sourceFamily: 'expatistan',
      url: `https://www.expatistan.com/cost-of-living/${slug}`, observedAt: f[9], grade, sampleSize: Number(contributors) || null,
      notes: `${anchor === 'cocktail' ? '1 cocktail drink in downtown club' : anchor}: ${localText}${usdText ? ' ' + usdText : ''}; page "${heading}".` });
  }
}
fs.writeFileSync(path.join(hcRoot, `panel/${outName}.jsonl`), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(path.join(hcRoot, `panel/${outName}.log.json`), JSON.stringify({ rows: rows.length, rejects }, null, 2) + '\n');
const by = a => rows.filter(r => r.anchor === a);
console.log(JSON.stringify({ cocktailCities: by('cocktail').length, dev: by('cocktail').filter(r => r.split === 'dev').length,
  grades: Object.fromEntries(['A', 'B', 'C'].map(g => [g, by('cocktail').filter(r => r.grade === g).length])), rejects: rejects.length }));
