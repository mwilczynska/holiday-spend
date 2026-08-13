import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v61-assignment-'));
const experimentDir = path.join(tempRoot, 'experiment');
fs.mkdirSync(experimentDir, { recursive: true });
const registration = {
  schemaVersion: 'city-cost-v6-1-delegated-canary-registration-v1',
  experiment: 'test-v6-1-assignment-claims',
  cities: [{ city: 'Test City', country: 'Testland' }],
};
fs.writeFileSync(path.join(experimentDir, 'registration.json'), JSON.stringify(registration, null, 2) + '\n');

function run(args) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'record-v6-1-canary-assignment.mjs'),
    '--experiment-dir', experimentDir, ...args], { cwd: root, encoding: 'utf8' });
}

try {
  const first = run(['--assignment-id', 'assignment-1', '--agent-id', 'agent-1', '--city', 'Test City', '--sources', 'expedia_3star']);
  if (first.status !== 0) throw new Error('The first slot claim did not succeed: ' + first.stderr);
  const duplicate = run(['--assignment-id', 'assignment-2', '--agent-id', 'agent-2', '--city', 'Test City', '--sources', 'expedia_3star']);
  if (duplicate.status === 0 || !(`${duplicate.stdout}${duplicate.stderr}`.includes('already claimed'))) {
    throw new Error('A duplicate city/source claim was accepted.');
  }
  const second = run(['--assignment-id', 'assignment-3', '--agent-id', 'agent-3', '--city', 'Test City', '--sources', 'numbeo_drinks']);
  if (second.status !== 0) throw new Error('A distinct slot claim did not succeed: ' + second.stderr);
  const check = run(['--check']);
  if (check.status !== 0 || !check.stdout.includes('"writeOnceClaims": 2')) {
    throw new Error('The assignment claim ledger check failed: ' + check.stderr);
  }
  console.log(JSON.stringify({ passed: true, duplicateRejected: true, distinctSlotAccepted: true }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
