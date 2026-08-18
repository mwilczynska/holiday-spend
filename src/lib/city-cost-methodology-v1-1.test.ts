import { describe, expect, it } from 'vitest';
import {
  CITY_COST_V11_FX,
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
  anchors_usd: anchors,
};

describe('city-cost-methodology-v1-1', () => {
  it('requires all ten positive anchors and rejects derived/output fields', () => {
    expect(cityCostV11AnchorResponseSchema.parse(response)).toEqual(response);
    expect(() => cityCostV11AnchorResponseSchema.parse({ ...response, tiers_aud: {} })).toThrow();
    expect(() => cityCostV11AnchorResponseSchema.parse({ ...response, anchors_usd: { ...anchors, beer: 0 } })).toThrow();
  });

  it('materializes the exact v1 formulas with server-side FX and rounding', () => {
    const materialized = materializeCityCostV11(response);

    expect(materialized.methodologyVersion).toBe(CITY_COST_V11_METHODOLOGY_VERSION);
    expect(materialized.formulaVersion).toBe(CITY_COST_V11_FORMULA_VERSION);
    expect(materialized.fx.snapshotId).toBe('aud-reference-2026-07-22-v1');
    expect(materialized.fx.audPerUsd).toBe(CITY_COST_V11_FX.audPerUsd);
    expect(Object.keys(materialized.tiersAud)).toHaveLength(19);
    expect(materialized.tiersAud).toMatchObject({
      accom_shared_hostel_dorm: 34,
      accom_hostel_private_room: 43,
      accom_1_star: 71,
      accom_2_star: 107,
      accom_3_star: 143,
      accom_4_star: 257,
      food_street_food: 51,
      food_budget: 63,
      food_mid_range: 103,
      food_high_end: 154,
      drink_coffee: 4.29,
      drinks_none: 9,
      drinks_light: 14,
      drinks_moderate: 43,
      drinks_heavy: 89,
      activities_free: 0,
      activities_budget: 29,
      activities_mid_range: 79,
      activities_high_end: 172,
    });
    expect(materialized.mappedEstimate).toMatchObject({
      drinkLocalBeer: 2.86,
      drinkCoffee: 4.29,
      drinkCocktail: 11.44,
      drinkWineGlass: 8.58,
    });
  });

  it('does not let the model supply FX or derived tiers', () => {
    const materialized = materializeCityCostV11(response);
    expect(materialized.anchorsUsd).toEqual(anchors);
    expect(materialized.tiersAud.accom_4_star).toBe(
      Math.round(anchors.hotel_3star_2p * 1.8 * CITY_COST_V11_FX.audPerUsd)
    );
  });
});
