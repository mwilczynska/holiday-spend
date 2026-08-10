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

if (seal.status !== 'sealed_after_collection') throw new Error('Holdout must be sealed_after_collection before candidate freeze.');
if (seal.scoresFile !== null) throw new Error('Holdout already has a score file; candidate freeze is too late.');
if (seal.candidateConfigHash || seal.candidateCommit) throw new Error('A candidate is already frozen; do not create a second candidate.');

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

fs.writeFileSync(sealPath, `${JSON.stringify(seal, null, 2)}\n`);
console.log(JSON.stringify({ candidateConfigHash: seal.candidateConfigHash, candidateCommit, holdoutRead: false }, null, 2));
