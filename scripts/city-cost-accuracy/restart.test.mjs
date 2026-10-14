import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { artifactDeadline, budgetPlan, collectorTask, expand, selectReview, validateActions, validateContract, validateWorker } from './restart.mjs';
import { replayBudget } from './budget.mjs';
import { hash } from './core.mjs';

const design = JSON.parse(fs.readFileSync(new URL('../../research/city-cost-accuracy/restart-design-repaired.json', import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(new URL('../../research/city-cost-accuracy/manifest.json', import.meta.url)));
const audit = JSON.parse(fs.readFileSync(new URL('../../research/city-cost-accuracy/restart-prior-audit.json', import.meta.url)));
function contract() {
  const shared = ['taskSha256', 'systemSha256', 'userSha256', 'protocolSha256', 'searchCount', 'retrievalCount', 'tokenUsage', 'failureReason'];
  const c = { ...structuredClone(design), status: 'coordinator_validated', programRevision: 'restart-1',
    workerSelection: { model: 'gpt-6-luna', effort: 'max', runtime: 'Codex subagent' },
    coordinatorValidation: { validated: true, validatedAt: '2026-10-13T12:00:00Z', validatedBy: 'fixture only' },
    reviewSampling: { unit: 'primary_meal_aggregate', fraction: 0.2, hashPrefix: 'restart-1-review|', idRule: 'CITY_ID/VENUE_RANK/inexp_meal_1p',
      acceptedPredicate: 'measure=inexp_meal_1p and provisionalEligibility=eligible and normalizationStatus=complete', grouping: 'sourceUrl', sourceOrder: 'lexical' },
    resources: { ...structuredClone(design.resources), designAssessmentReserveCalls: 5 } };
  c.schemas.referenceRecord.required.push('aggregates', 'disputes', ...shared);
  if (!c.schemas.referenceRecord.rowRequired.includes('sourceBasisEvidence')) c.schemas.referenceRecord.rowRequired.push('sourceBasisEvidence');
  c.schemas.reviewRecord.required.push(...shared);
  return c;
}
const startedAt = '2026-10-13T12:00:00Z', finishedAt = '2026-10-13T12:01:00Z';
const action = (ordinal, type, value, outcome = 'success') => ({ ordinal, type, query: type === 'search' ? value : null,
  url: type === 'search' ? null : value, startedAt, outcome });
const makeRow = (id = 'hanoi/1/inexp_meal_1p/1') => ({ id, venueId: 'fixture-venue', venueName: 'Fixture Venue', independentOperator: true,
  measure: 'inexp_meal_1p', itemLabel: 'Fixture main', amount: 12, currency: 'VND', unit: 'one main', servingSize: 'one person',
  sourceUrl: 'https://example.test/menu', sourceTitle: 'Fixture menu', retrievedAt: startedAt, applicableDate: null, datedStatus: 'current_undated',
  excerpt: 'A main dish 12', geographyEvidence: 'Fixture city address', taxBasis: 'included', inclusions: [], selectionRank: 1,
  evidenceClass: 'observed_offer', eligibility: 'eligible', reason: 'Labelled main, displayed tax-inclusive convention.',
  listedAmount: 12, listedUnit: 'one main', transaction: { people: 1, rooms: 0, nights: 0,
    items: [{ atomicRowId: id, quantity: 1 }], listedQuantityInTarget: 1 }, mandatoryChargeStatus: 'all_included', charges: [],
  allMandatoryChargesDocumented: true, normalizationStatus: 'complete', normalizationReason: 'Explicit all-inclusive menu statement.', sourceBasisEvidence: 'All prices include mandatory charges.' });
const makeAggregate = (row = makeRow()) => ({ aggregateId: row.id.split('/').slice(0, 3).join('/'), cityId: 'hanoi', venueId: row.venueId,
  measure: 'inexp_meal_1p', constituentAtomicRowIds: [row.id], sourceUrl: row.sourceUrl, provisionalEligibility: 'eligible', normalizationStatus: 'complete', reason: 'Fixture basis complete' });
function response(request) {
  return { taskId: request.taskId, cityId: request.cityId, model: request.model, effort: request.effort, runtime: request.runtime,
    taskSha256: request.taskSha256, systemSha256: request.systemSha256, userSha256: request.promptSha256, protocolSha256: request.contractSha256,
    searchCount: 1, retrievalCount: 2, tokenUsage: null, failureReason: null,
    startedAt, finishedAt, actions: [action(1, 'search', request.exactQuery), action(2, 'open', 'https://example.test/menu')],
    rankedResults: [{ rank: 1, title: 'Fixture menu', url: 'https://example.test/menu', eligibilityReason: 'Original city restaurant menu' }],
    rows: [makeRow()], aggregates: [makeAggregate()], disputes: [], missingMeasures: [], status: 'success' };
}

test('drafts cannot freeze; exact identities, prior use and reserves are validated', () => {
  assert.throws(() => validateContract(design, manifest, audit), /coordinator validation/);
  const c = contract();
  assert.equal(validateContract(c, manifest, audit).length, 6);
  c.resources.known.estimateInvocations = 18;
  assert.throws(() => validateContract(c, manifest, audit), /Prior balance/);
});
test('complete program reservations protect confirmation and future reference work', () => {
  const c = contract(), plan = budgetPlan(c);
  const events = plan.events.map((event, index) => ({ ...event, sequence: index + 1 }));
  let state = replayBudget(events, plan.limits);
  assert.equal(state.used.estimateInvocations, 19);
  assert.equal(state.used.referenceActions, 43);
  assert.equal(state.used.estimateRetrievalActions, 44);
  assert.equal(state.available.estimateInvocations, 100);
  assert.equal(state.available.referenceActions, 0);
  assert.equal(state.available.referenceWorkerInvocations, 0);
  assert.ok(events.some(event => event.id === 'protected-estimate-confirmationexclusive' && event.resources.estimateInvocations === 100));
  events.push({ sequence: events.length + 1, type: 'start', id: 'menu-hanoi', consumed: { referenceWorkerInvocations: 1 } });
  assert.throws(() => replayBudget([...events, { ...events.at(-1), sequence: events.length + 1 }], plan.limits), /duplicate start/);
  events.push({ sequence: events.length + 1, type: 'finish', id: 'menu-hanoi', actual: null });
  state = replayBudget(events, plan.limits);
  assert.equal(state.used.referenceActions, 47);
  assert.equal(state.used.referenceWorkerInvocations, 4);
  assert.throws(() => replayBudget([...events, { sequence: events.length + 1, type: 'reserve', id: 'unfunded', resources: { referenceActions: 1 } }], plan.limits), /cap exceeded/);
});
test('collector prompt expands exact frozen templates and binds selected provenance/hashes', () => {
  const c = contract(), task = collectorTask(c, manifest.cities[0], 'menu');
  assert.equal(task.request.exactQuery, 'Hanoi Vietnam restaurant cafe menu main course cappuccino draft beer');
  assert.equal(task.request.promptSha256, hash(task.prompt));
  assert.equal(task.request.systemSha256, hash(task.system));
  assert.equal(task.request.model, 'gpt-6-luna');
  assert.equal(task.request.maxActions, 4);
  assert.ok(task.prompt.includes(JSON.stringify(c.definitions, null, 2)));
  assert.throws(() => expand('{{MISSING}}', {}), /Unexpanded/);
});
test('reference validation checks IDs, actions, source basis and selected identity', () => {
  const c = contract(), { request } = collectorTask(c, manifest.cities[0], 'menu');
  request.taskSha256 = 'fixture-task-hash'; request.contractSha256 = 'fixture-contract-hash';
  const r = response(request);
  const valid = validateWorker(JSON.stringify(r), request, c);
  assert.equal(valid.valid, true, JSON.stringify(valid.errors));
  for (const mutate of [r => { r.model = 'other'; }, r => { r.rows[0].amount = -1; },
    r => { r.rows[0].id = 'other/1/inexp_meal_1p/1'; }, r => { r.rows[0].taxBasis = 'unknown'; },
    r => { r.actions[0].query = 'different query'; }, r => { r.rows[0].prediction = 50; }]) {
    const bad = structuredClone(r); mutate(bad);
    assert.equal(validateWorker(JSON.stringify(bad), request, c).valid, false);
  }
  const invalid = validateWorker('{', request, c);
  assert.equal(invalid.telemetryKnown, false);
  const unknown = structuredClone(r); unknown.actions = null;
  assert.equal(validateWorker(JSON.stringify(unknown), request, c).telemetryKnown, false);
});
test('batched/duplicate ordinal and excess retrieval telemetry is not trusted', () => {
  assert.equal(validateActions([action(1, 'open', 'https://example.test'), action(1, 'open', 'https://example.test')],
    { maxActions: 4 }, startedAt, finishedAt).valid, false);
  assert.equal(validateActions(Array.from({ length: 5 }, (_, i) => action(i + 1, 'open', 'https://example.test')),
    { maxActions: 4 }, startedAt, finishedAt).count, null);
});
test('deadline uses actual artifact mtime against coordinator start, including exact 600-second boundary', () => {
  const start = Date.parse(startedAt);
  assert.equal(artifactDeadline(startedAt, start + 600000, 600).valid, true);
  assert.equal(artifactDeadline(startedAt, start + 600001, 600).terminalStatus, 'timeout');
  assert.equal(artifactDeadline(startedAt, start + 600001, 600).valid, false);
  assert.equal(artifactDeadline(startedAt, start - 1, 600).valid, false);
});
test('eligible-main aggregate retains all eligible items while excluded rows stay separately auditable', () => {
  const c = contract(), { request } = collectorTask(c, manifest.cities[0], 'menu');
  request.taskSha256 = 'fixture-task'; request.contractSha256 = 'fixture-contract';
  const r = response(request), excluded = { ...makeRow('hanoi/1/inexp_meal_1p/2'), eligibility: 'ineligible', reason: 'Child menu explicitly excluded' };
  r.rows.push(excluded);
  assert.equal(validateWorker(JSON.stringify(r), request, c).valid, true);
  r.rows[1].eligibility = 'eligible';
  assert.equal(validateWorker(JSON.stringify(r), request, c).valid, false);
  r.aggregates[0].constituentAtomicRowIds.push(excluded.id);
  assert.equal(validateWorker(JSON.stringify(r), request, c).valid, true);
});
test('independent review validates assigned aggregate, every constituent and frozen sampling/provenance', () => {
  const c = contract(), row = makeRow(), aggregate = makeAggregate(row);
  const request = { taskId: 'review-feasibility', role: 'review', model: 'gpt-6-luna', effort: 'max', runtime: 'Codex subagent',
    maxActions: 10, timeoutSeconds: 600, taskSha256: 'fixture-task', systemSha256: 'fixture-system', promptSha256: 'fixture-user', contractSha256: 'fixture-contract',
    requiredRowIds: [row.id], rows: [row], aggregates: [aggregate], disputes: [], urls: [row.sourceUrl], acceptedAggregates: 1, sampledAggregateIds: [aggregate.aggregateId] };
  const r = { taskId: request.taskId, model: request.model, effort: request.effort, runtime: request.runtime, startedAt, finishedAt,
    taskSha256: request.taskSha256, systemSha256: request.systemSha256, userSha256: request.promptSha256, protocolSha256: request.contractSha256,
    searchCount: 0, retrievalCount: 1, tokenUsage: null, failureReason: null, actions: [action(1, 'open', row.sourceUrl)], unresolvedRowIds: [],
    reviewedRows: [{ rowId: row.id, verdict: 'verified', reason: 'Source checked', sourceUrl: row.sourceUrl, excerpt: row.excerpt, correctedObservedFields: null }],
    samplingDenominator: 1, selectedAggregateIds: [aggregate.aggregateId], reviewedAggregates: [{ aggregateId: aggregate.aggregateId,
      constituentAtomicRowIds: [row.id], enumerationComplete: true, amountsVerified: true, feeBasisVerified: true, verdict: 'verified', reason: 'Full menu checked', sourceUrl: row.sourceUrl }], disputes: [] };
  const good = validateWorker(JSON.stringify(r), request, c);
  assert.equal(good.valid, true, JSON.stringify(good.errors));
  r.reviewedAggregates = [];
  assert.equal(validateWorker(JSON.stringify(r), request, c).valid, false);
  r.reviewedRows[0].sourceUrl = 'https://example.test/other';
  assert.equal(validateWorker(JSON.stringify(r), request, c).valid, false);
});
test('review samples aggregates, verifies all constituent items, adds genuine disputes and never drops URLs to fit', () => {
  const rows = Array.from({ length: 11 }, (_, i) => ({ ...makeRow(`hanoi/${i + 1}/inexp_meal_1p/1`),
    venueId: `venue-${i}`, selectionRank: i + 1, sourceUrl: `https://example.test/${i}`, prediction: 999, candidate: 'hidden' }));
  const aggregates = rows.map(makeAggregate), sampling = contract().reviewSampling;
  const disputes = rows.map((row, i) => ({ id: `d-${i}`, aggregateId: aggregates[i].aggregateId, atomicRowIds: [row.id], sourceUrls: [row.sourceUrl],
    competingInterpretations: ['main', 'side'], evidence: 'Conflicting labels on source', reason: 'Definition disagreement' }));
  const selected = selectReview(rows, aggregates, disputes, sampling);
  assert.equal(selected.randomSampleCount, 3);
  assert.equal(selected.rows.length, 11);
  assert.equal(selected.fitsActionAllocation, false);
  assert.deepEqual(selected.urls, [...selected.urls].sort());
  assert.ok(selected.rows.every(row => !('prediction' in row) && !('candidate' in row)));
  assert.deepEqual(selectReview([...rows].reverse(), [...aggregates].reverse(), [], sampling).sampledAggregateIds,
    selectReview(rows, aggregates, [], sampling).sampledAggregateIds);
  assert.throws(() => selectReview(rows, aggregates, [{ ...disputes[0], atomicRowIds: ['unknown'] }], sampling), /Unknown\/malformed/);
  const extra = { ...makeRow('hanoi/1/inexp_meal_1p/2'), sourceUrl: rows[0].sourceUrl, venueId: rows[0].venueId };
  const one = { ...aggregates[0], constituentAtomicRowIds: [rows[0].id, extra.id] };
  assert.equal(selectReview([rows[0], extra], [one], [], sampling).rows.length, 2);
  const uncertain = { ...aggregates[0], provisionalEligibility: 'uncertain', normalizationStatus: 'missing' };
  assert.equal(selectReview([rows[0]], [uncertain], [], sampling).requiredRowIds.length, 0);
});
