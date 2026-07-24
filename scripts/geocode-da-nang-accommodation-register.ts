import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  daNangGeocodingAttemptSchema,
  daNangGeocodingManifestSchema,
  normalizeDaNangGeocodingAddress,
  parseDaNangGeocodingJsonl,
  requiresDaNangAdministrativeBoundaryReview,
  summarizeDaNangGeocoding,
} from '../src/lib/da-nang-accommodation-geocoding';
import { vietnamAccommodationRegisterCaptureSchema } from '../src/lib/vietnam-accommodation-register';

const EXPECTED_SNAPSHOT_SHA256 =
  '1067ba95e95487413831b8f49efbb9d7761d10d7f63de1395e49a173de7524c6';
const SERVICE_URL = 'https://nominatim.openstreetmap.org/search';
const REQUEST_INTERVAL_MS = 1100;

function parseArgs() {
  const snapshotIndex = process.argv.indexOf('--snapshot');
  const outputIndex = process.argv.indexOf('--out');
  const maxIndex = process.argv.indexOf('--max-records');
  if (
    snapshotIndex === -1 ||
    !process.argv[snapshotIndex + 1] ||
    outputIndex === -1 ||
    !process.argv[outputIndex + 1]
  ) {
    throw new Error(
      'Usage: tsx scripts/geocode-da-nang-accommodation-register.ts --snapshot <snapshot.json> --out <checkpoint.jsonl> [--max-records N]'
    );
  }
  const maxRecords = maxIndex === -1 ? Number.POSITIVE_INFINITY : Number(process.argv[maxIndex + 1]);
  if (!(maxRecords > 0)) throw new Error('--max-records must be positive');
  return {
    snapshotPath: path.resolve(process.argv[snapshotIndex + 1]),
    outputPath: path.resolve(process.argv[outputIndex + 1]),
    maxRecords,
  };
}

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex');
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const { snapshotPath, outputPath, maxRecords } = parseArgs();
  const snapshotBuffer = fs.readFileSync(snapshotPath);
  const snapshotSha256 = sha256(snapshotBuffer);
  if (snapshotSha256 !== EXPECTED_SNAPSHOT_SHA256) {
    throw new Error(`Snapshot SHA-256 is not the frozen Da Nang capture: ${snapshotSha256}`);
  }
  const snapshot = vietnamAccommodationRegisterCaptureSchema.parse(
    JSON.parse(snapshotBuffer.toString('utf8'))
  );
  const records = snapshot.strata
    .flatMap((stratum) =>
      stratum.records.map((record) => ({ ...record, stars: stratum.stars }))
    )
    .sort((left, right) =>
      left.stars - right.stars || left.sourcePropertyId.localeCompare(right.sourcePropertyId)
    );
  const deferredAdministrativeReview = records
    .filter(
      (record) =>
        record.address && requiresDaNangAdministrativeBoundaryReview(record.address)
    )
    .map((record) => ({
      sourcePropertyId: record.sourcePropertyId,
      stars: record.stars,
      address: record.address!,
      reason: 'former_quang_nam_or_remote_merged_ward_requires_boundary_review' as const,
    }));
  const deferredIds = new Set(
    deferredAdministrativeReview.map((record) => record.sourcePropertyId)
  );
  const queryCohort = records.filter((record) => !deferredIds.has(record.sourcePropertyId));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  if (!fs.existsSync(outputPath)) {
    const manifest = daNangGeocodingManifestSchema.parse({
      recordType: 'manifest',
      schemaVersion: 'da-nang-accommodation-geocoding-v1',
      createdAt: new Date().toISOString(),
      snapshotSha256,
      snapshotRecordCount: 423,
      queryCohortRecordCount: queryCohort.length,
      deferredAdministrativeReview,
      serviceUrl: SERVICE_URL,
      policyUrl: 'https://operations.osmfoundation.org/policies/nominatim/',
      attribution: 'Data © OpenStreetMap contributors, ODbL 1.0',
      requestIntervalMs: REQUEST_INTERVAL_MS,
      queryContract: {
        format: 'jsonv2',
        countrycodes: 'vn',
        addressdetails: 1,
        namedetails: 1,
        limit: 5,
        acceptLanguage: 'vi,en',
        addressNormalization:
          'remove_legacy_urban_district_then_replace_terminal_thanh_pho_da_nang_with_da_nang_v1',
      },
    });
    fs.writeFileSync(outputPath, `${JSON.stringify(manifest)}\n`, 'utf8');
  }

  const existing = parseDaNangGeocodingJsonl(fs.readFileSync(outputPath, 'utf8'));
  if (existing.manifest.snapshotSha256 !== snapshotSha256) {
    throw new Error('Existing geocoding checkpoint belongs to another source snapshot');
  }
  const completedIds = new Set(existing.attempts.map((attempt) => attempt.sourcePropertyId));
  let added = 0;
  let previousRequestStartedAt = 0;
  const executeQuery = async (
    query: string,
    strategy: 'name_and_normalized_address' | 'normalized_address_only'
  ) => {
    const elapsed = Date.now() - previousRequestStartedAt;
    if (elapsed < REQUEST_INTERVAL_MS) await sleep(REQUEST_INTERVAL_MS - elapsed);
    const url = new URL(SERVICE_URL);
    url.search = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      countrycodes: 'vn',
      addressdetails: '1',
      namedetails: '1',
      limit: '5',
      'accept-language': 'vi,en',
    }).toString();
    previousRequestStartedAt = Date.now();
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HolidaySpend-ObservedFirst-DaNang-Geocoder/1.0',
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Nominatim returned HTTP ${response.status}; stop and resume later`);
    }
    const responseText = await response.text();
    return {
      strategy,
      query,
      requestedAt: new Date().toISOString(),
      responseUrl: url.toString(),
      responseByteCount: Buffer.byteLength(responseText, 'utf8'),
      responseSha256: sha256(responseText),
      results: JSON.parse(responseText),
    };
  };
  for (const record of queryCohort) {
    if (completedIds.has(record.sourcePropertyId) || added >= maxRecords) continue;
    if (!record.address) throw new Error(`Property ${record.sourcePropertyId} has no address`);
    const normalizedAddress = normalizeDaNangGeocodingAddress(record.address);
    const primary = await executeQuery(
      `${record.name}, ${normalizedAddress}, Việt Nam`,
      'name_and_normalized_address'
    );
    const requests = [primary];
    if (primary.results.length === 0) {
      requests.push(await executeQuery(`${normalizedAddress}, Việt Nam`, 'normalized_address_only'));
    }
    const attempt = daNangGeocodingAttemptSchema.parse({
      recordType: 'geocode_attempt',
      schemaVersion: 'da-nang-accommodation-geocoding-v1',
      sourcePropertyId: record.sourcePropertyId,
      stars: record.stars,
      name: record.name,
      address: record.address,
      requests,
    });
    fs.appendFileSync(outputPath, `${JSON.stringify(attempt)}\n`, 'utf8');
    completedIds.add(record.sourcePropertyId);
    added += 1;
  }

  const finalCheckpoint = parseDaNangGeocodingJsonl(fs.readFileSync(outputPath, 'utf8'));
  console.log(JSON.stringify(summarizeDaNangGeocoding(finalCheckpoint.attempts), null, 2));
  console.log(`Added ${added} attempts; checkpoint ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
