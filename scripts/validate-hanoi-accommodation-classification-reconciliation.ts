import fs from 'node:fs';
import path from 'node:path';
import { hanoiAccommodationClassificationReconciliationSchema } from '../src/lib/hanoi-accommodation-classification';

const inputIndex = process.argv.indexOf('--input');
const inputPath = path.resolve(
  inputIndex === -1 || !process.argv[inputIndex + 1]
    ? 'data/reference/hanoi_accommodation_classification_reconciliation_2026.json'
    : process.argv[inputIndex + 1]
);
const artifact = hanoiAccommodationClassificationReconciliationSchema.parse(
  JSON.parse(fs.readFileSync(inputPath, 'utf8'))
);
console.log(`Validated ${inputPath}`);
console.log(`Source-universe records: ${artifact.sourceUniverse.recordCounts.total}`);
console.log(`Published current-count benchmark: ${artifact.currentCountBenchmark.recordCounts.total}`);
console.log(`Pending: ${artifact.summary.pending}`);
console.log(`Verified active: ${artifact.summary.verifiedActive}`);
console.log(`Verified inactive: ${artifact.summary.verifiedInactive}`);
console.log(`Eligible for geolocation: ${artifact.summary.eligibleForGeolocation}`);
