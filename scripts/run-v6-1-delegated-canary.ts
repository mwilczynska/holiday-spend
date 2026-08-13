import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  buildV61CollectionResultFromSpineResponses,
  createBlockedV61SpineResponse,
  normalizeV61DiskTelemetry,
  parseV61SpineResponse,
  sourceIdentityMatches,
  V61_SPINE_SOURCES,
  type V61CollectionResult,
  type V61CollectionCallTelemetry,
  type V61SpineSource,
  type V61DiskTelemetry,
} from '../src/lib/city-cost-v6-1-collection';
import { materializeCityCostV61, type V61Materialization } from '../src/lib/city-cost-methodology-v6-1';
import { buildCityEstimatePersistence } from '../src/lib/city-generation-persistence';
import { readV6Provenance } from '../src/lib/city-estimate-provenance';
import { V5_TIER_NAMES } from '../src/lib/city-cost-methodology-v5';
import { evaluateV61CanaryBatch, type V61CanaryCityRecord, type V61CanaryRegistrationCriteria } from '../src/lib/city-cost-v6-1-canary';
import { inspectV61CallSlot, inspectV61Experiment, type V61CallSlotInventory } from '../src/lib/city-cost-v6-1-canary-inventory';
import type { CityGenerationResult, V6GeneratedCityPayload } from '../src/lib/city-generation';

const ROOT = process.cwd();
function optionValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const experimentRelativeDir = optionValue('--experiment-dir')
  ?? 'data/reference/v6/experiments/011-v6-1-delegated-operational-canary';
const EXPERIMENT_DIR = path.resolve(ROOT, experimentRelativeDir);
const EXPERIMENT_NAME = path.basename(EXPERIMENT_DIR);
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
  if (!['delegated_codex_subagent', 'validated_experiment_012_reuse+delegated_codex_subagent'].includes(registration.collectionMode)) throw new Error('Delegated collection mode is not registered.');
  if (registration.cities.length !== 20 || registration.limits.sourceCallsPerCity !== 3) throw new Error('Delegated canary frame or call count drifted.');
  if (registration.passCriteria.completeCitiesMinimum !== 19) throw new Error('Delegated canary threshold drifted from 19/20.');
  if (registration.referenceWindow.arrival !== '2026-09-17' || registration.referenceWindow.departure !== '2026-09-18') throw new Error('Delegated canary window drifted.');
  if (registration.holdoutRead || registration.liveCsvWritten) throw new Error('Delegated canary registration permits a forbidden write/read.');
  if (sha256(repoFile(registration.inputCsv)) !== registration.inputCsvSha256) throw new Error('Registered CSV hash changed.');
  if (sha256(repoFile(registration.fxSnapshot)) !== registration.fxSnapshotSha256) throw new Error('Registered FX hash changed.');
  const immutableHistoricalExperiment = registration.experiment === '011-v6-1-delegated-operational-canary'
    || registration.experiment === '012-v6-1-corrected-delegated-canary'
    || registration.experiment === '013-v6-1-resumable-delegated-canary';
  for (const prompt of Object.values(registration.prompts)) {
    if (!immutableHistoricalExperiment && sha256(repoFile(prompt.file)) !== prompt.sha256) throw new Error(`Registered prompt changed: ${prompt.file}`);
  }
  for (const [file, hash] of Object.entries(registration.implementationFiles)) {
    if (!immutableHistoricalExperiment && sha256(repoFile(file)) !== hash) throw new Error(`Registered implementation changed: ${file}`);
  }
  if (registration.experiment !== EXPERIMENT_NAME) throw new Error(`Registration experiment ${registration.experiment} does not match ${EXPERIMENT_NAME}.`);
}

function readOptionalJson(file: string) {
  if (!fs.existsSync(file)) return { present: false, value: undefined };
  try {
    return { present: true, value: readJson<unknown>(file) };
  } catch (error) {
    return { present: true, value: undefined, error: error instanceof Error ? error.message : String(error) };
  }
}

function loadCollection(city: Registration['cities'][number], inventorySlots: V61CallSlotInventory[]) {
  const citySlug = slug(city.city);
  const rawResponses: Partial<Record<V61SpineSource, unknown>> = {};
  const telemetry: Partial<Record<V61SpineSource, V61DiskTelemetry>> = {};
  const effectiveResponses: Partial<Record<V61SpineSource, unknown>> = {};
  const invalidResponses: Partial<Record<V61SpineSource, string>> = {};
  const telemetryRecords: V61CollectionCallTelemetry[] = [];
  const slots = [] as V61CallSlotInventory[];
  for (const source of V61_SPINE_SOURCES) {
    const rawFile = readOptionalJson(path.join(RAW_DIR, citySlug, `${source}.json`));
    const telemetryFile = readOptionalJson(path.join(TELEMETRY_DIR, citySlug, `${source}.json`));
    const slot = inventorySlots.find((candidate) => candidate.source === source);
    if (!slot) throw new Error(`Inventory is missing ${city.city}/${source}.`);
    slots.push(slot);
    if (rawFile.present) rawResponses[source] = rawFile.value;
    if (telemetryFile.present) telemetry[source] = telemetryFile.value as V61DiskTelemetry;
    if (rawFile.error) invalidResponses[source] = `raw response JSON: ${rawFile.error}`;
    if (telemetryFile.error) invalidResponses[source] = `telemetry JSON: ${telemetryFile.error}`;
    if (rawFile.present && rawFile.value !== undefined) {
      try {
        const parsed = parseV61SpineResponse(source, rawFile.value);
        if (!sourceIdentityMatches(parsed, city)) throw new Error('response city/country does not match the registered call');
        effectiveResponses[source] = rawFile.value;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        invalidResponses[source] = invalidResponses[source] ?? message;
      }
    }
    if (telemetryFile.present && telemetryFile.value !== undefined) {
      try {
        const responseForTelemetry = effectiveResponses[source]
          ? parseV61SpineResponse(source, effectiveResponses[source])
          : createBlockedV61SpineResponse(source, city.city, city.country, 'Inventory-only telemetry validation; source response is unavailable.');
        const normalized = normalizeV61DiskTelemetry(source, responseForTelemetry, telemetryFile.value as V61DiskTelemetry);
        telemetryRecords.push(normalized);
      } catch (error) {
        invalidResponses[source] = invalidResponses[source] ?? (error instanceof Error ? error.message : String(error));
      }
    }
    if (slot.terminal && !slot.reusable && !invalidResponses[source]) {
      invalidResponses[source] = slot.errors.join('; ') || 'terminal call is not reusable';
    }
    if (!slot.terminal) {
      // Pending files are intentionally not converted into blocked source
      // values. The finalizer refuses this frame before Stage B runs.
      continue;
    }
    if (!effectiveResponses[source]) effectiveResponses[source] = createBlockedV61SpineResponse(source, city.city, city.country, invalidResponses[source] ?? 'Terminal source error; no source response was available.');
  }
  const collection = slots.every((slot) => slot.terminal)
    ? buildV61CollectionResultFromSpineResponses({ city: city.city, country: city.country, responses: effectiveResponses as Record<V61SpineSource, unknown>, telemetry })
    : undefined;
  return {
    collection: collection ? { ...collection, rawResponses: collection.rawResponses } : undefined,
    rawResponses,
    telemetry,
    telemetryRecords,
    invalidResponses,
    slots,
    collectionTerminal: slots.every((slot) => slot.terminal),
  };
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
    JSON.stringify(persisted.sources),
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

function writeArtifacts(city: Registration['cities'][number], collection: V61CollectionResult, rawResponses: Partial<Record<V61SpineSource, unknown>>, materialization: V61Materialization, provenance: ReturnType<typeof provenanceRecord>, invalidResponses: Partial<Record<V61SpineSource, string>>) {
  const citySlug = slug(city.city);
  for (const source of V61_SPINE_SOURCES) {
    if (rawResponses[source] !== undefined) writeJson(path.join(RAW_DIR, citySlug, `${source}.json`), rawResponses[source]);
  }
  for (const call of collection.telemetry) {
    if (!fs.existsSync(path.join(TELEMETRY_DIR, citySlug, `${call.source}.json`))) {
      writeJson(path.join(TELEMETRY_DIR, citySlug, `${call.source}.json`), call);
    }
  }
  const { rawResponses: _rawResponses, providerRawResponses: _providerRawResponses, ...auditableCollection } = collection;
  const file = path.join(MATERIALIZED_DIR, `${citySlug}.json`);
  writeJson(file, {
    schemaVersion: 'city-cost-v6-1-delegated-canary-materialization-v1',
    methodologyVersion: 'v6.1',
    city,
    productionPath: 'delegated Stage A -> buildV61CollectionResultFromSpineResponses -> materializeCityCostV61 -> persistence adapter -> readV6Provenance',
    collection: auditableCollection,
    validationErrors: invalidResponses,
    materialization,
    persistenceApiRoundTrip: { passed: true, apiSummary: provenance.api },
  });
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

function toRecord(city: Registration['cities'][number], inventorySlots: V61CallSlotInventory[]): V61CanaryCityRecord {
  const loaded = loadCollection(city, inventorySlots.filter((slot) => slot.city === city.city));
  if (!loaded.collection) {
    return {
      city: city.city,
      country: city.country,
      window: { arrival: '2026-09-17', departure: '2026-09-18', referenceDate: '2026-09-17' },
      responses: loaded.rawResponses,
      telemetry: loaded.telemetryRecords,
      invalidResponses: loaded.invalidResponses,
      collectionTerminal: loaded.collectionTerminal,
      callSlots: loaded.slots,
      collectionError: loaded.slots.filter((slot) => !slot.terminal).map((slot) => `${slot.source}: pending`).join('; '),
    };
  }
  try {
    const collection = loaded.collection;
    const materialization = materializeCityCostV61({ city: city.city, country: city.country, region: city.region, anchors: collection.anchors });
    if (!materialization.complete || Object.keys(materialization.tiersAud).length !== V5_TIER_NAMES.length) {
      throw new Error(`Expected ${V5_TIER_NAMES.length} materialized tiers.`);
    }
    const generated = buildGeneratedResult(city, collection, materialization);
    const provenance = provenanceRecord(generated);
    writeArtifacts(city, collection, loaded.rawResponses, materialization, provenance, loaded.invalidResponses);
    return {
      city: city.city,
      country: city.country,
      window: { arrival: '2026-09-17', departure: '2026-09-18', referenceDate: '2026-09-17' },
      responses: loaded.rawResponses,
      telemetry: collection.telemetry,
      materialization: { complete: materialization.complete, tiersAud: materialization.tiersAud },
      directPageReads: collection.telemetry.reduce((sum, call) => sum + call.directPageReads, 0),
      searches: collection.searches,
      provenance: { expected: provenance.expected, persisted: provenance.persisted, api: provenance.api },
      invalidResponses: loaded.invalidResponses,
      collectionTerminal: loaded.collectionTerminal,
      callSlots: loaded.slots,
    };
  } catch (error) {
    return {
      city: city.city,
      country: city.country,
      window: { arrival: '2026-09-17', departure: '2026-09-18', referenceDate: '2026-09-17' },
      responses: loaded.rawResponses,
      telemetry: loaded.telemetryRecords,
      collectionTerminal: loaded.collectionTerminal,
      callSlots: loaded.slots,
      invalidResponses: loaded.invalidResponses,
      collectionError: error instanceof Error ? error.message : String(error),
    };
  }
}

function run(registration: Registration) {
  const inventory = inspectV61Experiment(registration, EXPERIMENT_DIR);
  if (inventory.pendingCallSlots > 0) {
    throw new Error(`Cannot finalize ${registration.experiment}: ${inventory.pendingCallSlots} of ${inventory.registeredCallSlots} call slots are still pending. Run inventory/status and collect the missing slots first.`);
  }
  const records = registration.cities.map((city) => toRecord(city, inventory.slots));
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
    collectionTerminal: city.collectionTerminal,
    callSlots: records[index].callSlots,
    artifactCandidate: city.artifactCandidate,
    sourceStatuses: city.sourceStatuses,
    observedMeasures: city.observedMeasures,
    invalidResponses: city.invalidResponses,
    error: city.problems.length ? city.problems.join('; ') : null,
    materializationFile: fs.existsSync(path.join(MATERIALIZED_DIR, `${slug(registration.cities[index].city)}.json`))
      ? path.relative(ROOT, path.join(MATERIALIZED_DIR, `${slug(registration.cities[index].city)}.json`)).replaceAll('\\', '/')
      : null,
  }));
  const results = {
    schemaVersion: 'city-cost-v6-1-delegated-canary-results-v1',
    methodologyVersion: 'v6.1',
    experiment: registration.experiment,
    collectionMode: registration.collectionMode,
    generatedAt: new Date().toISOString(),
    cities: rows.length,
    completeCities: evaluation.completeCities,
    artifactCandidates: evaluation.artifactCandidates,
    artifactFraction: evaluation.artifactFraction,
    attemptedCalls: evaluation.attemptedCalls,
    validResponses: evaluation.validResponses,
    invalidResponses: evaluation.invalidResponses,
    retries: evaluation.retries,
    searches: evaluation.searches,
    directPageReads: evaluation.directPageReads,
    observedMeasureCounts: evaluation.observedMeasureCounts,
    sourceStatusCounts: evaluation.sourceStatusCounts,
    artifactSignatures: evaluation.artifactSignatures,
    registeredCallSlots: inventory.registeredCallSlots,
    pendingCallSlots: inventory.pendingCallSlots,
    terminalCallSlots: inventory.terminalCallSlots,
    reusableCallSlots: inventory.reusableCallSlots,
    invalidCallSlots: inventory.invalidCallSlots,
    rawResponsesPresent: inventory.rawResponsesPresent,
    telemetryRecordsPresent: inventory.telemetryRecordsPresent,
    orphanRawResponses: inventory.orphanRawResponses,
    orphanTelemetryRecords: inventory.orphanTelemetryRecords,
    actualProviderCalls: inventory.actualProviderCalls,
    sourceCallRecords: inventory.sourceCallRecords,
    assignmentAttempts: inventory.assignmentAttempts,
    assignmentAttemptsRecorded: inventory.assignmentAttemptsRecorded,
    categoryCounts: evaluation.categoryCounts,
    gradeDistribution: evaluation.gradeDistribution,
    allPriorCities: evaluation.allPriorCities,
    persistenceProvenanceEqualCities: evaluation.provenanceRoundTrips,
    completeDeterministic19TierCities: evaluation.completeDeterministic19TierCities,
    requiredCompleteCities: registration.passCriteria.completeCitiesMinimum,
    pass: evaluation.passed,
    holdoutRead: false,
    liveCsvWritten: false,
    rows,
    problems: evaluation.problems,
  };
  writeJson(RESULTS_PATH, results);
  const verdictLines = [
    '# Experiment 011 — delegated v6.1 operational canary verdict',
    '',
    `**Run:** ${results.generatedAt}`,
    `**Result:** ${results.pass ? 'PASS' : 'FAIL'}`,
    `**Complete cities:** ${results.completeCities}/${results.cities} (required ${results.requiredCompleteCities}/${results.cities})`,
    `**Artifact candidates:** ${results.artifactCandidates}/${results.cities} (${(results.artifactFraction * 100).toFixed(1)}%; maximum 30%)`,
    `**Call frame:** ${results.registeredCallSlots} registered, ${results.terminalCallSlots} terminal, ${results.pendingCallSlots} pending; ${results.rawResponsesPresent} raw responses and ${results.telemetryRecordsPresent} telemetry records present`,
    `**Calls:** ${results.sourceCallRecords} source-call records, ${results.actualProviderCalls} actual provider calls, ${results.assignmentAttemptsRecorded ? `${results.assignmentAttempts} assignment attempts` : 'assignment attempts not recorded'}, ${results.validResponses} valid responses, ${results.invalidResponses} invalid responses, ${results.retries} retries`,
    `**Searches / direct reads:** ${results.searches} / ${results.directPageReads}`,
    `**Observed measures:** ${JSON.stringify(results.observedMeasureCounts)}`,
    `**Source statuses:** ${JSON.stringify(results.sourceStatusCounts)}`,
    `**Category direct/fallback:** ${JSON.stringify(results.categoryCounts)}`,
    `**Tier grades:** ${JSON.stringify(results.gradeDistribution)}; all-prior cities: ${results.allPriorCities}`,
    `**Orphans:** ${results.orphanRawResponses} raw, ${results.orphanTelemetryRecords} telemetry`,
    `**Persistence/API provenance equality:** ${results.persistenceProvenanceEqualCities}/${results.cities} cities`,
    `**Artifact signatures:** ${results.artifactSignatures.length ? results.artifactSignatures.map((signature) => signature.reason).join(' ') : 'None.'}`,
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
  ].map((line, index) => index === 0 ? `# Experiment ${registration.experiment} - delegated v6.1 operational canary verdict` : line);
  fs.writeFileSync(VERDICT_PATH, verdictLines.join('\n'));
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
    attemptedCalls?: number;
    validResponses?: number;
    invalidResponses?: number;
    retries?: number;
    searches?: number;
    directPageReads?: number;
    observedMeasureCounts?: Record<string, number>;
    sourceStatusCounts?: Record<string, Record<string, number>>;
    artifactSignatures?: unknown[];
    registeredCallSlots?: number;
    pendingCallSlots?: number;
    terminalCallSlots?: number;
    rawResponsesPresent?: number;
    telemetryRecordsPresent?: number;
    sourceCallRecords?: number;
    assignmentAttemptsRecorded?: boolean;
    categoryCounts?: unknown;
    gradeDistribution?: unknown;
    allPriorCities?: number;
    persistenceProvenanceEqualCities?: number;
    completeDeterministic19TierCities?: number;
    requiredCompleteCities: number;
    pass: boolean;
    holdoutRead: boolean;
    liveCsvWritten: boolean;
  }>(RESULTS_PATH);
  if (results.schemaVersion !== 'city-cost-v6-1-delegated-canary-results-v1' || results.methodologyVersion !== 'v6.1' || results.experiment !== registration.experiment) throw new Error('Delegated canary result schema drifted.');
  if (results.cities !== 20 || results.rows.length !== 20) throw new Error('Delegated canary result frame is not 20 cities.');
  if (results.requiredCompleteCities !== registration.passCriteria.completeCitiesMinimum) throw new Error('Delegated canary completion threshold drifted.');
  if (typeof results.completeCities !== 'number' || typeof results.artifactCandidates !== 'number' || typeof results.pass !== 'boolean') throw new Error('Delegated canary gate fields are malformed.');
  if (results.experiment !== '011-v6-1-delegated-operational-canary'
    && (typeof results.attemptedCalls !== 'number' || results.attemptedCalls < 0 || results.attemptedCalls > 60
      || (results.validResponses ?? -1) < 0 || (results.invalidResponses ?? -1) < 0
      || (results.validResponses ?? 0) > 60 || (results.invalidResponses ?? 0) > 60
      || (results.retries ?? -1) < 0 || results.directPageReads !== 0)) {
    throw new Error('Delegated canary call accounting is malformed.');
  }
  const historicalExperiment = results.experiment === '011-v6-1-delegated-operational-canary'
    || results.experiment === '012-v6-1-corrected-delegated-canary';
  if (!historicalExperiment) {
    if (results.registeredCallSlots !== 60 || results.terminalCallSlots !== 60 || results.pendingCallSlots !== 0) {
      throw new Error('Finalized delegated canary does not have a terminal 60-slot collection frame.');
    }
    if (typeof results.rawResponsesPresent !== 'number' || typeof results.telemetryRecordsPresent !== 'number'
      || results.sourceCallRecords !== 60 || !results.assignmentAttemptsRecorded) {
      throw new Error('Finalized delegated canary call inventory is incomplete.');
    }
    if (!results.categoryCounts || !results.gradeDistribution || typeof results.allPriorCities !== 'number') {
      throw new Error('Finalized delegated canary category or grade reporting is missing.');
    }
    if (typeof results.persistenceProvenanceEqualCities !== 'number'
      || typeof results.completeDeterministic19TierCities !== 'number') {
      throw new Error('Finalized delegated canary deterministic/provenance reporting is missing.');
    }
  }
  if (results.holdoutRead || results.liveCsvWritten) throw new Error('Delegated canary recorded a forbidden holdout read or live CSV write.');
  // --check validates the recorded experiment artifact. A failed registered
  // gate remains visible as resultPass:false and is not converted into a pass.
  console.log(JSON.stringify({ passed: true, cities: results.cities, resultPass: results.pass, completeCities: results.completeCities, artifactCandidates: results.artifactCandidates }, null, 2));
}

const registration = readJson<Registration>(REGISTRATION_PATH);
assertRegistration(registration);
if (CHECK) check(registration);
else {
  if (fs.existsSync(RESULTS_PATH) || fs.existsSync(VERDICT_PATH)) {
    throw new Error(`Completed experiment ${registration.experiment} is immutable; use --check to validate it.`);
  }
  run(registration);
}
