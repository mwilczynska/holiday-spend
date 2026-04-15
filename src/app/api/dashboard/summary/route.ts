import { db } from '@/db';
import { itineraryLegs, itineraryLegTransports, cities, expenses, fixedCosts } from '@/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import { getDailyCost, getLegTotalFromTransports } from '@/lib/cost-calculator';
import { calcBurnRate, projectTotal } from '@/lib/burn-rate';
import { getExpenseAudAmount } from '@/lib/expense-aud';
import { getExpenseReportingDate, resolveExpenseLeg } from '@/lib/expense-leg-assignment';
import { groupIntercityTransportsByLegId } from '@/lib/intercity-transport';
import { deriveLegDates } from '@/lib/itinerary-leg-dates';
import { getPlannerGroupSize } from '@/lib/planner-settings';
import { getTripWindow, isWithinTripWindow } from '@/lib/trip-window';
import { requireCurrentUserId } from '@/lib/auth';
import { success, handleError } from '@/lib/api-helpers';
import type { AccomTier, FoodTier, DrinksTier, ActivitiesTier } from '@/types';

export const dynamic = 'force-dynamic';

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().split('T')[0];
}

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    // Fetch legs, cities, expenses, fixed costs
    const rawLegs = await db.select().from(itineraryLegs).where(eq(itineraryLegs.userId, userId)).orderBy(asc(itineraryLegs.sortOrder));
    const allTransports = rawLegs.length > 0
      ? await db
          .select()
          .from(itineraryLegTransports)
          .where(inArray(itineraryLegTransports.legId, rawLegs.map((leg) => leg.id)))
          .orderBy(asc(itineraryLegTransports.sortOrder), asc(itineraryLegTransports.id))
      : [];
    const allCities = await db.select().from(cities);
    const allExpenses = await db.select().from(expenses).where(eq(expenses.userId, userId));
    const allFixed = await db.select().from(fixedCosts).where(eq(fixedCosts.userId, userId));
    const groupSize = await getPlannerGroupSize(userId);

    const allLegs = deriveLegDates(rawLegs);
    const cityMap = new Map(allCities.map(c => [c.id, c]));
    const transportMap = groupIntercityTransportsByLegId(allTransports);
    const { tripStart, tripEnd } = getTripWindow(allLegs);

    // Calculate planned budget from legs + fixed costs
    const legTotals = allLegs.map(leg => {
      const city = cityMap.get(leg.cityId);
      const dailyCost = city
        ? getDailyCost(
            city,
            (leg.accomTier || '2star') as AccomTier,
            (leg.foodTier || 'mid') as FoodTier,
            (leg.drinksTier || 'moderate') as DrinksTier,
            (leg.activitiesTier || 'mid') as ActivitiesTier,
            { accomOverride: leg.accomOverride, foodOverride: leg.foodOverride, drinksOverride: leg.drinksOverride, activitiesOverride: leg.activitiesOverride, transportOverride: leg.transportOverride },
            groupSize
          )
        : 0;
      return getLegTotalFromTransports(dailyCost, leg.nights, transportMap.get(leg.id));
    });

    const plannedLegsTotal = legTotals.reduce((s, t) => s + t, 0);
    const fixedTotal = allFixed.reduce((s, f) => s + f.amountAud, 0);
    const totalBudget = plannedLegsTotal + fixedTotal;

    // Calculate actual spend (non-excluded)
    const activeExpenses = allExpenses.filter((expense) => {
      if (expense.isExcluded) return false;
      const matchedLeg = resolveExpenseLeg(expense, allLegs);
      return Boolean(matchedLeg) || isWithinTripWindow(getExpenseReportingDate(expense, allLegs), tripStart, tripEnd);
    });
    const totalSpent = activeExpenses.reduce((s, e) => s + getExpenseAudAmount(e), 0);

    const today = new Date().toISOString().split('T')[0];
    const totalNights = allLegs.reduce((s, l) => s + l.nights, 0);

    let daysElapsed = 0;
    let daysRemaining = 0;
    if (tripStart) {
      const start = new Date(tripStart);
      const now = new Date(today);
      daysElapsed = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
      if (tripEnd) {
        const end = new Date(tripEnd);
        daysRemaining = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 86400000));
      } else {
        daysRemaining = Math.max(0, totalNights - daysElapsed);
      }
    }

    const plannedByDate = new Map<string, number>();
    for (const leg of allLegs) {
      if (!leg.startDate || leg.nights < 1) continue;

      const city = cityMap.get(leg.cityId);
      if (!city) continue;

      const dailyCost = getDailyCost(
        city,
        (leg.accomTier || '2star') as AccomTier,
        (leg.foodTier || 'mid') as FoodTier,
        (leg.drinksTier || 'moderate') as DrinksTier,
        (leg.activitiesTier || 'mid') as ActivitiesTier,
        {
          accomOverride: leg.accomOverride,
          foodOverride: leg.foodOverride,
          drinksOverride: leg.drinksOverride,
          activitiesOverride: leg.activitiesOverride,
          transportOverride: leg.transportOverride,
        },
        groupSize
      );

      const intercityTotal = (transportMap.get(leg.id) || []).reduce((sum, transport) => sum + (transport.cost ?? 0), 0);
      for (let offset = 0; offset < leg.nights; offset += 1) {
        const date = addDays(leg.startDate, offset);
        const plannedAmount = dailyCost + (offset === 0 ? intercityTotal : 0);
        plannedByDate.set(date, (plannedByDate.get(date) || 0) + plannedAmount);
      }
    }

    const plannedDatesElapsed = Array.from(plannedByDate.keys()).filter((date) => date <= today);
    const plannedToDate = plannedDatesElapsed.reduce((sum, date) => sum + (plannedByDate.get(date) || 0), 0);
    const plannedAvgSoFar = plannedDatesElapsed.length > 0 ? plannedToDate / plannedDatesElapsed.length : 0;
    const varianceToDate = totalSpent - plannedToDate;

    // Burn rates
    const expenseData = activeExpenses.map(e => ({
      date: getExpenseReportingDate(e, allLegs),
      amountAud: getExpenseAudAmount(e),
    }));

    const { tripAvg, windowAvg: sevenDayAvg } = calcBurnRate(totalSpent, daysElapsed, {
      expenses: expenseData,
      days: 7,
    });
    const { windowAvg: thirtyDayAvg } = calcBurnRate(totalSpent, daysElapsed, {
      expenses: expenseData,
      days: 30,
    });

    // Projection using 7-day average if available, else trip average
    const projectionRate = sevenDayAvg ?? tripAvg;
    const projectedTotal = projectTotal(totalSpent, projectionRate, daysRemaining);
    const forecastVariance = projectedTotal - plannedLegsTotal;
    const remainingLegBudget = plannedLegsTotal - totalSpent;
    const requiredDailyPace = daysRemaining > 0 ? Math.max(remainingLegBudget, 0) / daysRemaining : null;

    // Budget health: ratio of projected to budget
    let budgetHealth: 'on_track' | 'warning' | 'over_budget' = 'on_track';
    if (totalBudget > 0) {
      const ratio = projectedTotal / totalBudget;
      if (ratio > 1.1) budgetHealth = 'over_budget';
      else if (ratio > 0.95) budgetHealth = 'warning';
    }

    return success({
      totalBudget,
      plannedLegsTotal,
      fixedTotal,
      groupSize,
      totalSpent,
      plannedToDate,
      varianceToDate,
      projectedTotal,
      forecastVariance,
      remainingLegBudget,
      tripStart,
      tripEnd,
      totalNights,
      daysElapsed,
      daysRemaining,
      destinations: allLegs.length,
      expenseCount: activeExpenses.length,
      burnRate: {
        tripAvg,
        plannedAvgSoFar,
        sevenDayAvg,
        thirtyDayAvg,
        requiredDailyPace,
      },
      budgetHealth,
      remaining: totalBudget - totalSpent,
    });
  } catch (err) {
    return handleError(err);
  }
}
