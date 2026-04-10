import { roundMoney } from '@/lib/accommodation';
import type { CityEstimateData, CityPriceInputData, EstimateConfidence } from '@/types';

type EstimateField = keyof CityEstimateData;
type InputField = keyof CityPriceInputData;

interface PeerContext {
  cityName: string;
  countryName: string;
  region: string | null;
}

interface HybridEstimateParams {
  manualInputs: Partial<CityPriceInputData>;
  xoteloData?: Partial<CityEstimateData>;
  peerInputs?: Partial<CityPriceInputData>;
  peerContext?: PeerContext | null;
}

interface DerivedFieldResult {
  value: number | null;
  source: string | null;
}

export interface HybridEstimateResult {
  data: Partial<CityEstimateData>;
  sources: Record<string, string>;
  inputSnapshot: Partial<CityPriceInputData>;
  fallbackLog: string[];
  confidence: EstimateConfidence;
}

const ACCOMMODATION_FIELDS: EstimateField[] = [
  'accomHostel',
  'accomPrivateRoom',
  'accom1star',
  'accom2star',
  'accom3star',
  'accom4star',
];

const SCALEABLE_INPUT_FIELDS: InputField[] = [
  'accomHostel',
  'accomPrivateRoom',
  'accom1star',
  'accom2star',
  'accom3star',
  'accom4star',
  'streetMeal',
  'cheapRestaurantMeal',
  'midRestaurantMeal',
  'coffee',
  'localBeer',
  'importBeer',
  'wineGlass',
  'cocktail',
  'activityBudget',
  'activityMid',
  'activityHigh',
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function withMoney(value: number | null | undefined): number | null {
  return value == null ? null : roundMoney(value);
}

function computePeerMultiplier(
  manualInputs: Partial<CityPriceInputData>,
  xoteloData: Partial<CityEstimateData> | undefined,
  peerInputs: Partial<CityPriceInputData> | undefined
): number {
  if (!peerInputs) return 1;

  const comparisons: Array<[number | null | undefined, number | null | undefined]> = [
    [xoteloData?.accom2star ?? manualInputs.accom2star, peerInputs.accom2star],
    [xoteloData?.accom1star ?? manualInputs.accom1star, peerInputs.accom1star],
    [xoteloData?.accomPrivateRoom ?? manualInputs.accomPrivateRoom, peerInputs.accomPrivateRoom],
  ];

  for (const [current, peer] of comparisons) {
    if (current != null && peer != null && peer > 0) {
      return clamp(current / peer, 0.7, 1.4);
    }
  }

  return 1;
}

function resolveInputField(params: {
  field: InputField;
  manualInputs: Partial<CityPriceInputData>;
  peerInputs?: Partial<CityPriceInputData>;
  multiplier: number;
  fallbackLog: string[];
  peerContext?: PeerContext | null;
}): DerivedFieldResult {
  const { field, manualInputs, peerInputs, multiplier, fallbackLog, peerContext } = params;
  const manualValue = manualInputs[field];

  if (manualValue != null) {
    return { value: withMoney(manualValue), source: 'manual_input' };
  }

  const peerValue = peerInputs?.[field];
  if (peerValue != null) {
    const scaledValue = withMoney(peerValue * multiplier);
    if (scaledValue != null) {
      const peerLabel = peerContext
        ? `${peerContext.cityName}, ${peerContext.countryName}`
        : 'peer city';
      fallbackLog.push(`${field} filled from ${peerLabel} using multiplier ${multiplier.toFixed(2)}.`);
      return { value: scaledValue, source: 'peer_fallback' };
    }
  }

  return { value: null, source: null };
}

function deriveFoodEstimates(snapshot: Partial<CityPriceInputData>): Partial<CityEstimateData> {
  if (
    snapshot.streetMeal == null ||
    snapshot.cheapRestaurantMeal == null ||
    snapshot.midRestaurantMeal == null ||
    snapshot.coffee == null
  ) {
    return {};
  }

  const foodStreet = 4 * snapshot.streetMeal + 2 * snapshot.coffee;
  const foodBudget = 2 * snapshot.streetMeal + 2 * snapshot.cheapRestaurantMeal + 2 * snapshot.coffee;
  const foodMid = 2 * snapshot.cheapRestaurantMeal + snapshot.midRestaurantMeal + 2 * snapshot.coffee;

  return {
    foodStreet: withMoney(foodStreet) ?? undefined,
    foodBudget: withMoney(foodBudget) ?? undefined,
    foodMid: withMoney(foodMid) ?? undefined,
    foodHigh: withMoney(foodMid * 1.5) ?? undefined,
  };
}

function deriveDrinkEstimates(snapshot: Partial<CityPriceInputData>): Partial<CityEstimateData> {
  if (
    snapshot.coffee == null ||
    snapshot.localBeer == null ||
    snapshot.cocktail == null ||
    snapshot.wineGlass == null
  ) {
    return {};
  }

  return {
    drinkCoffee: withMoney(snapshot.coffee) ?? undefined,
    drinkLocalBeer: withMoney(snapshot.localBeer) ?? undefined,
    drinkImportBeer: withMoney(snapshot.importBeer) ?? undefined,
    drinkWineGlass: withMoney(snapshot.wineGlass) ?? undefined,
    drinkCocktail: withMoney(snapshot.cocktail) ?? undefined,
    drinksLight: withMoney(2 * snapshot.coffee + 2 * snapshot.localBeer) ?? undefined,
    drinksModerate: withMoney(2 * snapshot.coffee + 4 * snapshot.localBeer + 2 * snapshot.cocktail) ?? undefined,
    drinksHeavy: withMoney(2 * snapshot.coffee + 6 * snapshot.localBeer + 4 * snapshot.cocktail + 2 * snapshot.wineGlass) ?? undefined,
  };
}

function deriveActivityEstimates(snapshot: Partial<CityPriceInputData>): Partial<CityEstimateData> {
  const result: Partial<CityEstimateData> = {};

  if (snapshot.activityBudget != null) {
    result.activitiesFree = 0;
    result.activitiesBudget = withMoney((snapshot.activityBudget * 4) / 7) ?? undefined;
  }

  if (snapshot.activityBudget != null && snapshot.activityMid != null) {
    result.activitiesMid = withMoney(((snapshot.activityBudget * 4) + (snapshot.activityMid * 4)) / 7) ?? undefined;
  }

  if (snapshot.activityBudget != null && snapshot.activityMid != null && snapshot.activityHigh != null) {
    result.activitiesHigh = withMoney(((snapshot.activityBudget * 4) + (snapshot.activityMid * 4) + (snapshot.activityHigh * 2)) / 7) ?? undefined;
  }

  return result;
}

export function buildHybridEstimate(params: HybridEstimateParams): HybridEstimateResult {
  const { manualInputs, xoteloData, peerInputs, peerContext } = params;
  const fallbackLog: string[] = [];
  const multiplier = computePeerMultiplier(manualInputs, xoteloData, peerInputs);
  const inputSnapshot: Partial<CityPriceInputData> = {};
  const sources: Record<string, string> = {};
  const data: Partial<CityEstimateData> = {};

  for (const field of SCALEABLE_INPUT_FIELDS) {
    const resolved = resolveInputField({
      field,
      manualInputs,
      peerInputs,
      multiplier,
      fallbackLog,
      peerContext,
    });

    if (resolved.value != null) {
      inputSnapshot[field] = resolved.value;
      sources[field] = resolved.source!;
    }
  }

  for (const field of ACCOMMODATION_FIELDS) {
    const xoteloValue = xoteloData?.[field];
    if (xoteloValue != null) {
      data[field] = withMoney(xoteloValue) ?? undefined;
      sources[field] = 'xotelo';
      continue;
    }

    const inputValue = inputSnapshot[field as InputField];
    if (inputValue != null) {
      data[field] = withMoney(inputValue) ?? undefined;
      sources[field] = sources[field] || 'manual_input';
    }
  }

  const foodEstimates = deriveFoodEstimates(inputSnapshot);
  for (const [field, value] of Object.entries(foodEstimates)) {
    if (value != null) {
      data[field as EstimateField] = value;
      sources[field] = 'hybrid_formula';
    }
  }

  const drinkEstimates = deriveDrinkEstimates(inputSnapshot);
  for (const [field, value] of Object.entries(drinkEstimates)) {
    if (value != null) {
      data[field as EstimateField] = value;
      sources[field] = 'hybrid_formula';
    }
  }

  const activityEstimates = deriveActivityEstimates(inputSnapshot);
  for (const [field, value] of Object.entries(activityEstimates)) {
    if (value != null) {
      data[field as EstimateField] = value;
      sources[field] = 'hybrid_formula';
    }
  }

  const sourceSet = new Set(Object.values(sources));
  const confidence: EstimateConfidence =
    sourceSet.has('peer_fallback') ? 'medium' : sourceSet.has('manual_input') || sourceSet.has('xotelo') ? 'high' : 'low';

  return {
    data,
    sources,
    inputSnapshot,
    fallbackLog,
    confidence,
  };
}
