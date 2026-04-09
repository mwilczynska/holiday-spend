import type { AccomTier, FoodTier, DrinksTier, ActivitiesTier } from '@/types';
import { derivePrivateRoomRate } from './accommodation';
import { getIntercityTransportTotal } from './intercity-transport';

interface CityData {
  accomHostel: number | null;
  accomPrivateRoom: number | null;
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

export function normalizeGroupSize(groupSize: number): number {
  return Math.min(5, Math.max(1, Math.round(groupSize || 2)));
}

function scaleDormAccommodation(baseCost: number, groupSize: number): number {
  return baseCost * (groupSize / 2);
}

function scaleRoomAccommodation(baseCost: number, groupSize: number): number {
  return baseCost * Math.ceil(groupSize / 2);
}

function scaleFood(baseCost: number, groupSize: number): number {
  const sharingDiscount = 1 - 0.05 * Math.max(0, groupSize - 2);
  return baseCost * (groupSize / 2) * Math.max(sharingDiscount, 0);
}

function scaleLinear(baseCost: number, groupSize: number): number {
  return baseCost * (groupSize / 2);
}

const ACCOM_MAP: Record<AccomTier, keyof CityData> = {
  hostel: 'accomHostel',
  privateRoom: 'accomPrivateRoom',
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
  overrides?: LegOverrides,
  groupSize: number = 2
): number {
  const normalizedGroupSize = normalizeGroupSize(groupSize);
  const computedAccommodation =
    accomTier === 'privateRoom'
      ? city.accomPrivateRoom ?? derivePrivateRoomRate(city.accomHostel, city.accom1star)
      : city[ACCOM_MAP[accomTier]];
  const scaledAccommodation = computedAccommodation == null
    ? 0
    : accomTier === 'hostel'
      ? scaleDormAccommodation(computedAccommodation, normalizedGroupSize)
      : scaleRoomAccommodation(computedAccommodation, normalizedGroupSize);
  const scaledFood = city[FOOD_MAP[foodTier]] == null ? 0 : scaleFood(city[FOOD_MAP[foodTier]] as number, normalizedGroupSize);
  const scaledDrinks = city[DRINKS_MAP[drinksTier]] == null ? 0 : scaleLinear(city[DRINKS_MAP[drinksTier]] as number, normalizedGroupSize);
  const scaledActivities = city[ACTIVITIES_MAP[activitiesTier]] == null ? 0 : scaleLinear(city[ACTIVITIES_MAP[activitiesTier]] as number, normalizedGroupSize);
  const accom = overrides?.accomOverride ?? scaledAccommodation;
  const food = overrides?.foodOverride ?? scaledFood;
  const drinks = overrides?.drinksOverride ?? scaledDrinks;
  const activities = overrides?.activitiesOverride ?? scaledActivities;
  const transport = overrides?.transportOverride ?? 0;

  return accom + food + drinks + activities + transport;
}

export function getLegTotal(
  dailyCost: number,
  nights: number,
  intercityTransportCost: number = 0
): number {
  return dailyCost * nights + intercityTransportCost;
}

export function getLegTotalFromTransports(
  dailyCost: number,
  nights: number,
  transports: Array<{ cost?: number | null }> | null | undefined
): number {
  return getLegTotal(dailyCost, nights, getIntercityTransportTotal(transports));
}

export function getYourShare(total: number, splitPct: number = 50): number {
  return total * (splitPct / 100);
}

export function getAccommodationCostForTier(
  city: CityData,
  accomTier: AccomTier,
  groupSize: number = 2
): number | null {
  const normalizedGroupSize = normalizeGroupSize(groupSize);
  const computedAccommodation =
    accomTier === 'privateRoom'
      ? city.accomPrivateRoom ?? derivePrivateRoomRate(city.accomHostel, city.accom1star)
      : city[ACCOM_MAP[accomTier]];

  if (computedAccommodation == null) {
    return null;
  }

  return accomTier === 'hostel'
    ? scaleDormAccommodation(computedAccommodation, normalizedGroupSize)
    : scaleRoomAccommodation(computedAccommodation, normalizedGroupSize);
}

export function getFoodCostForTier(
  city: CityData,
  foodTier: FoodTier,
  groupSize: number = 2
): number | null {
  const baseCost = city[FOOD_MAP[foodTier]];
  if (baseCost == null) {
    return null;
  }
  return scaleFood(baseCost as number, normalizeGroupSize(groupSize));
}

export function getDrinksCostForTier(
  city: CityData,
  drinksTier: DrinksTier,
  groupSize: number = 2
): number | null {
  const baseCost = city[DRINKS_MAP[drinksTier]];
  if (baseCost == null) {
    return null;
  }
  return scaleLinear(baseCost as number, normalizeGroupSize(groupSize));
}

export function getActivitiesCostForTier(
  city: CityData,
  activitiesTier: ActivitiesTier,
  groupSize: number = 2
): number | null {
  const baseCost = city[ACTIVITIES_MAP[activitiesTier]];
  if (baseCost == null) {
    return null;
  }
  return scaleLinear(baseCost as number, normalizeGroupSize(groupSize));
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
  overrides?: LegOverrides,
  groupSize: number = 2
): CostBreakdown {
  const scaledAccommodation = getAccommodationCostForTier(city, accomTier, groupSize) ?? 0;
  const scaledFood = getFoodCostForTier(city, foodTier, groupSize) ?? 0;
  const scaledDrinks = getDrinksCostForTier(city, drinksTier, groupSize) ?? 0;
  const scaledActivities = getActivitiesCostForTier(city, activitiesTier, groupSize) ?? 0;
  const accommodation = overrides?.accomOverride ?? scaledAccommodation;
  const food = overrides?.foodOverride ?? scaledFood;
  const drinks = overrides?.drinksOverride ?? scaledDrinks;
  const activities = overrides?.activitiesOverride ?? scaledActivities;
  const transport = overrides?.transportOverride ?? 0;

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
