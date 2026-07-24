import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { hanoiAccommodationClassificationReconciliationSchema } from '../src/lib/hanoi-accommodation-classification';
import { vietnamAccommodationRegisterCaptureSchema } from '../src/lib/vietnam-accommodation-register';

const EXPECTED_SNAPSHOT_SHA256 = '4367455956dd89823bf4f19439da4f7a7182859fc177c2c04b50cd22fdb6349f';
const BENCHMARK_URL = 'https://vietnamtourism.gov.vn/post/66938';

function requiredArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) throw new Error(`Missing ${name}`);
  return path.resolve(process.argv[index + 1]);
}

const snapshotPath = requiredArg('--snapshot');
const outputPath = requiredArg('--out');
const snapshotBuffer = fs.readFileSync(snapshotPath);
const snapshotSha256 = createHash('sha256').update(snapshotBuffer).digest('hex');
if (snapshotSha256 !== EXPECTED_SNAPSHOT_SHA256) {
  throw new Error(`Hanoi snapshot SHA-256 ${snapshotSha256} does not match ${EXPECTED_SNAPSHOT_SHA256}`);
}
const capture = vietnamAccommodationRegisterCaptureSchema.parse(JSON.parse(snapshotBuffer.toString('utf8')));
if (capture.filters.province.code !== '01') throw new Error('Snapshot is not the Hanoi province filter');

const records = capture.strata
  .flatMap((stratum) => stratum.records.map((record) => ({
    sourcePropertyId: record.sourcePropertyId,
    name: record.name,
    address: record.address ?? '',
    capturedStars: stratum.stars,
    reconciliationStatus: 'pending_current_decision' as const,
    decisionEvidence: null,
  })))
  .sort((left, right) => Number(left.sourcePropertyId) - Number(right.sourcePropertyId));
if (records.some((record) => !record.address)) throw new Error('Hanoi source universe contains a missing address');

const artifact = hanoiAccommodationClassificationReconciliationSchema.parse({
  schemaVersion: 'hanoi-accommodation-classification-reconciliation-v1',
  city: 'Hanoi',
  country: 'Vietnam',
  asOf: '2026-07-24',
  sourceUniverse: {
    snapshotSha256,
    snapshotByteCount: snapshotBuffer.length,
    capturedAt: capture.capturedAt,
    sourceUrl: capture.sourceUrl,
    provinceCode: '01',
    recordCounts: { 1: 219, 2: 78, 3: 19, 4: 14, total: 330 },
  },
  currentCountBenchmark: {
    sourceUrl: BENCHMARK_URL,
    sourceTitle: 'Hanoi welcomed nearly 3.2 million visitors in February 2026',
    publishedAt: '2026-02-27',
    scope: 'currently valid 1-4-star Hanoi hotels and tourist apartments',
    recordCounts: { 1: 3, 2: 10, 3: 8, 4: 16, total: 37 },
    limitation: 'The official article gives aggregate active counts but does not identify individual establishments or separate the included tourist apartments.',
  },
  eligibilityRule: 'Only verified_active rows backed by authoritative current classification evidence may enter geolocation or ranking.',
  records,
  summary: { pending: 330, verifiedActive: 0, verifiedInactive: 0, eligibleForGeolocation: 0 },
});

if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite existing artifact: ${outputPath}`);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outputPath}`);
console.log(`Pending current decisions: ${artifact.summary.pending}`);
console.log(`Eligible for geolocation: ${artifact.summary.eligibleForGeolocation}`);
