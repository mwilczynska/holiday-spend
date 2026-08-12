import { afterEach, describe, expect, it, vi } from 'vitest';
import { runJsonPromptWithWebSearch } from './transport-estimation';
import {
  buildV61CollectionResultFromSpineResponses,
  collectCityCostV61Anchors,
  parseV61SpineResponse,
  renderV61Prompt,
  V61_SEARCHES_PER_CITY_MAX,
  V61_SPINE_SOURCES,
} from './city-cost-v6-1-collection';

vi.mock('./transport-estimation', () => ({
  runJsonPromptWithWebSearch: vi.fn(),
}));

const mockedRun = vi.mocked(runJsonPromptWithWebSearch);

function observed(value: number) {
  return {
    status: 'observed',
    value,
    currency: 'USD',
    sourceUrl: 'https://example.com/source',
    sourceTitle: 'Source result',
    evidenceText: 'Exact source snippet',
    query: 'source query',
    taxStatus: 'unknown',
  };
}

function response(source: string, city: string, country: string, measures: Record<string, unknown>, searchesUsed = 1) {
  return {
    provider: 'openai' as const,
    model: 'test-model',
    text: JSON.stringify({
      schemaVersion: 'city-cost-v6-1-spine-response-v1',
      source,
      city,
      country,
      retrievalStatus: 'complete',
      searchesUsed,
      directPageReads: 0,
      measures,
      notes: '',
    }),
    usedWebSearch: true,
    fallbackReason: null,
    searchQueries: ['test query'],
    citations: [{ url: 'https://example.com/source', title: 'Source result' }],
    searchesUsed,
    attempts: 1,
    retries: 0,
    rawResponse: { provider: 'openai', source },
  };
}

function rawResponse(source: string, city: string, country: string, measures: Record<string, unknown>, searchesUsed = 1) {
  return {
    schemaVersion: 'city-cost-v6-1-spine-response-v1',
    source,
    city,
    country,
    retrievalStatus: 'complete',
    searchesUsed,
    directPageReads: 0,
    measures,
    notes: '',
  };
}

const expediaMeasures = { hotel_3star_room_2p: observed(100) };
const bytMeasures = {
  byt_food_budget_per_person_day: observed(10),
  byt_food_mid_per_person_day: observed(20),
  byt_food_high_per_person_day: observed(40),
  byt_activities_budget_per_person_day: observed(5),
  byt_activities_mid_per_person_day: observed(15),
  byt_activities_high_per_person_day: observed(30),
};
const drinkMeasures = {
  cappuccino_1: observed(4),
  domestic_draft_beer_1: observed(5),
};

afterEach(() => {
  mockedRun.mockReset();
});

describe('v6.1 source response contract', () => {
  it('defines exactly three sources and ten searches per city', () => {
    expect(V61_SPINE_SOURCES).toEqual(['expedia_3star', 'budgetyourtrip_daily_tiers', 'numbeo_drinks']);
    expect(V61_SEARCHES_PER_CITY_MAX).toBe(10);
  });

  it('rejects an unexpected source measure key instead of silently stripping it', () => {
    expect(() => parseV61SpineResponse('numbeo_drinks', rawResponse(
      'numbeo_drinks',
      'Test City',
      'Testland',
      { ...drinkMeasures, mcmeal_combo: observed(8) },
    ))).toThrow();
  });

  it('rejects a source response over its own search ceiling or with a direct read', () => {
    expect(() => parseV61SpineResponse(
      'numbeo_drinks',
      rawResponse('numbeo_drinks', 'Test City', 'Testland', drinkMeasures, 3),
    )).toThrow(/search limit/);

    expect(() => parseV61SpineResponse('expedia_3star', {
      ...rawResponse('expedia_3star', 'Test City', 'Testland', expediaMeasures),
      directPageReads: 1,
    })).toThrow(/direct page read/);
  });

  it('preserves missingness while normalizing valid disk responses', () => {
    const missing = {
      status: 'not_found',
      value: null,
      currency: null,
      sourceUrl: null,
      sourceTitle: '',
      evidenceText: '',
      query: '',
      taxStatus: 'unknown',
    };
    const result = buildV61CollectionResultFromSpineResponses({
      city: 'Test City',
      country: 'Testland',
      responses: {
        expedia_3star: rawResponse('expedia_3star', 'Test City', 'Testland', expediaMeasures),
        budgetyourtrip_daily_tiers: rawResponse('budgetyourtrip_daily_tiers', 'Test City', 'Testland', {
          ...bytMeasures,
          byt_food_high_per_person_day: missing,
        }),
        numbeo_drinks: rawResponse('numbeo_drinks', 'Test City', 'Testland', drinkMeasures),
      },
    });

    expect(result.anchors.byt_food_budget_per_person_day?.valueAud).toBeGreaterThan(0);
    expect(result.anchors.byt_food_high_per_person_day).toMatchObject({
      valueAud: null,
      status: 'not_found',
      evidenceGrade: 'D',
      missingness: 'not_found',
    });
    expect(result.facts.find((fact) => fact.measure === 'byt_food_high_per_person_day')?.status).toBe('not_found');
    expect(result.rawResponses.expedia_3star).toEqual(rawResponse('expedia_3star', 'Test City', 'Testland', expediaMeasures));
  });

  it('renders distinct Expedia arrival and departure dates', () => {
    const prompt = renderV61Prompt('expedia_3star', 'Test City', 'Testland', {
      referenceDate: '2026-09-17',
      arrivalDate: '2026-09-17',
      departureDate: '2026-09-18',
    });
    expect(prompt).toContain('2026-09-17');
    expect(prompt).toContain('2026-09-18');
    expect(prompt).not.toMatch(/arrival[^\n]*2026-09-18/i);
    expect(prompt).not.toMatch(/departure[^\n]*2026-09-17/i);
  });
});

describe('collectCityCostV61Anchors', () => {
  it('uses the three v6.1 prompt contracts and returns source-native fields', async () => {
    const city = 'Test City';
    const country = 'Testland';
    mockedRun
      .mockResolvedValueOnce(response('expedia_3star', city, country, expediaMeasures))
      .mockResolvedValueOnce(response('budgetyourtrip_daily_tiers', city, country, bytMeasures))
      .mockResolvedValueOnce(response('numbeo_drinks', city, country, drinkMeasures));

    const result = await collectCityCostV61Anchors({ city, country, provider: 'openai', apiKey: 'test' });

    expect(result.llmCalls).toBe(3);
    expect(result.searches).toBe(3);
    expect(result.facts.map((fact) => fact.measure)).toEqual([
      'hotel_3star_room_2p',
      'byt_food_budget_per_person_day',
      'byt_food_mid_per_person_day',
      'byt_food_high_per_person_day',
      'byt_activities_budget_per_person_day',
      'byt_activities_mid_per_person_day',
      'byt_activities_high_per_person_day',
      'cappuccino_1',
      'domestic_draft_beer_1',
    ]);
    expect(mockedRun).toHaveBeenCalledTimes(3);
    expect(mockedRun.mock.calls[0][0].userPrompt).toContain('city-cost-v6-1-spine-response-v1');
    expect(mockedRun.mock.calls[1][0].userPrompt).toContain('byt_food_budget_per_person_day');
    expect(mockedRun.mock.calls[2][0].userPrompt).toContain('domestic_draft_beer_1');
    expect(result.telemetry.every((call) => call.directPageReads === 0)).toBe(true);
    expect(Object.keys(result.rawResponses)).toEqual(V61_SPINE_SOURCES);
    expect(Object.keys(result.providerRawResponses ?? {})).toEqual(V61_SPINE_SOURCES);
  });

  it('records three blocked source calls without converting provider absence to not_found', async () => {
    mockedRun.mockResolvedValue(null);
    const result = await collectCityCostV61Anchors({ city: 'Blocked City', country: 'Testland', provider: 'openai' });
    expect(result.telemetry).toHaveLength(3);
    expect(result.telemetry.every((call) => call.status === 'blocked')).toBe(true);
    expect(result.facts.every((fact) => fact.status === 'blocked')).toBe(true);
    expect(result.facts.every((fact) => fact.retrievalStatus === 'blocked')).toBe(true);
    expect(result.rawResponses.expedia_3star).toMatchObject({ city: 'Blocked City', country: 'Testland' });
  });
});
