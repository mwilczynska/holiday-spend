import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { vietnamAccommodationRegisterCaptureSchema } from '../src/lib/vietnam-accommodation-register';

const snapshotIndex = process.argv.indexOf('--snapshot');
if (snapshotIndex === -1 || !process.argv[snapshotIndex + 1]) {
  throw new Error('Usage: tsx scripts/validate-da-nang-accommodation-register.ts --snapshot <snapshot.json>');
}

const snapshotPath = path.resolve(process.argv[snapshotIndex + 1]);
const buffer = fs.readFileSync(snapshotPath);
const capture = vietnamAccommodationRegisterCaptureSchema.parse(JSON.parse(buffer.toString('utf8')));
const sha256 = createHash('sha256').update(buffer).digest('hex');

console.log(`Validated ${snapshotPath}`);
console.log(`Captured at: ${capture.capturedAt}`);
console.log(`Records: ${capture.totalRecordCount}`);
for (const stratum of [...capture.strata].sort((a, b) => a.stars - b.stars)) {
  const missingAddresses = stratum.records.filter((record) => record.address === null).length;
  console.log(
    `${stratum.stars}-star: ${stratum.records.length} records, ${stratum.pages.length} pages, ${missingAddresses} missing addresses`
  );
}
console.log(`Bytes: ${buffer.length}`);
console.log(`SHA-256: ${sha256}`);
