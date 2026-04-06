import { db } from '@/db';
import { itineraryLegs, cities, expenses, fixedCosts } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { getDailyCost, getLegTotal } from '@/lib/cost-calculator';
import { calcBurnRate, projectTotal } from '@/lib/burn-rate';
import { getExpenseAudAmount } from '@/lib/expense-aud';
import { findLegForExpenseDate } from '@/lib/expense-leg-assignment';
import { getTripWindow, isWithinTripWindow } from '@/lib/trip-window';
import { success, handleError } from '@/lib/api-helpers';
import type { AccomTier, FoodTier, DrinksTier, ActivitiesTier } from '@/types';

export async function GET() {
  try {
    // Fetch legs, cities, expenses, fixed costs
    const allLegs = await db.select().from(itineraryLegs).orderBy(asc(itineraryLegs.sortOrder));
    const allCities = await db.select().from(cities);
    const allExpenses = await db.select().from(expenses);
    const allFixed = await db.select().from(fixedCosts);

    const cityMap = new Map(allCities.map(c => [c.id, c]));
    const legMap = new Map(allLegs.map(leg => [leg.id, leg]));
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
            { accomOverride: leg.accomOverride, foodOverride: leg.foodOverride, drinksOverride: leg.drinksOverride, activitiesOverride: leg.activitiesOverride, transportOverride: leg.transportOverride }
          )
        : 0;
      return getLegTotal(dailyCost, leg.nights, leg.intercityTransportCost ?? 0);
    });

    const plannedLegsTotal = legTotals.reduce((s, t) => s + t, 0);
    const fixedTotal = allFixed.reduce((s, f) => s + f.amountAud, 0);
    const totalBudget = plannedLegsTotal + fixedTotal;

    // Calculate actual spend (non-excluded)
    const activeExpenses = allExpenses.filter((expense) => {
      if (expense.isExcluded) return false;
      const matchedLeg = expense.legId
        ? legMap.get(expense.legId)
        : findLegForExpenseDate(expense.date, allLegs);
      return Boolean(matchedLeg) || isWithinTripWindow(expense.date, tripStart, tripEnd);
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

    // Burn rates
    const expenseData = activeExpenses.map(e => ({
      date: e.date,
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
      totalSpent,
      projectedTotal,
      tripStart,
      tripEnd,
      totalNights,
      daysElapsed,
      daysRemaining,
      destinations: allLegs.length,
      expenseCount: activeExpenses.length,
      burnRate: {
        tripAvg,
        sevenDayAvg,
        thirtyDayAvg,
      },
      budgetHealth,
      remaining: totalBudget - totalSpent,
    });
  } catch (err) {
    return handleError(err);
  }
}
