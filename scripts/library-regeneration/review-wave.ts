/**
 * Read-only review of regeneration answers before they are saved: computes what v1.2 would store for each answered,
 * not-yet-saved city and compares it with the city's current values in the app database.
 *   (from the app checkout) npx tsx <research>/scripts/library-regeneration/review-wave.ts <cities-dir>
 * Flags: unparseable or schema-invalid answers, no web search, exchange-rate observations older than 5 days, and
 * 3-star or mid-range food values that move by more than a factor of two (the correction alone moves 3-star by about
 * 0.6, so a fall to about 0.6x is expected).
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

// The app code (v1.2 on main) is loaded from the current working directory, the app checkout.
const appModule = (rel: string) => import(pathToFileURL(path.resolve(process.cwd(), rel)).href);
async function main() {
const { db } = await appModule('src/db/index.ts');
const { cities } = await appModule('src/db/schema.ts');
const { materializeCityCostV12 } = await appModule('src/lib/city-cost-methodology-v1-2.ts');

const dir = process.argv[2];
if (!dir) throw new Error('Usage: review-wave.ts <cities-dir>');
const current = new Map<string, any>(db.select().from(cities).all().map((row: any) => [row.id, row]));
const ids = fs.readdirSync(dir).filter((f) => f.endsWith('.provenance.json')).map((f) => f.replace(/\.provenance\.json$/, ''));
const now = new Date();
const rows: Array<Record<string, unknown>> = [];
const flags: string[] = [];

for (const id of ids.sort()) {
  if (fs.existsSync(path.join(dir, `${id}.result.json`)) && JSON.parse(fs.readFileSync(path.join(dir, `${id}.result.json`), 'utf8')).ok) continue;
  if (!fs.existsSync(path.join(dir, `${id}.response.json`))) continue; // a worker still writing its pair
  const meta = JSON.parse(fs.readFileSync(path.join(dir, `${id}.prompt.json`), 'utf8'));
  const provenance = JSON.parse(fs.readFileSync(path.join(dir, `${id}.provenance.json`), 'utf8'));
  const text = fs.readFileSync(path.join(dir, `${id}.response.json`), 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch {
    flags.push(`${id}: unparseable answer`);
    continue;
  }
  if (provenance.web_search_used !== true) flags.push(`${id}: no web search recorded`);
  let v12;
  try {
    v12 = materializeCityCostV12(parsed, { countryName: meta.countryName }, now);
  } catch (error) {
    flags.push(`${id}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
    continue;
  }
  const ageDays = (now.getTime() - Date.parse(`${v12.fx.asOfDate}T00:00:00Z`)) / 86_400_000;
  if (ageDays > 5) flags.push(`${id}: exchange rate dated ${v12.fx.asOfDate} (${ageDays.toFixed(1)} days old)`);
  const city = current.get(id);
  const ratio = (next: number | undefined, prev: number | null | undefined) => (next && prev ? next / prev : null);
  const r3 = ratio(v12.mappedEstimate.accom3star, city?.accom3star);
  const rFood = ratio(v12.mappedEstimate.foodMid, city?.foodMid);
  if (r3 !== null && (r3 < 0.3 || r3 > 1.6)) flags.push(`${id}: 3-star ${city?.accom3star} -> ${v12.mappedEstimate.accom3star} AUD (x${r3.toFixed(2)})`);
  if (rFood !== null && (rFood < 0.5 || rFood > 2)) flags.push(`${id}: mid-range food ${city?.foodMid} -> ${v12.mappedEstimate.foodMid} AUD (x${rFood.toFixed(2)})`);
  rows.push({ id, r3, rFood });
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
console.log(JSON.stringify({
  reviewed: rows.length,
  median3StarRatio: median(rows.map((r) => r.r3 as number).filter(Boolean)),
  medianMidFoodRatio: median(rows.map((r) => r.rFood as number).filter(Boolean)),
  flags,
}, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
