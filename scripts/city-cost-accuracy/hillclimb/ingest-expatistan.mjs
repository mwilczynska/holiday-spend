// Converts an Expatistan capture (browser collection, 17 October 2026) into panel rows.
//   node ingest-expatistan.mjs <capture.raw.json> <out-name>
// Anchor: cocktail <- "1 cocktail drink in downtown club" (a club price, which may sit above the app's "standard
// cocktail at a bar or restaurant"; recorded in notes). Diagnostic rows (diag_*) keep the pub beer and expat-area
// cappuccino so Expatistan's level can be compared with Numbeo's. Local amounts are converted with the frozen
// 14 October FX table; the page's own rounded USD figure is a check only. Pages whose country does not match the
// panel city, or whose conversion disagrees with the page's USD by more than 20%, are rejected.
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, loadPanel, splitOf } from './lib.mjs';

const [capFile, outName] = process.argv.slice(2);
if (!capFile || !outName) throw Error('Usage: ingest-expatistan.mjs <capture.raw.json> <out-name>');
const cap = readJson(capFile);
const fx = readJson(path.join(hcRoot, 'panel/fx-usd-2026-10-14.raw.json')).usd;
const panel = new Map(loadPanel().map(r => [r.cityKey, r]));
const currency = {};
for (const r of loadPanel()) if (r.currency && r.currency !== 'USD') currency[r.country] = r.currency;
Object.assign(currency, { Bahamas: 'BSD', 'Costa Rica': 'CRC', Curacao: 'ANG', Cyprus: 'EUR', Barbados: 'BBD', Kenya: 'KES',
  Myanmar: 'MMK', Qatar: 'QAR', Samoa: 'WST', Seychelles: 'SCR', Guatemala: 'GTQ', 'United States': 'USD' });
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const ALIAS = { unitedstatesofamerica: 'unitedstates', usa: 'unitedstates', uk: 'unitedkingdom', czechia: 'czechrepublic', turkiye: 'turkey', uae: 'unitedarabemirates' };
const cn = s => ALIAS[norm(s)] ?? norm(s);

function amount(text) {
  let s = text.replace(/[^\d.,]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '');
  else if (s.includes(',')) s = /,\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  const v = Number(s);
  return Number.isFinite(v) && v > 0 ? v : null;
}
const grade = note => !note ? 'C' : /abundant/i.test(note) ? 'A' : /small amount|not yet completely reliable|very little/i.test(note) ? 'C' : 'B';
const ITEMS = { cocktail: /cocktail/i, diag_beer_pub: /beer in neighbourhood pub/i, diag_cappuccino_expat: /cappuccino/i };

const rows = [], rejects = [];
for (const [key, v] of Object.entries(cap)) {
  const c = panel.get(key);
  if (!c) continue;
  if (v.status !== 200 || !v.rows || !Object.keys(v.rows).length) { rejects.push({ key, reason: `no page (${v.status ?? v.error})`, tried: v.tried }); continue; }
  const pageCountry = (v.h1 || '').split(',').pop().trim();
  if (cn(pageCountry) !== cn(c.country)) { rejects.push({ key, reason: `country mismatch: page "${v.h1}"` }); continue; }
  const code = currency[c.country];
  const rate = code === 'USD' ? 1 : fx[(code || '').toLowerCase()];
  if (!(rate > 0)) { rejects.push({ key, reason: `no FX for ${c.country} (${code})` }); continue; }
  for (const [anchor, re] of Object.entries(ITEMS)) {
    const name = Object.keys(v.rows).find(n => re.test(n));
    if (!name) continue;
    const [localText, usdText] = v.rows[name];
    const local = amount(localText);
    if (!local) continue;
    const usd = local / rate;
    const pageUsd = usdText ? amount(usdText) : null;
    if (pageUsd && Math.abs(Math.log(usd / pageUsd)) > Math.log(1.2)) { rejects.push({ key, anchor, reason: `FX check failed: ${localText} -> ${usd.toFixed(2)} vs page ${usdText}` }); continue; }
    const contributors = Number((v.note || '').match(/by (\d+) different people/)?.[1]) || null;
    rows.push({ cityKey: key, city: c.city, country: c.country, region: c.region, split: splitOf(key), anchor, valueUsd: +usd.toFixed(2),
      currency: code, localValue: local, fx: code === 'USD' ? 1 : rate, contributors, source: 'expatistan', sourceFamily: 'expatistan',
      url: v.url, observedAt: (v.at || '').slice(0, 10), grade: grade(v.note), sampleSize: contributors,
      notes: `${name}: ${localText}${usdText ? ' ' + usdText : ''}. ${v.note ? 'Expatistan: prices ' + v.note.slice(0, 120) : ''}`.trim() });
  }
}
fs.writeFileSync(path.join(hcRoot, `panel/${outName}.jsonl`), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(path.join(hcRoot, `panel/${outName}.log.json`), JSON.stringify({ rows: rows.length, rejects }, null, 2) + '\n');
const by = a => rows.filter(r => r.anchor === a);
console.log(JSON.stringify({ cocktailCities: by('cocktail').length, grades: Object.fromEntries(['A', 'B', 'C'].map(g => [g, by('cocktail').filter(r => r.grade === g).length])), rejects: rejects.length }));
