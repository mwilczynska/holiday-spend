import type { LLMEstimationRequest } from './llm-provider';

export function buildEstimationPrompt(req: LLMEstimationRequest): string {
  return `You are a travel cost estimation expert. Estimate daily costs for TWO PEOPLE traveling in ${req.cityName}, ${req.country}.

All prices should be in AUD (Australian Dollars). The current exchange rate is 1 ${req.currencyCode} = ${req.audRate.toFixed(4)} AUD.

Provide estimates for the following categories. Each is a DAILY cost for 2 people unless stated otherwise.

ACCOMMODATION (per night, for 2 people sharing):
- accomHostel: Hostel dorm bed x2, or private hostel room
- accom1star: Basic 1-star hotel/guesthouse
- accom2star: Standard 2-star hotel
- accom3star: Comfortable 3-star hotel
- accom4star: Upscale 4-star hotel

FOOD (per day, for 2 people):
- foodStreet: Street food / market meals only
- foodBudget: Mix of street food and cheap restaurants
- foodMid: Mid-range restaurants, occasional treats
- foodHigh: Higher-end restaurants, multiple courses

DRINKS (unit prices):
- drinkLocalBeer: One local beer at a bar/restaurant
- drinkImportBeer: One imported beer
- drinkWineGlass: One glass of wine
- drinkCocktail: One cocktail
- drinkCoffee: One coffee at a cafe

DRINKS DAILY BUDGETS (per day, 2 people):
- drinksLight: 2 coffees + 2 beers
- drinksModerate: 2 coffees + 4 beers + 1 cocktail each
- drinksHeavy: 2 coffees + 6 beers + 2 cocktails each + wine

ACTIVITIES (per day, 2 people):
- activitiesFree: Free activities (walking tours, parks, temples)
- activitiesBudget: Budget activities (museums, local tours)
- activitiesMid: Mid-range (day tours, cooking classes, shows)
- activitiesHigh: Premium (private tours, adventure activities)

TRANSPORT:
- transportLocal: Daily local transport for 2 people (taxis, buses, metro)

Respond with ONLY a JSON object in this exact format (all values in AUD, numbers only):
{
  "accomHostel": 0, "accom1star": 0, "accom2star": 0, "accom3star": 0, "accom4star": 0,
  "foodStreet": 0, "foodBudget": 0, "foodMid": 0, "foodHigh": 0,
  "drinkLocalBeer": 0, "drinkImportBeer": 0, "drinkWineGlass": 0, "drinkCocktail": 0, "drinkCoffee": 0,
  "drinksLight": 0, "drinksModerate": 0, "drinksHeavy": 0,
  "activitiesFree": 0, "activitiesBudget": 0, "activitiesMid": 0, "activitiesHigh": 0,
  "transportLocal": 0,
  "reasoning": "Brief explanation of your estimates",
  "confidence": "low|medium|high"
}`;
}
