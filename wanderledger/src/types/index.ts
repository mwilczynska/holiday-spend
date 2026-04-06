export type AccomTier = 'hostel' | '1star' | '2star' | '3star' | '4star';
export type FoodTier = 'street' | 'budget' | 'mid' | 'high';
export type DrinksTier = 'light' | 'moderate' | 'heavy';
export type ActivitiesTier = 'free' | 'budget' | 'mid' | 'high';
export type LegStatus = 'planned' | 'active' | 'completed';

export type ExpenseCategory =
  | 'accommodation'
  | 'food'
  | 'drinks'
  | 'activities'
  | 'transport_local'
  | 'transport_intercity'
  | 'shopping'
  | 'health'
  | 'comms'
  | 'other';

export type FixedCostCategory = 'visa' | 'insurance' | 'flights' | 'gear' | 'other';

export interface CityEstimateData {
  accomHostel?: number;
  accom1star?: number;
  accom2star?: number;
  accom3star?: number;
  accom4star?: number;
  foodStreet?: number;
  foodBudget?: number;
  foodMid?: number;
  foodHigh?: number;
  drinkLocalBeer?: number;
  drinkImportBeer?: number;
  drinkWineGlass?: number;
  drinkCocktail?: number;
  drinkCoffee?: number;
  drinksLight?: number;
  drinksModerate?: number;
  drinksHeavy?: number;
  activitiesFree?: number;
  activitiesBudget?: number;
  activitiesMid?: number;
  activitiesHigh?: number;
  transportLocal?: number;
}

export interface LegWithCost {
  id: number;
  cityId: string;
  cityName: string;
  countryName: string;
  startDate: string | null;
  endDate: string | null;
  nights: number;
  accomTier: AccomTier;
  foodTier: FoodTier;
  drinksTier: DrinksTier;
  activitiesTier: ActivitiesTier;
  accomOverride: number | null;
  foodOverride: number | null;
  drinksOverride: number | null;
  activitiesOverride: number | null;
  transportOverride: number | null;
  intercityTransportCost: number;
  intercityTransportNote: string | null;
  splitPct: number;
  sortOrder: number | null;
  notes: string | null;
  status: LegStatus;
  dailyCost: number;
  legTotal: number;
}

export const ACCOM_TIERS: { value: AccomTier; label: string }[] = [
  { value: 'hostel', label: 'Hostel' },
  { value: '1star', label: '1-Star' },
  { value: '2star', label: '2-Star' },
  { value: '3star', label: '3-Star' },
  { value: '4star', label: '4-Star' },
];

export const FOOD_TIERS: { value: FoodTier; label: string }[] = [
  { value: 'street', label: 'Street Food' },
  { value: 'budget', label: 'Budget' },
  { value: 'mid', label: 'Mid-Range' },
  { value: 'high', label: 'High-End' },
];

export const DRINKS_TIERS: { value: DrinksTier; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'heavy', label: 'Heavy' },
];

export const ACTIVITIES_TIERS: { value: ActivitiesTier; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'budget', label: 'Budget' },
  { value: 'mid', label: 'Mid-Range' },
  { value: 'high', label: 'High-End' },
];

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'food', label: 'Food' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'activities', label: 'Activities' },
  { value: 'transport_local', label: 'Local Transport' },
  { value: 'transport_intercity', label: 'Intercity Transport' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'health', label: 'Health' },
  { value: 'comms', label: 'Communications' },
  { value: 'other', label: 'Other' },
];
