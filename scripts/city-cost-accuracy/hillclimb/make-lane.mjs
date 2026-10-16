// Copies a frozen iteration's exact tasks into a new iteration for another model lane (same prompts, same system
// prompt, same cities), so a different runtime can answer them. No prompt is re-rendered.
//   node make-lane.mjs <source-iteration> <new-iteration> "<lane label>" [--max-repeat 1]
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, sha256 } from './lib.mjs';

const [source, target, lane, ...rest] = process.argv.slice(2);
const maxRepeat = rest.includes('--max-repeat') ? Number(rest[rest.indexOf('--max-repeat') + 1]) : Infinity;
const src = path.join(hcRoot, 'iterations', source), dst = path.join(hcRoot, 'iterations', target);
if (fs.existsSync(path.join(dst, 'freeze.json'))) throw Error(`${target} already exists`);
const cand = readJson(path.join(src, 'candidate.json')), freeze = readJson(path.join(src, 'freeze.json'));
const tasks = freeze.tasks.filter(t => t.repeat <= maxRepeat);
for (const t of tasks) {
  fs.mkdirSync(path.join(dst, 'tasks', t.id), { recursive: true });
  for (const f of ['prompt.txt', 'system.txt']) fs.copyFileSync(path.join(src, 'tasks', t.id, f), path.join(dst, 'tasks', t.id, f));
  if (sha256(fs.readFileSync(path.join(dst, 'tasks', t.id, 'prompt.txt'), 'utf8')) !== t.promptSha256) throw Error(`hash mismatch ${t.id}`);
}
const { cliModel, effort, dispatch, ...rest2 } = cand;
fs.writeFileSync(path.join(dst, 'candidate.json'), JSON.stringify({ ...rest2, id: target, lane, laneOf: source,
  hypothesis: `Lane copy of ${source} answered by ${lane}. Identical frozen prompts; only the answering model differs.`,
  repeats: Math.min(cand.repeats, maxRepeat) }, null, 2) + '\n');
fs.writeFileSync(path.join(dst, 'freeze.json'), JSON.stringify({ ...freeze, laneOf: source, tasks }, null, 2) + '\n');
console.log(`${target}: ${tasks.length} tasks copied from ${source}`);
