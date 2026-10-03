import { db } from '@/db';
import { cities, countries, savedPlans } from '@/db/schema';
import { requireCurrentUserId } from '@/lib/auth';
import { error, handleError, success } from '@/lib/api-helpers';
import { planSnapshotSchema } from '@/lib/plan-snapshot';
import { computePlanComparison } from '@/lib/plan-comparison';
import { and, eq, inArray } from 'drizzle-orm';
import { comparisonPlanIdsSchema } from '@/lib/comparison-read-contract';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json();

    const parsedIds = comparisonPlanIdsSchema.safeParse(body?.planIds);
    if (!parsedIds.success) {
      return error('Provide between 1 and 5 unique, nonempty plan IDs.', 400);
    }
    const planIds = parsedIds.data;

    const plans = await db
      .select()
      .from(savedPlans)
      .where(and(eq(savedPlans.userId, userId), inArray(savedPlans.id, planIds)));

    if (plans.length !== planIds.length) {
      return error('One or more selected saved plans were not found. Refresh the plan list and select again.', 404);
    }

    // Build city data map from all cities in DB
    const allCities = await db.select().from(cities);
    const allCountries = await db.select().from(countries);
    const countryMap = new Map(allCountries.map((country) => [country.id, country.name]));
    const cityMap = new Map(
      allCities.map((city) => [
        city.id,
        {
          id: city.id,
          name: city.name,
          countryId: city.countryId,
          countryName: countryMap.get(city.countryId) ?? null,
          accomHostel: city.accomHostel,
          accomPrivateRoom: city.accomPrivateRoom,
          accom1star: city.accom1star,
          accom2star: city.accom2star,
          accom3star: city.accom3star,
          accom4star: city.accom4star,
          foodStreet: city.foodStreet,
          foodBudget: city.foodBudget,
          foodMid: city.foodMid,
          foodHigh: city.foodHigh,
          drinkCoffee: city.drinkCoffee,
          drinksNone: city.drinksNone,
          drinksLight: city.drinksLight,
          drinksModerate: city.drinksModerate,
          drinksHeavy: city.drinksHeavy,
          activitiesFree: city.activitiesFree,
          activitiesBudget: city.activitiesBudget,
          activitiesMid: city.activitiesMid,
          activitiesHigh: city.activitiesHigh,
          transportLocal: city.transportLocal,
        },
      ])
    );

    const results = plans.map((plan) => {
      const snapshot = planSnapshotSchema.parse(JSON.parse(plan.snapshotJson));
      // Compare intentionally replays the saved snapshot inputs against the current
      // canonical city dataset so every result surface comes from the same engine.
      return computePlanComparison(plan.id, plan.name, snapshot, cityMap);
    });

    // Preserve the order the caller requested
    const orderedResults = planIds
      .map((id: string) => results.find((r) => r.id === id))
      .filter(Boolean);

    return success({ plans: orderedResults });
  } catch (err) {
    return handleError(err);
  }
}
