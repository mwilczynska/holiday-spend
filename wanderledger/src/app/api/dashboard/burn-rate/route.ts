import { db } from '@/db';
import { expenses, itineraryLegs } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { buildCumulativeSpend } from '@/lib/burn-rate';
import { getExpenseAudAmount } from '@/lib/expense-aud';
import { findLegForExpenseDate } from '@/lib/expense-leg-assignment';
import { getTripWindow, isWithinTripWindow } from '@/lib/trip-window';
import { success, handleError } from '@/lib/api-helpers';

export async function GET() {
  try {
    const allExpenses = await db.select().from(expenses);
    const allLegs = await db.select().from(itineraryLegs).orderBy(asc(itineraryLegs.sortOrder));

    const legMap = new Map(allLegs.map((leg) => [leg.id, leg]));
    const { tripStart, tripEnd } = getTripWindow(allLegs);
    const activeExpenses = allExpenses.filter((expense) => {
      if (expense.isExcluded) return false;
      const matchedLeg = expense.legId
        ? legMap.get(expense.legId)
        : findLegForExpenseDate(expense.date, allLegs);
      return Boolean(matchedLeg) || isWithinTripWindow(expense.date, tripStart, tripEnd);
    });

    // Build cumulative spend data
    const expenseData = activeExpenses.map(e => ({
      date: e.date,
      amountAud: getExpenseAudAmount(e),
    }));

    const cumulative = buildCumulativeSpend(expenseData);

    // Trip dates for projection line
    // Calculate total budget (from legs) for ceiling line
    // Reuse a simplified calc — just sum leg totals from the itinerary API
    const totalNights = allLegs.reduce((s, l) => s + l.nights, 0);

    return success({
      cumulative,
      tripStart,
      tripEnd,
      totalNights,
    });
  } catch (err) {
    return handleError(err);
  }
}
