// Hill-climb iteration harness. See research/city-cost-accuracy/hillclimb/PROGRAM.md.
//
//   node iterate.mjs prepare <iteration>   render exact prompts for every dev city x repeat; freeze the candidate
//   node iterate.mjs status  <iteration>   list tasks still lacking response.json
//   node iterate.mjs ingest  <iteration>   validate responses, apply transform, write predictions + dev score
//   node iterate.mjs assess  <iteration> [--against <iteration>]   paired comparison and frozen acceptance rule
//
// An iteration directory holds candidate.json. Prediction agents receive only tasks/<id>/prompt.txt and
// system.txt, and write tasks/<id>/response.json with the model's raw answer. A replay iteration
// ("replayFrom") reuses another iteration's responses and changes only the deterministic transform.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { repo, hcRoot, sha256, readJson, readJsonl, loadPanel, ANCHORS, pairedBootstrap } from './lib.mjs';

const [command, iteration, ...rest] = process.argv.slice(2);
if (!command || !iteration || !/^[0-9]{3}[a-z0-9-]*$/.test(iteration)) throw Error('Usage: iterate.mjs <prepare|status|ingest|assess> <NNN-slug>');
const dir = path.join(hcRoot, 'iterations', iteration);
const cand = readJson(path.join(dir, 'candidate.json'));
const taskDir = id => path.join(dir, 'tasks', id);
const split = cand.split ?? 'dev';

function panelCities() {
  const seen = new Map();
  for (const r of loadPanel()) if (r.split === split && !seen.has(r.cityKey)) seen.set(r.cityKey, r);
  return [...seen.values()].sort((a, b) => a.cityKey.localeCompare(b.cityKey));
}
const taskId = (cityKey, k) => `${cityKey.replace(/ /g, '-')}-r${k}`;

// Same substitution as buildCityGenerationV11Prompt: first occurrence of each placeholder.
// A candidate may build per-city extra context ("contextBuilder": module whose default export maps a panel city to
// text), filling the same {{EXTRA_CONTEXT}} slot the app exposes.
const contextBuilder = cand.contextBuilder ? (await import(pathToFileURL(path.join(dir, cand.contextBuilder)))).default : null;
function render(template, city) {
  const extra = contextBuilder ? contextBuilder(city) : cand.extraContext;
  return template.replace('{{CITY}}', city.city).replace('{{COUNTRY}}', city.country)
    .replace('{{REFERENCE_DATE}}', cand.referenceDate?.trim() || 'current best available estimate')
    .replace('{{EXTRA_CONTEXT}}', () => extra?.trim() || 'none');
}

if (command === 'prepare') {
  // Test-split tasks contain only city and country, never references. They are allowed solely for registered
  // sealed confirmations ("sealedConfirmation": true); their answers are scored by the coordinator with score.mjs --test.
  if (split === 'test' && cand.sealedConfirmation !== true) throw Error('Iterations run on dev only; test evaluation uses score.mjs --test at milestones');
  if (cand.replayFrom) { console.log(`Replay iteration: reuses ${cand.replayFrom} responses; nothing to dispatch.`); process.exit(0); }
  const templatePath = path.resolve(cand.promptTemplate.startsWith('docs/') ? repo : dir, cand.promptTemplate);
  const template = fs.readFileSync(templatePath, 'utf8');
  const system = cand.systemPrompt ?? 'You are a careful travel cost estimation assistant. Return valid JSON only.';
  const freeze = { candidateSha256: sha256(fs.readFileSync(path.join(dir, 'candidate.json'))),
    templateSha256: sha256(template), panelSha256: sha256(fs.readFileSync(path.join(hcRoot, 'panel/references.jsonl'))),
    tasks: [] };
  for (const city of panelCities()) for (let k = 1; k <= cand.repeats; k++) {
    const id = taskId(city.cityKey, k), prompt = render(template, city);
    fs.mkdirSync(taskDir(id), { recursive: true });
    for (const [name, text] of [['prompt.txt', prompt], ['system.txt', system]]) {
      const file = path.join(taskDir(id), name);
      if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') !== text) throw Error(`Frozen task differs: ${id}/${name}`);
      fs.writeFileSync(file, text);
    }
    freeze.tasks.push({ id, cityKey: city.cityKey, repeat: k, promptSha256: sha256(prompt) });
  }
  const freezeFile = path.join(dir, 'freeze.json'), text = JSON.stringify(freeze, null, 2) + '\n';
  if (fs.existsSync(freezeFile) && fs.readFileSync(freezeFile, 'utf8') !== text) throw Error('Candidate changed after freeze; register a new iteration');
  fs.writeFileSync(freezeFile, text);
  console.log(`Prepared ${freeze.tasks.length} tasks (${freeze.tasks.length / cand.repeats} cities x ${cand.repeats}).`);
} else if (command === 'status') {
  const freeze = readJson(path.join(dir, 'freeze.json'));
  const pending = freeze.tasks.filter(t => !fs.existsSync(path.join(taskDir(t.id), 'response.json')));
  console.log(JSON.stringify({ total: freeze.tasks.length, pending: pending.length, ids: pending.map(t => t.id) }));
} else if (command === 'ingest') {
  const sourceDir = cand.replayFrom ? path.join(hcRoot, 'iterations', cand.replayFrom) : dir;
  const freeze = readJson(path.join(sourceDir, 'freeze.json'));
  const transform = cand.transform ? (await import(pathToFileURL(path.join(dir, cand.transform)))).default : null;
  const cities = new Map(panelCities().map(c => [c.cityKey, c]));
  const out = [], failures = [];
  for (const t of freeze.tasks) {
    const responseFile = path.join(sourceDir, 'tasks', t.id, 'response.json');
    const prompt = fs.readFileSync(path.join(sourceDir, 'tasks', t.id, 'prompt.txt'), 'utf8');
    if (sha256(prompt) !== t.promptSha256) throw Error(`Prompt changed after freeze: ${t.id}`);
    let anchors = {}, status = 'valid', note = null, fx = null;
    if (!fs.existsSync(responseFile)) { status = 'missing'; }
    else {
      const raw = fs.readFileSync(responseFile, 'utf8');
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        try { parsed = m ? JSON.parse(m[0]) : null; note = 'extracted JSON from surrounding text'; } catch { parsed = null; }
      }
      // Candidates may elicit anchors in local currency ("localCurrency": { "anchorsField", "currencyField",
      // "fxFile" }); they are converted to USD with the frozen panel FX, never the model's own rate.
      const lc = cand.localCurrency;
      let a = parsed?.[lc?.anchorsField ?? 'anchors_usd'], rate = 1;
      if (lc && parsed) {
        const code = String(parsed[lc.currencyField] ?? '').toLowerCase();
        rate = readJson(path.join(hcRoot, lc.fxFile)).usd[code];
        if (!(rate > 0)) { a = null; note = `unknown currency ${code}`; }
      }
      const bad = ANCHORS.filter(k => !(Number.isFinite(a?.[k]) && a[k] > 0));
      if (!parsed) status = 'unparseable';
      else if (bad.length) { status = 'invalid'; note = note ?? `invalid anchors: ${bad.join(',')}`; }
      else anchors = Object.fromEntries(ANCHORS.map(k => [k, a[k] / rate]));
      fx = parsed?.fx ?? null;
    }
    if (status !== 'valid') failures.push({ id: t.id, status, note });
    const city = cities.get(t.cityKey);
    if (status === 'valid' && transform) anchors = transform({ ...anchors }, { cityKey: t.cityKey, city: city.city, country: city.country, region: city.region });
    out.push({ cityKey: t.cityKey, run: t.id, model: cand.lane, iteration, status, note,
      fxAsOf: fx?.as_of_date ?? null, anchors_usd: anchors });
  }
  const predictions = path.join(dir, 'predictions.jsonl');
  fs.writeFileSync(predictions, out.map(r => JSON.stringify(r)).join('\n') + '\n');
  if (split === 'test') {
    // Sealed split: never score here. The coordinator scores once with score.mjs --test, which logs the access.
    fs.writeFileSync(path.join(dir, 'ingest.json'), JSON.stringify({ tasks: out.length, failures }, null, 2) + '\n');
    console.log(JSON.stringify({ tasks: out.length, failures: failures.length, scored: false, note: 'sealed test split; not scored' }));
    process.exit(0);
  }
  const score = execFileSync(process.execPath, [path.join(repo, 'scripts/city-cost-accuracy/hillclimb/score.mjs'), predictions], { encoding: 'utf8' });
  fs.writeFileSync(path.join(dir, 'score-dev.json'), score);
  const g = JSON.parse(score).groups.all;
  fs.writeFileSync(path.join(dir, 'ingest.json'), JSON.stringify({ tasks: out.length, failures }, null, 2) + '\n');
  console.log(JSON.stringify({ tasks: out.length, failures: failures.length, primaryLoss: g?.primaryLoss, pooledRepeatLoss: g?.pooledRepeatLoss }));
} else if (command === 'assess') {
  const ai = rest.indexOf('--against');
  const against = ai >= 0 ? rest[ai + 1] : cand.parent;
  if (!against) throw Error('No parent/incumbent to assess against');
  const loadFull = it => readJson(path.join(hcRoot, 'iterations', it, 'score-dev.json'));
  if (loadFull(against).panelSha256 !== loadFull(iteration).panelSha256) throw Error('Scores use different panel versions; run rescore first');
  const base = loadFull(against).groups.all, next = loadFull(iteration).groups.all;
  const fails = it => { const f = path.join(hcRoot, 'iterations', it, 'ingest.json'); return fs.existsSync(f) ? readJson(f).failures.length / readJson(f).tasks : 0; };
  const boot = pairedBootstrap(base.cityLosses, next.cityLosses);
  // Frozen acceptance rule (PROGRAM.md section 5). Do not edit without a dated program revision.
  const RULE = { minMeanImprovement: 0.015, maxAnchorRegression: 0.05, maxFailureRateIncrease: 0.02, minPairedShare: 0.9 };
  const regressions = Object.entries(next.perAnchor).filter(([a, s]) => base.perAnchor[a] && s.meanAbsLog - base.perAnchor[a].meanAbsLog > RULE.maxAnchorRegression).map(([a]) => a);
  const pairedShare = boot.cities / Math.max(base.cities, next.cities);
  const failureIncrease = fails(iteration) - fails(against);
  let verdict;
  if (pairedShare < RULE.minPairedShare) verdict = 'invalid_coverage';
  else if (boot.meanImprovement >= RULE.minMeanImprovement && boot.lower95 > 0 && !regressions.length && failureIncrease <= RULE.maxFailureRateIncrease) verdict = 'accept';
  else if (boot.meanImprovement >= RULE.minMeanImprovement && !regressions.length) verdict = 'promising_extend';
  else verdict = 'reject';
  const result = { iteration, against, verdict, rule: RULE, bootstrap: boot, baseLoss: base.primaryLoss, candidateLoss: next.primaryLoss,
    anchorRegressions: regressions, failureRateIncrease: failureIncrease,
    perAnchorDelta: Object.fromEntries(Object.keys(next.perAnchor).filter(a => base.perAnchor[a]).map(a => [a, next.perAnchor[a].meanAbsLog - base.perAnchor[a].meanAbsLog])) };
  fs.writeFileSync(path.join(dir, 'verdict.json'), JSON.stringify(result, null, 2) + '\n');
  const board = path.join(hcRoot, 'leaderboard.csv');
  if (!fs.existsSync(board)) fs.writeFileSync(board, 'iteration,against,lane,verdict,candidate_loss,base_loss,mean_improvement,lower95,upper95,cities,hypothesis\n');
  fs.appendFileSync(board, [iteration, against, cand.lane, verdict, next.primaryLoss.toFixed(4), base.primaryLoss.toFixed(4),
    boot.meanImprovement.toFixed(4), boot.lower95.toFixed(4), boot.upper95.toFixed(4), boot.cities,
    JSON.stringify(cand.hypothesis ?? '')].join(',') + '\n');
  console.log(JSON.stringify(result, null, 2));
} else if (command === 'rescore') {
  // Re-scores saved predictions against the current panel (no model calls). Use after the panel grows.
  const score = execFileSync(process.execPath, [path.join(repo, 'scripts/city-cost-accuracy/hillclimb/score.mjs'), path.join(dir, 'predictions.jsonl')], { encoding: 'utf8' });
  fs.writeFileSync(path.join(dir, 'score-dev.json'), score);
  const g = JSON.parse(score).groups.all;
  console.log(JSON.stringify({ iteration, panelSha256: JSON.parse(score).panelSha256, primaryLoss: g?.primaryLoss }));
} else throw Error(`Unknown command ${command}`);
