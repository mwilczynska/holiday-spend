import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateCityCostEstimate } from './city-generation';
import { collectCityCostV6Anchors } from './city-cost-v6-collection';

vi.mock('@/lib/city-cost-v6-collection', () => ({
  collectCityCostV6Anchors: vi.fn(),
}));

const mockedCollect = vi.mocked(collectCityCostV6Anchors);

afterEach(() => {
  delete process.env.CITY_COST_METHODOLOGY_V6;
  mockedCollect.mockReset();
});

describe('city generation v6 feature flag', () => {
  it('runs a new city through collection and deterministic materialization with all 19 graded tiers', async () => {
    process.env.CITY_COST_METHODOLOGY_V6 = 'true';
    mockedCollect.mockResolvedValue({
      anchors: {
        hotel_3star_room_2p: {
          valueAud: 100,
          status: 'observed',
          evidenceGrade: 'B',
          sourceIds: ['expedia:test'],
          modelVersions: ['test-model'],
        },
        inexpensive_restaurant_meal_1p: {
          valueAud: 10,
          status: 'observed',
          evidenceGrade: 'A',
          sourceIds: ['numbeo:test'],
          modelVersions: ['test-model'],
        },
        midrange_restaurant_meal_2p: {
          valueAud: 40,
          status: 'observed',
          evidenceGrade: 'A',
          sourceIds: ['numbeo:test'],
          modelVersions: ['test-model'],
        },
        mcmeal_combo: {
          valueAud: 8,
          status: 'observed',
          evidenceGrade: 'A',
          sourceIds: ['numbeo:test'],
          modelVersions: ['test-model'],
        },
        cappuccino_1: {
          valueAud: 4,
          status: 'observed',
          evidenceGrade: 'A',
          sourceIds: ['numbeo:test'],
          modelVersions: ['test-model'],
        },
        domestic_draft_beer_1: {
          valueAud: 5,
          status: 'observed',
          evidenceGrade: 'A',
          sourceIds: ['numbeo:test'],
          modelVersions: ['test-model'],
        },
        paid_attraction_adult_1: {
          valueAud: 15,
          status: 'observed',
          evidenceGrade: 'B',
          sourceIds: ['byt:test'],
          modelVersions: ['test-model'],
        },
        half_day_group_activity_adult_1: {
          valueAud: 30,
          status: 'observed',
          evidenceGrade: 'B',
          sourceIds: ['byt:test'],
          modelVersions: ['test-model'],
        },
        full_day_premium_activity_adult_1: {
          valueAud: 60,
          status: 'observed',
          evidenceGrade: 'B',
          sourceIds: ['byt:test'],
          modelVersions: ['test-model'],
        },
      },
      facts: [],
      telemetry: [
        {
          source: 'numbeo',
          promptVersion: 'test',
          provider: 'openai',
          model: 'test-model',
          attempts: 1,
          retries: 0,
          status: 'complete',
          searchesUsed: 5,
          directPageReads: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 1,
          error: null,
        },
      ],
      llmCalls: 1,
      searches: 5,
      promptVersions: ['test'],
    });

    const result = await generateCityCostEstimate({
      cityName: 'New City',
      countryName: 'Testland',
      region: 'Europe',
      provider: 'openai',
      apiKey: 'test',
    });

    expect(result.methodologyVersion).toBe('v6.0');
    expect(result.v6Materialization?.complete).toBe(true);
    expect(Object.keys(result.v6Materialization?.tiersAud ?? {})).toHaveLength(19);
    expect(Object.values(result.v6Materialization?.tiersAud ?? {}).every((tier) => tier.evidenceGrade)).toBe(true);
    expect(result.mappedEstimate.accom3star).toBe(100);
    expect(result.payload).toHaveProperty('evidence_grades');
  });
});
