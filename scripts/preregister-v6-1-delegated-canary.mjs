import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_REGISTRATION = path.join(ROOT, 'data/reference/v6/experiments/010-v6-1-runtime-canary/registration.json');

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const experimentRelativeDir = optionValue('--experiment-dir')
  ?? 'data/reference/v6/experiments/013-v6-1-resumable-delegated-canary';
const collectionMode = optionValue('--collection-mode')
  ?? 'validated_experiment_012_reuse+delegated_codex_subagent';
const allowedCollectionModes = new Set([
  'delegated_codex_subagent',
  'validated_experiment_012_reuse+delegated_codex_subagent',
]);
if (!allowedCollectionModes.has(collectionMode)) {
  throw new Error(`Unsupported collection mode: ${collectionMode}`);
}
const experimentDir = path.resolve(ROOT, experimentRelativeDir);
const experimentName = path.basename(experimentDir);
const relativeExperimentDir = path.relative(ROOT, experimentDir).replaceAll('\\', '/');

function sha256(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relativePath))).digest('hex');
}

function writeJson(relativePath, value) {
  const file = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

if (fs.existsSync(experimentDir) && fs.readdirSync(experimentDir).length > 0) {
  throw new Error(`Experiment directory ${relativeExperimentDir} already contains files; completed/preregistered experiments are immutable.`);
}

const source = JSON.parse(fs.readFileSync(SOURCE_REGISTRATION, 'utf8'));
const promptFiles = {
  expedia_3star: 'docs/prompts/llm_prompt_city_cost_v6_1_expedia_3star.md',
  budgetyourtrip_daily_tiers: 'docs/prompts/llm_prompt_city_cost_v6_1_budgetyourtrip_daily_tiers.md',
  numbeo_drinks: 'docs/prompts/llm_prompt_city_cost_v6_1_numbeo_drinks.md',
};
const implementationFiles = [
  'src/lib/city-cost-v6-1-collection.ts',
  'src/lib/city-cost-methodology-v6-1.ts',
  'src/lib/city-generation-persistence.ts',
  'src/lib/city-estimate-provenance.ts',
  'src/lib/city-cost-v6-1-canary.ts',
  'src/lib/city-cost-v6-1-canary-inventory.ts',
  'scripts/run-v6-1-delegated-canary.ts',
  'scripts/inventory-v6-1-delegated-canary.ts',
  'scripts/reuse-v6-1-delegated-canary.ts',
  'scripts/record-v6-1-canary-assignment.mjs',
];

const registration = {
  schemaVersion: 'city-cost-v6-1-delegated-canary-registration-v1',
  experiment: experimentName,
  registeredAt: '2026-08-12',
  status: 'preregistered',
  purpose: 'Test the resumable v6.1 Stage-A source contract and deterministic Stage-B production path using validated experiment-012 call reuse plus delegated collection, without application provider credentials.',
  collectionMode,
  sourceRegistration: 'data/reference/v6/experiments/010-v6-1-runtime-canary/registration.json',
  inputCsv: source.inputCsv,
  inputCsvSha256: sha256(source.inputCsv),
  fxSnapshot: source.fxSnapshot,
  fxSnapshotSha256: sha256(source.fxSnapshot),
  referenceWindow: {
    arrival: '2026-09-17',
    departure: '2026-09-18',
    referenceDate: '2026-09-17',
    budgetYourTripReferenceDate: '2026-09-17',
    numbeoReferenceDate: '2026-09-17',
  },
  prompts: Object.fromEntries(Object.entries(promptFiles).map(([sourceId, file]) => [sourceId, { file, sha256: sha256(file) }])),
  implementationFiles: Object.fromEntries(implementationFiles.map((file) => [file, sha256(file)])),
  limits: {
    cities: 20,
    sourceCallsPerCity: 3,
    maxSearchesPerCity: 10,
    maxSearchesBySource: {
      expedia_3star: 4,
      budgetyourtrip_daily_tiers: 4,
      numbeo_drinks: 2,
    },
    directPageReadsPerCity: 0,
    maxRetriesPerCall: 1,
  },
  passCriteria: {
    completeCitiesMinimum: 19,
    completeCityDefinition: 'All three source calls have schema-valid city-matched responses (partial source statuses remain explicit and may invoke the shipped category fallback); the shipped materializer produces all 19 tiers; persistence/API provenance is field-identical; and no contract limit is violated. An all-prior bundle is an artifact candidate, not source coverage.',
    provenanceRoundTrip: 'Persisted and API-parsed methodology version, grades, intervals, anchors/facts, telemetry, missingness, prior basis and input snapshot are byte-equal to Stage-B values.',
    artifactBatchMaximumFraction: 0.3,
  },
  cities: source.cities,
  holdoutRead: false,
  liveCsvWritten: false,
};

fs.mkdirSync(experimentDir, { recursive: true });
writeJson(`${relativeExperimentDir}/registration.json`, registration);
fs.writeFileSync(path.join(experimentDir, 'protocol.md'), `# ${experimentName} - resumable delegated v6.1 operational canary

**Status:** preregistered 12 August 2026; Stage A is validated call-level experiment-012 reuse plus delegated collection, and Stage B is local deterministic replay.

## Purpose

Experiments 010, 011 and 012 are immutable history. This experiment reuses the registered 20-city frame and only those experiment-012 calls whose raw response and telemetry independently satisfy the frozen contract. Remaining calls are collected by delegated Codex subagents without copying Codex authentication into the application.

## Frozen contract

- Collection mode: \`${collectionMode}\`.
- Exactly three source calls per city, using the three registered v6.1 prompts verbatim.
- Search-snippet evidence only; Expedia 4, BudgetYourTrip 4 and Numbeo 2 searches maximum per source; 10 per city; zero direct page reads.
- One raw schema response and one telemetry record per city/source. Missingness is explicit and never substituted.
- Reused calls retain their source raw/telemetry bytes and record source and target hashes in \`reuse-manifest.json\`.
- Inventory is independent by call slot. Finalization refuses while any of the 60 registered slots remains pending.
- Frozen Expedia window: arrival 2026-09-17, departure 2026-09-18; reference date 2026-09-17 for BYT and Numbeo.
- Stage B validates every response, invokes \`materializeCityCostV61\`, then exercises persistence and API provenance parsing.
- Pass requires at least 19/20 complete cities and artifact candidates no greater than 30% of the batch. Repeated canonical-beer rejection above 30% is an artifact signature and fails the batch.

## Integrity

The registration records the frozen CSV, FX, prompt and implementation hashes. The live CSV and every holdout remain untouched. This experiment may not overwrite an existing experiment directory.
`);
console.log(JSON.stringify({ registered: true, experiment: experimentName, cities: registration.cities.length, sourceCalls: registration.cities.length * registration.limits.sourceCallsPerCity, collectionMode: registration.collectionMode }, null, 2));
