import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCityGenerationV11Prompt } from '../../src/lib/city-generation';
import { cityCostV11AnchorSchema, materializeCityCostV11 } from '../../src/lib/city-cost-methodology-v1-1';
import { hash, safePath, writeOnce, checkHash, requireConfirmationFreeze } from './core.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const expected = 'C:\\Users\\chawi\\.codex\\worktrees\\city-cost-accuracy\\holiday-spend';
if (fs.realpathSync(repo).toLowerCase() !== expected.toLowerCase()) throw Error('Runner is restricted to the authorized research worktree');
process.chdir(repo);
const root = path.join(repo, 'research/city-cost-accuracy');
const read = (relative: string) => JSON.parse(fs.readFileSync(safePath(root, relative), 'utf8'));
const manifest = read('manifest.json');
const protocolHash = hash(fs.readFileSync(path.join(root, 'protocol.md')));
const [command, runId] = process.argv.slice(2);
const system = 'You are a careful travel cost estimation assistant. Return valid JSON only.';
const runPath = (id: string) => {
  if (!/^[a-z0-9-]+$/.test(id)) throw Error('Invalid run identifier');
  return `experiments/000-baseline/runs/${id}`;
};

if (command === 'prepare') {
  writeOnce(root, 'protocol-freeze.json', { manifestSha256: hash(fs.readFileSync(path.join(root, 'manifest.json'))), protocolSha256: protocolHash });
  for (const city of manifest.cities.filter((c: {pilot: boolean}) => c.pilot)) {
    requireConfirmationFreeze(city, false);
    const built = buildCityGenerationV11Prompt({ cityName: city.name, countryName: city.country,
      referenceDate: manifest.referenceDate, extraContext: manifest.extraContext });
    for (let repeat = 1; repeat <= manifest.baselineRepeats; repeat++) {
      const id = `${city.id}-luna-r${repeat}`, dir = runPath(id);
      writeOnce(root, `${dir}/system.txt`, system);
      writeOnce(root, `${dir}/prompt.txt`, built.prompt);
      writeOnce(root, `${dir}/request.json`, { id, cityId: city.id, repeat, candidate: 'v1.1',
        model: 'gpt-6-luna', effort: 'max', runtime: 'Codex subagent', promptVersion: built.promptVersion,
        promptSha256: hash(built.prompt), systemSha256: hash(system), protocolSha256: protocolHash,
        referenceDate: manifest.referenceDate, generationDate: manifest.frozenAt });
    }
  }
  console.log('Prepared 18 immutable baseline requests; no model calls or database writes.');
} else if (command === 'dispatch') {
  const dir = runPath(runId), req = read(`${dir}/request.json`);
  checkHash(fs.readFileSync(safePath(root, `${dir}/prompt.txt`), 'utf8'), req.promptSha256);
  checkHash(fs.readFileSync(safePath(root, `${dir}/system.txt`), 'utf8'), req.systemSha256);
  const ledgerPath = safePath(root, 'estimation-dispatches.jsonl');
  const ledger = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
  if (ledger.some((entry: {runId:string}) => entry.runId === runId)) throw Error('Run already dispatched; retry needs a new registered run');
  if (ledger.length >= manifest.limits.estimationInvocations - manifest.limits.confirmationReserve) throw Error('Development invocation limit reached');
  const entry = { sequence: ledger.length + 1, runId, dispatchedAt: new Date().toISOString(), model: req.model,
    effort: req.effort, runtime: req.runtime, promptSha256: req.promptSha256 };
  fs.appendFileSync(ledgerPath, JSON.stringify(entry) + '\n');
  console.log(JSON.stringify(entry));
} else if (command === 'ingest') {
  const dir = runPath(runId), req = read(`${dir}/request.json`);
  checkHash(fs.readFileSync(safePath(root, `${dir}/prompt.txt`), 'utf8'), req.promptSha256);
  const raw = fs.readFileSync(safePath(root, `${dir}/response.json`), 'utf8');
  const ledger = fs.readFileSync(safePath(root, 'estimation-dispatches.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const dispatched = ledger.find((entry: {runId:string}) => entry.runId === runId);
  if (!dispatched) throw Error('Uncounted run refused');
  let status = 'invalid', error: string | null = null, materialized = null, diagnosticAnchors = null;
  try {
    const input = JSON.parse(raw);
    const anchors = cityCostV11AnchorSchema.safeParse(input.anchors_usd);
    if (anchors.success) diagnosticAnchors = anchors.data;
    materialized = materializeCityCostV11(input, new Date(dispatched.dispatchedAt));
    status = 'valid';
  } catch (err) { error = err instanceof Error ? err.message : String(err); }
  const provenance = read(`${dir}/provenance.json`);
  if (provenance.promptSha256 !== req.promptSha256 || provenance.model !== req.model || provenance.effort !== req.effort) throw Error('Worker provenance mismatch');
  writeOnce(root, `${dir}/result.json`, { runId, status, error, responseSha256: hash(raw),
    promptSha256: req.promptSha256, materialized, diagnosticAnchors,
    diagnosticNote: 'Anchor-only diagnostics never count as a successful app response when FX/schema fails.', provenance });
  console.log(JSON.stringify({ runId, status, error }));
} else if (command === 'verify') {
  const freeze = read('protocol-freeze.json');
  checkHash(fs.readFileSync(path.join(root, 'protocol.md')), freeze.protocolSha256);
  checkHash(fs.readFileSync(path.join(root, 'manifest.json')), freeze.manifestSha256);
  console.log('Frozen protocol hashes verified.');
} else { throw Error(`Unknown command ${command}; use prepare, dispatch RUN, ingest RUN, verify`); }
