import fs from 'node:fs';
import path from 'node:path';
import {
  assertAllTiers,
  assertFrozenProtocol,
  assertSafeMigrationOutput,
  buildImportPlan,
  buildMigrationCallProvenance,
  buildMigrationCollection,
  buildProvenanceRow,
  buildStagedCsv,
  buildV61GeneratedResult,
  migrationSlug,
  readCallFiles,
  readJson,
  readMigrationFrame,
  repoPath,
  sha256File,
  V61_MIGRATION_LIVE_CSV,
  V61_MIGRATION_ROOT,
  V61_MIGRATION_SCHEMA,
  V61_MIGRATION_CSV_COLUMNS,
  type V61MigrationCallProvenance,
  type V61MigrationCheckpoint,
  type V61MigrationCheckpointCity,
  type V61MigrationCity,
  type V61MigrationProvenanceRow,
  type V61MigrationProtocol,
} from '../src/lib/city-cost-v6-1-migration';
import { V61_SOURCE_CONFIG, V61_SPINE_SOURCES, type V61SpineSource } from '../src/lib/city-cost-v6-1-collection';
import { materializeCityCostV61 } from '../src/lib/city-cost-methodology-v6-1';
import { buildCityEstimatePersistence } from '../src/lib/city-generation-persistence';

const ROOT = process.cwd();
const MIGRATION_DIR = repoPath(ROOT, V61_MIGRATION_ROOT);
const PROTOCOL_PATH = path.join(MIGRATION_DIR, 'protocol.json');
const CHECKPOINT_PATH = path.join(MIGRATION_DIR, 'checkpoint.json');
const CALL_PROVENANCE_PATH = path.join(MIGRATION_DIR, 'call-provenance.json');
const REUSE_MANIFEST_PATH = path.join(MIGRATION_DIR, 'reuse-manifest.json');
const RAW_BASE = `${V61_MIGRATION_ROOT}/raw`;
const TELEMETRY_BASE = `${V61_MIGRATION_ROOT}/telemetry`;
const NORMALIZED_DIR = path.join(MIGRATION_DIR, 'normalized');
const MATERIALIZED_DIR = path.join(MIGRATION_DIR, 'materialized');
const STAGED_DIR = path.join(MIGRATION_DIR, 'staged');
const DRY_RUN_DIR = path.join(MIGRATION_DIR, 'dry-run');
const IMPLEMENTATION_FILES = [
  'src/lib/city-cost-v6-1-collection.ts',
  'src/lib/city-cost-methodology-v6-1.ts',
  'src/lib/city-generation-persistence.ts',
  'src/lib/city-estimate-provenance.ts',
  'src/lib/city-cost-v6-1-migration.ts',
  'scripts/migrate-city-cost-v6-1.ts',
];

function cliValue(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const command = process.argv[2] ?? 'status';
const check = process.argv.includes('--check');

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function expectedText(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sourcePath(source: V61SpineSource) {
  return `${source}`;
}

const ASSIGNMENTS_PATH = path.join(MIGRATION_DIR, 'assignments.json');
const CLAIMS_DIR = path.join(MIGRATION_DIR, 'assignment-claims');
const CLAIM_LOCK_DIR = path.join(CLAIMS_DIR, '.lock');

function readProtocol() {
  if (!fs.existsSync(PROTOCOL_PATH)) throw new Error(`Frozen migration protocol is missing: ${PROTOCOL_PATH}`);
  const protocol = readJson<V61MigrationProtocol>(PROTOCOL_PATH);
  assertFrozenProtocol(protocol, ROOT);
  return protocol;
}

function readModes(): Record<string, V61MigrationCallProvenance> {
  if (!fs.existsSync(CALL_PROVENANCE_PATH)) return {};
  return readJson<Record<string, V61MigrationCallProvenance>>(CALL_PROVENANCE_PATH);
}

function writeModes(modes: Record<string, V61MigrationCallProvenance>) {
  writeJson(CALL_PROVENANCE_PATH, Object.fromEntries(Object.entries(modes).sort(([left], [right]) => left.localeCompare(right))));
}

function assignmentSlotKey(city: string, source: V61SpineSource) {
  return `${city}\u0000${source}`;
}

function assignmentClaimFile(city: string, source: V61SpineSource) {
  return path.join(CLAIMS_DIR, `${migrationSlug(city)}--${source}.json`);
}

function acquireAssignmentLock() {
  fs.mkdirSync(CLAIMS_DIR, { recursive: true });
  try {
    fs.mkdirSync(CLAIM_LOCK_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    throw new Error('Migration assignment ledger is locked; retry after the current assignment completes.');
  }
  fs.writeFileSync(path.join(CLAIM_LOCK_DIR, 'owner.json'), `${JSON.stringify({ pid: process.pid })}\n`);
}

function releaseAssignmentLock() {
  if (fs.existsSync(CLAIM_LOCK_DIR)) fs.rmSync(CLAIM_LOCK_DIR, { recursive: true, force: true });
}

function readAssignments() {
  if (!fs.existsSync(ASSIGNMENTS_PATH)) return { schemaVersion: 'city-cost-v6-1-migration-assignment-ledger-v1', protocolSha256: sha256File(PROTOCOL_PATH), assignments: [] as Array<{ assignmentId: string; agentId: string; city: string; sources: V61SpineSource[]; assignedAt: string }> };
  const ledger = readJson<{ schemaVersion: string; protocolSha256: string; assignments: Array<{ assignmentId: string; agentId: string; city: string; sources: V61SpineSource[]; assignedAt: string }> }>(ASSIGNMENTS_PATH);
  if (ledger.schemaVersion !== 'city-cost-v6-1-migration-assignment-ledger-v1' || ledger.protocolSha256 !== sha256File(PROTOCOL_PATH)) throw new Error('Migration assignment ledger does not match the frozen protocol.');
  return ledger;
}

function assign() {
  const protocol = readProtocol();
  const cityName = cliValue('city');
  const assignmentId = cliValue('assignment-id');
  const agentId = cliValue('agent-id');
  const requestedSources = (cliValue('sources') ?? '').split(',').filter(Boolean) as V61SpineSource[];
  if (!cityName || !assignmentId || !agentId || requestedSources.length !== 3 || new Set(requestedSources).size !== 3 || requestedSources.some((source) => !V61_SPINE_SOURCES.includes(source))) {
    throw new Error('assign requires --city, --assignment-id, --agent-id and all three comma-separated --sources.');
  }
  const city = protocol.frame.find((candidate) => candidate.city === cityName);
  if (!city) throw new Error(`Migration city is not in the frozen frame: ${cityName}`);
  acquireAssignmentLock();
  try {
    const ledger = readAssignments();
    if (ledger.assignments.some((assignment) => assignment.assignmentId === assignmentId)) throw new Error(`Assignment already exists: ${assignmentId}`);
    const claimed = new Set(ledger.assignments.flatMap((assignment) => assignment.sources.map((source) => assignmentSlotKey(assignment.city, source))));
    for (const source of requestedSources) {
      const key = assignmentSlotKey(cityName, source);
      if (claimed.has(key) || fs.existsSync(assignmentClaimFile(cityName, source))) throw new Error(`Migration slot already claimed: ${cityName}/${source}`);
    }
    const assignment = { assignmentId, agentId, city: cityName, sources: requestedSources, assignedAt: new Date().toISOString() };
    if (!check) {
      for (const source of requestedSources) {
        const claimFile = assignmentClaimFile(cityName, source);
        const fd = fs.openSync(claimFile, 'wx');
        try { fs.writeFileSync(fd, `${JSON.stringify({ schemaVersion: 'city-cost-v6-1-migration-slot-claim-v1', ...assignment, source })}\n`); } finally { fs.closeSync(fd); }
      }
      ledger.assignments.push(assignment);
      writeJson(ASSIGNMENTS_PATH, ledger);
      const modes = readModes();
      for (const source of requestedSources) modes[assignmentSlotKey(cityName, source)] = { city: cityName, country: city.country, source, collectionMode: 'delegated_codex_subagent', assignmentId, agentId, rawSha256: '', telemetrySha256: '' };
      writeModes(modes);
    }
    console.log(JSON.stringify({ passed: true, command: 'assign', assignmentId, city: cityName, sources: requestedSources }, null, 2));
  } finally {
    releaseAssignmentLock();
  }
}

function buildProtocol(): V61MigrationProtocol {
  const csv = V61_MIGRATION_LIVE_CSV;
  const fx = 'data/reference/fx/city_cost_fx_aud_2026-07-22.json';
  const frame = readMigrationFrame(repoPath(ROOT, csv));
  const prompts = Object.fromEntries(V61_SPINE_SOURCES.map((source) => {
    const file = `docs/prompts/${V61_SOURCE_CONFIG[source].promptFile}`;
    return [source, { file, sha256: sha256File(repoPath(ROOT, file)) }];
  })) as V61MigrationProtocol['prompts'];
  return {
    schemaVersion: V61_MIGRATION_SCHEMA,
    status: 'frozen',
    registeredAt: '2026-08-13',
    methodologyVersion: 'v6.1',
    inputCsv: csv,
    inputCsvSha256: sha256File(repoPath(ROOT, csv)),
    fxSnapshot: fx,
    fxSnapshotSha256: sha256File(repoPath(ROOT, fx)),
    collectionWindow: { arrival: '2026-09-17', departure: '2026-09-18', referenceDate: '2026-09-17' },
    limits: {
      sourceCallsPerCity: 3,
      maxSearchesPerCity: 10,
      maxSearchesBySource: { expedia_3star: 4, budgetyourtrip_daily_tiers: 4, numbeo_drinks: 2 },
      directPageReadsPerCity: 0,
      maxRetriesPerCall: 1,
    },
    prompts,
    implementationFiles: Object.fromEntries(IMPLEMENTATION_FILES.map((file) => [file, sha256File(repoPath(ROOT, file))])),
    frame,
    sourcePolicy: {
      stageA: 'delegated_codex_subagent',
      stageB: 'shipped_materializeCityCostV61',
      noDirectPageReads: true,
      noPriorsFromCsv: true,
    },
    liveCsvWrite: 'forbidden',
  };
}

function buildCheckpoint(protocol: V61MigrationProtocol): V61MigrationCheckpoint {
  const protocolHash = sha256File(PROTOCOL_PATH);
  return {
    schemaVersion: 'city-cost-v6-1-migration-checkpoint-v1',
    protocolSha256: protocolHash,
    cities: protocol.frame.map((city) => ({
      city: city.city,
      cityId: city.cityId,
      status: 'pending',
      sourceCalls: 0,
      rawResponses: 0,
      telemetryRecords: 0,
      collectionModes: [],
      error: null,
    })),
  };
}

function init() {
  fs.mkdirSync(MIGRATION_DIR, { recursive: true });
  const protocol = buildProtocol();
  if (fs.existsSync(PROTOCOL_PATH)) {
    const existing = readJson<V61MigrationProtocol>(PROTOCOL_PATH);
    if (JSON.stringify(existing) !== JSON.stringify(protocol)) throw new Error('Frozen migration protocol already exists and differs; refusing overwrite.');
  } else if (!check) {
    writeJson(PROTOCOL_PATH, protocol);
  }
  if (!fs.existsSync(PROTOCOL_PATH)) throw new Error('Protocol was not written.');
  assertFrozenProtocol(readJson<V61MigrationProtocol>(PROTOCOL_PATH), ROOT);
  if (!fs.existsSync(CHECKPOINT_PATH)) {
    if (!check) writeJson(CHECKPOINT_PATH, buildCheckpoint(readJson<V61MigrationProtocol>(PROTOCOL_PATH)));
  }
  for (const dir of [NORMALIZED_DIR, MATERIALIZED_DIR, STAGED_DIR, path.join(MIGRATION_DIR, 'raw'), path.join(MIGRATION_DIR, 'telemetry')]) fs.mkdirSync(dir, { recursive: true });
  console.log(JSON.stringify({ passed: true, command: 'init', cities: protocol.frame.length, protocol: path.relative(ROOT, PROTOCOL_PATH).replaceAll('\\', '/') }, null, 2));
}

function readCheckpoint(protocol: V61MigrationProtocol) {
  if (!fs.existsSync(CHECKPOINT_PATH)) throw new Error('Migration checkpoint is missing; run init first.');
  const checkpoint = readJson<V61MigrationCheckpoint>(CHECKPOINT_PATH);
  if (checkpoint.schemaVersion !== 'city-cost-v6-1-migration-checkpoint-v1' || checkpoint.protocolSha256 !== sha256File(PROTOCOL_PATH)) throw new Error('Migration checkpoint does not match the frozen protocol.');
  if (checkpoint.cities.length !== protocol.frame.length) throw new Error('Migration checkpoint city frame drifted.');
  return checkpoint;
}

function saveCheckpoint(checkpoint: V61MigrationCheckpoint) {
  writeJson(CHECKPOINT_PATH, checkpoint);
}

function callInventory(protocol: V61MigrationProtocol, city: V61MigrationCity) {
  const calls = V61_SPINE_SOURCES.map((source) => readCallFiles(ROOT, RAW_BASE, city, source));
  return {
    city,
    terminal: calls.every((call) => call.terminal),
    rawResponses: calls.filter((call) => call.terminal).length,
    telemetryRecords: calls.filter((call) => call.terminal).length,
    calls,
  };
}

function status() {
  const protocol = readProtocol();
  const checkpoint = readCheckpoint(protocol);
  const rows = protocol.frame.map((city) => {
    const inventory = callInventory(protocol, city);
    const checkpointRow = checkpoint.cities.find((item) => item.cityId === city.cityId);
    return {
      city: city.city,
      status: checkpointRow?.status ?? 'pending',
      terminal: inventory.terminal,
      rawResponses: inventory.rawResponses,
      telemetryRecords: inventory.telemetryRecords,
    };
  });
  console.log(JSON.stringify({
    passed: true,
    command: 'status',
    registeredCities: rows.length,
    terminalCities: rows.filter((row) => row.terminal).length,
    materializedCities: rows.filter((row) => row.status === 'materialized').length,
    pendingCities: rows.filter((row) => !row.terminal).length,
    rows,
    liveCsvWrite: 'forbidden',
  }, null, 2));
}

function sourceRegistration(file: string) {
  return readJson<{
    experiment: string;
    referenceWindow?: { arrival: string; departure: string; referenceDate: string; budgetYourTripReferenceDate?: string; numbeoReferenceDate?: string };
    inputCsvSha256?: string;
    fxSnapshotSha256?: string;
    prompts?: Record<V61SpineSource, { file: string; sha256: string }>;
  }>(file);
}

function reuseFromExperiment() {
  const protocol = readProtocol();
  const sourceRelative = cliValue('source-experiment-dir') ?? 'data/reference/v6/experiments/014-v6-1-final-delegated-canary';
  const sourceDir = path.resolve(ROOT, sourceRelative);
  const sourceReg = sourceRegistration(path.join(sourceDir, 'registration.json'));
  const expectedWindow = { arrival: protocol.collectionWindow.arrival, departure: protocol.collectionWindow.departure, referenceDate: protocol.collectionWindow.referenceDate, budgetYourTripReferenceDate: '2026-09-17', numbeoReferenceDate: '2026-09-17' };
  if (JSON.stringify(sourceReg.referenceWindow) !== JSON.stringify(expectedWindow)) {
    throw new Error('Reuse source window does not match frozen migration window.');
  }
  if (sourceReg.inputCsvSha256 !== protocol.inputCsvSha256 || sourceReg.fxSnapshotSha256 !== protocol.fxSnapshotSha256) {
    throw new Error('Reuse source input CSV or FX snapshot does not match the frozen migration protocol.');
  }
  for (const source of V61_SPINE_SOURCES) {
    const expectedPrompt = protocol.prompts[source];
    const sourcePrompt = sourceReg.prompts?.[source];
    if (!sourcePrompt || sourcePrompt.file !== expectedPrompt.file || sourcePrompt.sha256 !== expectedPrompt.sha256) {
      throw new Error(`Reuse source prompt contract does not match the frozen migration protocol for ${source}.`);
    }
  }
  const requested = cliValue('cities')?.split(',').map((city) => city.trim()).filter(Boolean);
  const selected = protocol.frame.filter((city) => !requested?.length || requested.includes(city.city));
  const modes = readModes();
  const entries: unknown[] = [];
  for (const city of selected) {
    for (const source of V61_SPINE_SOURCES) {
      const sourceRaw = path.join(sourceDir, 'raw', migrationSlug(city.city), `${source}.json`);
      const sourceTelemetry = path.join(sourceDir, 'telemetry', migrationSlug(city.city), `${source}.json`);
      if (!fs.existsSync(sourceRaw) || !fs.existsSync(sourceTelemetry)) continue;
      const raw = readJson<unknown>(sourceRaw);
      const telemetry = readJson<Record<string, unknown>>(sourceTelemetry);
      const parsed = JSON.parse(JSON.stringify(raw));
      // The parser is the source of truth for reuse eligibility. It checks schema, identity and search/read limits.
      const call = readCallFiles(ROOT, `${sourceRelative}/raw`, city, source);
      if (!call.terminal) throw new Error(`Source reuse validation failed for ${city.city}/${source}.`);
      const targetRaw = path.join(MIGRATION_DIR, 'raw', migrationSlug(city.city), `${source}.json`);
      const targetTelemetry = path.join(MIGRATION_DIR, 'telemetry', migrationSlug(city.city), `${source}.json`);
      const rawHash = sha256File(sourceRaw);
      const telemetryHash = sha256File(sourceTelemetry);
      for (const [from, to] of [[sourceRaw, targetRaw], [sourceTelemetry, targetTelemetry]]) {
        if (fs.existsSync(to) && sha256File(to) !== sha256File(from)) throw new Error(`Existing migration reuse differs for ${city.city}/${source}.`);
        if (!fs.existsSync(to) && check) throw new Error(`Migration reuse target is missing for ${city.city}/${source}: ${to}`);
        if (!fs.existsSync(to) && !check) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); }
      }
      const key = `${city.city}\u0000${source}`;
      modes[key] = {
        city: city.city,
        country: city.country,
        source,
        collectionMode: 'validated_experiment_014_reuse',
        sourceExperiment: sourceReg.experiment,
        rawSha256: rawHash,
        telemetrySha256: telemetryHash,
      };
      entries.push({ city: city.city, country: city.country, source, collectionMode: modes[key].collectionMode, sourceExperiment: sourceReg.experiment, rawSha256: rawHash, telemetrySha256: telemetryHash });
      void parsed;
      void telemetry;
    }
  }
  if (!check) writeModes(modes);
  const manifest = {
    schemaVersion: 'city-cost-v6-1-migration-reuse-manifest-v1',
    sourceExperiment: sourceReg.experiment,
    sourceDirectory: sourceRelative.replaceAll('\\', '/'),
    protocolSha256: sha256File(PROTOCOL_PATH),
    entries: entries.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  };
  if (fs.existsSync(REUSE_MANIFEST_PATH) && fs.readFileSync(REUSE_MANIFEST_PATH, 'utf8') !== expectedText(manifest)) throw new Error('Migration reuse manifest exists and differs.');
  if (!check) writeJson(REUSE_MANIFEST_PATH, manifest);
  console.log(JSON.stringify({ passed: true, command: 'reuse', sourceExperiment: sourceReg.experiment, reusedCalls: entries.length, cities: selected.length }, null, 2));
}

function parseSelectedCities(protocol: V61MigrationProtocol) {
  const requested = cliValue('cities')?.split(',').map((city) => city.trim()).filter(Boolean);
  const selected = requested?.length ? protocol.frame.filter((city) => requested.includes(city.city)) : protocol.frame;
  if (requested?.length && selected.length !== requested.length) throw new Error(`Unknown migration city in --cities: ${requested.filter((city) => !selected.some((item) => item.city === city)).join(', ')}`);
  return selected;
}

function readMaterializedRows() {
  if (!fs.existsSync(MATERIALIZED_DIR)) return [] as V61MigrationProvenanceRow[];
  return fs.readdirSync(MATERIALIZED_DIR).filter((file) => file.endsWith('.json')).sort().map((file) => readJson<{ provenance: V61MigrationProvenanceRow }>(path.join(MATERIALIZED_DIR, file)).provenance);
}

function writeStageOutputs(protocol: V61MigrationProtocol) {
  const rows = readMaterializedRows().sort((left, right) => protocol.frame.findIndex((city) => city.cityId === left.cityId) - protocol.frame.findIndex((city) => city.cityId === right.cityId));
  const csvFile = path.join(STAGED_DIR, 'city_costs_app_aud.v6-1.staged.csv');
  const sidecarFile = path.join(STAGED_DIR, 'provenance-sidecar.json');
  const importPlanFile = path.join(STAGED_DIR, 'provenance-import-plan.json');
  for (const file of [csvFile, sidecarFile, importPlanFile]) assertSafeMigrationOutput(ROOT, file);
  const sidecar = {
    schemaVersion: 'city-cost-v6-1-migration-provenance-sidecar-v1',
    methodologyVersion: 'v6.1',
    protocolSha256: sha256File(PROTOCOL_PATH),
    inputCsvSha256: protocol.inputCsvSha256,
    frameCities: protocol.frame.length,
    completeCities: rows.length,
    rows,
  };
  const plan = buildImportPlan(rows);
  if (check) {
    if (!fs.existsSync(csvFile) || fs.readFileSync(csvFile, 'utf8') !== buildStagedCsv(rows)) throw new Error('Staged migration CSV is stale.');
    if (!fs.existsSync(sidecarFile) || fs.readFileSync(sidecarFile, 'utf8') !== expectedText(sidecar)) throw new Error('Migration provenance sidecar is stale.');
    if (!fs.existsSync(importPlanFile) || fs.readFileSync(importPlanFile, 'utf8') !== expectedText(plan)) throw new Error('Migration import plan is stale.');
  } else {
    fs.mkdirSync(STAGED_DIR, { recursive: true });
    fs.writeFileSync(csvFile, buildStagedCsv(rows));
    writeJson(sidecarFile, sidecar);
    writeJson(importPlanFile, plan);
  }
  return { rows, csvFile, sidecarFile, importPlanFile };
}

function materialize() {
  const protocol = readProtocol();
  const checkpoint = readCheckpoint(protocol);
  const modes = readModes();
  const selected = parseSelectedCities(protocol);
  const processed: string[] = [];
  for (const city of selected) {
    const inventory = callInventory(protocol, city);
    if (!inventory.terminal) throw new Error(`${city.city} has pending source slots; do not materialize an incomplete city.`);
    try {
      const collection = buildMigrationCollection(ROOT, RAW_BASE, city);
      const materialization = materializeCityCostV61({ city: city.city, country: city.country, region: city.region, anchors: collection.anchors });
      assertAllTiers(materialization);
      const generated = buildV61GeneratedResult(city, collection, materialization);
      const persisted = buildCityEstimatePersistence(generated, { referenceDate: protocol.collectionWindow.referenceDate, extraContext: 'v6.1 frozen migration; staged only; live CSV is read-only.' });
      const calls = buildMigrationCallProvenance(ROOT, RAW_BASE, city, modes);
      if (!check) {
        for (const call of calls) modes[`${city.city}\u0000${call.source}`] = call;
        writeModes(modes);
      }
      const provenance = buildProvenanceRow(protocol, city, collection, materialization, persisted, calls);
      const citySlug = migrationSlug(city.city);
      const normalized = {
        schemaVersion: 'city-cost-v6-1-migration-normalized-city-v1',
        city,
        collection: { anchors: collection.anchors, facts: collection.facts, telemetry: collection.telemetry, llmCalls: collection.llmCalls, searches: collection.searches, promptVersions: collection.promptVersions },
        calls,
      };
      const materialized = {
        schemaVersion: 'city-cost-v6-1-migration-materialized-city-v1',
        city,
        methodologyVersion: 'v6.1',
        materialization,
        persistence: persisted,
        provenance,
      };
      const normalizedFile = path.join(NORMALIZED_DIR, `${citySlug}.json`);
      const materializedFile = path.join(MATERIALIZED_DIR, `${citySlug}.json`);
      if (check) {
        if (!fs.existsSync(normalizedFile) || fs.readFileSync(normalizedFile, 'utf8') !== expectedText(normalized)) throw new Error(`Normalized artifact is stale for ${city.city}.`);
        if (!fs.existsSync(materializedFile) || fs.readFileSync(materializedFile, 'utf8') !== expectedText(materialized)) throw new Error(`Materialized artifact is stale for ${city.city}.`);
      } else {
        writeJson(normalizedFile, normalized);
        writeJson(materializedFile, materialized);
      }
      const checkpointRow = checkpoint.cities.find((item) => item.cityId === city.cityId);
      if (!checkpointRow) throw new Error(`Checkpoint city is missing: ${city.city}`);
      checkpointRow.status = 'materialized';
      checkpointRow.sourceCalls = 3;
      checkpointRow.rawResponses = 3;
      checkpointRow.telemetryRecords = 3;
      checkpointRow.collectionModes = calls.map((call) => call.collectionMode).sort();
      checkpointRow.error = null;
      processed.push(city.city);
    } catch (error) {
      const checkpointRow = checkpoint.cities.find((item) => item.cityId === city.cityId);
      if (checkpointRow) { checkpointRow.status = 'error'; checkpointRow.error = error instanceof Error ? error.message : String(error); }
      saveCheckpoint(checkpoint);
      throw error;
    }
  }
  if (!check) saveCheckpoint(checkpoint);
  const outputs = writeStageOutputs(protocol);
  console.log(JSON.stringify({ passed: true, command: 'materialize', processedCities: processed.length, completeCities: outputs.rows.length, stagedCsv: path.relative(ROOT, outputs.csvFile).replaceAll('\\', '/'), sidecar: path.relative(ROOT, outputs.sidecarFile).replaceAll('\\', '/') }, null, 2));
}

function checkAll() {
  const protocol = readProtocol();
  readCheckpoint(protocol);
  const modes = readModes();
  for (const city of protocol.frame) {
    for (const source of V61_SPINE_SOURCES) {
      const call = readCallFiles(ROOT, RAW_BASE, city, source);
      if (call.terminal) {
        const mode = modes[`${city.city}\u0000${source}`];
        if (!mode) throw new Error(`Call provenance is missing for ${city.city}/${source}.`);
        if (mode.rawSha256 !== call.rawSha256 || mode.telemetrySha256 !== call.telemetrySha256) throw new Error(`Call provenance hashes are stale for ${city.city}/${source}.`);
      }
    }
  }
  writeStageOutputs(protocol);
  console.log(JSON.stringify({ passed: true, command: 'check', protocol: path.relative(ROOT, PROTOCOL_PATH).replaceAll('\\', '/'), liveCsvWrite: 'forbidden' }, null, 2));
}

function main() {
  if (command === 'init') return init();
  if (command === 'status') return status();
  if (command === 'assign') return assign();
  if (command === 'reuse') return reuseFromExperiment();
  if (command === 'materialize') return materialize();
  if (command === 'check') return checkAll();
  throw new Error(`Unknown migration command: ${command}. Use init, status, reuse, materialize or check.`);
}

main();
