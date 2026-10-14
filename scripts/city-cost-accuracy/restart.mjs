import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { hash, safePath, writeOnce } from './core.mjs';
import { appendBudget, replayBudget } from './budget.mjs';
import { normalizeFees } from './fees.mjs';

// Offline, coordinator-only preparation/accounting. Never imports a provider or DB service.
export const AUTHORIZED_REPO = 'C:\\Users\\chawi\\.codex\\worktrees\\city-cost-accuracy\\holiday-spend';
const here = fileURLToPath(import.meta.url);
const SOURCE_PATHS = ['scripts/city-cost-accuracy/restart.mjs', 'scripts/city-cost-accuracy/core.mjs',
  'scripts/city-cost-accuracy/budget.mjs', 'scripts/city-cost-accuracy/fees.mjs', 'scripts/city-cost-accuracy/summarize.mjs',
  'src/lib/city-generation.ts', 'src/lib/city-cost-methodology-v1-1.ts'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const iso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const text = value => typeof value === 'string' && value.trim().length > 0;
const url = value => { try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; } };
const requireThat = (condition, message) => { if (!condition) throw Error(message); };
const exactKeys = (value, required, optional = []) => object(value) && required.every(key => Object.hasOwn(value, key)) &&
  Object.keys(value).every(key => [...required, ...optional].includes(key));
const integer = value => Number.isSafeInteger(value) && value >= 0;
const canonical = value => JSON.stringify(value, null, 2) + '\n';
const taskId = id => { requireThat(/^[a-z0-9-]+$/.test(id), 'Invalid task identifier'); return id; };

export function expand(template, values) {
  let result = template;
  for (const [key, value] of Object.entries(values)) result = result.split(`{{${key}}}`).join(String(value));
  requireThat(!/\{\{[^}]+\}\}/.test(result), 'Unexpanded prompt placeholder');
  return result;
}

export function validateContract(design, manifest, audit) {
  requireThat(design.status === 'coordinator_validated' && design.coordinatorValidation?.validated === true &&
    iso(design.coordinatorValidation.validatedAt) && text(design.coordinatorValidation.validatedBy), 'Contract needs explicit coordinator validation');
  requireThat(design.schemaVersion === 1 && design.programRevision === 'restart-1', 'Expected separate restart-1 contract');
  const selected = design.workerSelection;
  requireThat(selected?.model === 'gpt-6-luna' && selected.effort === 'max' && selected.runtime === 'Codex subagent', 'Unsupported selected collector provenance');
  const cities = manifest.cities.filter(city => city.pilot && city.split === 'development');
  requireThat(JSON.stringify(cities.map(city => city.id)) === JSON.stringify(design.pilotCities), 'Pilot identity/order differs from manifest');
  const allocation = design.feasibility.allocation;
  requireThat(allocation.menuWorkers === 6 && allocation.menuActionsEach === 4 && allocation.hotelWorkers === 3 &&
    allocation.hotelActionsEach === 2 && allocation.reviewWorkers === 1 && allocation.reviewActions === 10 &&
    allocation.totalActions === 40 && allocation.totalWorkerInvocations === 10 && allocation.automaticRetries === 0, 'Unexpected feasibility allocation');
  requireThat(allocation.hotelCities.length === 3 && new Set(allocation.hotelCities).size === 3 &&
    allocation.hotelCities.every(id => cities.some(city => city.id === id)), 'Invalid hotel probes');
  const sampling = { unit: 'primary_meal_aggregate', fraction: 0.2,
    hashPrefix: 'restart-1-review|', idRule: 'CITY_ID/VENUE_RANK/inexp_meal_1p',
    acceptedPredicate: 'measure=inexp_meal_1p and provisionalEligibility=eligible and normalizationStatus=complete',
    grouping: 'sourceUrl', sourceOrder: 'lexical' };
  requireThat(exactKeys(design.reviewSampling, Object.keys(sampling)) && Object.entries(sampling).every(([key, value]) => design.reviewSampling[key] === value), 'Unsupported machine review rule');
  const known = design.resources.known;
  for (const [key, auditKey] of Object.entries({ estimateInvocations: 'estimateCalls', referenceActions: 'referenceActions',
    referenceWorkerInvocations: 'referenceCalls', recordedEstimateActions: 'estimateActionsKnown' })) {
    requireThat(known[key] === audit[auditKey], `Prior balance mismatch: ${key}`);
  }
  requireThat(integer(known.designInvocationsIncludingThis) && known.designInvocationsIncludingThis >= audit.designCallsAtRestart, 'Design calls undercount prior work');
  requireThat(design.resources.unknownCharge.estimateRetrievalActions >= 8 && design.resources.unknownCharge.estimateInvocationHeadroom >= 1,
    'Unknown prior telemetry/headroom cannot disappear');
  requireThat(design.resources.hard.confirmationEstimateReserve === 100 && design.confirmation.reserveEstimateCalls === 100, 'Confirmation reserve must remain 100');
  requireThat(integer(design.resources.designAssessmentReserveCalls) && design.resources.designAssessmentReserveCalls >= 5, 'Need machine-readable future design assessment reserve (at least 5)');
  for (const key of ['collectorSystem', 'collectorUserTemplate', 'reviewSystem', 'reviewUserTemplate']) requireThat(text(design.prompts[key]), `Missing ${key}`);
  requireThat(object(design.definitions) && Array.isArray(design.schemas.referenceRecord.required) &&
    Array.isArray(design.schemas.referenceRecord.rowRequired), 'Missing frozen schemas/definitions');
  // Dry-run the complete reservations before any write or dispatch.
  const plan = budgetPlan(design);
  replayBudget(plan.events.map((event, index) => ({ ...event, sequence: index + 1 })), plan.limits);
  return cities;
}

export function budgetPlan(design) {
  const { hard, known, unknownCharge, referenceSchedule: refs, referenceWorkerSchedule: workers, estimateSchedule: estimates } = design.resources;
  const keys = ['estimateInvocations', 'referenceActions', 'referenceWorkerInvocations', 'estimateRetrievalActions', 'designInvocations', 'candidateAttempts', 'fullExtensions'];
  const limits = Object.fromEntries(keys.map(key => { requireThat(integer(hard[key]), `Invalid hard cap ${key}`); return [key, hard[key]]; }));
  const events = [{ type: 'opening', consumed: { estimateInvocations: known.estimateInvocations,
    referenceActions: known.referenceActions, referenceWorkerInvocations: known.referenceWorkerInvocations,
    estimateRetrievalActions: known.recordedEstimateActions + unknownCharge.estimateRetrievalActions,
    designInvocations: known.designInvocationsIncludingThis }, note: 'Known prior use plus explicit unknown-action accounting charge; true old cumulative telemetry remains unresolved.' }];
  const reserve = (id, resources) => events.push({ type: 'reserve', id, resources });
  requireThat(estimates.confirmationExclusive === hard.confirmationEstimateReserve, 'Confirmation schedule mismatch');
  for (const [key, calls] of Object.entries(estimates)) {
    if (['prior', 'totalReserved', 'unallocatedDevelopment'].includes(key)) continue;
    requireThat(integer(calls), `Invalid estimate reservation ${key}`);
    reserve(`protected-estimate-${key.toLowerCase()}`, { estimateInvocations: calls, estimateRetrievalActions: calls * 3 });
  }
  requireThat(estimates.unknownHeadroom >= unknownCharge.estimateInvocationHeadroom, 'Missing unknown invocation headroom');
  const refGroups = [ ['development', 'remainingDevelopmentAcquisitionReview', 'development'],
    ['confirmation', 'confirmationAcquisitionReview', 'confirmation'], ['fx', 'fxVerification', 'fx'],
    ['dispute-failure', 'disputeFailureReserve', 'disputeFailure'], ['unallocated', 'unallocated', 'unallocated'] ];
  for (const [id, actionKey, callKey] of refGroups) {
    requireThat(integer(refs[actionKey]) && integer(workers[callKey]), `Missing reference reserves ${id}`);
    reserve(`protected-reference-${id}`, { referenceActions: refs[actionKey], referenceWorkerInvocations: workers[callKey] });
  }
  requireThat(refs.feasibility === 40 && workers.feasibility === 10, 'Feasibility schedule mismatch');
  for (const id of design.pilotCities) reserve(`menu-${id}`, { referenceActions: 4, referenceWorkerInvocations: 1 });
  for (const id of design.feasibility.allocation.hotelCities) reserve(`hotel-${id}`, { referenceActions: 2, referenceWorkerInvocations: 1 });
  reserve('review-feasibility', { referenceActions: 10, referenceWorkerInvocations: 1 });
  reserve('protected-design-assessments', { designInvocations: design.resources.designAssessmentReserveCalls });
  return { limits, events };
}

export function collectorTask(design, city, kind) {
  const id = `${kind}-${city.id}`, actions = kind === 'menu' ? 4 : 2;
  const selection = expand(design.feasibility[kind === 'menu' ? 'menuSelection' : 'hotelSelection'], { CITY: city.name, COUNTRY: city.country });
  const prompt = expand(design.prompts.collectorUserTemplate, { TASK_ID: id, CITY_ID: city.id, CITY: city.name, COUNTRY: city.country,
    MENU_OR_HOTEL: kind, EXACT_DEFINITIONS_OBJECT: JSON.stringify(design.definitions, null, 2),
    EXACT_MENU_OR_HOTEL_SELECTION_STRING: selection, '4_OR_2': actions,
    EXACT_FEE_NORMALIZATION_OBJECT: JSON.stringify(design.feeNormalization, null, 2) });
  const system = design.prompts.collectorSystem;
  const queryMatch = selection.match(/Query exactly: ([\s\S]*?)\. Record ranked results|query exactly: ([\s\S]*?)\. Open first/);
  requireThat(queryMatch, 'Selection must declare its exact query');
  return { system, prompt, request: { taskId: id, cityId: city.id, cityName: city.name, country: city.country, role: kind,
    ...design.workerSelection, maxActions: actions, maxInvocations: 1, timeoutSeconds: design.resources.hard.workerTimeoutSeconds,
    exactQuery: queryMatch[1] ?? queryMatch[2], schema: design.schemas.referenceRecord,
    aggregateSchema: design.schemas.aggregateRecord, disputeSchema: design.schemas.disputeRecord,
    actionSchema: design.schemas.provenance.action, promptSha256: hash(prompt), systemSha256: hash(system),
    referenceWindow: design.window, retrievalPolicy: 'one search then ranked original-source opens; no retries',
    provenanceAuthority: 'Coordinator-selected metadata, not independent worker attestation' } };
}

export function validateActions(actions, request, startedAt, finishedAt) {
  const errors = [];
  if (!Array.isArray(actions)) return { valid: false, errors: ['Missing action telemetry'], count: null };
  if (!iso(startedAt) || !iso(finishedAt) || Date.parse(finishedAt) < Date.parse(startedAt)) errors.push('Action telemetry lacks a valid worker interval');
  if (actions.length > request.maxActions) errors.push('Retrieval action cap exceeded');
  for (const [index, action] of actions.entries()) {
    if (!exactKeys(action, ['ordinal', 'type', 'query', 'url', 'startedAt', 'outcome']) || action.ordinal !== index + 1 ||
      !['search', 'open', 'click'].includes(action.type) || !['success', 'blocked', 'error', 'timeout'].includes(action.outcome) ||
      !(action.query === null || text(action.query)) || !(action.url === null || url(action.url)) || !iso(action.startedAt) ||
      Date.parse(action.startedAt) < Date.parse(startedAt) || Date.parse(action.startedAt) > Date.parse(finishedAt)) errors.push(`Invalid action ${index + 1}`);
    if (action.type === 'search' && (!text(action.query) || action.url !== null)) errors.push(`Invalid search ${index + 1}`);
    if (['open', 'click'].includes(action.type) && (!url(action.url) || action.query !== null)) errors.push(`Invalid open/click ${index + 1}`);
  }
  return { valid: !errors.length, errors, count: errors.length ? null : actions.length };
}

export function artifactDeadline(startedAt, modifiedMs, timeoutSeconds) {
  const artifactElapsedMs = modifiedMs - Date.parse(startedAt);
  return { artifactElapsedMs, valid: Number.isFinite(artifactElapsedMs) && artifactElapsedMs >= 0 && artifactElapsedMs <= timeoutSeconds * 1000,
    error: artifactElapsedMs < 0 ? 'Raw artifact predates coordinator start' : 'Raw artifact arrived after coordinator deadline',
    terminalStatus: artifactElapsedMs < 0 ? 'invalid' : 'timeout' };
}

export function validateWorker(raw, request, design) {
  const errors = [];
  let record;
  try { record = JSON.parse(raw); } catch { return { valid: false, errors: ['Response is not valid JSON'], telemetryKnown: false, actionCount: null }; }
  const fail = (condition, message) => { if (!condition) errors.push(message); };
  const review = request.role === 'review';
  const schema = review ? design.schemas.reviewRecord : design.schemas.referenceRecord;
  fail(exactKeys(record, schema.required), 'Top-level fields do not match frozen record schema');
  if (!object(record)) return { valid: false, errors, telemetryKnown: false, actionCount: null };
  for (const key of ['taskId', 'model', 'effort', 'runtime']) fail(record[key] === request[key], `Provenance mismatch: ${key}`);
  for (const [key, expected] of Object.entries({ taskSha256: request.taskSha256, systemSha256: request.systemSha256,
    userSha256: request.promptSha256, protocolSha256: request.contractSha256 })) fail(record[key] === expected, `Provenance hash mismatch: ${key}`);
  fail(record.tokenUsage === null || object(record.tokenUsage), 'Invalid token usage; unavailable must be null');
  fail(record.failureReason === null || text(record.failureReason), 'Invalid failure reason');
  if (!review) fail(record.cityId === request.cityId, 'Wrong cityId');
  fail(iso(record.startedAt) && iso(record.finishedAt) && Date.parse(record.finishedAt) >= Date.parse(record.startedAt) &&
    Date.parse(record.finishedAt) - Date.parse(record.startedAt) <= request.timeoutSeconds * 1000, 'Invalid worker timestamps or timeout');
  const actions = validateActions(record.actions, request, record.startedAt, record.finishedAt);
  errors.push(...actions.errors);
  fail(record.searchCount === record.actions?.filter?.(action => action.type === 'search').length &&
    record.retrievalCount === record.actions?.length, 'Action count telemetry mismatch');
  if (review) {
    fail(Array.isArray(record.reviewedRows) && Array.isArray(record.unresolvedRowIds), 'Invalid review arrays');
    const expected = new Set(request.requiredRowIds), seen = new Set();
    for (const row of record.reviewedRows ?? []) {
      fail(exactKeys(row, ['rowId', 'verdict', 'reason', 'sourceUrl', 'excerpt', 'correctedObservedFields']), 'Invalid review-row schema');
      fail(expected.has(row.rowId) && !seen.has(row.rowId), 'Unexpected or duplicate reviewed row'); seen.add(row.rowId);
      fail(['verified', 'factual_correction', 'ineligible', 'unresolved'].includes(row.verdict) && text(row.reason) && url(row.sourceUrl) && typeof row.excerpt === 'string', 'Invalid review verdict/evidence');
      fail(request.rows.find(item => item.id === row.rowId)?.sourceUrl === row.sourceUrl, 'Review changed assigned source');
      const correctionKeys = ['amount', 'listedAmount', 'listedUnit', 'currency', 'unit', 'servingSize', 'applicableDate', 'datedStatus', 'taxBasis', 'inclusions',
        'transaction', 'mandatoryChargeStatus', 'charges', 'allMandatoryChargesDocumented', 'normalizationStatus', 'normalizationReason'];
      fail(row.correctedObservedFields === null || (object(row.correctedObservedFields) && Object.keys(row.correctedObservedFields).every(key => correctionKeys.includes(key))), 'Unsupported correction fields');
      fail(row.verdict === 'factual_correction' ? object(row.correctedObservedFields) : row.correctedObservedFields === null, 'Correction/verdict mismatch');
    }
    fail((record.unresolvedRowIds ?? []).every(id => expected.has(id)) && new Set(record.unresolvedRowIds ?? []).size === (record.unresolvedRowIds ?? []).length, 'Invalid unresolved IDs');
    for (const id of expected) fail(seen.has(id) || record.unresolvedRowIds?.includes(id), `Missing required review row ${id}`);
    fail(record.samplingDenominator === request.acceptedAggregates && JSON.stringify(record.selectedAggregateIds) === JSON.stringify(request.sampledAggregateIds), 'Review sampling registration changed');
    fail(Array.isArray(record.reviewedAggregates) && Array.isArray(record.disputes), 'Missing aggregate/dispute adjudication');
    const reviewedAggregateIds = new Set();
    for (const aggregate of record.reviewedAggregates ?? []) {
      const assigned = request.aggregates.find(item => item.aggregateId === aggregate.aggregateId);
      fail(exactKeys(aggregate, ['aggregateId', 'constituentAtomicRowIds', 'enumerationComplete', 'amountsVerified', 'feeBasisVerified', 'verdict', 'reason', 'sourceUrl']) && assigned &&
        !reviewedAggregateIds.has(aggregate.aggregateId), 'Invalid or unassigned reviewed aggregate');
      reviewedAggregateIds.add(aggregate.aggregateId);
      fail(JSON.stringify(aggregate.constituentAtomicRowIds) === JSON.stringify(assigned?.constituentAtomicRowIds), 'Review lost constituent rows');
      fail(['verified', 'factual_correction', 'ineligible', 'unresolved'].includes(aggregate.verdict) && text(aggregate.reason) &&
        aggregate.sourceUrl === assigned?.sourceUrl, 'Invalid aggregate verdict');
      if (aggregate.verdict === 'verified') fail(aggregate.enumerationComplete === true && aggregate.amountsVerified === true && aggregate.feeBasisVerified === true,
        'Verified aggregate needs complete enumeration/amount/fee checks');
      for (const key of ['enumerationComplete', 'amountsVerified', 'feeBasisVerified']) fail(typeof aggregate[key] === 'boolean', 'Aggregate checks must be boolean');
    }
    for (const aggregate of request.aggregates) fail(reviewedAggregateIds.has(aggregate.aggregateId), `Missing aggregate adjudication ${aggregate.aggregateId}`);
    const expectedDisputes = new Set(request.disputes.map(item => item.id));
    fail(record.disputes.length === expectedDisputes.size && record.disputes.every(item => expectedDisputes.has(item.id) &&
      ['verified', 'factual_correction', 'ineligible', 'unresolved'].includes(item.verdict) && text(item.reason)), 'Every genuine dispute needs adjudication');
    const opened = (record.actions ?? []).map(action => action.url);
    fail((record.actions ?? []).every(action => action.type === 'open') && opened.every((value, index) => value === request.urls[index]), 'Review must open URLs in frozen lexical order');
    for (const row of record.reviewedRows ?? []) if (row.verdict !== 'unresolved') fail((record.actions ?? []).some(action => action.url === row.sourceUrl && action.outcome === 'success'), 'Resolved verdict without successful underlying-source open');
  } else {
    fail(['success', 'failed', 'timeout'].includes(record.status), 'Invalid terminal status');
    fail(Array.isArray(record.rankedResults) && Array.isArray(record.rows) && Array.isArray(record.missingMeasures), 'Invalid reference arrays');
    const results = Array.isArray(record.rankedResults) ? record.rankedResults : [];
    fail(results.every((result, index) => exactKeys(result, ['rank', 'title', 'url', 'eligibilityReason']) && Number.isSafeInteger(result.rank) && result.rank > 0 &&
      (index === 0 || result.rank > results[index - 1].rank) && url(result.url) && text(result.title) && text(result.eligibilityReason)), 'Invalid ranked results');
    const search = (record.actions ?? [])[0];
    fail(!search || (search.type === 'search' && search.query === request.exactQuery), 'First action must use frozen exact search query');
    const opens = (record.actions ?? []).slice(1);
    fail(opens.every(action => action.type === 'open'), 'Only ranked source opens may follow search');
    const ranks = opens.map(action => results.find(result => result.url === action.url)?.rank);
    fail(ranks.every((rank, index) => rank !== undefined && (index === 0 || rank > ranks[index - 1])), 'Opened sources must be distinct ranked results in rank order');
    const ids = new Set(), excerpts = new Map();
    for (const row of record.rows ?? []) {
      fail(exactKeys(row, schema.rowRequired, schema.rowOptional ?? []), 'Reference row differs from frozen field schema');
      const pattern = new RegExp(`^${request.cityId}/[1-9][0-9]*/[a-z0-9_]+/[1-9][0-9]*$`);
      fail(text(row.id) && pattern.test(row.id) && !ids.has(row.id), 'Invalid or duplicate atomic row ID'); ids.add(row.id);
      fail(row.id === `${request.cityId}/${row.selectionRank}/${row.measure}/${row.id?.split('/').at(-1)}`, 'Row ID rank/measure differs');
      fail(text(row.venueId) && text(row.venueName) && typeof row.independentOperator === 'boolean' &&
        text(row.measure) && text(row.itemLabel) && text(row.reason), 'Missing identity/eligibility reason');
      fail(row.amount === null || (Number.isFinite(row.amount) && row.amount > 0), 'Invalid unconverted amount');
      fail(/^[A-Z]{3}$/.test(row.currency ?? '') && (row.unit === null || text(row.unit)) && (row.servingSize === null || text(row.servingSize)), 'Invalid currency/unit/serving');
      fail(['observed_offer', 'published_statistic', 'proxy', 'missing'].includes(row.evidenceClass) &&
        ['eligible', 'ineligible', 'uncertain'].includes(row.eligibility) && ['dated', 'current_undated', 'stale', 'unknown'].includes(row.datedStatus) &&
        ['included', 'excluded_with_documented_fixed_or_percentage_charges', 'unknown'].includes(row.taxBasis), 'Invalid reference enums');
      fail(iso(row.retrievedAt) && (row.applicableDate === null || text(row.applicableDate)) && typeof row.excerpt === 'string' &&
        text(row.geographyEvidence) && (Array.isArray(row.inclusions) || typeof row.inclusions === 'string'), 'Invalid evidence/date/basis fields');
      if (row.amount !== null) fail(url(row.sourceUrl) && text(row.sourceTitle) && text(row.excerpt), 'Numeric quote lacks underlying-source evidence');
      fail(Number.isSafeInteger(row.selectionRank) && row.selectionRank > 0 && results.some(result => result.rank === row.selectionRank && result.url === row.sourceUrl), 'Quote source/rank absent from ranked results');
      fail(opens.some(action => action.url === row.sourceUrl && action.outcome === 'success'), 'Reference row lacks successful underlying-source open');
      fail(row.listedAmount === row.amount && text(row.listedUnit) && Array.isArray(row.charges) && typeof row.allMandatoryChargesDocumented === 'boolean' &&
        ['complete', 'missing'].includes(row.normalizationStatus) && text(row.normalizationReason), 'Invalid source normalization fields');
      const normalized = normalizeFees(row);
      if (row.eligibility === 'eligible') fail(row.evidenceClass === 'observed_offer' && row.amount > 0 && text(row.unit) && row.independentOperator &&
        row.taxBasis !== 'unknown' && normalized.normalizationStatus === 'complete', 'Eligible row lacks required observed/normalized basis');
      fail(row.normalizationStatus === normalized.normalizationStatus, 'Worker normalization completeness differs from deterministic result');
      if (request.role === 'hotel') fail(row.measure === 'hotel_3star_2p', 'Unexpected hotel measure');
      if (request.role === 'menu') fail(['inexp_meal_1p', 'coffee', 'beer', 'cocktail', 'wine_glass', 'midrange_meal_2p'].includes(row.measure), 'Unexpected menu measure');
      const snippets = excerpts.get(row.sourceUrl) ?? new Set(); snippets.add(row.excerpt);
      if (typeof row.sourceBasisEvidence === 'string') snippets.add(row.sourceBasisEvidence);
      excerpts.set(row.sourceUrl, snippets);
      for (const charge of row.charges ?? []) {
        const chargeSnippets = excerpts.get(charge.sourceUrl) ?? new Set();
        if (typeof charge.sourceEvidence === 'string') chargeSnippets.add(charge.sourceEvidence);
        if (typeof charge.orderEvidence === 'string' && charge.orderEvidence !== 'unknown') chargeSnippets.add(charge.orderEvidence);
        excerpts.set(charge.sourceUrl, chargeSnippets);
        fail(opens.some(action => action.url === charge.sourceUrl && action.outcome === 'success'), 'Charge basis requires a counted successful open');
      }
    }
    fail(Array.isArray(record.aggregates) && Array.isArray(record.disputes), 'Missing complete aggregate/dispute ledger');
    const aggregateIds = new Set(), aggregateVenues = new Set();
    for (const aggregate of record.aggregates ?? []) {
      fail(exactKeys(aggregate, ['aggregateId', 'cityId', 'venueId', 'measure', 'constituentAtomicRowIds', 'sourceUrl', 'provisionalEligibility', 'normalizationStatus', 'reason']), 'Invalid aggregate schema');
      fail(aggregate.cityId === request.cityId && aggregate.measure === 'inexp_meal_1p' && !aggregateIds.has(aggregate.aggregateId) && !aggregateVenues.has(aggregate.venueId), 'Invalid/duplicate primary aggregate');
      aggregateIds.add(aggregate.aggregateId); aggregateVenues.add(aggregate.venueId);
      const venueRows = (record.rows ?? []).filter(row => row.venueId === aggregate.venueId && row.measure === 'inexp_meal_1p');
      const constituents = venueRows.filter(row => aggregate.constituentAtomicRowIds?.includes(row.id));
      fail(Array.isArray(aggregate.constituentAtomicRowIds) && new Set(aggregate.constituentAtomicRowIds).size === aggregate.constituentAtomicRowIds.length &&
        constituents.length === aggregate.constituentAtomicRowIds.length && venueRows.filter(row => row.eligibility === 'eligible').every(row => aggregate.constituentAtomicRowIds.includes(row.id)),
        'Aggregate must preserve every eligible same-venue primary row without duplicate/unknown constituents');
      fail(constituents.every(row => row.sourceUrl === aggregate.sourceUrl && `${request.cityId}/${row.selectionRank}/inexp_meal_1p` === aggregate.aggregateId), 'Aggregate must use one ranked original menu source');
      fail(['eligible', 'ineligible', 'uncertain'].includes(aggregate.provisionalEligibility) && ['complete', 'missing'].includes(aggregate.normalizationStatus) && text(aggregate.reason), 'Invalid aggregate eligibility');
      if (aggregate.provisionalEligibility === 'eligible') fail(constituents.length > 0 && aggregate.normalizationStatus === 'complete' && constituents.every(row => row.eligibility === 'eligible' && normalizeFees(row).normalizationStatus === 'complete'), 'Eligible aggregate has unsupported constituent');
    }
    fail(record.aggregates?.length <= (request.role === 'menu' ? 3 : 0), 'More than three selected menu venue aggregates or hotel aggregate present');
    for (const row of record.rows ?? []) if (row.measure === 'inexp_meal_1p' && row.eligibility === 'eligible') fail(aggregateVenues.has(row.venueId), 'Eligible primary item missing from aggregate ledger');
    for (const dispute of record.disputes ?? []) fail(validDispute(dispute, record.rows ?? [], record.aggregates ?? []), 'Invalid genuine-dispute log');
    for (const snippets of excerpts.values()) fail([...snippets].join(' ').trim().split(/\s+/).filter(Boolean).length <= 25, 'Excerpt allowance exceeds 25 words per source');
    for (const missing of record.missingMeasures ?? []) fail(object(missing) && text(missing.measure) && schema.missingReasons.includes(missing.reason), 'Invalid missing-measure reason');
    fail(record.status !== 'success' || record.actions?.length > 0, 'Successful worker cannot omit all actions');
  }
  return { valid: !errors.length, errors, telemetryKnown: actions.valid, actionCount: actions.count,
    terminalStatus: record.status ?? 'review', record: errors.length ? undefined : record };
}

function validDispute(dispute, rows, aggregates) {
  return exactKeys(dispute, ['id', 'aggregateId', 'atomicRowIds', 'sourceUrls', 'competingInterpretations', 'evidence', 'reason']) &&
    text(dispute.id) && (dispute.aggregateId === null || aggregates.some(item => item.aggregateId === dispute.aggregateId)) &&
    Array.isArray(dispute.atomicRowIds) && dispute.atomicRowIds.every(id => rows.some(row => row.id === id)) &&
    Array.isArray(dispute.sourceUrls) && dispute.sourceUrls.length > 0 && dispute.sourceUrls.every(url) &&
    Array.isArray(dispute.competingInterpretations) && dispute.competingInterpretations.length >= 2 && dispute.competingInterpretations.every(text) && text(dispute.evidence) && text(dispute.reason);
}

export function selectReview(rows, aggregates, disputes, sampling) {
  requireThat(new Set(rows.map(row => row.id)).size === rows.length, 'Duplicate IDs across collection tasks');
  requireThat(new Set(aggregates.map(item => item.aggregateId)).size === aggregates.length && new Set(disputes.map(item => item.id)).size === disputes.length, 'Duplicate aggregate/dispute IDs');
  const byId = new Map(rows.map(row => [row.id, row]));
  requireThat(disputes.every(dispute => validDispute(dispute, rows, aggregates)), 'Unknown/malformed genuine dispute');
  const accepted = aggregates.filter(item => item.measure === 'inexp_meal_1p' && item.provisionalEligibility === 'eligible' && item.normalizationStatus === 'complete');
  const ordered = accepted.map(aggregate => ({ aggregate, digest: hash(`${sampling.hashPrefix}${aggregate.aggregateId}`) }))
    .sort((a, b) => a.digest < b.digest ? -1 : a.digest > b.digest ? 1 : a.aggregate.aggregateId < b.aggregate.aggregateId ? -1 : 1);
  const count = Math.ceil(sampling.fraction * accepted.length), sampled = ordered.slice(0, count).map(item => item.aggregate.aggregateId);
  const requiredAggregateIds = [...new Set([...sampled, ...disputes.map(item => item.aggregateId).filter(Boolean)])];
  const selectedAggregates = requiredAggregateIds.map(id => aggregates.find(item => item.aggregateId === id));
  const selectedIds = [...new Set([...selectedAggregates.flatMap(item => item.constituentAtomicRowIds), ...disputes.flatMap(item => item.atomicRowIds)])];
  requireThat(selectedIds.every(id => byId.has(id)), 'Aggregate references unknown atomic row');
  // Explicit whitelist masks any accidental predictions or candidate metadata.
  const fields = ['id', 'venueId', 'venueName', 'independentOperator', 'measure', 'itemLabel', 'amount', 'currency', 'unit', 'servingSize',
    'sourceUrl', 'sourceTitle', 'retrievedAt', 'applicableDate', 'datedStatus', 'excerpt', 'geographyEvidence', 'taxBasis', 'inclusions',
    'selectionRank', 'evidenceClass', 'eligibility', 'reason', 'listedAmount', 'listedUnit', 'transaction', 'mandatoryChargeStatus', 'charges',
    'allMandatoryChargesDocumented', 'normalizationStatus', 'normalizationReason', 'sourceBasisEvidence', 'conditionalDiscount', 'publicNonMemberRate'];
  const selected = selectedIds.map(id => Object.fromEntries(Object.entries(byId.get(id)).filter(([key]) => fields.includes(key))));
  const urls = [...new Set([...selected.map(row => row.sourceUrl), ...selected.flatMap(row => row.charges?.map(charge => charge.sourceUrl) ?? []),
    ...disputes.flatMap(dispute => dispute.sourceUrls)])].sort();
  return { rule: sampling, acceptedAggregates: accepted.length, randomSampleCount: count, sampledAggregateIds: sampled,
    requiredAggregateIds, aggregates: selectedAggregates, disputes,
    requiredRowIds: selectedIds, rows: selected, urls, fitsActionAllocation: urls.length <= 10,
    note: urls.length > 10 ? 'Review cap cannot cover every URL: preserve every row and report unresolved; feasibility cannot pass.' : null };
}

function context(target) {
  const repo = path.resolve(path.dirname(here), '../..');
  requireThat(fs.realpathSync(repo).toLowerCase() === AUTHORIZED_REPO.toLowerCase(), 'Use authorized research worktree');
  requireThat(/^restart-1[a-z0-9-]*$/.test(target), 'New target must be a restart-1-prefixed directory; pilot artifacts are immutable');
  const root = path.join(repo, 'research/city-cost-accuracy');
  const dir = safePath(root, target);
  fs.mkdirSync(dir, { recursive: true });
  return { repo, root, target, dir };
}
const readJson = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
function locked(ctx, action) {
  const lock = safePath(ctx.root, `${ctx.target}/coordinator.lock`);
  const fd = fs.openSync(lock, 'wx');
  try { return action(); } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function loadFrozen(ctx) {
  const frozen = readJson(safePath(ctx.root, `${ctx.target}/freeze.json`));
  const bytes = fs.readFileSync(safePath(ctx.root, `${ctx.target}/contract.json`));
  requireThat(hash(bytes) === frozen.contractSha256, 'Frozen contract changed');
  for (const [relative, digest] of Object.entries(frozen.sourceCodeSha256)) requireThat(hash(fs.readFileSync(path.join(ctx.repo, relative))) === digest, `Frozen source changed: ${relative}`);
  requireThat(hash(fs.readFileSync(safePath(ctx.root, 'manifest.json'))) === frozen.manifestSha256, 'Manifest changed');
  requireThat(hash(fs.readFileSync(safePath(ctx.root, 'restart-prior-audit.json'))) === frozen.priorAuditSha256, 'Prior audit changed');
  const design = JSON.parse(bytes);
  validateContract(design, readJson(safePath(ctx.root, 'manifest.json')), readJson(safePath(ctx.root, 'restart-prior-audit.json')));
  return { design, frozen };
}
function journal(ctx, design) {
  const relative = `${ctx.target}/budget.jsonl`, filename = safePath(ctx.root, relative), limits = budgetPlan(design).limits;
  requireThat(fs.existsSync(filename), 'Initialize reservations before start');
  const events = fs.readFileSync(filename, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  return { relative, limits, events, state: replayBudget(events, limits) };
}
function saveTask(ctx, task, frozen) {
  const prefix = `${ctx.target}/tasks/${taskId(task.request.taskId)}`;
  writeOnce(ctx.root, `${prefix}/system.txt`, task.system);
  writeOnce(ctx.root, `${prefix}/prompt.txt`, task.prompt);
  writeOnce(ctx.root, `${prefix}/request.json`, { ...task.request, contractSha256: frozen.contractSha256, referenceDate: frozen.referenceDate,
    outputProvenance: { taskSha256: 'SHA256 exact UTF-8 request.json file bytes', systemSha256: task.request.systemSha256,
      userSha256: task.request.promptSha256, protocolSha256: frozen.contractSha256,
      searchCount: 'number of action entries with type search', retrievalCount: 'all search/open/click action entries',
      tokenUsage: 'reported object or null when unavailable; never invent', failureReason: 'null if none; truthful failure reason otherwise' },
    promptSourceSha256: frozen.promptSourceSha256, materializerCodeSha256: frozen.materializerCodeSha256, scorerCodeSha256: frozen.scorerCodeSha256 });
}
function readTask(ctx, id, frozen) {
  const prefix = `${ctx.target}/tasks/${taskId(id)}`, request = readJson(safePath(ctx.root, `${prefix}/request.json`));
  requireThat(request.contractSha256 === frozen.contractSha256 && request.taskId === id, 'Task contract or identity mismatch');
  for (const [file, key] of [['prompt.txt', 'promptSha256'], ['system.txt', 'systemSha256']]) requireThat(hash(fs.readFileSync(safePath(ctx.root, `${prefix}/${file}`))) === request[key], `Changed ${file}`);
  request.taskSha256 = hash(fs.readFileSync(safePath(ctx.root, `${prefix}/request.json`)));
  return { prefix, request };
}

export function run(argv) {
  const [command, target, arg, rawPath] = argv, ctx = context(target);
  return locked(ctx, () => {
    if (command === 'freeze') {
      requireThat(arg && !['restart-design.json', 'manifest.json'].includes(arg), 'Supply path to NEW validated contract');
      const input = safePath(ctx.root, arg), bytes = fs.readFileSync(input), design = JSON.parse(bytes);
      const manifestBytes = fs.readFileSync(safePath(ctx.root, 'manifest.json')), auditBytes = fs.readFileSync(safePath(ctx.root, 'restart-prior-audit.json'));
      validateContract(design, JSON.parse(manifestBytes), JSON.parse(auditBytes));
      const sourceCodeSha256 = Object.fromEntries(SOURCE_PATHS.map(relative => [relative, hash(fs.readFileSync(path.join(ctx.repo, relative)))]));
      let gitSha = null, gitReadError = null;
      try { gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ctx.repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
      catch (error) { gitReadError = error.code ?? 'unavailable'; }
      // Stable repeated freeze is idempotent; coordinator's validation timestamp is the frozen timestamp.
      const frozen = { schemaVersion: 1, programRevision: design.programRevision, status: 'frozen_preparation_only',
        contractSource: arg, contractSha256: hash(bytes), manifestSha256: hash(manifestBytes), priorAuditSha256: hash(auditBytes),
        frozenAt: design.coordinatorValidation.validatedAt, createdDate: design.createdDate, referenceDate: JSON.parse(manifestBytes).referenceDate,
        referenceWindow: design.window, sourceCodeSha256, sourceCodeGitSha: gitSha, gitReadError,
        promptSourceSha256: sourceCodeSha256['src/lib/city-generation.ts'], materializerCodeSha256: sourceCodeSha256['src/lib/city-cost-methodology-v1-1.ts'],
        scorerCodeSha256: sourceCodeSha256['scripts/city-cost-accuracy/core.mjs'], templateSha256: hash(canonical(design.prompts)),
        limitation: 'Reference pipeline only. Estimate preparation/materialization, scoring and gate adjudication are deferred; no worker dispatched.' };
      writeOnce(ctx.root, `${target}/contract.json`, bytes.toString('utf8'));
      writeOnce(ctx.root, `${target}/freeze.json`, frozen);
      return { status: frozen.status, contractSha256: frozen.contractSha256 };
    }
    const { design, frozen } = loadFrozen(ctx);
    if (command === 'verify') return { status: 'verified', contractSha256: frozen.contractSha256 };
    if (command === 'prepare') {
      const manifest = readJson(safePath(ctx.root, 'manifest.json'));
      for (const id of design.pilotCities) saveTask(ctx, collectorTask(design, manifest.cities.find(city => city.id === id), 'menu'), frozen);
      for (const id of design.feasibility.allocation.hotelCities) saveTask(ctx, collectorTask(design, manifest.cities.find(city => city.id === id), 'hotel'), frozen);
      return { status: 'prepared', collectors: 9, reservedReview: 1, dispatched: 0 };
    }
    if (command === 'reserve') {
      const relative = `${target}/budget.jsonl`;
      const plan = budgetPlan(design), filename = safePath(ctx.root, relative);
      const existing = fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
      // Resume an interrupted initialization only if its complete prefix matches; never reset balances.
      for (const [index, event] of existing.entries()) {
        if (index >= plan.events.length) break;
        const { sequence, recordedAt, ...saved } = event;
        requireThat(JSON.stringify(saved) === JSON.stringify(plan.events[index]), 'Existing budget initialization differs');
      }
      for (let index = existing.length; index < plan.events.length; index++) appendBudget(ctx.root, relative, plan.limits, plan.events[index]);
      return journal(ctx, design).state;
    }
    const book = journal(ctx, design);
    if (command === 'budget') return book.state;
    if (command === 'start') {
      const { prefix, request } = readTask(ctx, arg, frozen);
      requireThat(['menu', 'hotel', 'review'].includes(request.role), 'Only feasibility references are enabled');
      requireThat(book.state.started.length < design.resources.hard.costWorkerConcurrency, 'Worker concurrency reservation exceeded');
      requireThat(!fs.existsSync(safePath(ctx.root, `${prefix}/response.json`)), 'Cannot start worker with existing response');
      const state = appendBudget(ctx.root, book.relative, book.limits, { type: 'start', id: arg,
        consumed: { referenceWorkerInvocations: 1 }, requestSha256: hash(fs.readFileSync(safePath(ctx.root, `${prefix}/request.json`))),
        model: request.model, effort: request.effort, runtime: request.runtime });
      return { status: 'started_accounting_only', taskId: arg, note: 'This command records the call BEFORE coordinator dispatch; it does not invoke a worker.', state };
    }
    if (command === 'finish') {
      const { prefix, request } = readTask(ctx, arg, frozen);
      const start = book.events.find(event => event.type === 'start' && event.id === arg);
      requireThat(start && !book.events.some(event => event.type === 'finish' && event.id === arg), 'Unstarted or already finished worker');
      requireThat(rawPath, 'Supply raw response path relative to research root; use finish-missing for absent telemetry');
      const rawFile = safePath(ctx.root, rawPath), raw = fs.readFileSync(rawFile, 'utf8');
      const artifactStat = fs.statSync(rawFile);
      writeOnce(ctx.root, `${prefix}/response.json`, raw); // Always preserve exact bytes, including malformed JSON.
      let validation;
      try { validation = validateWorker(raw, request, design); }
      catch (error) { validation = { valid: false, errors: [`Malformed record: ${error.message}`], telemetryKnown: false, actionCount: null }; }
      if (validation.record && Date.parse(validation.record.startedAt) < Date.parse(start.recordedAt)) {
        validation.valid = false; validation.errors.push('Worker claims start before coordinator start'); delete validation.record;
      }
      const deadline = artifactDeadline(start.recordedAt, artifactStat.mtimeMs, request.timeoutSeconds), { artifactElapsedMs } = deadline;
      if (!deadline.valid) {
        validation.valid = false;
        validation.errors.push(deadline.error);
        validation.terminalStatus = deadline.terminalStatus;
        delete validation.record;
      }
      const sidecar = { ...validation, record: undefined, taskId: arg, status: validation.valid ? 'valid' : 'invalid',
        responseSha256: hash(raw), requestSha256: hash(fs.readFileSync(safePath(ctx.root, `${prefix}/request.json`))),
        model: request.model, effort: request.effort, runtime: request.runtime, coordinatorStartedAt: start.recordedAt,
        rawArtifactSource: rawPath, rawArtifactModifiedAt: artifactStat.mtime.toISOString(), artifactElapsedMs,
        coordinatorDeadline: new Date(Date.parse(start.recordedAt) + request.timeoutSeconds * 1000).toISOString(),
        budgetChargeActions: validation.telemetryKnown ? validation.actionCount : request.maxActions,
        provenanceAuthority: 'Coordinator-selected identity; worker metadata checked for consistency' };
      writeOnce(ctx.root, `${prefix}/validation.json`, sidecar);
      appendBudget(ctx.root, book.relative, book.limits, { type: 'finish', id: arg,
        actual: validation.telemetryKnown ? { referenceActions: validation.actionCount } : null,
        validationStatus: sidecar.status, responseSha256: sidecar.responseSha256 });
      return sidecar;
    }
    if (command === 'finish-missing') {
      const { prefix, request } = readTask(ctx, arg, frozen);
      requireThat(book.state.started.includes(arg), 'Worker not active');
      requireThat(!fs.existsSync(safePath(ctx.root, `${prefix}/response.json`)), 'Raw response exists; ingest it instead');
      writeOnce(ctx.root, `${prefix}/validation.json`, { taskId: arg, status: 'invalid', errors: ['No returned artifact/action telemetry'],
        telemetryKnown: false, budgetChargeActions: request.maxActions, model: request.model, effort: request.effort, runtime: request.runtime });
      return appendBudget(ctx.root, book.relative, book.limits, { type: 'finish', id: arg, actual: null, validationStatus: 'missing' });
    }
    if (command === 'prepare-review') {
      const ids = [...design.pilotCities.map(id => `menu-${id}`), ...design.feasibility.allocation.hotelCities.map(id => `hotel-${id}`)];
      requireThat(ids.every(id => book.events.some(event => event.type === 'finish' && event.id === id)), 'Every collector must be terminal before review freeze');
      const rows = [], aggregates = [], loggedDisputes = [], sourceResponses = {}, terminalCollectors = [];
      for (const id of ids) {
        const { prefix, request } = readTask(ctx, id, frozen);
        const sidecar = readJson(safePath(ctx.root, `${prefix}/validation.json`));
        terminalCollectors.push({ taskId: id, validationStatus: sidecar.status, errors: sidecar.errors });
        if (sidecar.status !== 'valid') continue; // Invalid records remain explicit failures, never repaired or accepted.
        const raw = fs.readFileSync(safePath(ctx.root, `${prefix}/response.json`), 'utf8');
        requireThat(hash(raw) === sidecar.responseSha256, 'Collector response changed after validation');
        const validation = validateWorker(raw, request, design);
        requireThat(validation.valid, 'Collector no longer validates');
        rows.push(...validation.record.rows); aggregates.push(...validation.record.aggregates); loggedDisputes.push(...validation.record.disputes); sourceResponses[id] = hash(raw);
      }
      const external = arg ? readJson(safePath(ctx.root, arg)) : { disputes: [] };
      requireThat(exactKeys(external, ['disputes']) && Array.isArray(external.disputes), 'Dispute input must be {disputes:[exact dispute records]}');
      const disputes = [...loggedDisputes, ...external.disputes];
      const ledger = { rows, aggregates, disputes, terminalCollectors, sourceResponses, contractSha256: frozen.contractSha256,
        normalization: rows.map(row => ({ rowId: row.id, ...normalizeFees(row) })) };
      writeOnce(ctx.root, `${target}/aggregate-ledger.json`, ledger);
      const selected = selectReview(rows, aggregates, disputes, design.reviewSampling);
      const selection = { ...selected, sourceResponses, disputeInputSha256: hash(canonical(external)), contractSha256: frozen.contractSha256,
        aggregateLedgerSha256: hash(canonical(ledger)) };
      writeOnce(ctx.root, `${target}/review-selection.json`, selection);
      const prompt = expand(design.prompts.reviewUserTemplate, {
        FROZEN_SELECTED_PRIMARY_MEAL_AGGREGATES_WITH_ALL_CONSTITUENT_ROWS_AND_ALL_GENUINE_DISPUTES: JSON.stringify(selected, null, 2),
        EXACT_DEFINITIONS_OBJECT: JSON.stringify(design.definitions, null, 2), EXACT_FEE_NORMALIZATION_OBJECT: JSON.stringify(design.feeNormalization, null, 2),
        EXACT_REVIEW_SELECTION_RULE: design.referenceRules.reviewSelection, EXACT_DISPUTE_DEFINITION: design.referenceRules.disputeDefinition });
      const system = design.prompts.reviewSystem;
      saveTask(ctx, { prompt, system, request: { taskId: 'review-feasibility', role: 'review', ...design.workerSelection,
        maxActions: design.feasibility.allocation.reviewActions, maxInvocations: 1, timeoutSeconds: design.resources.hard.workerTimeoutSeconds,
        schema: design.schemas.reviewRecord, actionSchema: design.schemas.provenance.action, ...selected,
        selectionSha256: hash(canonical(selection)), promptSha256: hash(prompt), systemSha256: hash(system) } }, frozen);
      return { status: 'review_prepared', requiredRows: selected.rows.length, urls: selected.urls.length, fitsActionAllocation: selected.fitsActionAllocation, dispatched: 0 };
    }
    throw Error('Use freeze TARGET CONTRACT, verify TARGET, prepare TARGET, reserve TARGET, budget TARGET, start TARGET TASK, finish TARGET TASK RAW, finish-missing TARGET TASK, prepare-review TARGET [DISPUTES]');
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === here) {
  try { console.log(JSON.stringify(run(process.argv.slice(2)), null, 2)); }
  catch (error) {
    const [, target] = process.argv.slice(2);
    try {
      const ctx = context(target);
      writeOnce(ctx.root, `${target}/failures/${Date.now()}-${process.pid}.json`, { status: 'not_ready', command: process.argv[2], error: error.message });
    } catch { /* No fallback writes outside the authorized, new target. */ }
    console.error(error.message); process.exitCode = 1;
  }
}
