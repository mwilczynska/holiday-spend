import { createHash } from 'node:crypto';
import fxSnapshot from '../../data/reference/fx/city_cost_fx_aud_2026-07-22.json';
import type { CityEstimateData } from '@/types';
import { z } from 'zod';

export const CITY_COST_V11_METHODOLOGY_VERSION = 'v1.1' as const;
export const CITY_COST_V11_PROMPT_VERSION = 'llm_prompt_new_cities_v1_1.md';
export const CITY_COST_V11_FORMULA_VERSION = 'v1-formulas-preserved-v1.1';

const positiveNumber = z.number().finite().positive();

export const cityCostV11AnchorSchema = z
  .object({
    beer: positiveNumber,
    coffee: positiveNumber,
    inexp_meal_1p: positiveNumber,
    midrange_meal_2p: positiveNumber,
    cocktail: positiveNumber,
    wine_glass: positiveNumber,
    hostel_dorm_1p: positiveNumber,
    hostel_private_2p: positiveNumber,
    hotel_1star_2p: positiveNumber,
    hotel_3star_2p: positiveNumber,
  })
  .strict();

export const cityCostV11AnchorResponseSchema = z
  .object({
    region: z.enum([
      'SEA',
      'East Asia',
      'South Asia',
      'Middle East',
      'Africa',
      'Europe',
      'Latin America',
      'North America',
      'Oceania',
    ]),
    confidence: z.enum(['low', 'medium', 'high']),
    confidence_notes: z.string().trim().min(1),
    comparable_city_reasoning: z.string().trim().min(1),
    anchors_usd: cityCostV11AnchorSchema,
  })
  .strict();

export type CityCostV11AnchorResponse = z.infer<typeof cityCostV11AnchorResponseSchema>;
export type CityCostV11AnchorsUsd = z.infer<typeof cityCostV11AnchorSchema>;

export const CITY_COST_V11_FX = {
  snapshotId: fxSnapshot.snapshotId,
  asOfDate: fxSnapshot.asOfDate,
  baseCurrency: fxSnapshot.baseCurrency,
  currency: fxSnapshot.rates.USD.currency,
  audPerUsd: fxSnapshot.rates.USD.audPerUnit,
  sourceName: fxSnapshot.rates.USD.sourceName,
  sourceUrl: fxSnapshot.rates.USD.sourceUrl,
  sourceDate: fxSnapshot.rates.USD.sourceDate,
  sourceQuote: fxSnapshot.rates.USD.sourceQuote,
  derivation: fxSnapshot.rates.USD.derivation,
  derivationFormula: fxSnapshot.rates.USD.derivationFormula,
  contentHash: createHash('sha256').update(JSON.stringify(fxSnapshot)).digest('hex'),
} as const;

export interface CityCostV11Materialization {
  methodologyVersion: typeof CITY_COST_V11_METHODOLOGY_VERSION;
  formulaVersion: typeof CITY_COST_V11_FORMULA_VERSION;
  fx: typeof CITY_COST_V11_FX;
  anchorsUsd: CityCostV11AnchorsUsd;
  anchorsAud: Record<keyof CityCostV11AnchorsUsd, number>;
  tiersUsd: Record<string, number>;
  tiersAud: Record<string, number>;
  mappedEstimate: Partial<CityEstimateData>;
}

function roundAud(value: number) {
  return Math.round(value);
}

function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}

function ensureFinitePositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`v1.1 ${label} must be finite and positive.`);
  }
}

function convertAnchorMap(anchors: CityCostV11AnchorsUsd) {
  return Object.fromEntries(
    Object.entries(anchors).map(([key, value]) => [key, roundCents(value * CITY_COST_V11_FX.audPerUsd)])
  ) as Record<keyof CityCostV11AnchorsUsd, number>;
}

function buildTiersUsd(anchors: CityCostV11AnchorsUsd) {
  const streetFoodMeal = anchors.inexp_meal_1p * 0.6;
  const blendedActivity = (anchors.inexp_meal_1p + 10.0) / 2;

  return {
    accom_shared_hostel_dorm: anchors.hostel_dorm_1p * 2,
    accom_hostel_private_room: anchors.hostel_private_2p,
    accom_1_star: anchors.hotel_1star_2p,
    accom_2_star: (anchors.hotel_1star_2p + anchors.hotel_3star_2p) / 2,
    accom_3_star: anchors.hotel_3star_2p,
    // Deliberately preserved from v1 for formula parity in the first release.
    accom_4_star: anchors.hotel_3star_2p * 1.8,
    food_street_food: streetFoodMeal * 3 * 2,
    food_budget: (streetFoodMeal * 2 + anchors.inexp_meal_1p) * 2,
    food_mid_range: (streetFoodMeal + anchors.inexp_meal_1p + anchors.midrange_meal_2p / 2) * 2,
    food_high_end: (streetFoodMeal + anchors.inexp_meal_1p + anchors.midrange_meal_2p / 2) * 2 * 1.5,
    drinks_none: 2 * anchors.coffee,
    drinks_light: 2 * anchors.coffee + 2 * anchors.beer,
    drinks_moderate: 2 * anchors.coffee + 4 * anchors.beer + 2 * anchors.cocktail,
    drinks_heavy: 2 * anchors.coffee + 6 * anchors.beer + 4 * anchors.cocktail + 2 * anchors.wine_glass,
    activities_free: 0,
    activities_budget: blendedActivity * 2,
    activities_mid_range: blendedActivity * 5.5,
    activities_high_end: blendedActivity * 12,
  };
}

function convertTierMap(tiersUsd: Record<string, number>) {
  return Object.fromEntries(Object.entries(tiersUsd).map(([key, value]) => [key, roundAud(value * CITY_COST_V11_FX.audPerUsd)]));
}

export function materializeCityCostV11(input: unknown): CityCostV11Materialization {
  const parsed = cityCostV11AnchorResponseSchema.parse(input);
  const anchors = parsed.anchors_usd;
  Object.entries(anchors).forEach(([key, value]) => ensureFinitePositive(value, `anchor ${key}`));

  const tiersUsd = buildTiersUsd(anchors);
  const tiersAud = convertTierMap(tiersUsd);
  const anchorsAud = convertAnchorMap(anchors);

  return {
    methodologyVersion: CITY_COST_V11_METHODOLOGY_VERSION,
    formulaVersion: CITY_COST_V11_FORMULA_VERSION,
    fx: CITY_COST_V11_FX,
    anchorsUsd: anchors,
    anchorsAud,
    tiersUsd,
    tiersAud,
    mappedEstimate: {
      accomHostel: tiersAud.accom_shared_hostel_dorm,
      accomPrivateRoom: tiersAud.accom_hostel_private_room,
      accom1star: tiersAud.accom_1_star,
      accom2star: tiersAud.accom_2_star,
      accom3star: tiersAud.accom_3_star,
      accom4star: tiersAud.accom_4_star,
      foodStreet: tiersAud.food_street_food,
      foodBudget: tiersAud.food_budget,
      foodMid: tiersAud.food_mid_range,
      foodHigh: tiersAud.food_high_end,
      drinkLocalBeer: anchorsAud.beer,
      drinkWineGlass: anchorsAud.wine_glass,
      drinkCocktail: anchorsAud.cocktail,
      drinkCoffee: anchorsAud.coffee,
      drinksNone: tiersAud.drinks_none,
      drinksLight: tiersAud.drinks_light,
      drinksModerate: tiersAud.drinks_moderate,
      drinksHeavy: tiersAud.drinks_heavy,
      activitiesFree: tiersAud.activities_free,
      activitiesBudget: tiersAud.activities_budget,
      activitiesMid: tiersAud.activities_mid_range,
      activitiesHigh: tiersAud.activities_high_end,
    },
  };
}
