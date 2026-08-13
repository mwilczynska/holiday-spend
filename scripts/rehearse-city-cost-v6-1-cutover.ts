import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { V5_TIER_NAMES } from '../src/lib/city-cost-methodology-v5';
import { readV6Provenance } from '../src/lib/city-estimate-provenance';
import { readJson, sha256Bytes, sha256File, type V61MigrationProvenanceRow } from '../src/lib/city-cost-v6-1-migration';

const ROOT = process.cwd();
const LIVE_DB = path.join(ROOT, 'data', 'travel.db');
const LIVE_CSV = path.join(ROOT, 'data', 'reference', 'city_costs_app_aud.csv');
const SIDECAR = path.join(ROOT, 'data', 'reference', 'v6', 'migration-v6-1', 'staged', 'provenance-sidecar.json');
const IMPORT_RUNNER = path.join(ROOT, 'scripts', 'import-city-cost-v6-1-provenance.mjs');
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');

type Sidecar = {
  frameCities: number;
  completeCities: number;
  rows: V61MigrationProvenanceRow[];
};

type ImportResult = {
  passed: boolean;
  insertedCities: number;
  reusedCities: number;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function copyDatabase(source: string, target: string) {
  for (const suffix of ['', '-wal', '-shm']) {
    const sourceFile = `${source}${suffix}`;
    if (fs.existsSync(sourceFile)) fs.copyFileSync(sourceFile, `${target}${suffix}`);
  }
}

function databaseFingerprint(file: string) {
  const db = new Database(file, { readonly: true });
  try {
    const cities = db.prepare(`
      SELECT id, estimation_id as estimationId, estimation_source as estimationSource, estimated_at as estimatedAt
      FROM cities
      ORDER BY id
    `).all();
    const estimates = db.prepare(`
      SELECT id, city_id as cityId, source, estimated_at as estimatedAt, is_active as isActive, metadata_json as metadataJson
      FROM city_estimates
      ORDER BY id
    `).all();
    return sha256Bytes(JSON.stringify({ cities, estimates }));
  } finally {
    db.close();
  }
}

function databaseCounts(file: string) {
  const db = new Database(file, { readonly: true });
  try {
    return {
      cities: (db.prepare('SELECT COUNT(*) as count FROM cities').get() as { count: number }).count,
      estimates: (db.prepare('SELECT COUNT(*) as count FROM city_estimates').get() as { count: number }).count,
      activeV61: (db.prepare('SELECT COUNT(*) as count FROM city_estimates WHERE source = ? AND is_active = 1').get('llm_city_generation_v6_1') as { count: number }).count,
    };
  } finally {
    db.close();
  }
}

function runImport(database: string): ImportResult {
  const result = spawnSync(process.execPath, [TSX, IMPORT_RUNNER, '--db', database], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`Non-live v6.1 provenance import failed: ${result.stderr || result.stdout}`);
  }
  const parsed = JSON.parse(result.stdout.trim()) as ImportResult;
  assert(parsed.passed === true, 'Import did not report passed=true.');
  return parsed;
}

function verifyImportedProvenance(database: string, sidecar: Sidecar) {
  const db = new Database(database, { readonly: true });
  try {
    const rows = db.prepare(`
      SELECT
        c.id as cityId,
        c.estimation_id as estimationId,
        c.estimation_source as estimationSource,
        ce.source,
        ce.metadata_json as metadataJson,
        ce.anchors_json as anchorsJson,
        ce.input_snapshot_json as inputSnapshotJson,
        ce.sources_json as sourcesJson
      FROM cities c
      INNER JOIN city_estimates ce ON ce.id = c.estimation_id
      WHERE c.estimation_source = ?
    `).all('llm_city_generation_v6_1') as Array<{
      cityId: string;
      estimationId: number;
      estimationSource: string;
      source: string;
      metadataJson: string | null;
      anchorsJson: string | null;
      inputSnapshotJson: string | null;
      sourcesJson: string | null;
    }>;

    const expectedIds = new Set(sidecar.rows.map((row) => row.cityId));
    assert(rows.length === sidecar.rows.length, `Expected ${sidecar.rows.length} v6.1 city links, found ${rows.length}.`);
    assert(new Set(rows.map((row) => row.cityId)).size === rows.length, 'Imported v6.1 city links contain duplicate city IDs.');
    const unexpectedIds = rows.map((row) => row.cityId).filter((cityId) => !expectedIds.has(cityId));
    assert(unexpectedIds.length === 0, `Imported v6.1 city links are outside the frozen sidecar frame: ${unexpectedIds.join(', ')}`);

    for (const row of rows) {
      assert(row.estimationSource === 'llm_city_generation_v6_1', `City ${row.cityId} lost its v6.1 source label.`);
      assert(row.source === 'llm_city_generation_v6_1', `City ${row.cityId} estimate source is not v6.1.`);
      const provenance = readV6Provenance(row.metadataJson, row.anchorsJson, row.inputSnapshotJson, row.sourcesJson);
      assert(provenance?.methodologyVersion === 'v6.1', `City ${row.cityId} did not round-trip methodologyVersion.`);
      assert(Object.keys(provenance.evidenceGrades).length === V5_TIER_NAMES.length, `City ${row.cityId} lost evidence grades.`);
      assert(Object.keys(provenance.intervals).length === V5_TIER_NAMES.length, `City ${row.cityId} lost intervals.`);
      assert(provenance.collectionTelemetry.length === 3, `City ${row.cityId} lost source telemetry.`);
      assert(provenance.anchors !== null, `City ${row.cityId} lost anchors.`);
      assert(provenance.inputSnapshot !== null, `City ${row.cityId} lost the input snapshot.`);
      assert(typeof provenance.priorBasis === 'string' && provenance.priorBasis.length > 0, `City ${row.cityId} lost the prior basis.`);
    }
    return rows.length;
  } finally {
    db.close();
  }
}

function main() {
  assert(fs.existsSync(LIVE_DB), 'The local database is required for the non-live rehearsal.');
  const sidecar = readJson<Sidecar>(SIDECAR);
  assert(sidecar.frameCities === 121 && sidecar.completeCities === 121, 'The rehearsal requires a complete 121-city sidecar.');
  const liveCsvHashBefore = sha256File(LIVE_CSV);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'city-cost-v61-cutover-'));
  const beforeDb = path.join(tempRoot, 'before.db');
  const rehearsalDb = path.join(tempRoot, 'rehearsal.db');
  const rollbackDb = path.join(tempRoot, 'rollback.db');

  try {
    copyDatabase(LIVE_DB, beforeDb);
    copyDatabase(LIVE_DB, rehearsalDb);
    const beforeFingerprint = databaseFingerprint(beforeDb);
    const beforeCounts = databaseCounts(rehearsalDb);
    const first = runImport(rehearsalDb);
    const firstFingerprint = databaseFingerprint(rehearsalDb);
    const firstCounts = databaseCounts(rehearsalDb);
    const roundTrippedCities = verifyImportedProvenance(rehearsalDb, sidecar);
    const second = runImport(rehearsalDb);
    const secondFingerprint = databaseFingerprint(rehearsalDb);
    const secondCounts = databaseCounts(rehearsalDb);

    assert(first.insertedCities === 121 && first.reusedCities === 0, 'First import did not insert exactly one row per city.');
    assert(second.insertedCities === 0 && second.reusedCities === 121, 'Second import was not idempotent.');
    assert(firstCounts.estimates === beforeCounts.estimates + 121, 'First import estimate count is incorrect.');
    assert(secondCounts.estimates === firstCounts.estimates, 'Second import created duplicate estimate rows.');
    assert(secondFingerprint === firstFingerprint, 'Second import changed the logical database state.');
    assert(firstCounts.activeV61 === 121 && secondCounts.activeV61 === 121, 'Expected exactly 121 active v6.1 estimates.');

    copyDatabase(beforeDb, rollbackDb);
    assert(databaseFingerprint(rollbackDb) === beforeFingerprint, 'Rollback copy did not restore the pre-import database state.');
    assert(sha256File(LIVE_CSV) === liveCsvHashBefore, 'The rehearsal changed the live CSV.');

    console.log(JSON.stringify({
      passed: true,
      command: process.argv.includes('--check') ? 'check' : 'rehearse',
      frameCities: sidecar.frameCities,
      roundTrippedCities,
      firstImport: first,
      secondImport: second,
      beforeCounts,
      afterCounts: secondCounts,
      liveCsvUnchanged: true,
      rollbackVerified: true,
    }, null, 2));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main();
