import { afterEach, describe, expect, it, vi } from 'vitest';
import { runJsonPromptWithProvider } from './city-llm-client';
import { collectCityCostV6Anchors } from './city-cost-v6-collection';

vi.mock('./city-llm-client', () => ({
  runJsonPromptWithProvider: vi.fn(),
}));

const mockedRun = vi.mocked(runJsonPromptWithProvider);

function response(source: string, city: string, country: string, measures: Record<string, unknown>, retrievalStatus = 'complete') {
  return {
    provider: 'openai',
    model: 'test-model',
    text: JSON.stringify({
      schemaVersion: 'city-cost-v6-spine-response-v1',
      source,
      city,
      country,
      retrievalStatus,
      searchesUsed: 1,
      directPageReads: 0,
      measures,
      notes: '',
    }),
  };
}

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

afterEach(() => {
  mockedRun.mockReset();
});

describe('collectCityCostV6Anchors', () => {
  it('runs the three bounded spine calls and converts source facts in deterministic code', async () => {
    const city = 'Test City';
    const country = 'Testland';
    mockedRun
      .mockResolvedValueOnce(
        response('numbeo', city, country, {
          inexpensive_restaurant_meal_1p: observed(10),
          midrange_restaurant_meal_2p: observed(40),
          cappuccino_1: observed(4),
          domestic_draft_beer_1: observed(5),
          mcmeal_combo: observed(8),
        })
      )
      .mockResolvedValueOnce(response('expedia_3star', city, country, { hotel_3star_room_2p: observed(100) }))
      .mockResolvedValueOnce(
        response('budgetyourtrip', city, country, {
          paid_attraction_adult_1: observed(15),
          half_day_group_activity_adult_1: observed(30),
          full_day_premium_activity_adult_1: observed(60),
        })
      );

    const result = await collectCityCostV6Anchors({ city, country, provider: 'openai', apiKey: 'test' });

    expect(result.llmCalls).toBe(3);
    expect(result.searches).toBe(3);
    expect(result.anchors.hotel_3star_room_2p?.valueAud).toBeCloseTo(142.987, 2);
    expect(result.anchors.hotel_3star_room_2p?.evidenceGrade).toBe('B');
    expect(result.telemetry.every((call) => call.directPageReads === 0)).toBe(true);
  });

  it('retries a reported block once and preserves the retry in telemetry', async () => {
    const city = 'Blocked City';
    const country = 'Testland';
    const blockedMeasures = {
      hotel_3star_room_2p: {
        status: 'blocked',
        value: null,
        currency: null,
        sourceUrl: null,
        sourceTitle: '',
        evidenceText: '',
        query: '',
        taxStatus: 'unknown',
      },
    };
    mockedRun
      .mockResolvedValueOnce(response('numbeo', city, country, {
        inexpensive_restaurant_meal_1p: observed(10),
        midrange_restaurant_meal_2p: observed(40),
        cappuccino_1: observed(4),
        domestic_draft_beer_1: observed(5),
        mcmeal_combo: observed(8),
      }))
      .mockResolvedValueOnce(response('expedia_3star', city, country, blockedMeasures, 'blocked'))
      .mockResolvedValueOnce(response('expedia_3star', city, country, blockedMeasures, 'blocked'))
      .mockResolvedValueOnce(response('budgetyourtrip', city, country, {
        paid_attraction_adult_1: observed(15),
        half_day_group_activity_adult_1: observed(30),
        full_day_premium_activity_adult_1: observed(60),
      }));

    const result = await collectCityCostV6Anchors({ city, country, provider: 'openai', apiKey: 'test' });
    const expedia = result.telemetry.find((call) => call.source === 'expedia_3star');

    expect(result.llmCalls).toBe(4);
    expect(expedia).toMatchObject({ attempts: 2, retries: 1, status: 'blocked' });
    expect(result.anchors.hotel_3star_room_2p?.status).toBe('blocked');
    expect(result.anchors.hotel_3star_room_2p?.valueAud).toBeNull();
  });
});

