export type AccomTier = 'hostel' | 'privateRoom' | '1star' | '2star' | '3star' | '4star';
export type FoodTier = 'street' | 'budget' | 'mid' | 'high';
export type DrinksTier = 'light' | 'moderate' | 'heavy';
export type ActivitiesTier = 'free' | 'budget' | 'mid' | 'high';
export type LegStatus = 'planned' | 'active' | 'completed';

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

export const ACCOM_TIERS: TierOption<AccomTier>[] = [
  {
    value: 'hostel',
    label: 'Shared Hostel Dorm',
    description: 'Two dorm beds in a shared hostel room.',
  },
  {
    value: 'privateRoom',
    label: 'Private Room',
    description: 'A private hostel or simple guesthouse room.',
  },
  {
    value: '1star',
    label: '1-Star',
    description: 'Very basic hotel or guesthouse with minimal amenities.',
  },
  {
    value: '2star',
    label: '2-Star',
    description: 'Simple private hotel room with standard comforts.',
  },
  {
    value: '3star',
    label: '3-Star',
    description: 'Comfortable mid-range stay with better amenities.',
  },
  {
    value: '4star',
    label: '4-Star',
    description: 'Upscale hotel with more service and facilities.',
  },
];

export const FOOD_TIERS: TierOption<FoodTier>[] = [
  {
    value: 'street',
    label: 'Street Food',
    description: 'Mostly stalls, markets, and simple local meals.',
  },
  {
    value: 'budget',
    label: 'Budget',
    description: 'Cheap cafes and casual restaurants most days.',
  },
  {
    value: 'mid',
    label: 'Mid-Range',
    description: 'A mix of casual meals and nicer sit-down spots.',
  },
  {
    value: 'high',
    label: 'High-End',
    description: 'Frequent nicer restaurants, drinks, and treats.',
  },
];

export const DRINKS_TIERS: TierOption<DrinksTier>[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'A couple of coffees and a few casual drinks.',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    description: 'Daily coffees plus a steady bar budget.',
  },
  {
    value: 'heavy',
    label: 'Heavy',
    description: 'Regular drinking, cocktails, and pricier nights out.',
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
