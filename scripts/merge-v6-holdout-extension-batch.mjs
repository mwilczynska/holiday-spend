// Merge a collected holdout batch into the per-measure extension.
// It reports status counts only; it never prints a holdout amount.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const extensionPath = path.join(root, 'data/reference/v6/ground-truth/holdout-extension.json');
const batchArgument = process.argv.find((argument) => argument.startsWith('--batch='));
if (!batchArgument) throw new Error('Usage: node scripts/merge-v6-holdout-extension-batch.mjs --batch=<path>');
const batchPath = path.resolve(root, batchArgument.slice('--batch='.length));
const extension = JSON.parse(fs.readFileSync(extensionPath, 'utf8'));
const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));

if (extension.status !== 'sealed_before_collection') throw new Error('Holdout extension is not open for collection.');
if (!Array.isArray(batch.cities)) throw new Error('Batch must contain cities.');
const allowedMeasures = new Set(extension.requiredMeasures);
const allowedCities = new Set(extension.cities.map((city) => city.city));
const byKey = new Map();
for (const city of batch.cities) {
  if (!allowedCities.has(city.city)) throw new Error(`Batch contains an unexpected holdout city: ${city.city}`);
  for (const observation of city.observations ?? []) {
    if (!allowedMeasures.has(observation.measure)) throw new Error(`Batch contains an unexpected measure: ${observation.measure}`);
    const key = `${city.city}\u001f${observation.measure}`;
    if (byKey.has(key)) throw new Error(`Duplicate batch row: ${city.city}/${observation.measure}`);
    byKey.set(key, observation);
  }
}

let replaced = 0;
let found = 0;
let missing = 0;
for (const city of extension.cities) {
  const observations = [];
  for (const measure of extension.requiredMeasures) {
    const row = byKey.get(`${city.city}\u001f${measure}`);
    if (!row) continue;
    observations.push({ measure, ...row });
    replaced += 1;
    if (row.status === 'found') found += 1;
    else missing += 1;
  }
  city.observations = observations;
}

if (replaced !== extension.cities.length * extension.requiredMeasures.length) {
  throw new Error(`Batch must resolve every extension slot; resolved ${replaced} of ${extension.cities.length * extension.requiredMeasures.length}.`);
}
extension.status = 'collected_before_seal';
extension.collectedAt = new Date().toISOString();
extension.collectionBatch = path.relative(root, batchPath).replaceAll('\\', '/');
fs.writeFileSync(extensionPath, `${JSON.stringify(extension, null, 2)}\n`);
console.log(JSON.stringify({ extension: path.relative(root, extensionPath), status: extension.status, resolved: replaced, found, missing, pricesReadBack: false }, null, 2));
