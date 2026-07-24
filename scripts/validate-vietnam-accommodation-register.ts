import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { vietnamAccommodationRegisterCaptureSchema } from '../src/lib/vietnam-accommodation-register';

const snapshotIndex = process.argv.indexOf('--snapshot');
const cityIndex = process.argv.indexOf('--city');
const provinceCodeIndex = process.argv.indexOf('--province-code');
if (
  snapshotIndex === -1 || !process.argv[snapshotIndex + 1] ||
  cityIndex === -1 || !process.argv[cityIndex + 1] ||
  provinceCodeIndex === -1 || !process.argv[provinceCodeIndex + 1]
) {
  throw new Error(
    'Usage: tsx scripts/validate-vietnam-accommodation-register.ts --city <name> --province-code <code> --snapshot <snapshot.json>'
  );
}

const snapshotPath = path.resolve(process.argv[snapshotIndex + 1]);
const city = process.argv[cityIndex + 1];
const provinceCode = process.argv[provinceCodeIndex + 1];
const buffer = fs.readFileSync(snapshotPath);
const capture = vietnamAccommodationRegisterCaptureSchema.parse(JSON.parse(buffer.toString('utf8')));
if (capture.filters.province.code !== provinceCode) {
  throw new Error(
    `${city} snapshot uses province code ${capture.filters.province.code}; expected ${provinceCode}`
  );
}
const sha256 = createHash('sha256').update(buffer).digest('hex');

console.log(`Validated ${snapshotPath}`);
console.log(`City: ${city}`);
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
