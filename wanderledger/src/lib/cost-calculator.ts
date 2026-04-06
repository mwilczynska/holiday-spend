import type { AccomTier, FoodTier, DrinksTier, ActivitiesTier } from '@/types';

interface CityData {
  accomHostel: number | null;
  accom1star: number | null;
  accom2star: number | null;
  accom3star: number | null;
  accom4star: number | null;
  foodStreet: number | null;
  foodBudget: number | null;
  foodMid: number | null;
  foodHigh: number | null;
  drinksLight: number | null;
  drinksModerate: number | null;
  drinksHeavy: number | null;
  activitiesFree: number | null;
  activitiesBudget: number | null;
  activitiesMid: number | null;
  activitiesHigh: number | null;
  transportLocal: number | null;
}

interface LegOverrides {
  accomOverride?: number | null;
  foodOverride?: number | null;
  drinksOverride?: number | null;
  activitiesOverride?: number | null;
  transportOverride?: number | null;
}

const ACCOM_MAP: Record<AccomTier, keyof CityData> = {
  hostel: 'accomHostel',
  '1star': 'accom1star',
  '2star': 'accom2star',
  '3star': 'accom3star',
  '4star': 'accom4star',
};

const FOOD_MAP: Record<FoodTier, keyof CityData> = {
  street: 'foodStreet',
  budget: 'foodBudget',
  mid: 'foodMid',
  high: 'foodHigh',
};

const DRINKS_MAP: Record<DrinksTier, keyof CityData> = {
  light: 'drinksLight',
  moderate: 'drinksModerate',
  heavy: 'drinksHeavy',
};

const ACTIVITIES_MAP: Record<ActivitiesTier, keyof CityData> = {
  free: 'activitiesFree',
  budget: 'activitiesBudget',
  mid: 'activitiesMid',
  high: 'activitiesHigh',
};

export function getDailyCost(
  city: CityData,
  accomTier: AccomTier,
  foodTier: FoodTier,
  drinksTier: DrinksTier,
  activitiesTier: ActivitiesTier,
  overrides?: LegOverrides
): number {
  const accom = overrides?.accomOverride ?? city[ACCOM_MAP[accomTier]] ?? 0;
  const food = overrides?.foodOverride ?? city[FOOD_MAP[foodTier]] ?? 0;
  const drinks = overrides?.drinksOverride ?? city[DRINKS_MAP[drinksTier]] ?? 0;
  const activities = overrides?.activitiesOverride ?? city[ACTIVITIES_MAP[activitiesTier]] ?? 0;
  const transport = overrides?.transportOverride ?? city.transportLocal ?? 0;

  return accom + food + drinks + activities + transport;
}

export function getLegTotal(
  dailyCost: number,
  nights: number,
  intercityTransportCost: number = 0
): number {
  return dailyCost * nights + intercityTransportCost;
}

export function getYourShare(total: number, splitPct: number = 50): number {
  return total * (splitPct / 100);
}

export interface CostBreakdown {
  accommodation: number;
  food: number;
  drinks: number;
  activities: number;
  transport: number;
  intercity: number;
  total: number;
}

export function getDailyBreakdown(
  city: CityData,
  accomTier: AccomTier,
  foodTier: FoodTier,
  drinksTier: DrinksTier,
  activitiesTier: ActivitiesTier,
  overrides?: LegOverrides
): CostBreakdown {
  const accommodation = overrides?.accomOverride ?? city[ACCOM_MAP[accomTier]] ?? 0;
  const food = overrides?.foodOverride ?? city[FOOD_MAP[foodTier]] ?? 0;
  const drinks = overrides?.drinksOverride ?? city[DRINKS_MAP[drinksTier]] ?? 0;
  const activities = overrides?.activitiesOverride ?? city[ACTIVITIES_MAP[activitiesTier]] ?? 0;
  const transport = overrides?.transportOverride ?? city.transportLocal ?? 0;

  return {
    accommodation: accommodation as number,
    food: food as number,
    drinks: drinks as number,
    activities: activities as number,
    transport: transport as number,
    intercity: 0,
    total: (accommodation as number) + (food as number) + (drinks as number) + (activities as number) + (transport as number),
  };
}
