// Calibrates a new model (or a new effort of a known model) for the v1.2 two-layer correction in one command:
//   node calibrate-model.mjs --model <id> --effort <effort> --runner claude|codex --app-repo <path> --version <version>
//     [--label "Claude Sonnet 6"] [--match "^claude-sonnet-6(?:-|$)"] [--lane <iteration id>] [--concurrency 6] [--no-dispatch]
// 1. Creates a lane of Luna's frozen v1.2 prompts for the fixed 40-city calibration set (first 40 dev cities of the
//    sweep hash order, seed sweep-2026-11-19), unless it exists.
// 2. Answers it on the subscription (dispatch.mjs: claude -p, or codex exec with --runner codex). A usage limit stops
//    the run (exit 3); rerun the same command to continue.
// 3. Adds the lane to model-adjustment-lanes.json under the model (efforts of one model are pooled).
// 4. Scores the lane with the app's current adjustments, rebuilds the adjustments into the app repository, and scores
//    again, printing both. The after-score is in sample for the new model's own factor; it is shrunk towards the
//    other models (w = n / (n + 20)) so the optimism is small, and held-out confirmation is a separate, deliberate step.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { hcRoot, readJson } from './lib.mjs';

const rest = process.argv.slice(2);
const opt = (n, f) => (rest.includes(`--${n}`) ? rest[rest.indexOf(`--${n}`) + 1] : f);
const model = opt('model'), effort = opt('effort'), runner = opt('runner', 'claude'), appRepo = opt('app-repo'), version = opt('version');
if (!model || !effort || !appRepo || !version) throw Error('Usage: calibrate-model.mjs --model <id> --effort <effort> --runner claude|codex --app-repo <path> --version <version>');
if (!['claude', 'codex'].includes(runner)) throw Error('--runner must be claude or codex');
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const label = opt('label', model), match = opt('match', `^${escape(model)}(?:-|$)`);
const lane = opt('lane', `cal-${model.replace(/[^a-z0-9.]+/gi, '-')}-${effort}`);
const scripts = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const env = { ...process.env, HC_PANEL: 'references-r4.jsonl' };
const run = (script, args) => { const r = spawnSync(process.execPath, [path.join(scripts, script), ...args], { stdio: 'inherit', env }); return r.status; };
const adjustmentsFile = path.join(appRepo, 'src/lib/data/city-cost-model-adjustments-v1-2.json');

const laneDir = path.join(hcRoot, 'iterations', lane);
if (!fs.existsSync(path.join(laneDir, 'freeze.json'))) {
  if (run('make-lane.mjs', ['102-search-food-drink-luna-r2', lane, `${model}/${effort} (${runner === 'codex' ? 'codex exec' : 'claude -p'} on subscription, Luna worker message, web search only, clean context; 40-city calibration)`,
    '--max-repeat', '1', '--sample', '40', '--seed', 'sweep-2026-11-19']) !== 0) process.exit(1);
  const candFile = path.join(laneDir, 'candidate.json'), cand = readJson(candFile);
  Object.assign(cand, { cliModel: model, effort, ...(runner === 'codex' ? { runner: 'codex' } : {}),
    dispatch: `node scripts/city-cost-accuracy/hillclimb/dispatch.mjs ${lane} ${runner === 'codex' ? '--runner codex' : '--message luna --clean-context'}` });
  fs.writeFileSync(candFile, JSON.stringify(cand, null, 2) + '\n');
}
if (!rest.includes('--no-dispatch')) {
  const code = run('dispatch.mjs', [lane, '--concurrency', opt('concurrency', runner === 'codex' ? '3' : '6'),
    ...(runner === 'codex' ? ['--runner', 'codex'] : ['--message', 'luna', '--clean-context'])]);
  if (code !== 0) { console.error(`dispatch exited ${code}; rerun this command to continue`); process.exit(code); }
}
const answered = readJson(path.join(laneDir, 'freeze.json')).tasks.filter(t => fs.existsSync(path.join(laneDir, 'tasks', t.id, 'response.json'))).length;
if (answered < 30) { console.error(`${lane}: only ${answered} of 40 answered; rerun to continue before fitting`); process.exit(2); }

const configFile = path.join(hcRoot, 'model-adjustment-lanes.json'), config = readJson(configFile);
let entry = config.models.find(m => m.id === model);
if (!entry) { entry = { id: model, label, match, lanes: [] }; config.models.push(entry); }
if (!entry.lanes.includes(lane)) entry.lanes.push(lane);
fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');

console.log('\nBefore (current app adjustments):');
if (fs.existsSync(adjustmentsFile)) run('score-adjustments.mjs', [appRepo, adjustmentsFile, lane]);
if (run('build-model-adjustments.mjs', [appRepo, adjustmentsFile, '--version', version]) !== 0) process.exit(1);
console.log('\nAfter (rebuilt adjustments, written to the app repository):');
run('score-adjustments.mjs', [appRepo, adjustmentsFile, lane]);
console.log(`\nNext: review ${adjustmentsFile}, run the app baseline, and recorrect stored cities (scripts/recorrect-city-costs.ts --dry-run first).`);
