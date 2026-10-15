// Composes panel/references.jsonl from the source files listed in panel/manifest.json, applying the documented
// source-to-anchor mappings. Rerun after adding a source file; the panel hash in every iteration freeze changes.
//   node build-panel.mjs
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, readJsonl, sha256 } from './lib.mjs';
import { ANCHORS } from './lib.mjs';

// node build-panel.mjs [name] composes panel/manifest[-name].json into panel/references[-name].jsonl.
const name = process.argv[2];
const manifest = readJson(path.join(hcRoot, `panel/manifest${name ? '-' + name : ''}.json`));
const rows = [];
// A source entry is a file name, or { file, anchors } to take only some anchors from it.
for (const entry of manifest.sources) {
  const file = typeof entry === 'string' ? entry : entry.file;
  const only = typeof entry === 'string' ? null : entry.anchors;
  for (const r of readJsonl(path.join(hcRoot, 'panel', file))) {
    if (!ANCHORS.includes(r.anchor)) continue; // diagnostics stay in their source file
    if (only && !only.includes(r.anchor)) continue;
    if (r.source === 'hostelworld' && r.anchor === 'hostel_private_2p' && !r.mapped) {
      // Hostelworld prices are per person; a private room for two costs twice the per-person price. The minimum
      // can be a single room, so these rows are capped at grade C.
      rows.push({ ...r, valueUsd: +(2 * r.valueUsd).toFixed(4), localValue: r.localValue * 2, grade: 'C', mapped: 'x2 per-person to room',
        notes: `${r.notes} Doubled: Hostelworld private prices are per person.` });
      continue;
    }
    rows.push(r);
  }
}
const text = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
fs.writeFileSync(path.join(hcRoot, `panel/references${name ? '-' + name : ''}.jsonl`), text);
const by = {};
for (const r of rows) by[r.anchor] = (by[r.anchor] ?? new Set()).add(r.cityKey);
const summary = { version: manifest.version, sources: manifest.sources, rows: rows.length,
  cities: new Set(rows.map(r => r.cityKey)).size, citiesPerAnchor: Object.fromEntries(Object.entries(by).map(([a, s]) => [a, s.size])),
  referencesSha256: sha256(text) };
fs.writeFileSync(path.join(hcRoot, `panel/panel-summary${name ? '-' + name : ''}.json`), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
