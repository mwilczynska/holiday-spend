import { describe, expect, it } from 'vitest';
import {
  deriveCityCostV5,
  V5_ANCHOR_NAMES,
  type V5AnchorInputs,
} from './city-cost-methodology-v5';

function completeInputs(): V5AnchorInputs {
  const values: Record<string, number> = {
    hostel_dorm_bed_1p: 20,
    hostel_private_room_2p: 60,
    hotel_1star_room_2p: 70,
    hotel_2star_room_2p: 90,
    hotel_3star_room_2p: 120,
    hotel_4star_room_2p: 180,
    street_food_meal_1p: 5,
    inexpensive_restaurant_meal_1p: 10,
    midrange_restaurant_meal_2p: 50,
    mcmeal_combo: 12,
    premium_restaurant_meal_2p: 100,
    cappuccino_1: 4,
    domestic_draft_beer_1: 6,
    cocktail_1: 14,
    wine_glass_1: 10,
    paid_attraction_adult_1: 20,
    half_day_group_activity_adult_1: 60,
    full_day_premium_activity_adult_1: 150,
  };
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      { valueAud: value, status: 'observed', sourceIds: [`source:${name}`] },
    ])
  ) as V5AnchorInputs;
}

describe('deriveCityCostV5', () => {
  it('materializes all 19 tiers from a complete anchor panel', () => {
    const result = deriveCityCostV5(completeInputs());

    expect(result.complete).toBe(true);
    expect(Object.keys(result.tiersAud)).toHaveLength(19);
    expect(result.tiersAud.accom_shared_hostel_dorm.amountAud).toBe(40);
    expect(result.tiersAud.food_mid_range.amountAud).toBe(80);
    expect(result.tiersAud.drinks_heavy.amountAud).toBe(120);
    expect(result.tiersAud.activities_high_end.amountAud).toBe(300);
    expect(result.tiersAud.accom_2_star.evidenceBasis).toBe('observed');
    expect(result.tiersAud.food_budget.evidenceBasis).toBe('derived');
    expect(result.tiersAud.activities_free.evidenceBasis).toBe('definitional');
    expect(result.unresolvedAnchors).toEqual([]);
  });

  it('fails closed and identifies every unresolved input', () => {
    const inputs = completeInputs();
    delete inputs.hotel_4star_room_2p;
    inputs.cocktail_1 = { valueAud: null, status: 'blocked' };
    inputs.mcmeal_combo = { valueAud: null, status: 'not_found' };

    const result = deriveCityCostV5(inputs);

    expect(result.complete).toBe(false);
    expect(result.tiersAud.accom_4_star.amountAud).toBeNull();
    expect(result.tiersAud.drinks_moderate.amountAud).toBeNull();
    expect(result.tiersAud.drinks_light.amountAud).toBe(20);
    expect(result.tiersAud.activities_free.amountAud).toBe(0);
    expect(result.tiersAud.accom_4_star.evidenceBasis).toBe('missing');
    expect(result.tiersAud.drinks_moderate.missingAnchors).toEqual(['cocktail_1']);
    expect(result.unresolvedAnchors).toEqual(['hotel_4star_room_2p', 'mcmeal_combo', 'cocktail_1']);
  });

  it('propagates model and imputation provenance without calling it observed', () => {
    const inputs = completeInputs();
    inputs.hotel_4star_room_2p = {
      valueAud: 200,
      status: 'modelled',
      modelVersions: ['hotel-ladder-v5-alpha'],
      imputedMeasures: ['hotel_3star_room_2p'],
    };
    inputs.cocktail_1 = {
      valueAud: 14,
      status: 'imputed',
      modelVersions: ['drink-ratio-v5-alpha'],
      imputedMeasures: ['domestic_draft_beer_1'],
    };

    const result = deriveCityCostV5(inputs);

    expect(result.tiersAud.accom_4_star.evidenceBasis).toBe('modelled');
    expect(result.tiersAud.accom_4_star.modelVersions).toEqual(['hotel-ladder-v5-alpha']);
    expect(result.tiersAud.accom_4_star.imputedMeasures).toEqual(['hotel_3star_room_2p']);
    expect(result.tiersAud.drinks_moderate.evidenceBasis).toBe('imputed');
    expect(result.tiersAud.drinks_heavy.evidenceBasis).toBe('imputed');
    expect(result.tiersAud.accom_2_star.evidenceBasis).toBe('observed');
  });

  it('rejects contradictory anchor status and value combinations', () => {
    expect(() =>
      deriveCityCostV5({
        hostel_dorm_bed_1p: { valueAud: null, status: 'observed' },
      })
    ).toThrow(/status observed is inconsistent/);
    expect(() =>
      deriveCityCostV5({
        hostel_dorm_bed_1p: { valueAud: 20, status: 'class_absent' },
      })
    ).toThrow(/status class_absent is inconsistent/);
  });

  it('keeps the auxiliary McMeal anchor separate from street-food derivation', () => {
    const inputs = completeInputs();
    delete inputs.street_food_meal_1p;
    const result = deriveCityCostV5(inputs);

    expect(result.tiersAud.food_street_food.amountAud).toBeNull();
    expect(result.tiersAud.food_budget.amountAud).toBeNull();
    expect(result.tiersAud.food_high_end.amountAud).toBe(170);
    expect(V5_ANCHOR_NAMES).toContain('mcmeal_combo');
  });
});
