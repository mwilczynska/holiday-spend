import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  buildV61CollectionResultFromSpineResponses,
  V61_SPINE_SOURCES,
  type V61CollectionResult,
  type V61SpineSource,
  type V61DiskTelemetry,
} from '../src/lib/city-cost-v6-1-collection';
import { materializeCityCostV61, type V61Materialization } from '../src/lib/city-cost-methodology-v6-1';
import { buildCityEstimatePersistence } from '../src/lib/city-generation-persistence';
import { readV6Provenance } from '../src/lib/city-estimate-provenance';
import { V5_TIER_NAMES } from '../src/lib/city-cost-methodology-v5';
import { evaluateV61CanaryBatch, type V61CanaryCityRecord, type V61CanaryRegistrationCriteria } from '../src/lib/city-cost-v6-1-canary';
import type { CityGenerationResult, V6GeneratedCityPayload } from '../src/lib/city-generation';

const ROOT = process.cwd();
const EXPERIMENT_DIR = path.join(ROOT, 'data/reference/v6/experiments/011-v6-1-delegated-operational-canary');
const REGISTRATION_PATH = path.join(EXPERIMENT_DIR, 'registration.json');
const RESULTS_PATH = path.join(EXPERIMENT_DIR, 'results.json');
const VERDICT_PATH = path.join(EXPERIMENT_DIR, 'verdict.md');
const RAW_DIR = path.join(EXPERIMENT_DIR, 'raw');
const TELEMETRY_DIR = path.join(EXPERIMENT_DIR, 'telemetry');
const MATERIALIZED_DIR = path.join(EXPERIMENT_DIR, 'materialized');
const CHECK = process.argv.includes('--check');

type Registration = V61CanaryRegistrationCriteria & {
  schemaVersion: string;
  experiment: string;
  registeredAt: string;
  status: string;
  collectionMode: string;
  inputCsv: string;
  inputCsvSha256: string;
  fxSnapshot: string;
  fxSnapshotSha256: string;
  prompts: Record<string, { file: string; sha256: string }>;
  implementationFiles: Record<string, string>;
  referenceWindow: V61CanaryRegistrationCriteria['window'] & {
    budgetYourTripReferenceDate: string;
    numbeoReferenceDate: string;
  };
  passCriteria: {
    completeCitiesMinimum: number;
    artifactBatchMaximumFraction: number;
  };
  cities: Array<{ city: string; country: string; region: string; band: string; fixtureSourceStrength: string; selectionReason: string }>;
  holdoutRead: boolean;
  liveCsvWritten: boolean;
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
  if (registration.schemaVersion !== 'city-cost-v6-1-delegated-canary-registration-v1') throw new Error('Unexpected delegated canary registration schema.');
  if (registration.collectionMode !== 'delegated_codex_subagent') throw new Error('Delegated collection mode is not registered.');
  if (registration.cities.length !== 20 || registration.limits.sourceCallsPerCity !== 3) throw new Error('Delegated canary frame or call count drifted.');
  if (registration.passCriteria.completeCitiesMinimum !== 19) throw new Error('Delegated canary threshold drifted from 19/20.');
  if (registration.referenceWindow.arrival !== '2026-09-17' || registration.referenceWindow.departure !== '2026-09-18') throw new Error('Delegated canary window drifted.');
  if (registration.holdoutRead || registration.liveCsvWritten) throw new Error('Delegated canary registration permits a forbidden write/read.');
  if (sha256(repoFile(registration.inputCsv)) !== registration.inputCsvSha256) throw new Error('Registered CSV hash changed.');
  if (sha256(repoFile(registration.fxSnapshot)) !== registration.fxSnapshotSha256) throw new Error('Registered FX hash changed.');
  for (const prompt of Object.values(registration.prompts)) {
    if (sha256(repoFile(prompt.file)) !== prompt.sha256) throw new Error(`Registered prompt changed: ${prompt.file}`);
  }
  for (const [file, hash] of Object.entries(registration.implementationFiles)) {
    if (sha256(repoFile(file)) !== hash) throw new Error(`Registered implementation changed: ${file}`);
  }
}

function loadCollection(city: Registration['cities'][number]) {
  const citySlug = slug(city.city);
  const responses = Object.fromEntries(V61_SPINE_SOURCES.map((source) => [
    source,
    readJson(path.join(RAW_DIR, citySlug, `${source}.json`)),
  ])) as Record<V61SpineSource, unknown>;
  const telemetry = Object.fromEntries(V61_SPINE_SOURCES.map((source) => [
    source,
    readJson(path.join(TELEMETRY_DIR, citySlug, `${source}.json`)),
  ])) as Partial<Record<V61SpineSource, V61DiskTelemetry>>;
  return buildV61CollectionResultFromSpineResponses({ city: city.city, country: city.country, responses, telemetry });
}

function buildGeneratedResult(city: Registration['cities'][number], collection: V61CollectionResult, materialization: V61Materialization): CityGenerationResult {
  const tiersAud = Object.fromEntries(Object.entries(materialization.tiersAud).map(([tier, value]) => [tier, value.amountAud ?? 0]));
  const anchorsAud = Object.fromEntries(Object.entries(materialization.anchors).map(([anchor, value]) => [anchor, value.valueAud ?? 0]));
  const evidenceGrades = Object.fromEntries(Object.entries(materialization.tiersAud).map(([tier, value]) => [tier, value.evidenceGrade]));
  const intervals = Object.fromEntries(Object.entries(materialization.tiersAud).map(([tier, value]) => [tier, value.interval]));
  const payload: V6GeneratedCityPayload = {
    city: city.city,
    country: city.country,
    region: materialization.region ?? city.region,
    confidence: 'medium',
    confidence_notes: 'Delegated Stage-A response followed by the shipped v6.1 deterministic Stage-B materializer.',
    anchors_aud: anchorsAud,
    tiers_aud: tiersAud,
    evidence_grades: evidenceGrades,
    intervals,
  };
  return {
    provider: collection.telemetry[0]?.provider ?? 'delegated-gpt-5.6-luna',
    model: collection.telemetry[0]?.model ?? 'gpt-5.6-luna',
    promptVersion: 'city-cost-v6-1-spine-v1',
    payload,
    mappedEstimate: materialization.mappedEstimate,
    inferredAudPerUsd: null,
    methodologyVersion: 'v6.1',
    v61Collection: collection,
    v61Materialization: materialization,
  };
}

function provenanceRecord(generated: CityGenerationResult) {
  const collection = generated.v61Collection!;
  const materialization = generated.v61Materialization!;
  const persisted = buildCityEstimatePersistence(generated, { referenceDate: '2026-09-17' });
  const api = readV6Provenance(
    JSON.stringify(persisted.metadata),
    JSON.stringify(persisted.anchors),
    JSON.stringify(persisted.inputSnapshot),
  );
  if (!api) throw new Error('The API provenance parser rejected the persisted v6.1 record.');
  const expected = {
    methodologyVersion: 'v6.1',
    evidenceGrades: Object.fromEntries(Object.entries(materialization.tiersAud).map(([tier, value]) => [tier, value.evidenceGrade])),
    intervals: Object.fromEntries(Object.entries(materialization.tiersAud).map(([tier, value]) => [tier, value.interval])),
    anchors: collection.facts,
    telemetry: collection.telemetry,
    missingness: materialization.missingness,
    priorBasis: materialization.priorBasis,
    inputSnapshot: materialization.anchors,
    sources: persisted.sources,
  };
  const persistedFields = {
    methodologyVersion: persisted.metadata.methodologyVersion,
    evidenceGrades: persisted.metadata.evidenceGrades,
    intervals: persisted.metadata.intervals,
    anchors: persisted.anchors,
    telemetry: persisted.metadata.v6CollectionTelemetry,
    missingness: persisted.metadata.v6Missingness,
    priorBasis: persisted.metadata.v6PriorBasis,
    inputSnapshot: persisted.inputSnapshot,
    sources: persisted.sources,
  };
  const apiFields = {
    methodologyVersion: api.methodologyVersion,
    evidenceGrades: api.evidenceGrades,
    intervals: api.intervals,
    anchors: api.anchors,
    telemetry: api.collectionTelemetry,
    missingness: api.missingness,
    priorBasis: api.priorBasis,
    inputSnapshot: api.inputSnapshot,
    sources: api.sources,
  };
  return { expected, persisted: persistedFields, api: apiFields, persistence: persisted };
}

function writeArtifacts(city: Registration['cities'][number], collection: V61CollectionResult, materialization: V61Materialization, provenance: ReturnType<typeof provenanceRecord>) {
  const citySlug = slug(city.city);
  for (const source of V61_SPINE_SOURCES) writeJson(path.join(RAW_DIR, citySlug, `${source}.json`), collection.rawResponses[source]);
  for (const call of collection.telemetry) writeJson(path.join(TELEMETRY_DIR, citySlug, `${call.source}.json`), call);
  const { rawResponses: _rawResponses, providerRawResponses: _providerRawResponses, ...auditableCollection } = collection;
  const file = path.join(MATERIALIZED_DIR, `${citySlug}.json`);
  writeJson(file, {
    schemaVersion: 'city-cost-v6-1-delegated-canary-materialization-v1',
    methodologyVersion: 'v6.1',
    city,
    productionPath: 'delegated Stage A -> buildV61CollectionResultFromSpineResponses -> materializeCityCostV61 -> persistence adapter -> readV6Provenance',
    collection: auditableCollection,
    materialization,
    persistenceApiRoundTrip: { passed: true, apiSummary: provenance.api },
  });
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

function toRecord(city: Registration['cities'][number]): V61CanaryCityRecord {
  try {
    const collection = loadCollection(city);
    const materialization = materializeCityCostV61({ city: city.city, country: city.country, region: city.region, anchors: collection.anchors });
    if (!materialization.complete || Object.keys(materialization.tiersAud).length !== V5_TIER_NAMES.length) {
      throw new Error(`Expected ${V5_TIER_NAMES.length} materialized tiers.`);
    }
    const generated = buildGeneratedResult(city, collection, materialization);
    const provenance = provenanceRecord(generated);
    writeArtifacts(city, collection, materialization, provenance);
    return {
      city: city.city,
      country: city.country,
      window: { arrival: '2026-09-17', departure: '2026-09-18', referenceDate: '2026-09-17' },
      responses: collection.rawResponses,
      telemetry: collection.telemetry,
      materialization: { complete: materialization.complete, tiersAud: materialization.tiersAud },
      directPageReads: collection.telemetry.reduce((sum, call) => sum + call.directPageReads, 0),
      searches: collection.searches,
      provenance: { expected: provenance.expected, persisted: provenance.persisted, api: provenance.api },
    };
  } catch (error) {
    return {
      city: city.city,
      country: city.country,
      window: { arrival: '2026-09-17', departure: '2026-09-18', referenceDate: '2026-09-17' },
      responses: {},
      telemetry: [],
      collectionError: error instanceof Error ? error.message : String(error),
    } as unknown as V61CanaryCityRecord;
  }
}

function run(registration: Registration) {
  const records = registration.cities.map((city) => toRecord(city));
  const criteria: V61CanaryRegistrationCriteria = {
    window: registration.referenceWindow,
    limits: registration.limits,
    completeCitiesMinimum: registration.passCriteria.completeCitiesMinimum,
    artifactBatchMaximumFraction: registration.passCriteria.artifactBatchMaximumFraction,
  };
  const evaluation = evaluateV61CanaryBatch(criteria, records);
  const rows = evaluation.cities.map((city, index) => ({
    city: registration.cities[index].city,
    country: registration.cities[index].country,
    region: registration.cities[index].region,
    band: registration.cities[index].band,
    fixtureSourceStrength: registration.cities[index].fixtureSourceStrength,
    complete: city.complete,
    schemaValid: city.schemaValid,
    sourceCallCount: city.sourceCallCount,
    searches: city.searches,
    directPageReads: city.directPageReads,
    tierCount: records[index].materialization ? Object.keys(records[index].materialization.tiersAud).length : 0,
    provenanceRoundTrip: city.provenanceRoundTrip,
    artifactCandidate: city.artifactCandidate,
    sourceStatuses: Object.fromEntries(records[index].telemetry.map((call) => [call.source, call.status])),
    observedMeasures: Object.values(city.parsedResponses).flatMap((response) => Object.values(response.measures)).filter((measure) => measure.status === 'observed').length,
    error: city.problems.length ? city.problems.join('; ') : null,
    materializationFile: fs.existsSync(path.join(MATERIALIZED_DIR, `${slug(registration.cities[index].city)}.json`))
      ? `data/reference/v6/experiments/011-v6-1-delegated-operational-canary/materialized/${slug(registration.cities[index].city)}.json`
      : null,
  }));
  const results = {
    schemaVersion: 'city-cost-v6-1-delegated-canary-results-v1',
    methodologyVersion: 'v6.1',
    experiment: '011-v6-1-delegated-operational-canary',
    collectionMode: 'delegated_codex_subagent',
    generatedAt: new Date().toISOString(),
    cities: rows.length,
    completeCities: evaluation.completeCities,
    artifactCandidates: evaluation.artifactCandidates,
    artifactFraction: evaluation.artifactFraction,
    requiredCompleteCities: registration.passCriteria.completeCitiesMinimum,
    pass: evaluation.passed,
    holdoutRead: false,
    liveCsvWritten: false,
    rows,
    problems: evaluation.problems,
  };
  writeJson(RESULTS_PATH, results);
  fs.writeFileSync(VERDICT_PATH, [
    '# Experiment 011 — delegated v6.1 operational canary verdict',
    '',
    `**Run:** ${results.generatedAt}`,
    `**Result:** ${results.pass ? 'PASS' : 'FAIL'}`,
    `**Complete cities:** ${results.completeCities}/${results.cities} (required ${results.requiredCompleteCities}/${results.cities})`,
    `**Artifact candidates:** ${results.artifactCandidates}/${results.cities} (${(results.artifactFraction * 100).toFixed(1)}%; maximum 30%)`,
    '',
    results.pass ? 'The delegated Stage-A source contract and deterministic Stage-B/provenance gates passed.' : 'The registered delegated canary failed. Do not proceed to migration; inspect the listed contract failures without tuning coefficients.',
    '',
    '## Gate details',
    '',
    ...evaluation.problems.map((problem) => `- ${problem}`),
    ...(evaluation.problems.length ? [] : ['- None.']),
    '',
    'The delegated canary is not a statistical claim about authenticated provider runtime reliability. The user-key 3–5-city smoke remains pending before cutover. Holdouts and the live CSV were untouched.',
    '',
  ].join('\n'));
  console.log(JSON.stringify({ passed: results.pass, completeCities: results.completeCities, artifactCandidates: results.artifactCandidates, cities: results.cities, holdoutRead: false, liveCsvWritten: false }, null, 2));
  if (!results.pass) process.exitCode = 1;
}

function check(registration: Registration) {
  if (!fs.existsSync(RESULTS_PATH) || !fs.existsSync(VERDICT_PATH)) throw new Error('Delegated canary results or verdict is missing.');
  const results = readJson<{
    schemaVersion: string;
    methodologyVersion: string;
    experiment: string;
    cities: number;
    rows: unknown[];
    completeCities: number;
    artifactCandidates: number;
    requiredCompleteCities: number;
    pass: boolean;
    holdoutRead: boolean;
    liveCsvWritten: boolean;
  }>(RESULTS_PATH);
  if (results.schemaVersion !== 'city-cost-v6-1-delegated-canary-results-v1' || results.methodologyVersion !== 'v6.1' || results.experiment !== registration.experiment) throw new Error('Delegated canary result schema drifted.');
  if (results.cities !== 20 || results.rows.length !== 20) throw new Error('Delegated canary result frame is not 20 cities.');
  if (results.requiredCompleteCities !== registration.passCriteria.completeCitiesMinimum) throw new Error('Delegated canary completion threshold drifted.');
  if (typeof results.completeCities !== 'number' || typeof results.artifactCandidates !== 'number' || typeof results.pass !== 'boolean') throw new Error('Delegated canary gate fields are malformed.');
  if (results.holdoutRead || results.liveCsvWritten) throw new Error('Delegated canary recorded a forbidden holdout read or live CSV write.');
  // --check validates the recorded experiment artifact. A failed registered
  // gate remains visible as resultPass:false and is not converted into a pass.
  console.log(JSON.stringify({ passed: true, cities: results.cities, resultPass: results.pass, completeCities: results.completeCities, artifactCandidates: results.artifactCandidates }, null, 2));
}

const registration = readJson<Registration>(REGISTRATION_PATH);
assertRegistration(registration);
if (CHECK) check(registration);
else run(registration);
