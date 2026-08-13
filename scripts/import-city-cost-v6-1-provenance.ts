import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  buildImportPlan,
  readJson,
  sha256File,
  V61_MIGRATION_LIVE_CSV,
  V61_MIGRATION_ROOT,
  type V61MigrationProvenanceRow,
} from '../src/lib/city-cost-v6-1-migration';
import { findKnownCountryMetadata } from '../src/lib/country-metadata';

const ROOT = process.cwd();
const DEFAULT_SIDECAR = path.join(ROOT, V61_MIGRATION_ROOT, 'staged', 'provenance-sidecar.json');
const LIVE_DB = path.resolve(ROOT, 'data/travel.db');

function optionValue(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function cityCountryKey(city: string, country: string) {
  const metadata = findKnownCountryMetadata(country);
  if (!metadata) throw new Error(`Country is not recognized by the canonical metadata: ${country}`);
  return `${city}\u0000${metadata.id}`;
}

type DatabaseCity = { cityId: string; city: string; country: string };

function resolveDatabaseCity(row: V61MigrationProvenanceRow, cityById: Map<string, DatabaseCity>, citiesByKey: Map<string, DatabaseCity[]>) {
  const exact = cityById.get(row.cityId);
  if (exact && exact.city === row.city && cityCountryKey(exact.city, exact.country) === cityCountryKey(row.city, row.country)) return exact;

  const matches = citiesByKey.get(cityCountryKey(row.city, row.country)) ?? [];
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) throw new Error(`Database contains multiple cities matching the sidecar identity: ${row.city}, ${row.country}`);
  throw new Error(`Database city does not match sidecar: ${row.city}, ${row.country} (${row.cityId})`);
}

function readSidecar(file: string) {
  const sidecar = readJson<{ schemaVersion: string; methodologyVersion: string; protocolSha256: string; inputCsvSha256: string; frameCities: number; completeCities: number; rows: V61MigrationProvenanceRow[] }>(file);
  if (sidecar.schemaVersion !== 'city-cost-v6-1-migration-provenance-sidecar-v1' || sidecar.methodologyVersion !== 'v6.1') throw new Error('Unexpected v6.1 provenance sidecar schema.');
  if (!Array.isArray(sidecar.rows) || sidecar.rows.some((row) => row.schemaVersion !== 'city-cost-v6-1-migration-provenance-row-v1' || row.methodologyVersion !== 'v6.1')) throw new Error('Provenance sidecar contains an invalid row.');
  if (new Set(sidecar.rows.map((row) => row.cityId)).size !== sidecar.rows.length) throw new Error('Provenance sidecar has duplicate city IDs.');
  return sidecar;
}

function checkOnly() {
  const file = path.resolve(ROOT, optionValue('sidecar') ?? DEFAULT_SIDECAR);
  const sidecar = readSidecar(file);
  const plan = buildImportPlan(sidecar.rows);
  console.log(JSON.stringify({ passed: true, command: 'check', sidecar: path.relative(ROOT, file).replaceAll('\\', '/'), frameCities: sidecar.frameCities, completeCities: sidecar.completeCities, importRows: plan.length, liveDatabaseWrite: 'forbidden unless an explicit non-live --db is supplied' }, null, 2));
}

function assertWritableDatabase(file: string) {
  const target = path.resolve(file);
  if (target === LIVE_DB) throw new Error('Refusing to import v6.1 provenance into data/travel.db before Phase 11 approval.');
  if (target === path.resolve(ROOT, V61_MIGRATION_LIVE_CSV)) throw new Error('A CSV path is not a database.');
}

function requiredColumns(db: Database.Database, table: string, columns: string[]) {
  const existing = new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name));
  const missing = columns.filter((column) => !existing.has(column));
  if (missing.length) throw new Error(`${table} is missing required provenance columns: ${missing.join(', ')}`);
}

type ExistingMigrationEstimate = {
  id: number;
  source: string;
  metadataJson: string | null;
};

function migrationMetadata(metadataJson: string | null) {
  if (!metadataJson) return null;
  try {
    const parsed = JSON.parse(metadataJson) as { migrationImportKey?: unknown; migrationProtocolSha256?: unknown };
    return {
      migrationImportKey: typeof parsed.migrationImportKey === 'string' ? parsed.migrationImportKey : null,
      migrationProtocolSha256: typeof parsed.migrationProtocolSha256 === 'string' ? parsed.migrationProtocolSha256 : null,
    };
  } catch {
    return null;
  }
}

function findExistingMigrationEstimate(db: Database.Database, cityId: string, row: V61MigrationProvenanceRow, protocolSha256: string) {
  const estimates = db.prepare(`
    SELECT id, source, metadata_json as metadataJson
    FROM city_estimates
    WHERE city_id = ?
  `).all(cityId) as ExistingMigrationEstimate[];

  const matching = estimates.filter((estimate) => migrationMetadata(estimate.metadataJson)?.migrationImportKey === row.estimationImportKey);
  if (matching.length > 1) {
    throw new Error(`Database contains duplicate v6.1 migration imports for ${row.city}: ${row.estimationImportKey}`);
  }
  const existing = matching[0];
  if (!existing) return null;
  const metadata = migrationMetadata(existing.metadataJson);
  if (existing.source !== row.estimateSource || metadata?.migrationProtocolSha256 !== protocolSha256) {
    throw new Error(`Existing migration import for ${row.city} does not match the staged source/protocol.`);
  }
  return existing;
}

function importRows() {
  const file = path.resolve(ROOT, optionValue('sidecar') ?? DEFAULT_SIDECAR);
  const dbFile = optionValue('db');
  if (!dbFile) throw new Error('Import requires --db <non-live database path>; use --check for a read-only validation.');
  const dbPath = path.resolve(ROOT, dbFile);
  assertWritableDatabase(dbPath);
  const sidecar = readSidecar(file);
  const db = new Database(dbPath);
  try {
    requiredColumns(db, 'cities', ['id', 'country_id', 'name', 'estimation_source', 'estimated_at', 'estimation_id']);
    requiredColumns(db, 'city_estimates', ['id', 'city_id', 'estimated_at', 'source', 'data_json', 'anchors_json', 'metadata_json', 'reasoning', 'confidence', 'sources_json', 'input_snapshot_json', 'fallback_log_json', 'is_active']);
    const cityRows = db.prepare('SELECT cities.id AS cityId, cities.name AS city, countries.name AS country FROM cities INNER JOIN countries ON countries.id = cities.country_id').all() as DatabaseCity[];
    const cityById = new Map(cityRows.map((row) => [row.cityId, row]));
    const citiesByKey = new Map<string, DatabaseCity[]>();
    for (const row of cityRows) {
      const key = cityCountryKey(row.city, row.country);
      const matches = citiesByKey.get(key) ?? [];
      matches.push(row);
      citiesByKey.set(key, matches);
    }
    const resolvedCities = new Map(sidecar.rows.map((row) => [row.estimationImportKey, resolveDatabaseCity(row, cityById, citiesByKey)]));
    if (sidecar.completeCities !== sidecar.frameCities || sidecar.frameCities !== 121) throw new Error('Database import requires a complete 121-city sidecar; partial Phase 8/9 artifacts are not importable.');
    const deactivate = db.prepare('UPDATE city_estimates SET is_active = 0 WHERE city_id = ?');
    const activate = db.prepare('UPDATE city_estimates SET is_active = 1 WHERE id = ?');
    const insert = db.prepare(`INSERT INTO city_estimates (city_id, estimated_at, source, llm_provider, llm_model, prompt_version, data_json, anchors_json, metadata_json, reasoning, confidence, sources_json, input_snapshot_json, fallback_log_json, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`);
    const updateCity = db.prepare(`UPDATE cities SET
      accom_hostel = ?, accom_private_room = ?, accom_1star = ?, accom_2star = ?, accom_3star = ?, accom_4star = ?,
      food_street = ?, food_budget = ?, food_mid = ?, food_high = ?,
      drink_coffee = ?, drinks_none = ?, drinks_light = ?, drinks_moderate = ?, drinks_heavy = ?,
      activities_free = ?, activities_budget = ?, activities_mid = ?, activities_high = ?,
      estimation_source = ?, estimated_at = ?, estimation_id = ?, notes = ?
      WHERE id = ?`);
    let insertedCities = 0;
    let reusedCities = 0;
    const transaction = db.transaction(() => {
      for (const row of sidecar.rows) {
        const city = resolvedCities.get(row.estimationImportKey);
        if (!city) throw new Error(`Database city does not match sidecar: ${row.city}, ${row.country} (${row.cityId})`);
        const d = row.data;
        const metadata = {
          ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
          migrationImportKey: row.estimationImportKey,
          migrationProtocolSha256: sidecar.protocolSha256,
        };
        const existing = findExistingMigrationEstimate(db, city.cityId, row, sidecar.protocolSha256);
        let estimateId: number;
        deactivate.run(city.cityId);
        if (existing) {
          activate.run(existing.id);
          estimateId = existing.id;
          reusedCities += 1;
        } else {
          const result = insert.run(
            city.cityId,
            row.estimatedAt,
            row.estimateSource,
            row.provider,
            row.model,
            row.promptVersion,
            JSON.stringify(row.data),
            JSON.stringify(row.anchors),
            JSON.stringify(metadata),
            row.reasoning,
            row.confidence,
            JSON.stringify(row.sources),
            JSON.stringify(row.inputSnapshot),
            JSON.stringify(row.fallbackLog),
          );
          estimateId = Number(result.lastInsertRowid);
          insertedCities += 1;
        }
        updateCity.run(
          d.accomHostel ?? null, d.accomPrivateRoom ?? null, d.accom1star ?? null, d.accom2star ?? null, d.accom3star ?? null, d.accom4star ?? null,
          d.foodStreet ?? null, d.foodBudget ?? null, d.foodMid ?? null, d.foodHigh ?? null,
          d.drinkCoffee ?? null, d.drinksNone ?? null, d.drinksLight ?? null, d.drinksModerate ?? null, d.drinksHeavy ?? null,
          d.activitiesFree ?? null, d.activitiesBudget ?? null, d.activitiesMid ?? null, d.activitiesHigh ?? null,
          row.estimateSource, row.estimatedAt, estimateId,
          `Imported from the frozen v6.1 staged migration (${sidecar.protocolSha256.slice(0, 12)}).`,
          city.cityId,
        );
      }
    });
    transaction();
    console.log(JSON.stringify({ passed: true, command: 'import', importedCities: sidecar.rows.length, insertedCities, reusedCities, database: dbPath, liveCsv: V61_MIGRATION_LIVE_CSV }, null, 2));
  } finally {
    db.close();
  }
}

if (process.argv.includes('--check') || process.argv.includes('--dry-run')) checkOnly();
else importRows();
