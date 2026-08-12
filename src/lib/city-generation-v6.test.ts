import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateCityCostEstimate, isCityCostV6Enabled } from './city-generation';
import { collectCityCostV61Anchors } from './city-cost-v6-1-collection';

vi.mock('@/lib/city-cost-v6-1-collection', () => ({
  collectCityCostV61Anchors: vi.fn(),
}));

const mockedCollect = vi.mocked(collectCityCostV61Anchors);

afterEach(() => {
  delete process.env.CITY_COST_METHODOLOGY_V6;
  mockedCollect.mockReset();
});

describe('city generation v6 feature flag', () => {
  it('keeps the v1 path selected when the v6 flag is unset', () => {
    expect(isCityCostV6Enabled()).toBe(false);
    process.env.CITY_COST_METHODOLOGY_V6 = 'true';
    expect(isCityCostV6Enabled()).toBe(true);
    delete process.env.CITY_COST_METHODOLOGY_V6;
    expect(isCityCostV6Enabled()).toBe(false);
  });

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
        byt_food_budget_per_person_day: {
          valueAud: 10,
          status: 'observed',
          evidenceGrade: 'B',
          sourceIds: ['byt:test'],
          modelVersions: ['test-model'],
        },
        byt_food_mid_per_person_day: {
          valueAud: 20,
          status: 'observed',
          evidenceGrade: 'B',
          sourceIds: ['byt:test'],
          modelVersions: ['test-model'],
        },
        byt_food_high_per_person_day: {
          valueAud: 40,
          status: 'observed',
          evidenceGrade: 'B',
          sourceIds: ['byt:test'],
          modelVersions: ['test-model'],
        },
        byt_activities_budget_per_person_day: {
          valueAud: 5,
          status: 'observed',
          evidenceGrade: 'B',
          sourceIds: ['byt:test'],
          modelVersions: ['test-model'],
        },
        byt_activities_mid_per_person_day: {
          valueAud: 15,
          status: 'observed',
          evidenceGrade: 'B',
          sourceIds: ['byt:test'],
          modelVersions: ['test-model'],
        },
        byt_activities_high_per_person_day: {
          valueAud: 30,
          status: 'observed',
          evidenceGrade: 'B',
          sourceIds: ['byt:test'],
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
      },
      facts: [],
      rawResponses: {
        expedia_3star: {},
        budgetyourtrip_daily_tiers: {},
        numbeo_drinks: {},
      },
      telemetry: [
        {
          source: 'numbeo_drinks',
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

    expect(result.methodologyVersion).toBe('v6.1');
    expect(result.v61Materialization?.complete).toBe(true);
    expect(Object.keys(result.v61Materialization?.tiersAud ?? {})).toHaveLength(19);
    expect(Object.values(result.v61Materialization?.tiersAud ?? {}).every((tier) => tier.evidenceGrade)).toBe(true);
    expect(result.mappedEstimate.accom3star).toBe(100);
    expect(result.payload).toHaveProperty('evidence_grades');
  });
});
