// Coordinator helper for in-session subagent lanes. Scans a Claude Code session's subagent transcripts, saves every
// finished agent's answer through save-agent-answer.mjs, and prints the next tasks to launch.
//   node sweep-agents.mjs <iteration> <subagents-dir> [--slots 10] [--agent-type city-cost-haiku]
// Only agents of --agent-type count (earlier stopped agents of other types are ignored).
// An agent belongs to a task when its description (meta.json) equals the task id. A task is in flight when it has an
// agent transcript without a SubagentHandback and no response.json. Prints: saved lines, then
// `inflight=<n> answered=<n>/<total>` and `NEXT <task-id> | <city> | <country>` for each free slot.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hcRoot, readJson } from './lib.mjs';

const [iteration, subDir, ...rest] = process.argv.slice(2);
const agentType = rest.includes('--agent-type') ? rest[rest.indexOf('--agent-type') + 1] : 'city-cost-haiku';
const slots = Number(rest.includes('--slots') ? rest[rest.indexOf('--slots') + 1] : 10);
const dir = path.join(hcRoot, 'iterations', iteration);
const tasks = readJson(path.join(dir, 'freeze.json')).tasks;
const ids = new Set(tasks.map(t => t.id));
const answered = id => fs.existsSync(path.join(dir, 'tasks', id, 'response.json'));
const saver = path.join(path.dirname(fileURLToPath(import.meta.url)), 'save-agent-answer.mjs');

const byTask = new Map();
for (const f of fs.readdirSync(subDir).filter(f => f.endsWith('.meta.json'))) {
  const meta = readJson(path.join(subDir, f));
  if (!ids.has(meta.description) || meta.agentType !== agentType) continue;
  const transcript = path.join(subDir, f.replace('.meta.json', '.jsonl'));
  if (!fs.existsSync(transcript)) continue;
  (byTask.get(meta.description) ?? byTask.set(meta.description, []).get(meta.description)).push({ transcript, mtime: fs.statSync(transcript).mtimeMs });
}
const inflight = new Set();
for (const [id, agents] of byTask) {
  if (answered(id)) continue;
  agents.sort((a, b) => a.mtime - b.mtime);
  const latest = agents.at(-1);
  try {
    const out = execFileSync('node', [saver, iteration, id, latest.transcript, '--attempt', String(agents.length),
      '--runtime', `Claude Code in-session subagent (${agentType}: WebSearch only)`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.write(out);
  } catch (e) {
    if (e.status === 4) { inflight.add(id); continue; } // no SubagentHandback yet: still running
    process.stdout.write(`FAILED ${id} exit=${e.status} ${(e.stderr || e.stdout || '').trim()}\n`);
  }
}
const done = tasks.filter(t => answered(t.id)).length;
console.log(`inflight=${inflight.size} answered=${done}/${tasks.length}`);
const free = Math.max(0, slots - inflight.size);
const next = tasks.filter(t => !answered(t.id) && !inflight.has(t.id) && !byTask.has(t.id)).slice(0, free);
for (const t of next) {
  const p = fs.readFileSync(path.join(dir, 'tasks', t.id, 'prompt.txt'), 'utf8').replace(/\r/g, '').split('\n');
  console.log(`NEXT ${t.id} | ${p.find(l => l.startsWith('- City: ')).slice(8)} | ${p.find(l => l.startsWith('- Country: ')).slice(11)}`);
}
