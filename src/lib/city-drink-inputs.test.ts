import { describe, expect, it } from 'vitest';
import { resolveCityDrinkInputs, roundCityCost } from '@/lib/city-drink-inputs';

describe('city drink inputs', () => {
  it('derives the two-coffee daily basket from a coffee unit price', () => {
    expect(resolveCityDrinkInputs({ drinkCoffee: 2.35 })).toEqual({
      drinkCoffee: 2.35,
      drinksNone: 4.7,
    });
  });

  it('derives the coffee unit price from a stored none tier', () => {
    expect(resolveCityDrinkInputs({ drinksNone: 5.01 })).toEqual({
      drinkCoffee: 2.51,
      drinksNone: 5.02,
    });
  });

  it('treats coffee as canonical when both values are supplied', () => {
    expect(resolveCityDrinkInputs({ drinkCoffee: 2.4, drinksNone: 4.75 })).toEqual({
      drinkCoffee: 2.4,
      drinksNone: 4.8,
    });
  });

  it('rejects invalid negative and non-finite values', () => {
    expect(resolveCityDrinkInputs({ drinkCoffee: -1 })).toEqual({
      drinkCoffee: null,
      drinksNone: null,
    });
    expect(resolveCityDrinkInputs({ drinksNone: Number.NaN })).toEqual({
      drinkCoffee: null,
      drinksNone: null,
    });
  });

  it('rounds generated city costs to cents', () => {
    expect(roundCityCost(1.005)).toBe(1.01);
  });
});
