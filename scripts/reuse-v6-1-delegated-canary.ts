import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  inspectV61Experiment,
  type V61InventoryRegistration,
} from '../src/lib/city-cost-v6-1-canary-inventory';
import { V61_SPINE_SOURCES, type V61SpineSource } from '../src/lib/city-cost-v6-1-collection';

const ROOT = process.cwd();

type Registration = V61InventoryRegistration & {
  collectionMode: string;
  inputCsv: string;
  inputCsvSha256: string;
  fxSnapshot: string;
  fxSnapshotSha256: string;
  prompts: Record<V61SpineSource, { file: string; sha256: string }>;
  referenceWindow: { arrival: string; departure: string; referenceDate: string };
};

function optionValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const sourceRelativeDir = optionValue('--source-experiment-dir')
  ?? 'data/reference/v6/experiments/012-v6-1-corrected-delegated-canary';
const targetRelativeDir = optionValue('--target-experiment-dir')
  ?? 'data/reference/v6/experiments/013-v6-1-resumable-delegated-canary';
const sourceDir = path.resolve(ROOT, sourceRelativeDir);
const targetDir = path.resolve(ROOT, targetRelativeDir);
const manifestPath = path.join(targetDir, 'reuse-manifest.json');
const check = process.argv.includes('--check');

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function sha256File(file: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function repoRelative(file: string) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function assertSameFrozenContract(source: Registration, target: Registration) {
  if (target.collectionMode !== 'validated_experiment_012_reuse+delegated_codex_subagent') {
    throw new Error(`Target collection mode does not permit experiment-012 reuse: ${target.collectionMode}`);
  }
  if (source.inputCsvSha256 !== target.inputCsvSha256 || source.fxSnapshotSha256 !== target.fxSnapshotSha256) {
    throw new Error('Source and target CSV/FX hashes differ.');
  }
  if (JSON.stringify(source.referenceWindow) !== JSON.stringify(target.referenceWindow)) {
    throw new Error('Source and target collection windows differ.');
  }
  for (const spineSource of V61_SPINE_SOURCES) {
    const sourcePrompt = source.prompts[spineSource];
    const targetPrompt = target.prompts[spineSource];
    if (!sourcePrompt || !targetPrompt || sourcePrompt.sha256 !== targetPrompt.sha256) {
      throw new Error(`Prompt hash differs for ${spineSource}.`);
    }
    if (sha256File(path.join(ROOT, targetPrompt.file)) !== targetPrompt.sha256) {
      throw new Error(`Current prompt does not match target registration for ${spineSource}.`);
    }
  }
}

function copyOrVerify(sourceFile: string, targetFile: string) {
  const expectedHash = sha256File(sourceFile);
  if (fs.existsSync(targetFile)) {
    if (sha256File(targetFile) !== expectedHash) throw new Error(`Existing target differs from reusable source: ${repoRelative(targetFile)}`);
  } else if (check) {
    throw new Error(`Reusable target file is missing: ${repoRelative(targetFile)}`);
  } else {
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.copyFileSync(sourceFile, targetFile);
  }
  return expectedHash;
}

const sourceRegistrationPath = path.join(sourceDir, 'registration.json');
const targetRegistrationPath = path.join(targetDir, 'registration.json');
if (!fs.existsSync(sourceRegistrationPath) || !fs.existsSync(targetRegistrationPath)) {
  throw new Error('Both source and target registrations must exist before reuse.');
}
if (!check && (fs.existsSync(path.join(targetDir, 'results.json')) || fs.existsSync(path.join(targetDir, 'verdict.md')))) {
  throw new Error('A finalized target experiment is immutable.');
}

const sourceRegistration = readJson<Registration>(sourceRegistrationPath);
const targetRegistration = readJson<Registration>(targetRegistrationPath);
assertSameFrozenContract(sourceRegistration, targetRegistration);
const sourceInventory = inspectV61Experiment(sourceRegistration, sourceDir);
const targetCities = new Map(targetRegistration.cities.map((city) => [`${city.city}\u0000${city.country}`, city]));

const entries = sourceInventory.slots
  .filter((slot) => slot.reusable && targetCities.has(`${slot.city}\u0000${slot.country}`))
  .map((slot) => {
    const citySlug = slug(slot.city);
    const sourceRaw = path.join(sourceDir, 'raw', citySlug, `${slot.source}.json`);
    const sourceTelemetry = path.join(sourceDir, 'telemetry', citySlug, `${slot.source}.json`);
    const targetRaw = path.join(targetDir, 'raw', citySlug, `${slot.source}.json`);
    const targetTelemetry = path.join(targetDir, 'telemetry', citySlug, `${slot.source}.json`);
    const rawSha256 = copyOrVerify(sourceRaw, targetRaw);
    const telemetrySha256 = copyOrVerify(sourceTelemetry, targetTelemetry);
    return {
      city: slot.city,
      country: slot.country,
      source: slot.source,
      collectionMode: 'validated_experiment_012_reuse',
      sourceRaw: repoRelative(sourceRaw),
      sourceTelemetry: repoRelative(sourceTelemetry),
      targetRaw: repoRelative(targetRaw),
      targetTelemetry: repoRelative(targetTelemetry),
      rawSha256,
      telemetrySha256,
      promptSha256: targetRegistration.prompts[slot.source].sha256,
      referenceWindow: targetRegistration.referenceWindow,
    };
  });

const manifest = {
  schemaVersion: 'city-cost-v6-1-canary-reuse-manifest-v1',
  experiment: targetRegistration.experiment,
  sourceExperiment: sourceRegistration.experiment,
  collectionMode: targetRegistration.collectionMode,
  reusableCalls: entries.length,
  pendingCallsAfterReuse: targetRegistration.cities.length * targetRegistration.limits.sourceCallsPerCity - entries.length,
  entries,
};
const expectedManifest = `${JSON.stringify(manifest, null, 2)}\n`;

if (check) {
  if (!fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, 'utf8') !== expectedManifest) {
    throw new Error('Reuse manifest is missing or stale.');
  }
} else if (fs.existsSync(manifestPath)) {
  if (fs.readFileSync(manifestPath, 'utf8') !== expectedManifest) throw new Error('Existing reuse manifest differs from validated reuse.');
} else {
  fs.writeFileSync(manifestPath, expectedManifest);
}

console.log(JSON.stringify({
  passed: true,
  check,
  experiment: targetRegistration.experiment,
  sourceExperiment: sourceRegistration.experiment,
  reusableCalls: entries.length,
  pendingCallsAfterReuse: manifest.pendingCallsAfterReuse,
  manifest: repoRelative(manifestPath),
}, null, 2));
