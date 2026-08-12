import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { generateCityCostEstimate } from '../src/lib/city-generation';
import { buildCityEstimatePersistence } from '../src/lib/city-generation-persistence';
import { readV6Provenance } from '../src/lib/city-estimate-provenance';
import { V5_TIER_NAMES } from '../src/lib/city-cost-methodology-v5';
import { V61_SPINE_SOURCES, V61_SEARCHES_PER_CITY_MAX } from '../src/lib/city-cost-v6-1-collection';
import type { CityGenerationProvider } from '../src/lib/city-generation-config';

const ROOT = process.cwd();
const EXPERIMENT_DIR = path.join(ROOT, 'data/reference/v6/experiments/010-v6-1-runtime-canary');
const REGISTRATION_PATH = path.join(EXPERIMENT_DIR, 'registration.json');
const RESULTS_PATH = path.join(EXPERIMENT_DIR, 'results.json');
const VERDICT_PATH = path.join(EXPERIMENT_DIR, 'verdict.md');
const RAW_DIR = path.join(EXPERIMENT_DIR, 'raw');
const TELEMETRY_DIR = path.join(EXPERIMENT_DIR, 'telemetry');
const MATERIALIZED_DIR = path.join(EXPERIMENT_DIR, 'materialized');
const CHECK = process.argv.includes('--check');

type CanaryCity = {
  city: string;
  country: string;
  region: string;
  band: string;
  fixtureSourceStrength: string;
  selectionReason: string;
};

type Registration = {
  schemaVersion: string;
  methodologyVersion: string;
  inputCsv: string;
  inputCsvSha256: string;
  fxSnapshot: string;
  fxSnapshotSha256: string;
  referenceWindow: { arrival: string; departure: string; budgetYourTripReferenceDate: string; numbeoReferenceDate: string };
  providerMode: string;
  provider: string | null;
  model: string | null;
  prompts: Record<string, { file: string; sha256: string }>;
  limits: { cities: number; sourceCallsPerCity: number; maxSearchesPerCity: number; directPageReadsPerCity: number };
  passCriteria: { completeCitiesMinimum: number; completeCityDefinition: string; provenanceRoundTrip: string; artifactBatchMaximumFraction: number };
  cities: CanaryCity[];
};

type CanaryRow = {
  city: string;
  country: string;
  region: string;
  band: string;
  fixtureSourceStrength: string;
  status: 'complete' | 'failed';
  complete: boolean;
  sourceCallCount: number;
  searches: number;
  directPageReads: number;
  tierCount: number;
  provenanceRoundTrip: boolean;
  sourceStatuses: Record<string, string>;
  error: string | null;
  rawResponseFiles: string[];
  telemetryFiles: string[];
  materializationFile: string | null;
};

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function expectedText(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(file: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function repoFile(relativePath: string) {
  const file = path.join(ROOT, relativePath);
  if (!fs.existsSync(file)) throw new Error(`Missing registered file: ${relativePath}`);
  return file;
}

function assertRegistration(registration: Registration) {
  if (registration.schemaVersion !== 'city-cost-v6-1-runtime-canary-registration-v1') throw new Error('Unexpected canary registration schema.');
  if (registration.methodologyVersion !== 'v6.1') throw new Error('Canary registration is not v6.1.');
  if (registration.cities.length !== registration.limits.cities) throw new Error('Canary city count does not match its registered limit.');
  if (registration.passCriteria.completeCitiesMinimum !== 19) throw new Error('Canary pass threshold drifted from 19/20.');
  if (registration.limits.maxSearchesPerCity !== V61_SEARCHES_PER_CITY_MAX) throw new Error('Canary search budget drifted from the v6.1 source contract.');
  if (sha256(repoFile(registration.inputCsv)) !== registration.inputCsvSha256) throw new Error('Canary input CSV hash changed after preregistration.');
  if (sha256(repoFile(registration.fxSnapshot)) !== registration.fxSnapshotSha256) throw new Error('Canary FX snapshot hash changed after preregistration.');
  for (const prompt of Object.values(registration.prompts)) {
    if (sha256(repoFile(prompt.file)) !== prompt.sha256) throw new Error(`Registered prompt hash changed: ${prompt.file}`);
  }

  const csvRows = fs.readFileSync(repoFile(registration.inputCsv), 'utf8').trim().split(/\r?\n/).slice(1).map((line) => line.split(','));
  const csvCities = new Set(csvRows.map((columns) => `${columns[0]}|${columns[1]}|${columns[2]}`));
  for (const city of registration.cities) {
    if (!csvCities.has(`${city.city}|${city.country}|${city.region}`)) throw new Error(`Canary city is not in the registered CSV frame: ${city.city}`);
  }
}

function checkProvenanceRoundTrip(generated: Awaited<ReturnType<typeof generateCityCostEstimate>>) {
  if (generated.methodologyVersion !== 'v6.1' || !generated.v61Collection || !generated.v61Materialization) {
    return { passed: false, problems: ['generation did not return a v6.1 collection and materialization'] };
  }
  const persisted = buildCityEstimatePersistence(generated, { referenceDate: '2026-09-17' });
  const parsed = readV6Provenance(JSON.stringify(persisted.metadata));
  const problems: string[] = [];
  if (persisted.estimateSource !== 'llm_city_generation_v6_1') problems.push('persistence source is not llm_city_generation_v6_1');
  if (!parsed || parsed.methodologyVersion !== 'v6.1') problems.push('API provenance parser did not preserve v6.1');
  if (Object.keys(parsed?.evidenceGrades ?? {}).length !== V5_TIER_NAMES.length) problems.push('API provenance lost tier grades');
  if (Object.keys(parsed?.intervals ?? {}).length !== V5_TIER_NAMES.length) problems.push('API provenance lost tier intervals');
  if (!Array.isArray(parsed?.collectionTelemetry) || parsed.collectionTelemetry.length !== 3) problems.push('API provenance lost three-call telemetry');
  if (!Array.isArray(persisted.anchors) || persisted.anchors.length !== 9) problems.push('persistence lost source facts/anchors');
  if (!persisted.inputSnapshot || !persisted.metadata.v6PriorBasis) problems.push('persistence lost input snapshot or prior basis');
  if (Object.keys(persisted.sources).length !== 3) problems.push('persistence lost source map');
  return { passed: problems.length === 0, problems, persisted, parsed };
}

function writeSuccessArtifacts(city: CanaryCity, generated: Awaited<ReturnType<typeof generateCityCostEstimate>>, roundTrip: ReturnType<typeof checkProvenanceRoundTrip>) {
  const collection = generated.v61Collection!;
  const materialization = generated.v61Materialization!;
  const citySlug = slug(city.city);
  const rawResponseFiles: string[] = [];
  for (const source of V61_SPINE_SOURCES) {
    const file = path.join(RAW_DIR, citySlug, `${source}.json`);
    writeJson(file, collection.rawResponses[source]);
    rawResponseFiles.push(path.relative(ROOT, file).replaceAll('\\', '/'));
  }
  const telemetryFiles: string[] = [];
  for (const telemetry of collection.telemetry) {
    const file = path.join(TELEMETRY_DIR, citySlug, `${telemetry.source}.json`);
    writeJson(file, telemetry);
    telemetryFiles.push(path.relative(ROOT, file).replaceAll('\\', '/'));
  }
  const materializationFile = path.join(MATERIALIZED_DIR, `${citySlug}.json`);
  writeJson(materializationFile, {
    schemaVersion: 'city-cost-v6-1-runtime-canary-materialization-v1',
    methodologyVersion: 'v6.1',
    city,
    productionPath: 'generateCityCostEstimate -> collectCityCostV61Anchors -> materializeCityCostV61 -> buildCityEstimatePersistence -> readV6Provenance',
    collection,
    materialization,
    persistenceApiRoundTrip: {
      passed: roundTrip.passed,
      problems: roundTrip.problems,
      apiSummary: roundTrip.parsed ?? null,
    },
  });
  return { rawResponseFiles, telemetryFiles, materializationFile: path.relative(ROOT, materializationFile).replaceAll('\\', '/') };
}

async function run(registration: Registration) {
  process.env.CITY_COST_METHODOLOGY_V6 = 'true';
  const rows: CanaryRow[] = [];
  for (const city of registration.cities) {
    const startedAt = new Date().toISOString();
    try {
      const generated = await generateCityCostEstimate({
        cityName: city.city,
        countryName: city.country,
        region: city.region,
        referenceDate: registration.referenceWindow.arrival,
        provider: registration.provider as CityGenerationProvider | undefined,
        model: registration.model ?? undefined,
      });
      const collection = generated.v61Collection;
      const materialization = generated.v61Materialization;
      const roundTrip = checkProvenanceRoundTrip(generated);
      const sourceCallCount = collection?.telemetry.length ?? 0;
      const searches = collection?.searches ?? 0;
      const directPageReads = collection?.telemetry.reduce((sum, call) => sum + call.directPageReads, 0) ?? 0;
      const tierCount = materialization ? Object.keys(materialization.tiersAud).length : 0;
      const complete = Boolean(materialization?.complete && tierCount === V5_TIER_NAMES.length && sourceCallCount === 3 && roundTrip.passed);
      const artifacts = collection && materialization ? writeSuccessArtifacts(city, generated, roundTrip) : { rawResponseFiles: [], telemetryFiles: [], materializationFile: null };
      rows.push({
        city: city.city,
        country: city.country,
        region: city.region,
        band: city.band,
        fixtureSourceStrength: city.fixtureSourceStrength,
        status: complete ? 'complete' : 'failed',
        complete,
        sourceCallCount,
        searches,
        directPageReads,
        tierCount,
        provenanceRoundTrip: roundTrip.passed,
        sourceStatuses: Object.fromEntries((collection?.telemetry ?? []).map((call) => [call.source, call.status])),
        error: [...(roundTrip.problems ?? [])].join('; ') || null,
        ...artifacts,
      });
    } catch (error) {
      rows.push({
        city: city.city,
        country: city.country,
        region: city.region,
        band: city.band,
        fixtureSourceStrength: city.fixtureSourceStrength,
        status: 'failed',
        complete: false,
        sourceCallCount: 0,
        searches: 0,
        directPageReads: 0,
        tierCount: 0,
        provenanceRoundTrip: false,
        sourceStatuses: {},
        error: error instanceof Error ? error.message : String(error),
        rawResponseFiles: [],
        telemetryFiles: [],
        materializationFile: null,
      });
    }
    if (!startedAt) throw new Error('unreachable');
  }

  const completeCities = rows.filter((row) => row.complete).length;
  const results = {
    schemaVersion: 'city-cost-v6-1-runtime-canary-results-v1',
    methodologyVersion: 'v6.1',
    registration: 'data/reference/v6/experiments/010-v6-1-runtime-canary/registration.json',
    runMode: 'real-provider-runtime-path',
    generatedAt: new Date().toISOString(),
    cities: rows.length,
    completeCities,
    requiredCompleteCities: registration.passCriteria.completeCitiesMinimum,
    pass: completeCities >= registration.passCriteria.completeCitiesMinimum && rows.every((row) => row.directPageReads === 0 && row.searches <= registration.limits.maxSearchesPerCity),
    providerCredentialsConfigured: rows.some((row) => row.sourceCallCount > 0),
    holdoutRead: false,
    shippingCsvWritten: false,
    rows,
  };
  writeJson(RESULTS_PATH, results);
  const failures = rows.filter((row) => !row.complete).map((row) => `- ${row.city}: ${row.error ?? 'incomplete'}`);
  fs.writeFileSync(VERDICT_PATH, [
    '# Experiment 010 — v6.1 runtime canary verdict',
    '',
    `**Run:** ${results.generatedAt}`,
    `**Result:** ${results.pass ? 'PASS' : 'FAIL'}`,
    `**Complete cities:** ${completeCities}/${rows.length} (required ${registration.passCriteria.completeCitiesMinimum}/${rows.length})`,
    '',
    results.pass
      ? 'The canary met the registered runtime coverage and provenance criteria.'
      : 'The canary failed the registered runtime coverage/provenance criteria. Bulk migration is stopped; no fixture, delegated response or v1 comparison was substituted.',
    '',
    failures.length ? '## Failed cities' : '## Failed cities\n\nNone.',
    ...failures,
    '',
    'Holdout files were not read, the live CSV was not written, and no coefficient or accommodation refit occurred.',
    '',
  ].join('\n'));
  console.log(JSON.stringify({ passed: results.pass, completeCities, cities: rows.length, holdoutRead: false, shippingCsvWritten: false }, null, 2));
  if (!results.pass) process.exitCode = 1;
}

function check(registration: Registration) {
  if (!fs.existsSync(RESULTS_PATH) || !fs.existsSync(VERDICT_PATH)) throw new Error('Canary results or verdict is missing. Run without --check first.');
  const results = readJson<{ schemaVersion: string; methodologyVersion: string; cities: number; rows: CanaryRow[] }>(RESULTS_PATH);
  if (results.schemaVersion !== 'city-cost-v6-1-runtime-canary-results-v1' || results.methodologyVersion !== 'v6.1') throw new Error('Canary results schema drifted.');
  if (results.cities !== registration.cities.length || results.rows.length !== registration.cities.length) throw new Error('Canary result city count is not deterministic against registration.');
  if (results.rows.some((row) => row.directPageReads !== 0 || row.searches > registration.limits.maxSearchesPerCity)) throw new Error('Canary result violates a source/search limit.');
  console.log(JSON.stringify({ passed: true, cities: results.cities, completeCities: results.rows.filter((row) => row.complete).length, resultPass: (readJson<{ pass?: boolean }>(RESULTS_PATH)).pass ?? false }, null, 2));
}

async function main() {
  const registration = readJson<Registration>(REGISTRATION_PATH);
  assertRegistration(registration);
  if (CHECK) check(registration);
  else await run(registration);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
