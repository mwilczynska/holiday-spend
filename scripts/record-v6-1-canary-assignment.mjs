import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCES = new Set(['expedia_3star', 'budgetyourtrip_daily_tiers', 'numbeo_drinks']);

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const relativeExperimentDir = optionValue('--experiment-dir')
  ?? 'data/reference/v6/experiments/013-v6-1-resumable-delegated-canary';
const experimentDir = path.resolve(ROOT, relativeExperimentDir);
const registrationPath = path.join(experimentDir, 'registration.json');
const ledgerPath = path.join(experimentDir, 'assignments.json');
const check = process.argv.includes('--check');

if (!fs.existsSync(registrationPath)) throw new Error(`Missing registration: ${registrationPath}`);
const registration = JSON.parse(fs.readFileSync(registrationPath, 'utf8'));

function validateLedger(ledger) {
  if (ledger.schemaVersion !== 'city-cost-v6-1-canary-assignment-ledger-v1'
    || ledger.experiment !== registration.experiment || !Array.isArray(ledger.assignments)) {
    throw new Error('Assignment ledger schema or experiment is invalid.');
  }
  const ids = new Set();
  const registeredCities = new Set(registration.cities.map((city) => city.city));
  for (const assignment of ledger.assignments) {
    if (!assignment.assignmentId || ids.has(assignment.assignmentId)) throw new Error('Assignment ids must be non-empty and unique.');
    ids.add(assignment.assignmentId);
    if (!assignment.agentId || !registeredCities.has(assignment.city)) throw new Error(`Invalid assignment identity: ${assignment.assignmentId}`);
    if (!Array.isArray(assignment.sources) || assignment.sources.length === 0
      || assignment.sources.some((source) => !SOURCES.has(source))) {
      throw new Error(`Invalid assignment sources: ${assignment.assignmentId}`);
    }
  }
  return ledger;
}

if (check) {
  if (!fs.existsSync(ledgerPath)) throw new Error('Assignment ledger is missing.');
  const ledger = validateLedger(JSON.parse(fs.readFileSync(ledgerPath, 'utf8')));
  console.log(JSON.stringify({ passed: true, experiment: ledger.experiment, assignmentAttempts: ledger.assignments.length }, null, 2));
  process.exit(0);
}

const assignmentId = optionValue('--assignment-id');
const agentId = optionValue('--agent-id');
const city = optionValue('--city');
const sources = (optionValue('--sources') ?? '').split(',').filter(Boolean);
if (!assignmentId || !agentId || !city || sources.length === 0) {
  throw new Error('Required: --assignment-id, --agent-id, --city and comma-separated --sources.');
}
if (fs.existsSync(path.join(experimentDir, 'results.json')) || fs.existsSync(path.join(experimentDir, 'verdict.md'))) {
  throw new Error('A finalized experiment is immutable.');
}

const ledger = fs.existsSync(ledgerPath)
  ? validateLedger(JSON.parse(fs.readFileSync(ledgerPath, 'utf8')))
  : { schemaVersion: 'city-cost-v6-1-canary-assignment-ledger-v1', experiment: registration.experiment, assignments: [] };
if (ledger.assignments.some((assignment) => assignment.assignmentId === assignmentId)) {
  throw new Error(`Assignment already recorded: ${assignmentId}`);
}
ledger.assignments.push({ assignmentId, agentId, city, sources, assignedAt: new Date().toISOString() });
validateLedger(ledger);
fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
console.log(JSON.stringify({ recorded: true, assignmentId, agentId, city, sources, assignmentAttempts: ledger.assignments.length }, null, 2));
