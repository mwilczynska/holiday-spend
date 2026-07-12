export interface CityDrinkInputs {
  drinkCoffee: number | null;
  drinksNone: number | null;
}

function normalizeCost(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

export function roundCityCost(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Resolve the two representations of the coffee-only drinks tier.
 *
 * The canonical input is the per-coffee price, while the planner stores the
 * composed two-coffee daily basket as `drinks_none`. Accepting either side
 * keeps older/generated rows compatible while ensuring a complete, rounded
 * pair when one value is available.
 */
export function resolveCityDrinkInputs(input: {
  drinkCoffee?: number | null;
  drinksNone?: number | null;
}): CityDrinkInputs {
  const drinkCoffee = normalizeCost(input.drinkCoffee);
  const drinksNone = normalizeCost(input.drinksNone);

  if (drinkCoffee != null) {
    return {
      drinkCoffee,
      drinksNone: roundCityCost(drinkCoffee * 2),
    };
  }

  if (drinksNone != null) {
    const derivedCoffee = roundCityCost(drinksNone / 2);
    return {
      drinkCoffee: derivedCoffee,
      drinksNone: roundCityCost(derivedCoffee * 2),
    };
  }

  return {
    drinkCoffee: null,
    drinksNone: null,
  };
}
