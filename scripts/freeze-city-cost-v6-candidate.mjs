// Freeze the single M3 candidate before the locked holdout is read.
// This script reads only the candidate configuration and the seal metadata.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const coefficientsPath = path.join(root, 'data/reference/v6/coefficients-v6.json');
const sealPath = path.join(root, 'data/reference/v6/ground-truth/holdout-seal.json');
const coefficients = JSON.parse(fs.readFileSync(coefficientsPath, 'utf8'));
const seal = JSON.parse(fs.readFileSync(sealPath, 'utf8'));

if (seal.status !== 'per_measure') throw new Error('Holdout must use the per_measure seal before candidate freeze.');
if (!seal.measures || typeof seal.measures !== 'object') throw new Error('Per-measure holdout seal is missing its measure states.');
const freshMeasures = Object.entries(seal.measures).filter(([, entry]) => entry.status === 'sealed_after_collection');
if (!freshMeasures.length) throw new Error('No fresh sealed_after_collection measures are available for candidate freeze.');
if (freshMeasures.some(([, entry]) => entry.scoresFile !== null || entry.candidateConfigHash !== null || entry.candidateCommit !== null)) {
  throw new Error('A fresh holdout measure already carries a score or candidate identity; candidate freeze is too late.');
}
if (seal.candidateConfigHash || seal.candidateCommit || seal.scoresFile) throw new Error('A candidate is already frozen; do not create a second candidate.');

const candidateConfiguration = {
  methodologyVersion: coefficients.methodologyVersion,
  productionAnchor: coefficients.productionAnchor,
  shippedCoefficients: coefficients.shippedCoefficients,
  sourceCalibrationOffsets: coefficients.sourceCalibrationOffsets,
};
const candidateConfigJson = JSON.stringify(candidateConfiguration);
const candidateConfigHash = crypto.createHash('sha256').update(candidateConfigJson).digest('hex');
const candidateCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

seal.candidateConfigHash = `sha256:${candidateConfigHash}`;
seal.candidateCommit = candidateCommit;
seal.candidateFiles = ['data/reference/v6/coefficients-v6.json', 'src/lib/city-cost-v6-collection.ts'];
seal.frozenAt = new Date().toISOString();
seal.lockRule = 'Candidate frozen before first holdout read. Score gates 2-6 once; do not tune or rescore after reveal.';
for (const [, entry] of freshMeasures) {
  entry.candidateConfigHash = seal.candidateConfigHash;
  entry.candidateCommit = candidateCommit;
  entry.frozenAt = seal.frozenAt;
}

fs.writeFileSync(sealPath, `${JSON.stringify(seal, null, 2)}\n`);
console.log(JSON.stringify({ candidateConfigHash: seal.candidateConfigHash, candidateCommit, holdoutRead: false }, null, 2));
