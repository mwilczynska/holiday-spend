import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCES = new Set(['expedia_3star', 'budgetyourtrip_daily_tiers', 'numbeo_drinks']);
const HISTORICAL_EXPERIMENTS = new Set([
  '011-v6-1-delegated-operational-canary',
  '012-v6-1-corrected-delegated-canary',
  '013-v6-1-resumable-delegated-canary',
]);

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const relativeExperimentDir = optionValue('--experiment-dir')
  || 'data/reference/v6/experiments/013-v6-1-resumable-delegated-canary';
const experimentDir = path.resolve(ROOT, relativeExperimentDir);
const registrationPath = path.join(experimentDir, 'registration.json');
const ledgerPath = path.join(experimentDir, 'assignments.json');
const claimsDir = path.join(experimentDir, 'assignment-claims');
const claimLockPath = path.join(claimsDir, '.lock');
const check = process.argv.includes('--check');

if (!fs.existsSync(registrationPath)) throw new Error('Missing registration: ' + registrationPath);
const registration = JSON.parse(fs.readFileSync(registrationPath, 'utf8'));

function slotKey(city, source) {
  return city + '::' + source;
}

function validateLedger(ledger, allowDuplicateSlots) {
  if (ledger.schemaVersion !== 'city-cost-v6-1-canary-assignment-ledger-v1'
    || ledger.experiment !== registration.experiment || !Array.isArray(ledger.assignments)) {
    throw new Error('Assignment ledger schema or experiment is invalid.');
  }
  const ids = new Set();
  const slots = new Set();
  const duplicateSlots = [];
  const registeredCities = new Set(registration.cities.map((city) => city.city));
  for (const assignment of ledger.assignments) {
    if (!assignment.assignmentId || ids.has(assignment.assignmentId)) throw new Error('Assignment ids must be non-empty and unique.');
    ids.add(assignment.assignmentId);
    if (!assignment.agentId || !registeredCities.has(assignment.city)) throw new Error('Invalid assignment identity: ' + assignment.assignmentId);
    if (!Array.isArray(assignment.sources) || assignment.sources.length === 0
      || assignment.sources.some((source) => !SOURCES.has(source))) {
      throw new Error('Invalid assignment sources: ' + assignment.assignmentId);
    }
    for (const source of assignment.sources) {
      const key = slotKey(assignment.city, source);
      if (slots.has(key)) duplicateSlots.push({ city: assignment.city, source, assignmentId: assignment.assignmentId });
      slots.add(key);
    }
  }
  if (duplicateSlots.length && !allowDuplicateSlots) {
    throw new Error('Duplicate city/source assignment claim: ' + duplicateSlots.map((slot) => slot.city + '/' + slot.source).join(', '));
  }
  return { ledger, duplicateSlots };
}

function readClaims() {
  if (!fs.existsSync(claimsDir)) return [];
  return fs.readdirSync(claimsDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const file = path.join(claimsDir, name);
      const claim = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!claim.city || !claim.source || !claim.assignmentId) throw new Error('Invalid slot claim: ' + file);
      return { ...claim, file };
    });
}

function validateClaims(claims, allowDuplicateSlots) {
  const slots = new Set();
  const duplicateSlots = [];
  const registeredCities = new Set(registration.cities.map((city) => city.city));
  for (const claim of claims) {
    if (!registeredCities.has(claim.city) || !SOURCES.has(claim.source)) {
      throw new Error('Invalid claimed city/source: ' + claim.city + '/' + claim.source);
    }
    const key = slotKey(claim.city, claim.source);
    if (slots.has(key)) duplicateSlots.push({ city: claim.city, source: claim.source });
    slots.add(key);
  }
  if (duplicateSlots.length && !allowDuplicateSlots) {
    throw new Error('Duplicate write-once slot claim: ' + duplicateSlots.map((slot) => slot.city + '/' + slot.source).join(', '));
  }
  return duplicateSlots;
}

function acquireClaimLock() {
  fs.mkdirSync(claimsDir, { recursive: true });
  try {
    fs.mkdirSync(claimLockPath);
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      const ownerPath = path.join(claimLockPath, 'owner.json');
      if (!fs.existsSync(ownerPath)) throw new Error('Assignment claim lock is busy; inspect it before retrying.');
      let owner;
      try {
        owner = JSON.parse(fs.readFileSync(ownerPath, 'utf8'));
      } catch {
        throw new Error('Assignment claim lock is busy and its owner record is unreadable.');
      }
      try {
        process.kill(owner.pid, 0);
        throw new Error('Assignment claim lock is busy; retry without assigning new work.');
      } catch (probeError) {
        if (probeError && probeError.message && probeError.message.startsWith('Assignment claim lock is busy')) throw probeError;
        fs.rmSync(claimLockPath, { recursive: true, force: true });
        fs.mkdirSync(claimLockPath);
      }
    } else {
      throw error;
    }
  }
  fs.writeFileSync(path.join(claimLockPath, 'owner.json'), JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }) + '\n');
}

function releaseClaimLock() {
  if (!fs.existsSync(claimLockPath)) return;
  const ownerPath = path.join(claimLockPath, 'owner.json');
  if (fs.existsSync(ownerPath)) {
    const owner = JSON.parse(fs.readFileSync(ownerPath, 'utf8'));
    if (owner.pid !== process.pid) throw new Error('Cannot release an assignment claim lock owned by another process.');
  }
  fs.rmSync(claimLockPath, { recursive: true, force: true });
}

function claimFileName(city, source) {
  const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return path.join(claimsDir, citySlug + '--' + source + '.json');
}

function writeClaim(claim) {
  const file = claimFileName(claim.city, claim.source);
  const descriptor = fs.openSync(file, 'wx');
  try {
    fs.writeFileSync(descriptor, JSON.stringify(claim, null, 2) + '\n');
  } finally {
    fs.closeSync(descriptor);
  }
  return file;
}

if (check) {
  if (!fs.existsSync(ledgerPath)) throw new Error('Assignment ledger is missing.');
  const historical = HISTORICAL_EXPERIMENTS.has(registration.experiment);
  const validated = validateLedger(JSON.parse(fs.readFileSync(ledgerPath, 'utf8')), historical);
  const claims = readClaims();
  const duplicateClaims = validateClaims(claims, historical);
  console.log(JSON.stringify({
    passed: true,
    experiment: validated.ledger.experiment,
    assignmentAttempts: validated.ledger.assignments.length,
    writeOnceClaims: claims.length,
    duplicateHistoricalSlots: validated.duplicateSlots.length + duplicateClaims.length,
  }, null, 2));
  process.exit(0);
}

const assignmentId = optionValue('--assignment-id');
const agentId = optionValue('--agent-id');
const city = optionValue('--city');
const sources = (optionValue('--sources') || '').split(',').filter(Boolean);
if (!assignmentId || !agentId || !city || sources.length === 0) {
  throw new Error('Required: --assignment-id, --agent-id, --city and comma-separated --sources.');
}
if (fs.existsSync(path.join(experimentDir, 'results.json')) || fs.existsSync(path.join(experimentDir, 'verdict.md'))) {
  throw new Error('A finalized experiment is immutable.');
}
if (new Set(sources).size !== sources.length || sources.some((source) => !SOURCES.has(source))) {
  throw new Error('Assignment sources must be unique supported source ids.');
}

acquireClaimLock();
try {
  const ledger = fs.existsSync(ledgerPath)
    ? validateLedger(JSON.parse(fs.readFileSync(ledgerPath, 'utf8')), false).ledger
    : { schemaVersion: 'city-cost-v6-1-canary-assignment-ledger-v1', experiment: registration.experiment, assignments: [] };
  const claims = readClaims();
  validateClaims(claims, false);
  if (ledger.assignments.some((assignment) => assignment.assignmentId === assignmentId)) {
    throw new Error('Assignment already recorded: ' + assignmentId);
  }
  const assignedSlots = new Set(ledger.assignments.flatMap((assignment) =>
    assignment.sources.map((source) => slotKey(assignment.city, source))));
  for (const source of sources) {
    if (assignedSlots.has(slotKey(city, source))
      || claims.some((claim) => slotKey(claim.city, claim.source) === slotKey(city, source))) {
      throw new Error('City/source slot is already claimed: ' + city + '/' + source);
    }
  }
  const assignment = { assignmentId, agentId, city, sources, assignedAt: new Date().toISOString() };
  for (const source of sources) {
    writeClaim({ schemaVersion: 'city-cost-v6-1-canary-slot-claim-v1', ...assignment, source });
  }
  ledger.assignments.push(assignment);
  validateLedger(ledger, false);
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
  console.log(JSON.stringify({
    recorded: true,
    assignmentId,
    agentId,
    city,
    sources,
    assignmentAttempts: ledger.assignments.length,
    writeOnceClaims: readClaims().length,
  }, null, 2));
} finally {
  releaseClaimLock();
}
