// Prepares one review task per city photo for Codex Luna workers (owner request, 18 October 2026).
//   node scripts/city-images-review/prepare.mjs <app-root> <out-dir>
// Reads the app database read-only. Each task holds the exact worker message; images stay on disk and are never
// copied or committed. Workers answer with a verdict JSON written to <out-dir>/tasks/<cityId>/verdict.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const [appRoot, outDir] = process.argv.slice(2);
if (!appRoot || !outDir) throw Error('Usage: prepare.mjs <app-root> <out-dir>');
const require = createRequire(path.join(appRoot, 'package.json'));
const Database = require('better-sqlite3');
const db = new Database(path.join(appRoot, 'data/travel.db'), { readonly: true });
const rows = db.prepare(`select i.city_id, i.city_name, i.country_code, i.small_file, i.data_json, co.name as country
  from city_images i join cities c on c.id = i.city_id join countries co on co.id = c.country_id
  where i.status = 'ok' and i.small_file is not null order by i.city_id`).all();

const message = r => {
  const d = JSON.parse(r.data_json || '{}');
  const image = path.join(appRoot, 'data/city-images', r.small_file);
  return `Review one destination photo for a travel budgeting app.

Image file (open and look at it): ${image}
It is meant to represent: ${r.city_name}, ${r.country}
Wikipedia article it came from: ${d.articleTitle ?? 'unknown'}
Wikimedia Commons file: ${d.commonsFile ?? 'unknown'}

Decide one verdict:
- "ok": a photo that recognisably shows this place (its townscape, a landmark, a street, its landscape or coast).
- "wrong_place": it clearly shows somewhere else, for example a same-named town elsewhere or another city.
- "unsuitable": not a photo of the place: a map, flag, coat of arms, logo, diagram, document, portrait of a person,
  an indoor close-up, or too dark, blurry or tiny to recognise anything.
- "unsure": you cannot tell from the image and the titles.

Use only the image and the titles above. Do not search the web. Your final message must be only this JSON object:
{"verdict": "ok" | "wrong_place" | "unsuitable" | "unsure", "reason": "<one short sentence about what the photo shows>"}`;
};

const tasks = [];
for (const r of rows) {
  const dir = path.join(outDir, 'tasks', r.city_id);
  fs.mkdirSync(dir, { recursive: true });
  const text = message(r);
  fs.writeFileSync(path.join(dir, 'message.txt'), text);
  tasks.push({ id: r.city_id, city: r.city_name, country: r.country, commonsFile: JSON.parse(r.data_json || '{}').commonsFile ?? null,
    messageSha256: crypto.createHash('sha256').update(text).digest('hex') });
}
fs.writeFileSync(path.join(outDir, 'tasks.json'), JSON.stringify({ preparedAt: new Date().toISOString(), count: tasks.length, tasks }, null, 2) + '\n');
console.log(`Prepared ${tasks.length} photo review tasks in ${outDir}`);
