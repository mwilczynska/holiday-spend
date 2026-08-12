import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_REGISTRATION = path.join(ROOT, 'data/reference/v6/experiments/010-v6-1-runtime-canary/registration.json');
const EXPERIMENT_DIR = path.join(ROOT, 'data/reference/v6/experiments/011-v6-1-delegated-operational-canary');

function sha256(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relativePath))).digest('hex');
}

function writeJson(relativePath, value) {
  const file = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const source = JSON.parse(fs.readFileSync(SOURCE_REGISTRATION, 'utf8'));
const implementationFiles = [
  'src/lib/city-cost-v6-1-collection.ts',
  'src/lib/city-cost-methodology-v6-1.ts',
  'src/lib/city-generation-persistence.ts',
  'src/lib/city-estimate-provenance.ts',
  'src/lib/city-cost-v6-1-canary.ts',
];

const registration = {
  schemaVersion: 'city-cost-v6-1-delegated-canary-registration-v1',
  experiment: '011-v6-1-delegated-operational-canary',
  registeredAt: '2026-08-12',
  status: 'preregistered',
  purpose: 'Test the exact v6.1 Stage-A source contract and deterministic Stage-B production path without application provider credentials.',
  collectionMode: 'delegated_codex_subagent',
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
  prompts: source.prompts,
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

fs.mkdirSync(EXPERIMENT_DIR, { recursive: true });
writeJson('data/reference/v6/experiments/011-v6-1-delegated-operational-canary/registration.json', registration);
fs.writeFileSync(path.join(EXPERIMENT_DIR, 'protocol.md'), `# Experiment 011 — delegated v6.1 operational canary\n\n**Status:** preregistered 12 August 2026; Stage A is delegated collection and Stage B is local deterministic replay.\n\n## Purpose\n\nExperiment 010 is immutable credential-preflight history and is not rerun. This experiment reuses its representative 20-city frame to test the corrected v6.1 source contract without copying Codex authentication into the application.\n\n## Frozen contract\n\n- Collection mode: \`delegated_codex_subagent\`.\n- Exactly three source calls per city, using the three registered v6.1 prompts verbatim.\n- Search-snippet evidence only; Expedia 4, BudgetYourTrip 4 and Numbeo 2 searches maximum per source; 10 per city; zero direct page reads.\n- One raw schema response and one telemetry record per city/source. Missingness is explicit and never substituted.\n- Frozen Expedia window: arrival 2026-09-17, departure 2026-09-18; reference date 2026-09-17 for BYT and Numbeo.\n- Stage B validates the responses, invokes \`materializeCityCostV61\`, then exercises persistence and API provenance parsing.\n- Pass requires at least 19/20 complete cities and artifact candidates no greater than 30% of the batch.\n\n## Integrity\n\nThe registration records the frozen CSV, FX, prompt and implementation hashes. The live CSV and every holdout remain untouched.\n`);
console.log(JSON.stringify({ registered: true, experiment: '011-v6-1-delegated-operational-canary', cities: registration.cities.length, sourceCalls: registration.cities.length * registration.limits.sourceCallsPerCity, collectionMode: registration.collectionMode }, null, 2));
