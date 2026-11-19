// Saves one in-session Claude Code subagent's answer for a frozen task, straight from the subagent's JSONL transcript,
// so neither the request nor the answer passes through the coordinator's retyping.
//   node save-agent-answer.mjs <iteration> <task-id> <transcript.jsonl> [--attempt n] [--notes "..."]
// Checks: the transcript's first user message equals the Luna worker message (lib.mjs workerMessage) for that task,
// compared after normalising CRLF to LF, because an agent prompt cannot carry carriage returns. Writes response.json
// (final assistant text, verbatim) and run.json (model, effort, timing, web searches, usage, hashes). Refuses to
// overwrite an existing response.json. Exit code 2 on a request mismatch (nothing written).
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, sha256, workerMessage } from './lib.mjs';

const [iteration, taskId, transcript, ...rest] = process.argv.slice(2);
const opt = (n, d) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : d; };
if (!iteration || !taskId || !transcript) throw Error('Usage: save-agent-answer.mjs <iteration> <task-id> <transcript.jsonl>');
const dir = path.join(hcRoot, 'iterations', iteration);
const task = readJson(path.join(dir, 'freeze.json')).tasks.find(t => t.id === taskId);
if (!task) throw Error(`No frozen task ${taskId} in ${iteration}`);
const tdir = path.join(dir, 'tasks', taskId);
if (fs.existsSync(path.join(tdir, 'response.json'))) throw Error(`${taskId} already has response.json`);
const prompt = fs.readFileSync(path.join(tdir, 'prompt.txt'), 'utf8');
if (sha256(prompt) !== task.promptSha256) throw Error(`prompt.txt for ${taskId} does not match its frozen hash`);
const lf = s => s.replace(/\r\n/g, '\n');
const expected = lf(workerMessage(fs.readFileSync(path.join(tdir, 'system.txt'), 'utf8'), prompt));

const events = fs.readFileSync(transcript, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const textOf = content => typeof content === 'string' ? content
  : (content ?? []).filter(c => c.type === 'text').map(c => c.text).join('');
const users = events.filter(e => e.type === 'user' && e.message?.role === 'user');
const request = textOf(users[0]?.message?.content);
if (lf(request) !== expected) {
  console.error(`REQUEST MISMATCH ${taskId}: transcript request sha ${sha256(lf(request))}, expected ${sha256(expected)}`);
  process.exit(2);
}
const assistants = events.filter(e => e.type === 'assistant' && e.message);
const toolUses = assistants.flatMap(e => (e.message.content ?? []).filter(c => c.type === 'tool_use' || c.type === 'server_tool_use'));
// In-session subagents deliver their final report as the `message` of a SubagentHandback call; plain final text is the
// fallback for runtimes without it.
const handback = toolUses.filter(c => c.name === 'SubagentHandback').at(-1);
const searches = toolUses.filter(c => c.name === 'WebSearch').length;
const fetches = toolUses.filter(c => c.name === 'WebFetch').length;
const otherTools = [...new Set(toolUses.filter(c => !['WebSearch', 'WebFetch', 'SubagentHandback', 'ToolSearch'].includes(c.name)).map(c => c.name))];
const last = [...assistants].reverse().find(e => textOf(e.message.content).trim());
const answer = handback ? String(handback.input?.message ?? '') || null : last ? textOf(last.message.content) : null;
if (!handback && !rest.includes('--no-handback-ok')) {
  console.error(`${taskId}: no SubagentHandback yet; the agent may still be running`);
  process.exit(4);
}
const models = [...new Set(assistants.map(e => e.message.model).filter(Boolean))];
const usage = assistants.reduce((u, e) => {
  for (const k of ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']) u[k] += e.message.usage?.[k] ?? 0;
  return u;
}, { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
const times = events.map(e => e.timestamp).filter(Boolean).sort();
if (answer) fs.writeFileSync(path.join(tdir, 'response.json'), answer);
fs.writeFileSync(path.join(tdir, 'run.json'), JSON.stringify({ runtime: opt('runtime', 'Claude Code in-session subagent'),
  model: models.length === 1 ? models[0] : models, effort: 'max', startedAt: times[0] ?? null, finishedAt: times.at(-1) ?? null,
  attempts: Number(opt('attempt', 1)), searches, fetches, otherTools, delivery: handback ? 'SubagentHandback' : 'final text', usage, promptSha256: task.promptSha256,
  requestSha256Lf: sha256(expected), requestCheck: 'transcript first user message equals Luna worker message (LF-normalised)',
  hasAnswer: !!answer, notes: opt('notes', '') }, null, 2) + '\n');
console.log(`${taskId}: ${answer ? 'saved' : 'NO ANSWER'} model=${models.join(',')} searches=${searches} fetches=${fetches}${otherTools.length ? ` otherTools=${otherTools.join(',')}` : ''} out=${usage.output_tokens}`);
if (!answer) process.exit(3);
