import { describe, expect, it } from 'vitest';
import {
  evaluateV61CanaryBatch,
  type V61CanaryCityRecord,
  type V61CanaryRegistrationCriteria,
} from './city-cost-v6-1-canary';
import { V61_SOURCE_CONFIG, V61_SPINE_SOURCES } from './city-cost-v6-1-collection';

const window = {
  arrival: '2026-09-17',
  departure: '2026-09-18',
  referenceDate: '2026-09-17',
};

const registration: V61CanaryRegistrationCriteria = {
  window,
  limits: {
    sourceCallsPerCity: 3,
    maxSearchesBySource: {
      expedia_3star: 4,
      budgetyourtrip_daily_tiers: 4,
      numbeo_drinks: 2,
    },
    maxSearchesPerCity: 10,
    directPageReadsPerCity: 0,
    maxRetriesPerCall: 1,
  },
  completeCitiesMinimum: 1,
  artifactBatchMaximumFraction: 0.3,
};

function observed() {
  return {
    status: 'observed',
    value: 10,
    currency: 'USD',
    sourceUrl: 'https://example.com/source',
    sourceTitle: 'Source',
    evidenceText: 'Evidence',
    query: 'query',
    taxStatus: 'unknown',
  };
}

function response(source: (typeof V61_SPINE_SOURCES)[number], city = 'Test City', country = 'Testland', status = 'complete') {
  const measures = Object.fromEntries(V61_SOURCE_CONFIG[source].measures.map((measure) => [measure,
    measure === 'domestic_draft_beer_1'
      ? { ...observed(), sourceTitle: 'Numbeo Domestic Draft Beer (0.5 Liter)', evidenceText: 'Domestic Draft Beer (0.5 Liter): USD 5.00' }
      : observed(),
  ]));
  return {
    schemaVersion: 'city-cost-v6-1-spine-response-v1',
    source,
    city,
    country,
    retrievalStatus: status,
    searchesUsed: 1,
    directPageReads: 0,
    measures,
    notes: '',
  };
}

function telemetry(status: 'complete' | 'partial' | 'blocked' = 'complete') {
  return V61_SPINE_SOURCES.map((source) => ({
    source,
    promptVersion: `${source}.md`,
    provider: 'delegated-gpt-5.6-luna',
    model: 'gpt-5.6-luna',
    attempts: 1,
    retries: 0,
    status,
    searchesUsed: 1,
    directPageReads: 0,
    startedAt: '2026-09-17T00:00:00.000Z',
    completedAt: '2026-09-17T00:00:01.000Z',
    durationMs: 1000,
    error: status === 'complete' ? null : 'blocked',
  }));
}

function provenance() {
  const value = {
    methodologyVersion: 'v6.1',
    evidenceGrades: { tier: 'A' },
    intervals: { tier: { lowerAud: 1, upperAud: 2, widthPct: 50 } },
    anchors: [{ measure: 'hotel_3star_room_2p', status: 'observed' }],
    telemetry: [{ source: 'expedia_3star', status: 'complete' }],
    missingness: {},
    priorBasis: 'direct-evidence',
    inputSnapshot: { hotel_3star_room_2p: { valueAud: 100 } },
    sources: { expedia_3star: 'https://example.com/source' },
  };
  return { expected: value, persisted: structuredClone(value), api: structuredClone(value) };
}

function materialization(allPrior = false) {
  return {
    complete: true,
    tiersAud: Object.fromEntries(Array.from({ length: 19 }, (_, index) => [
      `tier_${index}`,
      { evidenceBasis: allPrior ? 'imputed' : 'direct', evidenceGrade: allPrior ? 'D' : 'A' },
    ])),
  };
}

function record(overrides: Partial<V61CanaryCityRecord> = {}): V61CanaryCityRecord {
  return {
    city: 'Test City',
    country: 'Testland',
    window,
    responses: Object.fromEntries(V61_SPINE_SOURCES.map((source) => [source, response(source)])),
    telemetry: telemetry(),
    materialization: materialization(),
    provenance: provenance(),
    ...overrides,
  };
}

describe('v6.1 operational canary evaluator', () => {
  it('rejects an all-blocked city and marks its all-prior bundle as an artifact candidate', () => {
    const blocked = record({
      responses: Object.fromEntries(V61_SPINE_SOURCES.map((source) => [source, response(source, 'Test City', 'Testland', 'blocked')])),
      telemetry: telemetry('blocked'),
      materialization: materialization(true),
    });
    const result = evaluateV61CanaryBatch(registration, [blocked]);
    expect(result.passed).toBe(false);
    expect(result.artifactCandidates).toBe(1);
    expect(result.problems.join('\n')).toMatch(/complete-city threshold|artifact-candidate threshold/);
  });

  it('rejects partial failure, missing calls, date drift and limit violations', () => {
    const partial = record({ telemetry: telemetry('partial') });
    const missing = record({ telemetry: telemetry().slice(0, 2) });
    const drift = record({ window: { ...window, departure: '2026-09-19' } });
    const limits = record({
      telemetry: telemetry().map((call, index) => index === 0 ? { ...call, searchesUsed: 5, retries: 2 } : call),
    });
    const result = evaluateV61CanaryBatch({ ...registration, completeCitiesMinimum: 4 }, [partial, missing, drift, limits]);
    const errors = result.problems.join('\n');
    expect(errors).toMatch(/retrievalStatus|complete-city threshold/);
    expect(errors).toMatch(/expected exactly 3 source-call records/);
    expect(errors).toMatch(/reference window drifted/);
    expect(errors).toMatch(/search ceiling/);
    expect(errors).toMatch(/retry limit/);
  });

  it('does not classify an uncollected city as an all-prior artifact', () => {
    const pending = record({
      responses: { expedia_3star: response('expedia_3star') },
      telemetry: telemetry().slice(0, 1),
      materialization: undefined,
      collectionTerminal: false,
    });
    const result = evaluateV61CanaryBatch({ ...registration, completeCitiesMinimum: 0 }, [pending]);
    expect(result.pendingCallSlots).toBe(3);
    expect(result.artifactCandidates).toBe(0);
    expect(result.artifactFraction).toBe(0);
    expect(result.cities[0].collectionTerminal).toBe(false);
  });

  it('rejects provenance mutation field by field', () => {
    const mutated = record();
    mutated.provenance!.api.intervals = { tier: { lowerAud: 0, upperAud: 3, widthPct: 300 } };
    const result = evaluateV61CanaryBatch(registration, [mutated]);
    expect(result.passed).toBe(false);
    expect(result.problems.join('\n')).toContain('API parser changed intervals');
  });

  it('keeps the other source calls visible when one response is invalid', () => {
    const invalidNumbeo = response('numbeo_drinks');
    (invalidNumbeo.measures.cappuccino_1 as Record<string, unknown>).sourceTitle = null;
    const result = evaluateV61CanaryBatch(registration, [record({
      responses: { ...record().responses, numbeo_drinks: invalidNumbeo },
      invalidResponses: { numbeo_drinks: 'Observed measures require a source title' },
    })]);
    expect(result.cities[0].sourceCallCount).toBe(3);
    expect(result.cities[0].parsedResponses.expedia_3star).toBeDefined();
    expect(result.cities[0].parsedResponses.budgetyourtrip_daily_tiers).toBeDefined();
    expect(result.cities[0].invalidResponses.numbeo_drinks).toContain('source title');
    expect(result.cities[0].sourceStatuses.numbeo_drinks).toBe('invalid');
    expect(result.passed).toBe(false);
  });

  it('fails a batch when a canonical beer label is repeatedly rejected as non-observed', () => {
    const rejected = response('numbeo_drinks') as { measures: Record<string, unknown> };
    rejected.measures.domestic_draft_beer_1 = {
      status: 'not_found',
      value: null,
      currency: null,
      sourceUrl: null,
      sourceTitle: 'Numbeo Domestic Draft Beer (0.5 Liter)',
      evidenceText: 'Domestic Draft Beer (0.5 Liter): USD 5.00',
      query: 'Numbeo Domestic Draft Beer (0.5 Liter)',
      taxStatus: 'unknown',
    };
    const result = evaluateV61CanaryBatch(
      { ...registration, completeCitiesMinimum: 0 },
      [record({ responses: { ...record().responses, numbeo_drinks: rejected } }),
        record({ city: 'Second City', responses: { ...record().responses, numbeo_drinks: rejected } }),
        record({ city: 'Third City' })],
    );
    expect(result.artifactSignatures[0].id).toBe('numbeo_domestic_draft_beer_canonical_label_rejected');
    expect(result.passed).toBe(false);
    expect(result.problems.join('\n')).toContain('canonical Domestic Draft Beer');
  });

  it('fails the batch when artifact candidates exceed the registered fraction', () => {
    const result = evaluateV61CanaryBatch(
      { ...registration, completeCitiesMinimum: 0 },
      [record(), record({ city: 'Prior City', materialization: materialization(true) }), record({ city: 'Prior City 2', materialization: materialization(true) })],
    );
    expect(result.artifactFraction).toBeCloseTo(2 / 3);
    expect(result.passed).toBe(false);
    expect(result.problems.join('\n')).toContain('artifact-candidate threshold failed');
  });
});
