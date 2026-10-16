// Runs pending prediction tasks through the headless Claude Code CLI, one fresh process per task.
//   node dispatch.mjs <iteration> [--concurrency 8] [--model claude-haiku-5-5] [--effort max]
// Each worker gets exactly the task's system.txt (as its system prompt) and prompt.txt (as the request), with
// WebSearch as its only tool, in an empty working directory, no MCP servers and no session persistence.
// Saves response.json (the final text, verbatim) and run.json (model, usage, tool calls, timing, exit status).
// A worker that exits without a result is retried once; both attempts are recorded.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { hcRoot, readJson } from './lib.mjs';

const [iteration, ...rest] = process.argv.slice(2);
const opt = (name, fallback) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : fallback; };
const dir = path.join(hcRoot, 'iterations', iteration);
const cand = readJson(path.join(dir, 'candidate.json'));
const model = opt('model', cand.cliModel ?? 'claude-haiku-5-5');
const effort = opt('effort', cand.effort ?? 'max');
const tools = cand.workerTools ?? 'WebSearch';
const concurrency = Number(opt('concurrency', 8));
const freeze = readJson(path.join(dir, 'freeze.json'));
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-worker-'));
// Work is chunked for usage windows: repeat 1 of every city runs before any repeat 2 (so a partial run is a
// complete one-run-per-city dataset), --max-repeat skips higher repeats, and --max-tasks bounds one session.
const maxRepeat = Number(opt('max-repeat', Infinity));
const maxTasks = Number(opt('max-tasks', Infinity));
const pending = freeze.tasks.filter(t => t.repeat <= maxRepeat && !fs.existsSync(path.join(dir, 'tasks', t.id, 'response.json')))
  .sort((a, b) => a.repeat - b.repeat || a.cityKey.localeCompare(b.cityKey)).slice(0, maxTasks);
console.log(`${iteration}: ${pending.length} pending, model ${model}, effort ${effort}, concurrency ${concurrency}`);

function runOnce(task) {
  const tdir = path.join(dir, 'tasks', task.id);
  const args = ['-p', '--model', model, '--effort', effort, '--system-prompt-file', path.join(tdir, 'system.txt'),
    '--tools', tools, '--allowedTools', tools, '--strict-mcp-config', '--no-session-persistence', '--output-format', 'json'];
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn('claude', args, { cwd: workDir, shell: process.platform === 'win32', windowsHide: true });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    const timer = setTimeout(() => child.kill(), 15 * 60 * 1000);
    child.on('close', code => {
      clearTimeout(timer);
      let events = null;
      try { events = JSON.parse(out); } catch { /* recorded below */ }
      const list = Array.isArray(events) ? events : events ? [events] : [];
      const result = list.find(e => e.type === 'result');
      const toolCalls = list.filter(e => e.type === 'assistant').flatMap(e => (e.message?.content ?? [])
        .filter(c => c.type === 'tool_use').map(c => ({ name: c.name, input: c.input })));
      resolve({ code, ms: Date.now() - started, text: result?.result ?? null, isError: result?.is_error ?? null,
        modelUsage: result?.modelUsage ?? null, costUsdList: result?.total_cost_usd ?? null, toolCalls,
        stderr: err.slice(-2000), stdoutUnparsed: events ? null : out.slice(-2000) });
    });
    fs.createReadStream(path.join(tdir, 'prompt.txt')).pipe(child.stdin);
  });
}

async function runTask(task) {
  const attempts = [];
  for (let i = 0; i < 2; i++) {
    const r = await runOnce(task);
    attempts.push({ ...r, text: undefined, hasText: !!r.text });
    if (r.text && !r.isError) {
      fs.writeFileSync(path.join(dir, 'tasks', task.id, 'response.json'), r.text);
      break;
    }
  }
  fs.writeFileSync(path.join(dir, 'tasks', task.id, 'run.json'), JSON.stringify({ model, effort, tools, attempts }, null, 2) + '\n');
  return fs.existsSync(path.join(dir, 'tasks', task.id, 'response.json')); // success means an answer was saved
}

// Atomic per-task claim so overlapping dispatchers never run the same task; claims older than 20 minutes without
// a response are treated as abandoned.
function claim(task) {
  const file = path.join(dir, 'tasks', task.id, '.claim');
  if (fs.existsSync(path.join(dir, 'tasks', task.id, 'response.json'))) return false;
  try { fs.writeFileSync(file, `${process.pid} ${new Date().toISOString()}`, { flag: 'wx' }); return true; } catch {
    if (Date.now() - fs.statSync(file).mtimeMs < 20 * 60 * 1000) return false;
    fs.writeFileSync(file, `${process.pid} ${new Date().toISOString()}`); return true;
  }
}

let next = 0, ok = 0, failed = 0;
await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
  while (next < pending.length) {
    const task = pending[next++];
    if (!claim(task)) continue;
    (await runTask(task)) ? ok++ : failed++;
    console.log(`${new Date().toISOString()} ${task.id} done (${ok} ok, ${failed} failed, ${pending.length - ok - failed} left)`);
  }
}));
console.log(`Finished ${iteration}: ${ok} ok, ${failed} failed.`);
