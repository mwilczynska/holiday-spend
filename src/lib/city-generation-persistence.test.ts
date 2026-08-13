import { describe, expect, it } from 'vitest';
import type { CityGenerationResult, GeneratedCityPayload, V6GeneratedCityPayload } from './city-generation';
import { V5_TIER_NAMES } from './city-cost-methodology-v5';
import type { V6CollectionResult } from './city-cost-v6-collection';
import type { V61CollectionResult } from './city-cost-v6-1-collection';
import type { V6Materialization } from './city-cost-methodology-v6';
import type { V61Materialization } from './city-cost-methodology-v6-1';
import { buildCityEstimatePersistence } from './city-generation-persistence';

function tierMap() {
  return Object.fromEntries(
    V5_TIER_NAMES.map((tier) => [
      tier,
      {
        amountAud: 10,
        formula: tier,
        parentAnchors: [],
        missingAnchors: [],
        evidenceBasis: 'observed',
        imputedMeasures: [],
        sourceIds: ['fixture'],
        modelVersions: ['fixture'],
        evidenceGrade: 'A',
        interval: { lowerAud: 9, upperAud: 11, widthPct: 10 },
      },
    ])
  );
}

function v6Payload(): V6GeneratedCityPayload {
  return {
    city: 'Fixture City',
    country: 'Fixtureland',
    region: 'Europe',
    confidence: 'high',
    confidence_notes: 'fixture',
    anchors_aud: { hotel_3star_room_2p: 100 },
    tiers_aud: Object.fromEntries(V5_TIER_NAMES.map((tier) => [tier, 10])),
    evidence_grades: Object.fromEntries(V5_TIER_NAMES.map((tier) => [tier, 'A'])),
    intervals: Object.fromEntries(
      V5_TIER_NAMES.map((tier) => [tier, { lowerAud: 9, upperAud: 11, widthPct: 10 }])
    ),
  };
}

function v6Materialization(version: 'v6.0' | 'v6.1') {
  return {
    schemaVersion: version === 'v6.1' ? 'city-cost-materialization-v6.1' : 'city-cost-materialization-v6',
    methodologyVersion: version,
    city: 'Fixture City',
    country: 'Fixtureland',
    region: 'Europe',
    costBand: 'mid',
    tiersAud: tierMap(),
    anchors: {
      hotel_3star_room_2p: {
        valueAud: 100,
        status: 'observed',
        evidenceGrade: 'B',
        intervalPct: 20,
        sourceIds: ['expedia:fixture'],
        modelVersions: ['fixture'],
      },
    },
    missingness: { cocktail_1: 'not_found' },
    priorBasis: 'fixture regional then global prior',
    complete: true,
    mappedEstimate: { accom3star: 100 },
  } as unknown as V6Materialization | V61Materialization;
}

function v6Collection(version: 'v6.0' | 'v6.1') {
  return {
    anchors: { hotel_3star_room_2p: { valueAud: 100, status: 'observed', evidenceGrade: 'B' } },
    facts: [{ measure: 'hotel_3star_room_2p', status: 'observed', value: 100 }],
    telemetry: [
      {
        source: 'expedia_3star',
        promptVersion: version === 'v6.1' ? 'v6.1-fixture' : 'v6.0-fixture',
        provider: 'fixture-provider',
        model: 'fixture-model',
        attempts: 1,
        retries: 0,
        status: 'complete',
        searchesUsed: 1,
        directPageReads: 0,
        startedAt: '2026-08-12T00:00:00.000Z',
        completedAt: '2026-08-12T00:00:01.000Z',
        durationMs: 1000,
        error: null,
      },
    ],
    llmCalls: 1,
    searches: 1,
    promptVersions: ['fixture'],
  } as unknown as V6CollectionResult | V61CollectionResult;
}

function v6Result(version: 'v6.0' | 'v6.1'): CityGenerationResult {
  const payload = v6Payload();
  const materialization = v6Materialization(version);
  const collection = v6Collection(version);
  return {
    provider: 'fixture-provider',
    model: 'fixture-model',
    promptVersion: 'fixture',
    payload,
    mappedEstimate: { accom3star: 100 },
    inferredAudPerUsd: null,
    methodologyVersion: version,
    reasoningEffort: 'high',
    ...(version === 'v6.1'
      ? { v61Collection: collection as V61CollectionResult, v61Materialization: materialization as V61Materialization }
      : { v6Collection: collection as V6CollectionResult, v6Materialization: materialization as V6Materialization }),
  };
}

describe('city generation persistence adapter', () => {
  it('keeps v1 data on the v1 source path without fabricated v6 provenance', () => {
    const payload = {
      city: 'Fixture City',
      country: 'Fixtureland',
      region: 'Europe',
      confidence: 'medium',
      confidence_notes: 'v1 fixture',
      anchors_usd: { beer: 1 },
      tiers_aud: { food_budget: 20 },
    } as unknown as GeneratedCityPayload;
    const generated = {
      provider: 'fixture-provider',
      model: 'fixture-model',
      promptVersion: 'v1-fixture',
      payload,
      mappedEstimate: { foodBudget: 20 },
      inferredAudPerUsd: 1.5,
      methodologyVersion: 'v1',
    } as CityGenerationResult;

    const persisted = buildCityEstimatePersistence(generated);

    expect(persisted.estimateSource).toBe('llm_city_generation');
    expect(persisted.metadata.methodologyVersion).toBe('v1');
    expect(persisted.metadata.evidenceGrades).toBeNull();
    expect(persisted.metadata.v6CollectionTelemetry).toBeNull();
    expect(persisted.apiSummary.evidenceGrades).toBeNull();
  });

  it.each(['v6.0', 'v6.1'] as const)('preserves %s provenance explicitly', (version) => {
    const persisted = buildCityEstimatePersistence(v6Result(version));

    expect(persisted.estimateSource).toBe(version === 'v6.1' ? 'llm_city_generation_v6_1' : 'llm_city_generation_v6');
    expect(persisted.metadata.methodologyVersion).toBe(version);
    expect(persisted.metadata.evidenceGrades).toHaveProperty('accom_3_star', 'A');
    expect(persisted.metadata.intervals).toHaveProperty('accom_3_star');
    expect(persisted.metadata.v6CollectionTelemetry?.[0]).toMatchObject({ source: 'expedia_3star' });
    expect(persisted.metadata.v6Missingness).toEqual({ cocktail_1: 'not_found' });
    expect(persisted.metadata.v6PriorBasis).toBe('fixture regional then global prior');
  });

  it('retains all 19 v6.1 grades and intervals and the distinct anchors/facts', () => {
    const persisted = buildCityEstimatePersistence(v6Result('v6.1'));

    expect(Object.keys(persisted.metadata.evidenceGrades ?? {})).toHaveLength(19);
    expect(Object.keys(persisted.metadata.intervals ?? {})).toHaveLength(19);
    expect(persisted.anchors).toEqual([{ measure: 'hotel_3star_room_2p', status: 'observed', value: 100 }]);
    expect(persisted.inputSnapshot).toMatchObject({ hotel_3star_room_2p: { valueAud: 100 } });
    expect(persisted.apiSummary.methodologyVersion).toBe('v6.1');
    expect(persisted.metadata.reasoningEffort).toBe('high');
    expect(persisted.apiSummary.reasoningEffort).toBe('high');
  });
});
