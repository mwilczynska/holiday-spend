import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { runJsonPromptWithProvider } = vi.hoisted(() => ({ runJsonPromptWithProvider: vi.fn() }));

vi.mock('@/lib/city-llm-client', () => ({
  runJsonPromptWithProvider,
}));

import { generateCityCostEstimate } from '@/lib/city-generation';

const originalVersion = process.env.CITY_COST_METHODOLOGY_VERSION;
const originalLegacyFlag = process.env.CITY_COST_METHODOLOGY_V6;

const validResponse = JSON.stringify({
  region: 'East Asia',
  confidence: 'medium',
  confidence_notes: 'Fixture estimate.',
  comparable_city_reasoning: 'Comparable regional city.',
  anchors_usd: {
    beer: 2,
    coffee: 3,
    inexp_meal_1p: 10,
    midrange_meal_2p: 40,
    cocktail: 8,
    wine_glass: 6,
    hostel_dorm_1p: 12,
    hostel_private_2p: 30,
    hotel_1star_2p: 50,
    hotel_3star_2p: 100,
  },
});

beforeEach(() => {
  process.env.CITY_COST_METHODOLOGY_VERSION = 'v1.1';
  delete process.env.CITY_COST_METHODOLOGY_V6;
  runJsonPromptWithProvider.mockReset();
  runJsonPromptWithProvider.mockResolvedValue({ provider: 'openai', model: 'gpt-5.6-luna', text: validResponse });
});

afterEach(() => {
  if (originalVersion === undefined) delete process.env.CITY_COST_METHODOLOGY_VERSION;
  else process.env.CITY_COST_METHODOLOGY_VERSION = originalVersion;
  if (originalLegacyFlag === undefined) delete process.env.CITY_COST_METHODOLOGY_V6;
  else process.env.CITY_COST_METHODOLOGY_V6 = originalLegacyFlag;
});

describe('v1.1 generation call boundary', () => {
  it('uses one provider call and performs derivation only after the response', async () => {
    const result = await generateCityCostEstimate({
      cityName: 'Toyama',
      countryName: 'Japan',
      provider: 'openai',
      apiKey: 'fixture-key',
      model: 'gpt-5.6-luna',
      reasoningEffort: 'max',
    });

    expect(runJsonPromptWithProvider).toHaveBeenCalledTimes(1);
    expect(runJsonPromptWithProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-5.6-luna',
        reasoningEffort: 'max',
      })
    );
    expect(result.methodologyVersion).toBe('v1.1');
    expect(result.v11Materialization?.tiersAud.food_budget).toBeGreaterThan(0);
  });
});
