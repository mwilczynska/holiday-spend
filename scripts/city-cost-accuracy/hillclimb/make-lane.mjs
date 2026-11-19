// Copies a frozen iteration's exact tasks into a new iteration for another model lane (same prompts, same system
// prompt, same cities), so a different runtime can answer them. No prompt is re-rendered.
//   node make-lane.mjs <source-iteration> <new-iteration> "<lane label>" [--max-repeat 1] [--sample n --seed s]
// --sample keeps a fixed hash-ordered subset of cities (the same ordering iterate.mjs uses for "citySample") and records
// citySample in candidate.json, so ingest and scoring restrict to the same cities.
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, sha256 } from './lib.mjs';

const [source, target, lane, ...rest] = process.argv.slice(2);
const maxRepeat = rest.includes('--max-repeat') ? Number(rest[rest.indexOf('--max-repeat') + 1]) : Infinity;
const sampleN = rest.includes('--sample') ? Number(rest[rest.indexOf('--sample') + 1]) : null;
const sampleSeed = rest.includes('--seed') ? rest[rest.indexOf('--seed') + 1] : null;
if (sampleN !== null && !sampleSeed) throw Error('--sample needs --seed');
const src = path.join(hcRoot, 'iterations', source), dst = path.join(hcRoot, 'iterations', target);
if (fs.existsSync(path.join(dst, 'freeze.json'))) throw Error(`${target} already exists`);
const cand = readJson(path.join(src, 'candidate.json')), freeze = readJson(path.join(src, 'freeze.json'));
let tasks = freeze.tasks.filter(t => t.repeat <= maxRepeat);
if (sampleN !== null) {
  const keys = [...new Set(tasks.map(t => t.cityKey))].sort((a, b) => sha256(`${sampleSeed}|${a}`).localeCompare(sha256(`${sampleSeed}|${b}`))).slice(0, sampleN);
  const keep = new Set(keys);
  tasks = tasks.filter(t => keep.has(t.cityKey));
}
for (const t of tasks) {
  fs.mkdirSync(path.join(dst, 'tasks', t.id), { recursive: true });
  for (const f of ['prompt.txt', 'system.txt']) fs.copyFileSync(path.join(src, 'tasks', t.id, f), path.join(dst, 'tasks', t.id, f));
  if (sha256(fs.readFileSync(path.join(dst, 'tasks', t.id, 'prompt.txt'), 'utf8')) !== t.promptSha256) throw Error(`hash mismatch ${t.id}`);
}
const { cliModel, effort, dispatch, ...rest2 } = cand;
fs.writeFileSync(path.join(dst, 'candidate.json'), JSON.stringify({ ...rest2, id: target, lane, laneOf: source,
  hypothesis: `Lane copy of ${source} answered by ${lane}. Identical frozen prompts; only the answering model differs.`,
  repeats: Math.min(cand.repeats, maxRepeat),
  ...(sampleN !== null ? { citySample: { n: sampleN, seed: sampleSeed } } : {}) }, null, 2) + '\n');
fs.writeFileSync(path.join(dst, 'freeze.json'), JSON.stringify({ ...freeze, laneOf: source, tasks }, null, 2) + '\n');
console.log(`${target}: ${tasks.length} tasks copied from ${source}`);
