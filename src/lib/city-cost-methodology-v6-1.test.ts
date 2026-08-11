import { describe, expect, it } from 'vitest';
import { V5_TIER_NAMES, type V5TierName } from './city-cost-methodology-v5';
import type { V6AnchorInput, V6Priors } from './city-cost-methodology-v6';
import {
  materializeCityCostV61,
  type V61Materialization,
} from './city-cost-methodology-v6-1';
import type { V61AnchorInputs, V61SourceMeasure } from './city-cost-v6-1-collection';

function observed(valueAud: number, evidenceGrade: 'A' | 'B', sourceId: string): V6AnchorInput {
  return {
    valueAud,
    status: 'observed',
    evidenceGrade,
    sourceIds: [sourceId],
    modelVersions: ['test-fixture-v1'],
  };
}

function missing(status: 'blocked' | 'not_found' = 'blocked'): V6AnchorInput {
  return {
    valueAud: null,
    status,
    evidenceGrade: 'D',
    missingness: status,
    sourceIds: [],
    modelVersions: ['test-fixture-v1'],
  };
}

const fallbackTiers: Record<V5TierName, number> = {
  accom_shared_hostel_dorm: 20,
  accom_hostel_private_room: 50,
  accom_1_star: 60,
  accom_2_star: 75,
  accom_3_star: 100,
  accom_4_star: 140,
  food_street_food: 5,
  food_budget: 20,
  food_mid_range: 50,
  food_high_end: 90,
  drink_coffee: 4,
  drinks_none: 8,
  drinks_light: 18,
  drinks_moderate: 45,
  drinks_heavy: 75,
  activities_free: 0,
  activities_budget: 15,
  activities_mid_range: 40,
  activities_high_end: 100,
};

const testPriors: V6Priors = {
  byRegionBand: {},
  byRegion: {},
  global: {},
  tierValuesByRegionBand: {},
  tierValuesByRegion: { Europe: fallbackTiers },
  tierValuesGlobal: fallbackTiers,
  bandCuts: { lowMax: 54.25, midMax: 116.25 },
};

function completeSources(): V61AnchorInputs {
  return {
    hotel_3star_room_2p: observed(100, 'B', 'expedia:test'),
    byt_food_budget_per_person_day: observed(10, 'B', 'byt:test'),
    byt_food_mid_per_person_day: observed(20, 'B', 'byt:test'),
    byt_food_high_per_person_day: observed(40, 'B', 'byt:test'),
    byt_activities_budget_per_person_day: observed(5, 'B', 'byt:test'),
    byt_activities_mid_per_person_day: observed(15, 'B', 'byt:test'),
    byt_activities_high_per_person_day: observed(30, 'B', 'byt:test'),
    cappuccino_1: observed(4, 'A', 'numbeo:test'),
    domestic_draft_beer_1: observed(5, 'A', 'numbeo:test'),
  };
}

function materialize(anchors: V61AnchorInputs, priors = testPriors): V61Materialization {
  return materializeCityCostV61({
    city: 'Test City',
    country: 'Testland',
    region: 'Europe',
    anchors,
    priors,
  });
}

describe('materializeCityCostV61', () => {
  it('derives all 19 tiers from the three source-native vectors', () => {
    const result = materialize(completeSources());

    expect(result.complete).toBe(true);
    expect(Object.keys(result.tiersAud)).toHaveLength(19);
    expect(Object.keys(result.tiersAud)).toEqual([...V5_TIER_NAMES]);
    expect(result.tiersAud.accom_3_star.amountAud).toBe(100);
    expect(result.tiersAud.accom_4_star.amountAud).toBe(133.72);
    expect(result.tiersAud.accom_shared_hostel_dorm.amountAud).toBe(59.1);
    expect(result.tiersAud.food_budget.amountAud).toBe(20);
    expect(result.tiersAud.food_mid_range.amountAud).toBe(40);
    expect(result.tiersAud.food_high_end.amountAud).toBe(80);
    expect(result.tiersAud.food_street_food.amountAud).toBeCloseTo(10.66, 2);
    expect(result.tiersAud.drinks_none.amountAud).toBe(8);
    expect(result.tiersAud.drinks_light.amountAud).toBe(18);
    expect(result.tiersAud.activities_budget.amountAud).toBe(10);
    expect(result.tiersAud.activities_mid_range.amountAud).toBe(30);
    expect(result.tiersAud.activities_high_end.amountAud).toBe(60);
    expect(result.tiersAud.activities_free.evidenceGrade).toBe('definitional');
    expect(result.tiersAud.food_budget.evidenceGrade).toBe('B');
    expect(result.tiersAud.food_street_food.evidenceGrade).toBe('D');
    expect(result.tiersAud.drinks_moderate.evidenceGrade).toBe('C');
    expect(result.tiersAud.food_budget.formula).toBe('2 * byt_food_budget_per_person_day');
    expect(result.tiersAud.food_budget.parentAnchors).toEqual(['byt_food_budget_per_person_day']);
    expect(result.anchors.byt_food_budget_per_person_day.status).toBe('observed');
    expect(result.anchors.cocktail_1.status).toBe('modelled');
    expect(result.mappedEstimate.drinkCoffee).toBe(4);
    expect(result.mappedEstimate.drinkLocalBeer).toBe(5);
    expect(result.mappedEstimate.drinkCocktail).toBe(10.4);
    expect(result.mappedEstimate.drinkWineGlass).toBeUndefined();
  });

  it('uses one category vector fallback and preserves missingness', () => {
    const anchors: V61AnchorInputs = {
      hotel_3star_room_2p: missing(),
      ...Object.fromEntries(
        [
          'byt_food_budget_per_person_day',
          'byt_food_mid_per_person_day',
          'byt_food_high_per_person_day',
          'byt_activities_budget_per_person_day',
          'byt_activities_mid_per_person_day',
          'byt_activities_high_per_person_day',
          'cappuccino_1',
          'domestic_draft_beer_1',
        ].map((measure) => [measure, missing('not_found')])
      ) as Partial<Record<V61SourceMeasure, V6AnchorInput>>,
    };
    const result = materialize(anchors);

    expect(Object.values(result.tiersAud)).toHaveLength(19);
    expect(Object.values(result.tiersAud).every((tier) => typeof tier.amountAud === 'number')).toBe(true);
    expect(result.tiersAud.food_budget.amountAud).toBe(20);
    expect(result.tiersAud.food_mid_range.amountAud).toBe(50);
    expect(result.tiersAud.food_high_end.amountAud).toBe(90);
    expect(result.tiersAud.drinks_heavy.amountAud).toBe(75);
    expect(result.tiersAud.activities_high_end.amountAud).toBe(100);
    expect(result.tiersAud.food_budget.evidenceGrade).toBe('D');
    expect(result.tiersAud.drinks_heavy.evidenceGrade).toBe('D');
    expect(result.tiersAud.activities_high_end.evidenceGrade).toBe('D');
    expect(result.tiersAud.food_budget.imputedMeasures).toEqual([
      'byt_food_budget_per_person_day',
      'byt_food_mid_per_person_day',
      'byt_food_high_per_person_day',
    ]);
    expect(result.missingness.hotel_3star_room_2p).toBe('blocked');
    expect(result.missingness.byt_food_budget_per_person_day).toBe('not_found');
    expect(result.mappedEstimate.drinkCoffee).toBe(4);
    expect(result.mappedEstimate.drinkLocalBeer).toBe(5);
    expect(result.mappedEstimate.drinkCocktail).toBe(8.5);
  });

  it('loads the generated v6.1 priors for a cold-start city', () => {
    const result = materializeCityCostV61({
      city: 'Cold Start City',
      country: 'Testland',
      region: 'Europe',
      anchors: {},
    });

    expect(Object.keys(result.tiersAud)).toHaveLength(19);
    expect(Object.values(result.tiersAud).every((tier) => Number.isFinite(tier.amountAud))).toBe(true);
    expect(result.tiersAud.accom_3_star.evidenceGrade).toBe('D');
    expect(result.priorBasis).toContain('regional then global category-tier fallback');
  });
});
