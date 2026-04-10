export type AccomTier = 'hostel' | 'privateRoom' | '1star' | '2star' | '3star' | '4star';
export type FoodTier = 'street' | 'budget' | 'mid' | 'high';
export type DrinksTier = 'light' | 'moderate' | 'heavy';
export type ActivitiesTier = 'free' | 'budget' | 'mid' | 'high';
export type LegStatus = 'planned' | 'active' | 'completed';
export type EstimateConfidence = 'low' | 'medium' | 'high';

export interface TierOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

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
  accomPrivateRoom?: number;
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
}

export interface CityPriceInputData {
  accomHostel?: number;
  accomPrivateRoom?: number;
  accom1star?: number;
  accom2star?: number;
  accom3star?: number;
  accom4star?: number;
  streetMeal?: number;
  cheapRestaurantMeal?: number;
  midRestaurantMeal?: number;
  coffee?: number;
  localBeer?: number;
  importBeer?: number;
  wineGlass?: number;
  cocktail?: number;
  publicTransitRide?: number;
  taxiShort?: number;
  activityBudget?: number;
  activityMid?: number;
  activityHigh?: number;
}

export interface IntercityTransportItem {
  id?: number;
  legId?: number;
  mode: string | null;
  note: string | null;
  cost: number;
  sortOrder?: number | null;
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
  intercityTransports: IntercityTransportItem[];
  sortOrder: number | null;
  notes: string | null;
  status: LegStatus;
  dailyCost: number;
  legTotal: number;
}

export const ACCOM_TIERS: TierOption<AccomTier>[] = [
  {
    value: 'hostel',
    label: 'Shared Hostel Dorm',
    description: 'Shared dorm beds using the city hostel rate.',
  },
  {
    value: 'privateRoom',
    label: 'Private Room',
    description: 'A private hostel room or simple guesthouse room.',
  },
  {
    value: '1star',
    label: '1-Star',
    description: 'A very basic private hotel or guesthouse room.',
  },
  {
    value: '2star',
    label: '2-Star',
    description: 'A simple private hotel room with standard comforts.',
  },
  {
    value: '3star',
    label: '3-Star',
    description: 'A comfortable mid-range hotel room.',
  },
  {
    value: '4star',
    label: '4-Star',
    description: 'An upscale hotel room with better service and facilities.',
  },
];

export const FOOD_TIERS: TierOption<FoodTier>[] = [
  {
    value: 'street',
    label: 'Street Food',
    description: 'A food budget built around cheap stalls, markets, and simple local meals for most meals.',
  },
  {
    value: 'budget',
    label: 'Budget',
    description: 'A food budget using a mix of street food, cheap cafes, and casual restaurants.',
  },
  {
    value: 'mid',
    label: 'Mid-Range',
    description: 'A food budget with casual meals plus some nicer sit-down meals and occasional treats.',
  },
  {
    value: 'high',
    label: 'High-End',
    description: 'A food budget that assumes frequent nicer restaurants, bigger meals, and regular extras.',
  },
];

export const DRINKS_TIERS: TierOption<DrinksTier>[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'Uses the light drinks basket shown in the option details.',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    description: 'Uses the moderate drinks basket shown in the option details.',
  },
  {
    value: 'heavy',
    label: 'Heavy',
    description: 'Uses the heavy drinks basket shown in the option details.',
  },
];

export const ACTIVITIES_TIERS: TierOption<ActivitiesTier>[] = [
  {
    value: 'free',
    label: 'Free',
    description: 'Parks, beaches, walks, and free sights.',
  },
  {
    value: 'budget',
    label: 'Budget',
    description: 'Low-cost museums, temples, and local attractions.',
  },
  {
    value: 'mid',
    label: 'Mid-Range',
    description: 'Paid tours, classes, and bigger ticket entries.',
  },
  {
    value: 'high',
    label: 'High-End',
    description: 'Premium tours, adventure activities, and splurges.',
  },
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
