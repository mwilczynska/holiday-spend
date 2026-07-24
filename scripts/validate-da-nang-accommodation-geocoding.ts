import fs from 'node:fs';
import path from 'node:path';
import {
  parseDaNangGeocodingJsonl,
  summarizeDaNangGeocoding,
} from '../src/lib/da-nang-accommodation-geocoding';

const checkpointIndex = process.argv.indexOf('--checkpoint');
if (checkpointIndex === -1 || !process.argv[checkpointIndex + 1]) {
  throw new Error(
    'Usage: tsx scripts/validate-da-nang-accommodation-geocoding.ts --checkpoint <checkpoint.jsonl>'
  );
}
const checkpointPath = path.resolve(process.argv[checkpointIndex + 1]);
const parsed = parseDaNangGeocodingJsonl(fs.readFileSync(checkpointPath, 'utf8'));
const summary = summarizeDaNangGeocoding(parsed.attempts);
console.log(`Validated ${checkpointPath}`);
console.log(`Snapshot SHA-256: ${parsed.manifest.snapshotSha256}`);
console.log(`Attempted: ${summary.attempted}/${parsed.manifest.snapshotRecordCount}`);
console.log(`Requests: ${summary.requests}`);
console.log(`Query cohort: ${parsed.manifest.queryCohortRecordCount}`);
console.log(`Deferred administrative-boundary review: ${parsed.manifest.deferredAdministrativeReview.length}`);
console.log(`With results: ${summary.withResults}`);
console.log(`Without results: ${summary.withoutResults}`);
console.log(`With tourism POI candidate: ${summary.withTourismPoiCandidate}`);
console.log(`Name-matched lodging POIs: ${summary.poiNameMatches}`);
console.log(`Exact house-address matches: ${summary.exactHouseAddressMatches}`);
console.log(`Coarse or ambiguous: ${summary.coarseOrAmbiguous}`);
console.log(`No result: ${summary.noResult}`);
console.log(
  summary.attempted === parsed.manifest.queryCohortRecordCount
    ? 'Geocoding query cohort complete'
    : 'Geocoding query cohort partial'
);
