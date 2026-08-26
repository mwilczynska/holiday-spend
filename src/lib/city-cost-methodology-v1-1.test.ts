import { describe, expect, it } from 'vitest';
import {
  CITY_COST_V11_FORMULA_VERSION,
  CITY_COST_V11_METHODOLOGY_VERSION,
  cityCostV11AnchorResponseSchema,
  materializeCityCostV11,
} from '@/lib/city-cost-methodology-v1-1';

const anchors = {
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
};

const response = {
  region: 'Europe' as const,
  confidence: 'medium' as const,
  confidence_notes: 'Holistic test fixture.',
  comparable_city_reasoning: 'Comparable city test fixture.',
  fx: {
    as_of_date: '2026-08-25',
    source_name: 'Reserve Bank of Australia',
    source_url: 'https://www.rba.gov.au/statistics/frequency/exchange-rates.html',
    source_rate: 0.715,
    source_rate_basis: 'USD_PER_AUD' as const,
  },
  anchors_usd: anchors,
};

const now = new Date('2026-08-26T12:00:00Z');

describe('city-cost-methodology-v1-1', () => {
  it('requires all ten positive anchors and rejects derived/output fields', () => {
    expect(cityCostV11AnchorResponseSchema.parse(response)).toEqual(response);
    expect(() => cityCostV11AnchorResponseSchema.parse({ ...response, tiers_aud: {} })).toThrow();
    expect(() => cityCostV11AnchorResponseSchema.parse({ ...response, anchors_usd: { ...anchors, beer: 0 } })).toThrow();
  });

  it('materializes the exact v1 formulas with server-side FX and rounding', () => {
    const materialized = materializeCityCostV11(response, now);

    expect(materialized.methodologyVersion).toBe(CITY_COST_V11_METHODOLOGY_VERSION);
    expect(materialized.formulaVersion).toBe(CITY_COST_V11_FORMULA_VERSION);
    expect(materialized.fx.snapshotId).toBe('llm-rba-fx-2026-08-25');
    expect(materialized.fx.audPerUsd).toBe(1.398601);
    expect(Object.keys(materialized.tiersAud)).toHaveLength(19);
    expect(materialized.tiersAud).toMatchObject({
      accom_shared_hostel_dorm: 34,
      accom_hostel_private_room: 42,
      accom_1_star: 70,
      accom_2_star: 105,
      accom_3_star: 140,
      accom_4_star: 252,
      food_street_food: 50,
      food_budget: 62,
      food_mid_range: 101,
      food_high_end: 151,
      drink_coffee: 4.2,
      drinks_none: 8,
      drinks_light: 14,
      drinks_moderate: 42,
      drinks_heavy: 87,
      activities_free: 0,
      activities_budget: 28,
      activities_mid_range: 77,
      activities_high_end: 168,
    });
    expect(materialized.mappedEstimate).toMatchObject({
      drinkLocalBeer: 2.8,
      drinkCoffee: 4.2,
      drinkCocktail: 11.19,
      drinkWineGlass: 8.39,
    });
  });

  it('does not let the model supply FX or derived tiers', () => {
    const materialized = materializeCityCostV11(response, now);
    expect(materialized.anchorsUsd).toEqual(anchors);
    expect(materialized.tiersAud.accom_4_star).toBe(
      Math.round(anchors.hotel_3star_2p * 1.8 * materialized.fx.audPerUsd)
    );
  });

  it('fails closed for stale or non-RBA FX observations', () => {
    expect(() => materializeCityCostV11({
      ...response,
      fx: { ...response.fx, as_of_date: '2026-07-22' },
    }, now)).toThrow('within the last seven days');
    expect(() => materializeCityCostV11({
      ...response,
      fx: { ...response.fx, source_url: 'https://example.com/rate' },
    }, now)).toThrow('official Reserve Bank of Australia');
    expect(() => materializeCityCostV11({
      ...response,
      fx: { ...response.fx, as_of_date: '2026-02-30' },
    }, now)).toThrow();
    expect(() => materializeCityCostV11({
      ...response,
      fx: { ...response.fx, source_rate: 715 },
    }, now)).toThrow();
  });
});
