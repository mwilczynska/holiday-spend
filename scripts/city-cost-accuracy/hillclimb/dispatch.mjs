// Runs pending prediction tasks through the headless Claude Code CLI, one fresh process per task.
//   node dispatch.mjs <iteration> [--concurrency 8] [--model claude-haiku-5-5] [--effort max] [--message luna] [--bare] [--clean-context]
//   node dispatch.mjs <iteration> --runner codex [--model gpt-6.2-sol] [--effort max] [--concurrency 6]
// --runner codex runs each task through `codex exec` on the signed-in ChatGPT account instead: the Luna worker message
// (system.txt and prompt.txt wrapped exactly as Luna's Codex subagents received them) on stdin, live web search, a
// read-only sandbox in an empty directory, no user config, rules or project docs, and no session persistence. Usage
// comes from turn.completed; every completed web_search item is recorded (each query of a search action counts as one
// WebSearch, page opens are recorded separately).
// --message luna sends, as the request, the exact message Luna (Codex) workers received (lib.mjs workerMessage:
// system.txt and prompt.txt wrapped with the same instruction lines) after checking prompt.txt against its frozen hash;
// system.txt stays the system prompt. --bare runs the CLI without user/project CLAUDE.md, hooks, skills or plugins
// (API-key auth only). --clean-context loads no setting sources (no user or project CLAUDE.md or settings) and keeps
// the signed-in account.
// Each worker gets exactly the task's system.txt (as its system prompt) and prompt.txt (as the request), with
// WebSearch as its only tool, in an empty working directory, no MCP servers and no session persistence.
// Saves response.json (the final text, verbatim) and run.json (model, usage, tool calls, timing, exit status).
// A worker that exits without a result is retried once; both attempts are recorded.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { hcRoot, readJson, sha256, workerMessage } from './lib.mjs';

const [iteration, ...rest] = process.argv.slice(2);
const opt = (name, fallback) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : fallback; };
const dir = path.join(hcRoot, 'iterations', iteration);
const cand = readJson(path.join(dir, 'candidate.json'));
const model = opt('model', cand.cliModel ?? 'claude-haiku-5-5');
const effort = opt('effort', cand.effort ?? 'max');
const tools = cand.workerTools ?? 'WebSearch';
const concurrency = Number(opt('concurrency', 8));
const runner = opt('runner', cand.runner ?? 'claude');
if (!['claude', 'codex'].includes(runner)) throw Error('--runner must be claude or codex');
const messageMode = runner === 'codex' ? 'luna' : opt('message', 'prompt');
if (!['prompt', 'luna'].includes(messageMode)) throw Error('--message must be prompt or luna');
const bare = rest.includes('--bare');
const cleanContext = rest.includes('--clean-context');
const freeze = readJson(path.join(dir, 'freeze.json'));
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-worker-'));
// Work is chunked for usage windows: repeat 1 of every city runs before any repeat 2 (so a partial run is a
// complete one-run-per-city dataset), --max-repeat skips higher repeats, and --max-tasks bounds one session.
const maxRepeat = Number(opt('max-repeat', Infinity));
const maxTasks = Number(opt('max-tasks', Infinity));
const pending = freeze.tasks.filter(t => t.repeat <= maxRepeat && !fs.existsSync(path.join(dir, 'tasks', t.id, 'response.json')))
  .sort((a, b) => a.repeat - b.repeat || a.cityKey.localeCompare(b.cityKey)).slice(0, maxTasks);
console.log(`${iteration}: ${pending.length} pending, runner ${runner}, model ${model}, effort ${effort}, concurrency ${concurrency}, message ${messageMode}${bare ? ', bare' : ''}${cleanContext ? ', clean context' : ''}`);

function requestText(task) {
  const tdir = path.join(dir, 'tasks', task.id);
  const prompt = fs.readFileSync(path.join(tdir, 'prompt.txt'), 'utf8');
  if (sha256(prompt) !== task.promptSha256) throw Error(`prompt.txt for ${task.id} does not match its frozen hash`);
  return messageMode === 'luna' ? workerMessage(fs.readFileSync(path.join(tdir, 'system.txt'), 'utf8'), prompt) : prompt;
}

function runCodexOnce(task, request) {
  const args = ['exec', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '-s', 'read-only',
    '-m', model, '-c', `model_reasoning_effort="${effort}"`, '-c', 'web_search="live"', '-c', 'project_doc_max_bytes=0', '--json', '-'];
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn('codex', args, { cwd: workDir, shell: process.platform === 'win32', windowsHide: true });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    const timer = setTimeout(() => child.kill(), 15 * 60 * 1000);
    child.on('close', code => {
      clearTimeout(timer);
      const events = out.split(/\r?\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      const items = events.filter(e => e.type === 'item.completed').map(e => e.item);
      const messages = items.filter(i => i.type === 'agent_message');
      const usage = events.filter(e => e.type === 'turn.completed').at(-1)?.usage ?? null;
      const toolCalls = items.filter(i => i.type === 'web_search').flatMap(i => i.action?.type === 'search'
        ? (i.action.queries?.length ? i.action.queries : [i.query]).map(query => ({ name: 'WebSearch', input: { query } }))
        : [{ name: i.action?.type === 'open_page' ? 'OpenPage' : 'WebSearchOther', input: { url: i.action?.url ?? null } }]);
      const otherItems = items.filter(i => !['agent_message', 'web_search', 'reasoning'].includes(i.type)).map(i => i.type);
      const failed = events.some(e => e.type === 'turn.failed' || e.type === 'error');
      resolve({ code, ms: Date.now() - started, text: messages.at(-1)?.text ?? null, isError: failed || code !== 0,
        modelUsage: usage ? { [model]: { inputTokens: usage.input_tokens, cachedInputTokens: usage.cached_input_tokens,
          outputTokens: usage.output_tokens, reasoningOutputTokens: usage.reasoning_output_tokens } } : null,
        costUsdList: null, toolCalls, otherItems, stderr: err.slice(-2000), stdoutUnparsed: events.length ? null : out.slice(-2000) });
    });
    child.stdin.end(request);
  });
}

function runOnce(task, request) {
  if (runner === 'codex') return runCodexOnce(task, request);
  const tdir = path.join(dir, 'tasks', task.id);
  const args = [...(bare ? ['--bare'] : []), ...(cleanContext ? ['--setting-sources', process.platform === 'win32' ? '""' : ''] : []), '-p', '--model', model, '--effort', effort, '--system-prompt-file', path.join(tdir, 'system.txt'),
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
    child.stdin.end(request);
  });
}

// A usage or rate limit stops the whole dispatch: no retry, no new tasks, exit code 3. Unanswered tasks stay pending.
const LIMIT_PATTERN = /usage limit|hit your limit|limit reached|rate limit|rate_limit|429|quota|resets? (at|in)/i;
let limitHit = null;
async function runTask(task) {
  const attempts = [];
  const request = requestText(task);
  for (let i = 0; i < 2; i++) {
    const startedAt = new Date().toISOString();
    const r = await runOnce(task, request);
    attempts.push({ ...r, text: undefined, hasText: !!r.text, startedAt, finishedAt: new Date().toISOString() });
    const limitText = `${r.isError || !r.text ? r.text ?? "" : ""} ${r.code !== 0 || !r.text ? r.stderr : ""}`;
    if (LIMIT_PATTERN.test(limitText)) { limitHit = limitText.trim().slice(0, 300); break; }
    if (r.text && !r.isError) {
      fs.writeFileSync(path.join(dir, 'tasks', task.id, 'response.json'), r.text);
      break;
    }
  }
  fs.writeFileSync(path.join(dir, 'tasks', task.id, 'run.json'), JSON.stringify({ runtime: runner === 'codex' ? 'codex exec' : 'claude -p', model, effort, tools: runner === 'codex' ? 'web_search (live)' : tools, message: messageMode, bare, cleanContext,
    promptSha256: task.promptSha256, requestSha256: sha256(request), attempts }, null, 2) + '\n');
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
  while (next < pending.length && !limitHit) {
    const task = pending[next++];
    if (!claim(task)) continue;
    (await runTask(task)) ? ok++ : failed++;
    console.log(`${new Date().toISOString()} ${task.id} done (${ok} ok, ${failed} failed, ${pending.length - ok - failed} left)`);
  }
}));
console.log(`Finished ${iteration}: ${ok} ok, ${failed} failed.`);
if (limitHit) { console.log(`STOPPED: usage limit: ${limitHit}`); process.exit(3); }
