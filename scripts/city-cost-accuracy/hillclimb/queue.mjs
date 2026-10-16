// Prints the pending tasks of an iteration in collection priority order, for runtimes that answer tasks by hand
// (for example Codex subagents). Priority: repeat 1 before repeat 2, then the original 54 R1 dev cities, then the rest.
//   node queue.mjs <iteration> [--limit 20]        (prints absolute task folders, one per line)
//   node queue.mjs --status                         (pending counts for every iteration)
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, readJsonl } from './lib.mjs';

const args = process.argv.slice(2);
const iterDir = path.join(hcRoot, 'iterations');
const r1 = new Set(readJsonl(path.join(hcRoot, 'panel/r0-numbeo.jsonl')).map(r => r.cityKey));
const pendingOf = it => {
  const f = path.join(iterDir, it, 'freeze.json');
  if (!fs.existsSync(f) || fs.existsSync(path.join(iterDir, it, 'WITHDRAWN.md'))) return null;
  return readJson(f).tasks.filter(t => !fs.existsSync(path.join(iterDir, it, 'tasks', t.id, 'response.json')))
    .sort((a, b) => a.repeat - b.repeat || (r1.has(b.cityKey) - r1.has(a.cityKey)) || a.cityKey.localeCompare(b.cityKey));
};
if (args[0] === '--status') {
  for (const it of fs.readdirSync(iterDir).sort()) {
    const p = pendingOf(it);
    if (!p) continue;
    const total = readJson(path.join(iterDir, it, 'freeze.json')).tasks.length;
    if (p.length) console.log(`${it.padEnd(40)} pending ${String(p.length).padStart(4)} / ${total}  (repeat-1 pending ${p.filter(t => t.repeat === 1).length})`);
  }
} else {
  const it = args[0], limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : 20;
  for (const t of pendingOf(it).slice(0, limit)) console.log(path.join(iterDir, it, 'tasks', t.id));
}
