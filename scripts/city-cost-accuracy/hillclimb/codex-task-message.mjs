// Prints the exact message to give one Luna worker for a frozen task, after checking the prompt against its frozen
// hash. Copy the printed message verbatim; never retype prompt text (a retyped prompt caused the Alicante deviation).
//   node codex-task-message.mjs <iteration> <task-id>
// Prints the message between BEGIN/END markers, then the prompt SHA-256 for the run record.
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, sha256 } from './lib.mjs';

const [iteration, taskId] = process.argv.slice(2);
if (!iteration || !taskId) throw Error('Usage: codex-task-message.mjs <iteration> <task-id>');
const dir = path.join(hcRoot, 'iterations', iteration);
const task = readJson(path.join(dir, 'freeze.json')).tasks.find(t => t.id === taskId);
if (!task) throw Error(`No frozen task ${taskId} in ${iteration}`);
const tdir = path.join(dir, 'tasks', taskId);
if (fs.existsSync(path.join(tdir, 'response.json'))) throw Error(`${taskId} already has response.json; do not re-answer it`);
const prompt = fs.readFileSync(path.join(tdir, 'prompt.txt'), 'utf8');
const system = fs.readFileSync(path.join(tdir, 'system.txt'), 'utf8');
if (sha256(prompt) !== task.promptSha256) throw Error(`prompt.txt for ${taskId} does not match its frozen hash; stop and report`);
const message = `System instruction:\n${system.trim()}\n\nUser request:\n${prompt.trim()}\n\nFollow the request exactly. Use web search only where the request permits it. Your final message must be only the JSON object the request asks for.`;
console.log('=====BEGIN WORKER MESSAGE=====');
console.log(message);
console.log('=====END WORKER MESSAGE=====');
console.log(`promptSha256=${task.promptSha256}`);
