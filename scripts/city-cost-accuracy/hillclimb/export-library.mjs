// Exports anchors already persisted in a library database for cities on the reference panel, as a predictions
// file. Read-only; never writes the database. Iteration 000 uses this so the program starts with a measured
// baseline at zero model cost.
//   node scripts/city-cost-accuracy/hillclimb/export-library.mjs <path/to/travel.db> <out.jsonl>
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { loadPanel, normalizeCity } from './lib.mjs';

// The research worktree installs dependencies without native builds; HC_SQLITE_FROM points at a checkout whose
// better-sqlite3 binding is built (for example the main repository).
const require = createRequire(process.env.HC_SQLITE_FROM ? `${process.env.HC_SQLITE_FROM}/package.json` : import.meta.url);
const Database = require('better-sqlite3');
const [dbPath, out] = process.argv.slice(2);
if (!dbPath || !out) throw Error('Usage: export-library.mjs <travel.db> <out.jsonl>');
const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const panelKeys = new Set(loadPanel().map(r => r.cityKey));
// Panel names that differ from library names.
const aliases = { 'bali ubud': 'bali', 'ubud': 'bali', 'new york': 'new york city', 'bogota': 'bogota' };

const rows = db.prepare(`select c.name city, co.name country, e.llm_model model, e.prompt_version promptVersion,
  e.estimated_at estimatedAt, e.anchors_json anchors from city_estimates e join cities c on c.id = e.city_id
  join countries co on co.id = c.country_id where e.is_active = 1 and e.anchors_json is not null`).all();
const lines = [];
for (const r of rows) {
  let key = normalizeCity(r.city);
  if (!panelKeys.has(key) && aliases[key] && panelKeys.has(aliases[key])) key = aliases[key];
  if (!panelKeys.has(key)) continue;
  lines.push(JSON.stringify({ cityKey: key, city: r.city, country: r.country, run: 'library', model: r.model,
    promptVersion: r.promptVersion, estimatedAt: r.estimatedAt, anchors_usd: JSON.parse(r.anchors) }));
}
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`Exported ${lines.length} library estimates on the panel (of ${rows.length} with anchors).`);
