import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {hash, writeOnce} from './core.mjs';
import {run, budgetPlan, validateWorker, selectReview, AUTHORIZED_REPO} from './restart.mjs';
import {replayBudget} from './budget.mjs';

// Offline execution audit only. No provider, database, retrieval or scoring imports.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(repo, 'research/city-cost-accuracy');
const target = 'restart-1-prep', output = `${target}/execution-summary.json`;
const canonical = value => JSON.stringify(value, null, 2) + '\n';
const need = (condition, message) => { if (!condition) throw Error(message); };
const counts = values => Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(item => item === value).length]));
const unique = values => [...new Set(values)];
const sum = values => values.reduce((total, value) => total + value, 0);
const primary = item => item.measure === 'inexp_meal_1p' && item.provisionalEligibility === 'eligible' && item.normalizationStatus === 'complete';

export function budgetPrefix(bytes, eventCount = null) {
  const lines = bytes.toString('utf8').split(/(?<=\n)/).filter(line => line.trim());
  const chosen = eventCount === null ? lines : lines.slice(0, eventCount);
  need(eventCount === null || chosen.length === eventCount, 'Budget journal shorter than recorded snapshot');
  const prefix = Buffer.from(chosen.join(''));
  need(bytes.subarray(0, prefix.length).equals(prefix), 'Budget prefix bytes differ');
  return {bytes:prefix, events:chosen.map(line => JSON.parse(line))};
}

// These count recorded eligibility only; they do not independently certify scientific suitability.
export function exactDateHotel(row, window) {
  const dates = String(row.applicableDate ?? '');
  return row.measure === 'hotel_3star_2p' && row.eligibility === 'eligible' && row.evidenceClass === 'observed_offer' &&
    row.normalizationStatus === 'complete' && row.datedStatus === 'dated' && row.taxBasis !== 'unknown' &&
    dates.includes(window.stayStart) && dates.includes(window.stayEndExclusive) &&
    row.transaction?.people === window.adults && row.transaction?.rooms === 1 &&
    [1, window.nights].includes(row.transaction?.nights) && row.conditionalDiscount !== true && row.publicNonMemberRate === true;
}

export function assertTerminal(events, state, taskIds) {
  need(state.started.length === 0, `Live budget entries: ${state.started.join(', ')}`);
  for (const id of taskIds) {
    need(events.filter(event => event.id === id && event.type === 'start').length === 1, `Expected one start: ${id}`);
    need(events.filter(event => event.id === id && event.type === 'finish').length === 1, `Reference task not terminal: ${id}`);
  }
  need(state.pending.every(id => id.startsWith('protected-')), 'Unstarted reference allocation remains pending');
}

export function audit({snapshotEventCount = null} = {}) {
  need(fs.realpathSync(repo).toLowerCase() === AUTHORIZED_REPO.toLowerCase(), 'Use authorized research worktree');
  const verified = run(['verify', target]);
  const artifacts = {};
  const bytes = relative => {
    const result = fs.readFileSync(path.join(root, relative));
    artifacts[relative] = {sha256:hash(result), bytes:result.length};
    return result;
  };
  const read = relative => JSON.parse(bytes(relative));
  const design = read(`${target}/contract.json`), frozen = read(`${target}/freeze.json`);
  const prior = read('restart-prior-audit.json');
  bytes('manifest.json');
  const plan = budgetPlan(design);
  const journalBytes = fs.readFileSync(path.join(root, target, 'budget.jsonl'));
  const snapshot = budgetPrefix(journalBytes, snapshotEventCount);
  const currentEvents = budgetPrefix(journalBytes).events;
  // Replays verify both the immutable snapshot and lawful later accounting events.
  replayBudget(currentEvents, plan.limits);
  const state = replayBudget(snapshot.events, plan.limits);
  need(snapshot.events.length >= plan.events.length, 'Missing planned budget opening/reservations');
  for (const [index, event] of plan.events.entries()) {
    const actual = {...snapshot.events[index]}; delete actual.sequence; delete actual.recordedAt;
    assert.deepEqual(actual, event, `Budget plan prefix differs at event ${index + 1}`);
  }
  const taskIds = [...design.pilotCities.map(id => `menu-${id}`), ...design.feasibility.allocation.hotelCities.map(id => `hotel-${id}`), 'review-feasibility'];
  assertTerminal(snapshot.events, state, taskIds);
  const tasks = [], records = new Map(), validRows = [], validAggregates = [], rawDisputes = [];
  for (const id of taskIds) {
    const prefix = `${target}/tasks/${id}`;
    const requestBytes = bytes(`${prefix}/request.json`), request = JSON.parse(requestBytes);
    request.taskSha256 = hash(requestBytes);
    const systemSha256 = hash(bytes(`${prefix}/system.txt`)), promptSha256 = hash(bytes(`${prefix}/prompt.txt`));
    need(request.taskId === id && request.contractSha256 === frozen.contractSha256, `Request identity/contract mismatch: ${id}`);
    need(systemSha256 === request.systemSha256 && promptSha256 === request.promptSha256, `Prompt/system changed: ${id}`);
    for (const key of ['promptSourceSha256', 'materializerCodeSha256', 'scorerCodeSha256']) need(request[key] === frozen[key], `Request frozen source mismatch: ${id}/${key}`);
    const start = snapshot.events.find(event => event.type === 'start' && event.id === id);
    const finish = snapshot.events.find(event => event.type === 'finish' && event.id === id);
    need(start.requestSha256 === request.taskSha256, `Start request hash mismatch: ${id}`);
    for (const key of ['model', 'effort', 'runtime']) need(start[key] === request[key], `Start provenance mismatch: ${id}/${key}`);
    const validation = read(`${prefix}/validation.json`);
    need(validation.taskId === id && ['valid', 'invalid'].includes(validation.status), `Bad sidecar identity/status: ${id}`);
    for (const key of ['model', 'effort', 'runtime']) need(validation[key] === request[key], `Sidecar provenance mismatch: ${id}/${key}`);
    if (validation.requestSha256 !== undefined) need(validation.requestSha256 === request.taskSha256, `Validation request hash mismatch: ${id}`);
    let record = null, replay = null;
    const responseExists = fs.existsSync(path.join(root, prefix, 'response.json'));
    if (responseExists) {
      const raw = bytes(`${prefix}/response.json`);
      need(hash(raw) === validation.responseSha256 && hash(raw) === finish.responseSha256, `Response changed after validation: ${id}`);
      try { record = JSON.parse(raw); } catch { /* Raw malformed response remains preserved. */ }
      try { replay = validateWorker(raw.toString('utf8'), request, design); }
      catch (error) { replay = {valid:false, errors:[`Malformed record: ${error.message}`], telemetryKnown:false, actionCount:null}; }
      const replayErrors = [...replay.errors];
      if (replay.record && Date.parse(replay.record.startedAt) < Date.parse(start.recordedAt)) replayErrors.push('Worker claims start before coordinator start');
      if (validation.artifactElapsedMs < 0) replayErrors.push('Raw artifact predates coordinator start');
      else if (validation.artifactElapsedMs > request.timeoutSeconds * 1000) replayErrors.push('Raw artifact arrived after coordinator deadline');
      assert.deepEqual(replayErrors, validation.errors, `Validation errors changed on replay: ${id}`);
      need(validation.valid === (replayErrors.length === 0) && validation.status === (validation.valid ? 'valid' : 'invalid'), `Validation status changed: ${id}`);
      need(replay.telemetryKnown === validation.telemetryKnown && replay.actionCount === validation.actionCount, `Telemetry changed on replay: ${id}`);
      need(validation.coordinatorStartedAt === start.recordedAt, `Coordinator start changed: ${id}`);
      need(validation.coordinatorDeadline === new Date(Date.parse(start.recordedAt) + request.timeoutSeconds * 1000).toISOString(), `Coordinator deadline changed: ${id}`);
      records.set(id, record);
    } else {
      need(finish.validationStatus === 'missing' && validation.telemetryKnown === false && validation.responseSha256 === undefined, `Missing response sidecar mismatch: ${id}`);
    }
    const knownActions = validation.telemetryKnown ? validation.actionCount : null;
    const charged = knownActions ?? request.maxActions;
    need(validation.budgetChargeActions === charged, `Sidecar charge differs: ${id}`);
    if (knownActions === null) need(finish.actual === null, `Unknown activity charged as known: ${id}`);
    else need(finish.actual?.referenceActions === knownActions && finish.validationStatus === validation.status, `Finish charge/status mismatch: ${id}`);
    const envelopeFiles = fs.readdirSync(path.join(root, prefix)).filter(file => file.startsWith('delivery')).sort();
    for (const file of envelopeFiles) bytes(`${prefix}/${file}`);
    const envelopeMetadata = envelopeFiles.filter(file => /^delivery-v\d+\.json$/.test(file)).map(file => read(`${prefix}/${file}`));
    for (const item of envelopeMetadata) need(item.taskId === id && item.sha256 === artifacts[`${prefix}/delivery-v${item.version}.txt`]?.sha256, `Envelope mismatch: ${id}`);
    tasks.push({taskId:id, role:request.role, cityId:request.cityId ?? null, status:validation.status, terminalStatus:validation.terminalStatus ?? finish.validationStatus,
      responsePresent:responseExists, validationErrorCount:validation.errors.length, validationErrorCounts:counts(validation.errors),
      validationArtifact:`${prefix}/validation.json`, responseArtifact:responseExists ? `${prefix}/response.json` : null,
      requestSha256:request.taskSha256, sidecarRequestHashPresent:validation.requestSha256 !== undefined,
      rawReportedActionCount:Array.isArray(record?.actions) ? record.actions.length : null,
      knownReportedActions:knownActions, referenceActionsCharged:charged, conservativeUnknownActionsCharge:knownActions === null ? charged : 0,
      reportedActionTypes:counts((record?.actions ?? []).map(action => action.type)), reportedActionOutcomes:counts((record?.actions ?? []).map(action => action.outcome)),
      rawRowCount:Array.isArray(record?.rows) ? record.rows.length : 0, rawAggregateCount:Array.isArray(record?.aggregates) ? record.aggregates.length : 0,
      rawDisputeCount:Array.isArray(record?.disputes) ? record.disputes.length : 0, envelopeVersions:envelopeMetadata.map(item => item.version)});
    if (request.role !== 'review') {
      rawDisputes.push(...(record?.disputes ?? []).map(dispute => ({taskId:id, disputeId:dispute.id})));
      if (validation.status === 'valid') { validRows.push(...(record?.rows ?? [])); validAggregates.push(...(record?.aggregates ?? [])); }
    }
  }
  const ledger = read(`${target}/aggregate-ledger.json`), selection = read(`${target}/review-selection.json`);
  need(selection.aggregateLedgerSha256 === artifacts[`${target}/aggregate-ledger.json`].sha256, 'Review ledger hash mismatch');
  need(selection.contractSha256 === frozen.contractSha256 && ledger.contractSha256 === frozen.contractSha256, 'Review contract mismatch');
  const selected = selectReview(ledger.rows, ledger.aggregates, ledger.disputes, design.reviewSampling);
  for (const [key, value] of Object.entries(selected)) assert.deepEqual(selection[key], value, `Review selection changed: ${key}`);
  const accepted = validAggregates.filter(primary);
  need(selection.acceptedAggregates === accepted.length, 'Review denominator includes excluded/invalid aggregates');
  for (const sourceMap of [ledger.sourceResponses, selection.sourceResponses]) for (const [id, digest] of Object.entries(sourceMap)) need(digest === artifacts[`${target}/tasks/${id}/response.json`]?.sha256, `Review source changed: ${id}`);
  const assigned = selection.disputes.map(dispute => dispute.id), rawDisputeIds = rawDisputes.map(dispute => dispute.disputeId);
  assert.deepEqual([...assigned].sort(), [...rawDisputeIds].sort(), 'Raw disputes differ from assigned disputes');
  const diagnostics = selection.excludedDiagnosticIds ?? [];
  for (const item of diagnostics) {
    need(tasks.find(task => task.taskId === item.taskId)?.status === 'invalid', 'Diagnostic task is not invalid');
    for (const id of item.aggregateIds) need(!accepted.some(aggregate => aggregate.aggregateId === id), 'Diagnostic aggregate entered primary denominator');
    const original = records.get(item.taskId);
    for (const id of item.aggregateIds) assert.deepEqual(ledger.aggregates.find(aggregate => aggregate.aggregateId === id), original.aggregates.find(aggregate => aggregate.aggregateId === id), 'Diagnostic aggregate changed');
    for (const id of item.rowIds) assert.deepEqual(ledger.rows.find(row => row.id === id), original.rows.find(row => row.id === id), 'Diagnostic row changed');
  }
  const reviewRequest = read(`${target}/tasks/review-feasibility/request.json`);
  need(reviewRequest.selectionSha256 === artifacts[`${target}/review-selection.json`].sha256, 'Review request selection hash mismatch');
  for (const [key, value] of Object.entries(selected)) assert.deepEqual(reviewRequest[key], value, `Review assignment differs: ${key}`);
  const review = records.get('review-feasibility'), reviewTask = tasks.find(task => task.role === 'review');
  const hotels = validRows.filter(row => row.measure === 'hotel_3star_2p'), eligibleHotels = hotels.filter(row => exactDateHotel(row, design.window));
  const collectors = tasks.filter(task => task.role !== 'review'), menuTasks = tasks.filter(task => task.role === 'menu');
  const knownNew = sum(tasks.map(task => task.knownReportedActions ?? 0)), unknownNew = sum(tasks.map(task => task.conservativeUnknownActionsCharge));
  need(state.used.referenceActions === prior.referenceActions + knownNew + unknownNew, 'Reference cumulative charge mismatch');
  need(state.used.referenceWorkerInvocations === prior.referenceCalls + tasks.length, 'Reference invocation charge mismatch');
  const supporting = ['serialization-errata.json', 'runtime-failures.json', 'review-execution-errata.json'];
  for (const name of supporting) if (fs.existsSync(path.join(root, target, name))) bytes(`${target}/${name}`);
  const inputArtifacts = Object.fromEntries(Object.entries(artifacts).sort(([a], [b]) => a.localeCompare(b)));
  return {schemaVersion:1, kind:'offline_pre_assessment_execution_snapshot', target, asOfBudgetSequence:snapshot.events.length,
    asOfBudgetRecordedAt:snapshot.events.at(-1).recordedAt, auditCodeSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),
    frozenVerification:verified, frozenSourceCodeSha256:frozen.sourceCodeSha256, inputArtifacts,
    budgetSnapshot:{journalArtifact:`${target}/budget.jsonl`, prefixByteLength:snapshot.bytes.length, prefixSha256:hash(snapshot.bytes), eventCount:snapshot.events.length,
      limits:plan.limits, state, referenceAccounting:{priorKnownActions:prior.referenceActions, newKnownReportedActions:knownNew, newConservativeUnknownCharge:unknownNew,
        cumulativeKnownReportedActions:prior.referenceActions + knownNew, cumulativeChargedActions:state.used.referenceActions},
      priorEstimateRetrievalAccounting:{knownReportedActions:prior.estimateActionsKnown, conservativeUnknownCharge:design.resources.unknownCharge.estimateRetrievalActions,
        chargedTotal:prior.estimateActionsKnown + design.resources.unknownCharge.estimateRetrievalActions, unknownRunIds:prior.unknownEstimateActionRuns,
        limitation:'Unknown accounting charge is neither observed usage nor a proven upper bound; true old cumulative telemetry remains unresolved.'}},
    taskCounts:{total:tasks.length, collectors:collectors.length, validRecords:tasks.filter(task => task.status === 'valid').length,
      invalidRecords:tasks.filter(task => task.status === 'invalid').length, invalidReturnedRecords:tasks.filter(task => task.status === 'invalid' && task.responsePresent).length,
      missingResponseArtifacts:tasks.filter(task => !task.responsePresent).length}, tasks,
    primaryMealCoverage:{validEligibleCompleteAggregates:accepted.length, cityCount:unique(accepted.map(item => item.cityId)).length,
      cityIds:unique(accepted.map(item => item.cityId)).sort(), aggregateIds:accepted.map(item => item.aggregateId).sort(),
      pilotCities:design.pilotCities.map(cityId => ({cityId, menuTaskStatus:menuTasks.find(task => task.cityId === cityId).status,
        responsePresent:menuTasks.find(task => task.cityId === cityId).responsePresent, validPrimaryAggregates:accepted.filter(item => item.cityId === cityId).length}))},
    hotels:{validRecordRows:hotels.length, recordedExactDateEligibleRows:eligibleHotels.length, rowIds:eligibleHotels.map(row => row.id),
      predicate:'Valid collector record, hotel measure, eligible observed offer, complete normalization, dated requested ISO start/end, two adults, one room, one or three nights, public non-member, no conditional discount. Recorded fields only; no new scientific certification.'},
    review:{status:reviewTask.status, responsePresent:reviewTask.responsePresent, validationArtifact:reviewTask.validationArtifact,
      primarySamplingDenominator:selection.acceptedAggregates, randomSampleCount:selection.randomSampleCount, sampledAggregateIds:selection.sampledAggregateIds,
      requiredAggregateIds:selection.requiredAggregateIds, requiredRowIds:selection.requiredRowIds, urlCount:selection.urls.length,
      excludedDiagnosticAggregateCount:sum(diagnostics.map(item => item.aggregateIds.length)), excludedDiagnosticRowCount:unique(diagnostics.flatMap(item => item.rowIds)).length,
      excludedDiagnostics:diagnostics, rawCollectorDisputeCount:rawDisputes.length, assignedDisputeCount:assigned.length, rawCollectorDisputes:rawDisputes, assignedDisputeIds:assigned,
      rowOutcomeCounts:counts((review?.reviewedRows ?? []).map(row => row.verdict)), aggregateOutcomeCounts:counts((review?.reviewedAggregates ?? []).map(item => item.verdict)),
      unresolvedRowIds:review?.unresolvedRowIds ?? [], aggregateOutcomes:(review?.reviewedAggregates ?? []).map(({aggregateId, verdict, reason, enumerationComplete, amountsVerified, feeBasisVerified}) => ({aggregateId, verdict, reason, enumerationComplete, amountsVerified, feeBasisVerified})),
      disputeOutcomes:review?.disputes ?? [], outcomesAdmission:reviewTask.status === 'valid' ? 'Validated diagnostic outcomes; excluded collectors remain excluded.' : 'Invalid/missing review outcomes are reported for audit only.'},
    limitations:['Execution/accounting snapshot only; no point estimates, scores, calibration, accuracy gains or scientific verdicts generated.',
      'Invalid or missing menu records do not establish absence of public menus.', 'Excluded diagnostic review cannot promote original invalid records or enter the primary denominator.',
      'This immutable pre-assessment budget snapshot excludes later assessment accounting; replay verifies its exact original prefix and validates later journal entries separately.']};
}

export function selfTest() {
  const opening = {sequence:1, type:'opening', consumed:{actions:1}};
  const encoded = Buffer.from(JSON.stringify(opening)+'\n'+JSON.stringify({sequence:2,type:'reserve',id:'protected-test',resources:{actions:2}})+'\n');
  assert.equal(budgetPrefix(encoded, 1).events.length, 1);
  assert.equal(hash(budgetPrefix(encoded, 1).bytes), hash(Buffer.from(JSON.stringify(opening)+'\n')));
  assert.throws(() => budgetPrefix(encoded, 3), /shorter/);
  assertTerminal([{type:'start',id:'task'}, {type:'finish',id:'task'}], {started:[],pending:['protected-test']}, ['task']);
  assert.throws(() => assertTerminal([], {started:['task'],pending:[]}, []), /Live/);
  assert.throws(() => assertTerminal([{type:'start',id:'task'}], {started:[],pending:[]}, ['task']), /not terminal/);
  assert.throws(() => assertTerminal([], {started:[],pending:['menu-unstarted']}, []), /Unstarted reference/);
  const window = {stayStart:'2026-11-17',stayEndExclusive:'2026-11-20',adults:2,nights:3};
  const row = {measure:'hotel_3star_2p',eligibility:'eligible',evidenceClass:'observed_offer',normalizationStatus:'complete',datedStatus:'dated',taxBasis:'included',applicableDate:'2026-11-17 to 2026-11-20',transaction:{people:2,rooms:1,nights:3},publicNonMemberRate:true};
  assert.equal(exactDateHotel(row, window), true);
  for (const patch of [{applicableDate:null},{eligibility:'uncertain'},{normalizationStatus:'missing'},{conditionalDiscount:true},{publicNonMemberRate:false},{transaction:{people:1,rooms:1,nights:3}}]) assert.equal(exactDateHotel({...row,...patch},window),false);
  assert.equal(primary({measure:'inexp_meal_1p',provisionalEligibility:'uncertain',normalizationStatus:'missing'}),false);
  return {status:'passed',checks:14};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const mode = process.argv[2] ?? '--check';
    need(['--check','--write','--replay','--self-test'].includes(mode), 'Use --check, --write, --replay or --self-test');
    if (mode === '--self-test') console.log(canonical(selfTest()));
    else {
      const saved = mode === '--replay' ? fs.readFileSync(path.join(root, output)) : null;
      const priorSummary = saved ? JSON.parse(saved) : null;
      const summary = audit({snapshotEventCount:priorSummary?.budgetSnapshot.eventCount ?? null});
      const rendered = Buffer.from(canonical(summary));
      if (saved) need(saved.equals(rendered), 'Immutable summary bytes differ on replay');
      if (mode === '--write') writeOnce(root, output, rendered.toString('utf8'));
      console.log(canonical({status:mode === '--replay' ? 'immutable_bytes_verified' : mode === '--write' ? 'written_once' : 'checked_without_summary_write',
        summarySha256:hash(rendered), budgetSequence:summary.asOfBudgetSequence, taskCounts:summary.taskCounts,
        primaryMealCoverage:summary.primaryMealCoverage, referenceAccounting:summary.budgetSnapshot.referenceAccounting,
        reviewStatus:summary.review.status, reviewDisputes:summary.review.assignedDisputeCount}));
    }
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
