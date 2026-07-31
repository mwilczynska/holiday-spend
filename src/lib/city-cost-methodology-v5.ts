/**
 * The v5 derivation boundary.
 *
 * This module deliberately contains no web access, currency conversion, or
 * statistical coefficients. Collection and FX conversion must produce the
 * `V5AnchorInput` map first; this function then applies only the frozen basket
 * definitions and preserves provenance. It is an experiment contract, not yet
 * the shipping city-generation path.
 */

export const V5_ANCHOR_NAMES = [
  'hostel_dorm_bed_1p',
  'hostel_private_room_2p',
  'hotel_1star_room_2p',
  'hotel_2star_room_2p',
  'hotel_3star_room_2p',
  'hotel_4star_room_2p',
  'street_food_meal_1p',
  'inexpensive_restaurant_meal_1p',
  'midrange_restaurant_meal_2p',
  'mcmeal_combo',
  'premium_restaurant_meal_2p',
  'cappuccino_1',
  'domestic_draft_beer_1',
  'cocktail_1',
  'wine_glass_1',
  'paid_attraction_adult_1',
  'half_day_group_activity_adult_1',
  'full_day_premium_activity_adult_1',
] as const;

export type V5AnchorName = (typeof V5_ANCHOR_NAMES)[number];

export const V5_TIER_NAMES = [
  'accom_shared_hostel_dorm',
  'accom_hostel_private_room',
  'accom_1_star',
  'accom_2_star',
  'accom_3_star',
  'accom_4_star',
  'food_street_food',
  'food_budget',
  'food_mid_range',
  'food_high_end',
  'drink_coffee',
  'drinks_none',
  'drinks_light',
  'drinks_moderate',
  'drinks_heavy',
  'activities_free',
  'activities_budget',
  'activities_mid_range',
  'activities_high_end',
] as const;

export type V5TierName = (typeof V5_TIER_NAMES)[number];

export type V5AnchorStatus =
  | 'observed'
  | 'modelled'
  | 'imputed'
  | 'not_found'
  | 'blocked'
  | 'class_absent';

export type V5EvidenceBasis =
  | 'observed'
  | 'derived'
  | 'modelled'
  | 'imputed'
  | 'definitional'
  | 'missing';

export interface V5AnchorInput {
  /** Value after deterministic FX conversion, never a model output in AUD. */
  valueAud: number | null;
  status: V5AnchorStatus;
  sourceIds?: string[];
  modelVersions?: string[];
  /** Original anchors used by a modelled or imputed input. */
  imputedMeasures?: V5AnchorName[];
}

export type V5AnchorInputs = Partial<Record<V5AnchorName, V5AnchorInput>>;

export interface V5MaterializedTier {
  amountAud: number | null;
  formula: string;
  parentAnchors: V5AnchorName[];
  missingAnchors: V5AnchorName[];
  evidenceBasis: V5EvidenceBasis;
  imputedMeasures: V5AnchorName[];
  sourceIds: string[];
  modelVersions: string[];
}

export interface V5Materialization {
  schemaVersion: 'city-cost-materialization-v5-experiment-1';
  tiersAud: Record<V5TierName, V5MaterializedTier>;
  complete: boolean;
  unresolvedAnchors: V5AnchorName[];
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function validateInput(name: V5AnchorName, input: V5AnchorInput) {
  if (!Number.isFinite(input.valueAud ?? 0) || (input.valueAud !== null && input.valueAud < 0)) {
    throw new Error(`${name} must have a finite, non-negative valueAud or null`);
  }
  const valueRequired = input.status === 'observed' || input.status === 'modelled' || input.status === 'imputed';
  if (valueRequired !== (input.valueAud !== null)) {
    throw new Error(`${name} status ${input.status} is inconsistent with valueAud`);
  }
}

function basisFor(inputs: V5AnchorInput[]) {
  if (inputs.some((input) => input.status === 'imputed')) return 'imputed' as const;
  if (inputs.some((input) => input.status === 'modelled')) return 'modelled' as const;
  return inputs.length === 1 ? ('observed' as const) : ('derived' as const);
}

function tier(
  inputs: V5AnchorInputs,
  parentAnchors: V5AnchorName[],
  formula: string,
  calculate: (value: (anchor: V5AnchorName) => number) => number
): V5MaterializedTier {
  const missingAnchors = parentAnchors.filter((anchor) => {
    const input = inputs[anchor];
    return !input || input.valueAud === null;
  });
  const shared = {
    formula,
    parentAnchors,
    missingAnchors,
    sourceIds: unique(
      parentAnchors.flatMap((anchor) => inputs[anchor]?.sourceIds ?? [])
    ),
    modelVersions: unique(
      parentAnchors.flatMap((anchor) => inputs[anchor]?.modelVersions ?? [])
    ),
  };
  if (missingAnchors.length) {
    return {
      ...shared,
      amountAud: null,
      evidenceBasis: 'missing',
      imputedMeasures: [],
    };
  }

  const parentInputs = parentAnchors.map((anchor) => inputs[anchor]!);
  const imputedMeasures = unique([
    ...parentAnchors.filter((anchor) => inputs[anchor]!.status === 'imputed'),
    ...parentInputs.flatMap((input) => input.imputedMeasures ?? []),
  ]);
  const amountAud = calculate((anchor) => inputs[anchor]!.valueAud!);
  if (!Number.isFinite(amountAud) || amountAud < 0) {
    throw new Error(`Formula ${formula} produced an invalid amount`);
  }
  return {
    ...shared,
    amountAud: money(amountAud),
    evidenceBasis: basisFor(parentInputs),
    imputedMeasures,
  };
}

/**
 * Materialize the 19 product values from a validated anchor panel.
 *
 * `mcmeal_combo` is retained as an auxiliary collected anchor for source and
 * model experiments; it is intentionally not silently substituted for a
 * street-food or inexpensive-restaurant measure.
 */
export function deriveCityCostV5(inputs: V5AnchorInputs): V5Materialization {
  for (const [name, input] of Object.entries(inputs) as [V5AnchorName, V5AnchorInput][]) {
    if (input) validateInput(name, input);
  }

  const tiersAud: Record<V5TierName, V5MaterializedTier> = {
    accom_shared_hostel_dorm: tier(inputs, ['hostel_dorm_bed_1p'], '2 * hostel_dorm_bed_1p', (v) =>
      2 * v('hostel_dorm_bed_1p')
    ),
    accom_hostel_private_room: tier(inputs, ['hostel_private_room_2p'], 'hostel_private_room_2p', (v) =>
      v('hostel_private_room_2p')
    ),
    accom_1_star: tier(inputs, ['hotel_1star_room_2p'], 'hotel_1star_room_2p', (v) =>
      v('hotel_1star_room_2p')
    ),
    accom_2_star: tier(inputs, ['hotel_2star_room_2p'], 'hotel_2star_room_2p', (v) =>
      v('hotel_2star_room_2p')
    ),
    accom_3_star: tier(inputs, ['hotel_3star_room_2p'], 'hotel_3star_room_2p', (v) =>
      v('hotel_3star_room_2p')
    ),
    accom_4_star: tier(inputs, ['hotel_4star_room_2p'], 'hotel_4star_room_2p', (v) =>
      v('hotel_4star_room_2p')
    ),
    food_street_food: tier(inputs, ['street_food_meal_1p'], '6 * street_food_meal_1p', (v) =>
      6 * v('street_food_meal_1p')
    ),
    food_budget: tier(
      inputs,
      ['street_food_meal_1p', 'inexpensive_restaurant_meal_1p'],
      '4 * street_food_meal_1p + 2 * inexpensive_restaurant_meal_1p',
      (v) => 4 * v('street_food_meal_1p') + 2 * v('inexpensive_restaurant_meal_1p')
    ),
    food_mid_range: tier(
      inputs,
      ['street_food_meal_1p', 'inexpensive_restaurant_meal_1p', 'midrange_restaurant_meal_2p'],
      '2 * street_food_meal_1p + 2 * inexpensive_restaurant_meal_1p + midrange_restaurant_meal_2p',
      (v) =>
        2 * v('street_food_meal_1p') +
        2 * v('inexpensive_restaurant_meal_1p') +
        v('midrange_restaurant_meal_2p')
    ),
    food_high_end: tier(
      inputs,
      ['inexpensive_restaurant_meal_1p', 'midrange_restaurant_meal_2p', 'premium_restaurant_meal_2p'],
      '2 * inexpensive_restaurant_meal_1p + midrange_restaurant_meal_2p + premium_restaurant_meal_2p',
      (v) =>
        2 * v('inexpensive_restaurant_meal_1p') +
        v('midrange_restaurant_meal_2p') +
        v('premium_restaurant_meal_2p')
    ),
    drink_coffee: tier(inputs, ['cappuccino_1'], 'cappuccino_1', (v) => v('cappuccino_1')),
    drinks_none: tier(inputs, ['cappuccino_1'], '2 * cappuccino_1', (v) => 2 * v('cappuccino_1')),
    drinks_light: tier(inputs, ['cappuccino_1', 'domestic_draft_beer_1'], '2 * cappuccino_1 + 2 * domestic_draft_beer_1',
      (v) => 2 * v('cappuccino_1') + 2 * v('domestic_draft_beer_1')
    ),
    drinks_moderate: tier(inputs, ['cappuccino_1', 'domestic_draft_beer_1', 'cocktail_1'],
      '2 * cappuccino_1 + 4 * domestic_draft_beer_1 + 2 * cocktail_1',
      (v) => 2 * v('cappuccino_1') + 4 * v('domestic_draft_beer_1') + 2 * v('cocktail_1')
    ),
    drinks_heavy: tier(inputs, ['cappuccino_1', 'domestic_draft_beer_1', 'cocktail_1', 'wine_glass_1'],
      '2 * cappuccino_1 + 6 * domestic_draft_beer_1 + 4 * cocktail_1 + 2 * wine_glass_1',
      (v) =>
        2 * v('cappuccino_1') +
        6 * v('domestic_draft_beer_1') +
        4 * v('cocktail_1') +
        2 * v('wine_glass_1')
    ),
    activities_free: {
      amountAud: 0,
      formula: '0 (definitional)',
      parentAnchors: [],
      missingAnchors: [],
      evidenceBasis: 'definitional',
      imputedMeasures: [],
      sourceIds: [],
      modelVersions: [],
    },
    activities_budget: tier(inputs, ['paid_attraction_adult_1'], '2 * paid_attraction_adult_1', (v) =>
      2 * v('paid_attraction_adult_1')
    ),
    activities_mid_range: tier(inputs, ['half_day_group_activity_adult_1'], '2 * half_day_group_activity_adult_1', (v) =>
      2 * v('half_day_group_activity_adult_1')
    ),
    activities_high_end: tier(inputs, ['full_day_premium_activity_adult_1'], '2 * full_day_premium_activity_adult_1', (v) =>
      2 * v('full_day_premium_activity_adult_1')
    ),
  };

  return {
    schemaVersion: 'city-cost-materialization-v5-experiment-1',
    tiersAud,
    complete: V5_TIER_NAMES.every((name) => tiersAud[name].amountAud !== null),
    unresolvedAnchors: V5_ANCHOR_NAMES.filter((anchor) => {
      const input = inputs[anchor];
      return !input || input.valueAud === null;
    }),
  };
}
