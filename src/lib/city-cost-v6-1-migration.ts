import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import {
  buildV61CollectionResultFromSpineResponses,
  normalizeV61DiskTelemetry,
  parseV61SpineResponse,
  sourceIdentityMatches,
  V61_SOURCE_CONFIG,
  V61_SPINE_SOURCES,
  type V61CollectionResult,
  type V61DiskTelemetry,
  type V61SpineSource,
} from './city-cost-v6-1-collection';
import { findKnownCountryMetadata, slugifyId } from './country-metadata';
import { V5_TIER_NAMES } from './city-cost-methodology-v5';
import type { CityGenerationPersistence } from './city-generation-persistence';
import type { V61Materialization } from './city-cost-methodology-v6-1';

export const V61_MIGRATION_ROOT = 'data/reference/v6/migration-v6-1';
export const V61_MIGRATION_LIVE_CSV = 'data/reference/city_costs_app_aud.csv';
export const V61_MIGRATION_SCHEMA = 'city-cost-v6-1-migration-v1';
export const V61_MIGRATION_CSV_COLUMNS = [
  'city', 'country', 'region',
  'accom_shared_hostel_dorm', 'accom_hostel_private_room', 'accom_1_star', 'accom_2_star', 'accom_3_star', 'accom_4_star',
  'food_street_food', 'food_budget', 'food_mid_range', 'food_high_end',
  'drink_coffee', 'drinks_none', 'drinks_light', 'drinks_moderate', 'drinks_heavy',
  'activities_free', 'activities_budget', 'activities_mid_range', 'activities_high_end',
] as const;

export type V61MigrationCity = {
  city: string;
  country: string;
  region: string;
  band: string | null;
  cityId: string;
};

export type V61MigrationProtocol = {
  schemaVersion: typeof V61_MIGRATION_SCHEMA;
  status: 'frozen';
  registeredAt: string;
  methodologyVersion: 'v6.1';
  inputCsv: string;
  inputCsvSha256: string;
  fxSnapshot: string;
  fxSnapshotSha256: string;
  collectionWindow: { arrival: string; departure: string; referenceDate: string };
  limits: {
    sourceCallsPerCity: 3;
    maxSearchesPerCity: 10;
    maxSearchesBySource: Record<V61SpineSource, number>;
    directPageReadsPerCity: 0;
    maxRetriesPerCall: 1;
  };
  prompts: Record<V61SpineSource, { file: string; sha256: string }>;
  implementationFiles: Record<string, string>;
  frame: V61MigrationCity[];
  sourcePolicy: {
    stageA: 'delegated_codex_subagent' | 'provider_user_key';
    stageB: 'shipped_materializeCityCostV61';
    noDirectPageReads: true;
    noPriorsFromCsv: true;
  };
  liveCsvWrite: 'forbidden';
};

export type V61MigrationCallProvenance = {
  city: string;
  country: string;
  source: V61SpineSource;
  collectionMode: 'validated_experiment_014_reuse' | 'delegated_codex_subagent' | 'provider_user_key';
  sourceExperiment?: string;
  assignmentId?: string;
  agentId?: string;
  rawSha256: string;
  telemetrySha256: string;
};

export type V61MigrationCheckpointCity = {
  city: string;
  cityId: string;
  status: 'pending' | 'materialized' | 'error';
  sourceCalls: number;
  rawResponses: number;
  telemetryRecords: number;
  collectionModes: string[];
  error: string | null;
};

export type V61MigrationCheckpoint = {
  schemaVersion: 'city-cost-v6-1-migration-checkpoint-v1';
  protocolSha256: string;
  cities: V61MigrationCheckpointCity[];
};

export type V61MigrationProvenanceRow = {
  schemaVersion: 'city-cost-v6-1-migration-provenance-row-v1';
  cityId: string;
  city: string;
  country: string;
  region: string;
  methodologyVersion: 'v6.1';
  estimationImportKey: string;
  estimateSource: string;
  estimatedAt: string;
  provider: string;
  model: string;
  promptVersion: string;
  confidence: string;
  reasoning: string;
  data: Record<string, number | undefined>;
  anchors: unknown;
  metadata: unknown;
  sources: Record<string, string>;
  inputSnapshot: unknown;
  fallbackLog: unknown[];
  materializationHash: string;
  calls: V61MigrationCallProvenance[];
};

export type V61MigrationImportPlanRow = {
  cityId: string;
  city: string;
  country: string;
  estimationImportKey: string;
  methodologyVersion: 'v6.1';
  source: string;
  data: Record<string, number | undefined>;
};

export function sha256Bytes(value: string | Buffer) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function sha256File(file: string) {
  return sha256Bytes(fs.readFileSync(file));
}

export function repoPath(root: string, relative: string) {
  return path.resolve(root, relative);
}

export function migrationSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function readMigrationFrame(csvFile: string): V61MigrationCity[] {
  const parsed = Papa.parse<Record<string, string>>(fs.readFileSync(csvFile, 'utf8'), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`Migration frame CSV is invalid: ${parsed.errors[0].message}`);
  const usedIds = new Set<string>();
  return parsed.data.map((row, index) => {
    if (!row.city?.trim() || !row.country?.trim() || !row.region?.trim()) throw new Error(`Migration frame row ${index + 2} lacks city/country/region.`);
    const metadata = findKnownCountryMetadata(row.country);
    if (!metadata) throw new Error(`Migration frame country is not canonical: ${row.country}`);
    let cityId = slugifyId(row.city);
    if (usedIds.has(cityId)) cityId = `${cityId}-${metadata.id}`;
    let suffix = 2;
    while (usedIds.has(cityId)) {
      cityId = `${slugifyId(row.city)}-${metadata.id}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(cityId);
    return { city: row.city, country: row.country, region: row.region, band: null, cityId };
  });
}

export function assertFrozenProtocol(protocol: V61MigrationProtocol, root: string) {
  if (protocol.schemaVersion !== V61_MIGRATION_SCHEMA || protocol.status !== 'frozen') throw new Error('Migration protocol is not frozen or has an unexpected schema.');
  if (protocol.liveCsvWrite !== 'forbidden') throw new Error('Migration protocol must forbid live CSV writes.');
  if (protocol.sourcePolicy.noPriorsFromCsv !== true) throw new Error('Migration protocol must forbid CSV-derived priors.');
  const csv = repoPath(root, protocol.inputCsv);
  if (sha256File(csv) !== protocol.inputCsvSha256) throw new Error('Frozen migration input CSV hash changed.');
  const fx = repoPath(root, protocol.fxSnapshot);
  if (sha256File(fx) !== protocol.fxSnapshotSha256) throw new Error('Frozen migration FX snapshot hash changed.');
  if (protocol.frame.length !== 121) throw new Error(`Frozen migration frame has ${protocol.frame.length} cities, expected 121.`);
  if (protocol.limits.sourceCallsPerCity !== 3 || protocol.limits.maxSearchesPerCity !== 10 || protocol.limits.directPageReadsPerCity !== 0) throw new Error('Frozen migration limits drifted.');
  for (const source of V61_SPINE_SOURCES) {
    const prompt = protocol.prompts[source];
    if (!prompt || sha256File(repoPath(root, prompt.file)) !== prompt.sha256) throw new Error(`Frozen prompt changed for ${source}.`);
  }
  for (const [file, expectedHash] of Object.entries(protocol.implementationFiles)) {
    if (sha256File(repoPath(root, file)) !== expectedHash) throw new Error(`Frozen implementation changed: ${file}.`);
  }
}

export function readCallFiles(root: string, baseDir: string, city: V61MigrationCity, source: V61SpineSource) {
  const rawFile = path.join(root, baseDir, migrationSlug(city.city), `${source}.json`);
  const telemetryFile = path.join(root, baseDir.replace(/\\raw$/, 'telemetry').replace(/\/raw$/, '/telemetry'), migrationSlug(city.city), `${source}.json`);
  if (!fs.existsSync(rawFile) || !fs.existsSync(telemetryFile)) return { terminal: false as const, rawFile, telemetryFile };
  const raw = readJson<unknown>(rawFile);
  const telemetry = readJson<V61DiskTelemetry>(telemetryFile);
  const parsed = parseV61SpineResponse(source, raw);
  if (!sourceIdentityMatches(parsed, city)) throw new Error(`${city.city}/${source} response city/country does not match frozen frame.`);
  const normalizedTelemetry = normalizeV61DiskTelemetry(source, parsed, telemetry);
  if (normalizedTelemetry.promptVersion !== V61_SOURCE_CONFIG[source].promptFile) throw new Error(`${city.city}/${source} telemetry prompt does not match the frozen production prompt.`);
  if (normalizedTelemetry.retries > 1 || normalizedTelemetry.directPageReads !== 0) throw new Error(`${city.city}/${source} telemetry violates frozen retry/direct-read limits.`);
  return {
    terminal: true as const,
    rawFile,
    telemetryFile,
    raw,
    telemetry,
    parsed,
    normalizedTelemetry,
    rawSha256: sha256File(rawFile),
    telemetrySha256: sha256File(telemetryFile),
  };
}

export function buildMigrationCollection(root: string, rawBaseDir: string, city: V61MigrationCity): V61CollectionResult {
  const responses = {} as Record<V61SpineSource, unknown>;
  const telemetry = {} as Record<V61SpineSource, V61DiskTelemetry>;
  for (const source of V61_SPINE_SOURCES) {
    const call = readCallFiles(root, rawBaseDir, city, source);
    if (!call.terminal) throw new Error(`${city.city}/${source} is still pending.`);
    responses[source] = call.raw;
    telemetry[source] = call.telemetry;
  }
  return buildV61CollectionResultFromSpineResponses({ city: city.city, country: city.country, responses, telemetry });
}

export function buildMigrationCallProvenance(root: string, baseDir: string, city: V61MigrationCity, modes: Record<string, V61MigrationCallProvenance>) {
  return V61_SPINE_SOURCES.map((source) => {
    const call = readCallFiles(root, baseDir, city, source);
    if (!call.terminal) throw new Error(`${city.city}/${source} is still pending.`);
    const key = `${city.city}\u0000${source}`;
    const existing = modes[key];
    if (!existing) throw new Error(`Collection mode is missing for ${city.city}/${source}.`);
    return { ...existing, rawSha256: call.rawSha256, telemetrySha256: call.telemetrySha256 };
  });
}

export function buildV61GeneratedResult(city: V61MigrationCity, collection: V61CollectionResult, materialization: V61Materialization) {
  const grades = Object.fromEntries(Object.entries(materialization.tiersAud).map(([tier, value]) => [tier, value.evidenceGrade]));
  const intervals = Object.fromEntries(Object.entries(materialization.tiersAud).map(([tier, value]) => [tier, value.interval]));
  const tierValues = Object.fromEntries(Object.entries(materialization.tiersAud).map(([tier, value]) => [tier, value.amountAud ?? 0]));
  const anchorValues = Object.fromEntries(Object.entries(materialization.anchors).map(([anchor, value]) => [anchor, value.valueAud ?? 0]));
  return {
    provider: collection.telemetry[0]?.provider ?? 'delegated-gpt-5.6-luna',
    model: collection.telemetry[0]?.model ?? 'gpt-5.6-luna',
    promptVersion: 'city-cost-v6-1-spine-v1',
    payload: {
      city: city.city,
      country: city.country,
      region: materialization.region ?? city.region,
      confidence: 'medium' as const,
      confidence_notes: 'City cost v6.1 deterministic migration materialization. Grades, intervals, source facts and fallback basis are persisted in the provenance sidecar.',
      anchors_aud: anchorValues,
      tiers_aud: tierValues,
      evidence_grades: grades,
      intervals,
    },
    inferredAudPerUsd: null,
    methodologyVersion: 'v6.1' as const,
    v61Collection: collection,
    v61Materialization: materialization,
    mappedEstimate: materialization.mappedEstimate,
  };
}

export function materializationHash(materialization: V61Materialization) {
  return sha256Bytes(JSON.stringify(materialization));
}

export function buildProvenanceRow(
  protocol: V61MigrationProtocol,
  city: V61MigrationCity,
  collection: V61CollectionResult,
  materialization: V61Materialization,
  persisted: CityGenerationPersistence,
  calls: V61MigrationCallProvenance[],
): V61MigrationProvenanceRow {
  const hash = materializationHash(materialization);
  const importKey = sha256Bytes(`${protocol.inputCsvSha256}:${protocol.fxSnapshotSha256}:${city.cityId}:${hash}`);
  const estimatedAt = `${protocol.registeredAt}T00:00:00.000Z`;
  return {
    schemaVersion: 'city-cost-v6-1-migration-provenance-row-v1',
    cityId: city.cityId,
    city: city.city,
    country: city.country,
    region: city.region,
    methodologyVersion: 'v6.1',
    estimationImportKey: importKey,
    estimateSource: persisted.estimateSource,
    estimatedAt,
    provider: collection.telemetry[0]?.provider ?? 'unknown',
    model: collection.telemetry[0]?.model ?? 'unknown',
    promptVersion: 'city-cost-v6-1-spine-v1',
    confidence: persisted.confidence,
    reasoning: persisted.reasoning,
    data: persisted.data,
    anchors: persisted.anchors,
    metadata: persisted.metadata,
    sources: persisted.sources,
    inputSnapshot: persisted.inputSnapshot,
    fallbackLog: persisted.fallbackLog,
    materializationHash: hash,
    calls,
  };
}

export function buildStagedCsv(rows: V61MigrationProvenanceRow[]) {
  const records = rows.map((row) => {
    const data = row.data;
    const value = (key: string) => data[key] ?? '';
    return [
      row.city, row.country, row.region,
      value('accomHostel'), value('accomPrivateRoom'), value('accom1star'), value('accom2star'), value('accom3star'), value('accom4star'),
      value('foodStreet'), value('foodBudget'), value('foodMid'), value('foodHigh'),
      value('drinkCoffee'), value('drinksNone'), value('drinksLight'), value('drinksModerate'), value('drinksHeavy'),
      value('activitiesFree'), value('activitiesBudget'), value('activitiesMid'), value('activitiesHigh'),
    ];
  });
  return Papa.unparse({ fields: [...V61_MIGRATION_CSV_COLUMNS], data: records }, { newline: '\n' });
}

export function buildImportPlan(rows: V61MigrationProvenanceRow[]): V61MigrationImportPlanRow[] {
  return [...rows].sort((left, right) => left.cityId.localeCompare(right.cityId)).map((row) => ({
    cityId: row.cityId,
    city: row.city,
    country: row.country,
    estimationImportKey: row.estimationImportKey,
    methodologyVersion: row.methodologyVersion,
    source: row.estimateSource,
    data: row.data,
  }));
}

export function assertSafeMigrationOutput(root: string, file: string) {
  const target = path.resolve(file);
  const live = repoPath(root, V61_MIGRATION_LIVE_CSV);
  if (target === live) throw new Error('Refusing to write the live city_costs_app_aud.csv during migration.');
  if (target.startsWith(`${path.dirname(live)}${path.sep}`) && !target.startsWith(`${repoPath(root, V61_MIGRATION_ROOT)}${path.sep}`)) {
    throw new Error('Migration output must remain under data/reference/v6/migration-v6-1.');
  }
}

export function assertAllTiers(materialization: V61Materialization) {
  if (!materialization.complete || Object.keys(materialization.tiersAud).length !== V5_TIER_NAMES.length) {
    throw new Error(`Expected ${V5_TIER_NAMES.length} complete v6.1 tiers.`);
  }
}
