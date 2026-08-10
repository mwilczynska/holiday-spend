import { describe, expect, it } from 'vitest';
import {
  buildV6Priors,
  materializeCityCostV6,
  type V6AnchorInputs,
} from './city-cost-methodology-v6';

const priors = buildV6Priors(
  [
    {
      region: 'Europe',
      values: {
        hostel_dorm_bed_1p: 20,
        hostel_private_room_2p: 50,
        hotel_1star_room_2p: 60,
        hotel_2star_room_2p: 75,
        hotel_3star_room_2p: 100,
        hotel_4star_room_2p: 140,
        street_food_meal_1p: 5,
        inexpensive_restaurant_meal_1p: 10,
        midrange_restaurant_meal_2p: 50,
        premium_restaurant_meal_2p: 90,
        mcmeal_combo: 8,
        cappuccino_1: 4,
        domestic_draft_beer_1: 5,
        cocktail_1: 12,
        wine_glass_1: 9,
        paid_attraction_adult_1: 15,
        half_day_group_activity_adult_1: 40,
        full_day_premium_activity_adult_1: 100,
      },
    },
  ],
  { lowMax: 54.25, midMax: 116.25 }
);

function observed(valueAud: number, evidenceGrade: 'A' | 'B' = 'A') {
  return {
    valueAud,
    status: 'observed' as const,
    evidenceGrade,
    sourceIds: ['test-source'],
  };
}

describe('materializeCityCostV6', () => {
  it('reads the ladder coefficients and produces all 19 values with propagated grades', () => {
    const anchors: V6AnchorInputs = {
      hotel_3star_room_2p: observed(100, 'B'),
      inexpensive_restaurant_meal_1p: observed(10),
      midrange_restaurant_meal_2p: observed(50),
      mcmeal_combo: observed(8),
      cappuccino_1: observed(4),
      domestic_draft_beer_1: observed(5),
      paid_attraction_adult_1: observed(15, 'B'),
      half_day_group_activity_adult_1: observed(40, 'B'),
      full_day_premium_activity_adult_1: observed(100, 'B'),
    };

    const result = materializeCityCostV6({
      city: 'Test City',
      country: 'Testland',
      region: 'europe',
      anchors,
      priors,
    });

    expect(result.complete).toBe(true);
    expect(Object.keys(result.tiersAud)).toHaveLength(19);
    expect(result.tiersAud.accom_shared_hostel_dorm.amountAud).toBe(59.1);
    expect(result.tiersAud.accom_hostel_private_room.amountAud).toBe(59.19);
    expect(result.tiersAud.accom_1_star.amountAud).toBe(66.63);
    expect(result.tiersAud.accom_2_star.amountAud).toBe(75);
    expect(result.tiersAud.accom_3_star.amountAud).toBe(100);
    expect(result.tiersAud.accom_4_star.amountAud).toBe(133.72);
    expect(result.tiersAud.accom_3_star.evidenceGrade).toBe('B');
    expect(result.tiersAud.accom_2_star.evidenceGrade).toBe('C');
    expect(result.tiersAud.activities_budget.evidenceGrade).toBe('B');
    expect(result.tiersAud.food_budget.evidenceGrade).toBe('B');
    expect(result.tiersAud.food_high_end.evidenceGrade).toBe('D');
    expect(result.tiersAud.accom_4_star.interval.widthPct).toBe(25);
    expect(result.mappedEstimate.accom4star).toBe(133.72);
  });

  it('falls back to regional priors and retains missingness instead of returning blanks', () => {
    const result = materializeCityCostV6({
      city: 'Sparse City',
      country: 'Testland',
      region: 'Europe',
      anchors: {
        hotel_3star_room_2p: { valueAud: null, status: 'blocked', evidenceGrade: 'D', missingness: 'blocked' },
      },
      priors,
    });

    expect(Object.values(result.tiersAud).every((tier) => typeof tier.amountAud === 'number')).toBe(true);
    expect(Object.values(result.tiersAud).every((tier) => tier.evidenceGrade !== undefined)).toBe(true);
    expect(result.tiersAud.accom_3_star.evidenceGrade).toBe('D');
    expect(result.tiersAud.accom_3_star.interval.widthPct).toBe(45);
    expect(result.missingness.hotel_3star_room_2p).toBe('blocked');
    expect(result.tiersAud.activities_free.evidenceGrade).toBe('definitional');
  });

  it('can cold-start from the canonical 121-city prior source', () => {
    const result = materializeCityCostV6({
      city: 'Unknown City',
      country: 'Unknown Country',
      region: 'Europe',
      anchors: {},
    });

    expect(Object.values(result.tiersAud).every((tier) => typeof tier.amountAud === 'number')).toBe(true);
    expect(Object.values(result.tiersAud).every((tier) => tier.interval !== undefined)).toBe(true);
  });
});
