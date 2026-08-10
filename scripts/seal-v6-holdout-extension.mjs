// Seal the fresh extension after collection. This checks only row status and
// metadata shape; it does not print or otherwise expose holdout prices.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const extensionPath = path.join(root, 'data/reference/v6/ground-truth/holdout-extension.json');
const sealPath = path.join(root, 'data/reference/v6/ground-truth/holdout-seal.json');
const extension = JSON.parse(fs.readFileSync(extensionPath, 'utf8'));
const seal = JSON.parse(fs.readFileSync(sealPath, 'utf8'));
if (extension.status !== 'collected_before_seal') throw new Error('Holdout extension must be collected before sealing.');
if (seal.status !== 'per_measure') throw new Error('Holdout seal must use per_measure lifecycle.');

const missingStatuses = new Set(['not_found', 'blocked', 'stale', 'class_absent']);
for (const city of extension.cities) {
  const seen = new Set();
  for (const observation of city.observations ?? []) {
    if (seen.has(observation.measure)) throw new Error(`Duplicate extension row: ${city.city}/${observation.measure}`);
    seen.add(observation.measure);
    if (observation.status !== 'found' && !missingStatuses.has(observation.status)) throw new Error(`Invalid extension status: ${city.city}/${observation.measure}`);
    if (observation.status === 'found' && !(typeof observation.amount === 'number' && observation.amount > 0)) throw new Error(`Found extension row lacks a positive amount: ${city.city}/${observation.measure}`);
  }
  if (seen.size !== extension.requiredMeasures.length) throw new Error(`Extension has unresolved slots for ${city.city}.`);
}

for (const measure of extension.requiredMeasures) {
  const entry = seal.measures[measure];
  if (!entry || entry.status !== 'sealed_before_collection') throw new Error(`Measure is not a fresh sealed_before_collection slot: ${measure}`);
  entry.status = 'sealed_after_collection';
}
extension.status = 'sealed_after_collection';
extension.sealedAt = new Date().toISOString();
fs.writeFileSync(extensionPath, `${JSON.stringify(extension, null, 2)}\n`);
fs.writeFileSync(sealPath, `${JSON.stringify(seal, null, 2)}\n`);
console.log(JSON.stringify({ extensionStatus: extension.status, sealedMeasures: extension.requiredMeasures.length, valuesInspected: false }, null, 2));
