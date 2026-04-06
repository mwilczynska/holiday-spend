import { db } from '@/db';
import { expenses, itineraryLegs } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { buildCumulativeSpend } from '@/lib/burn-rate';
import { success, handleError } from '@/lib/api-helpers';

export async function GET() {
  try {
    const allExpenses = await db.select().from(expenses);
    const allLegs = await db.select().from(itineraryLegs).orderBy(asc(itineraryLegs.sortOrder));

    const activeExpenses = allExpenses.filter(e => !e.isExcluded);

    // Build cumulative spend data
    const expenseData = activeExpenses.map(e => ({
      date: e.date,
      amountAud: e.amountAud ?? e.amount,
    }));

    const cumulative = buildCumulativeSpend(expenseData);

    // Trip dates for projection line
    const legDates = allLegs.filter(l => l.startDate).map(l => l.startDate!).sort();
    const legEndDates = allLegs.filter(l => l.endDate).map(l => l.endDate!).sort();
    const tripStart = legDates[0] || null;
    const tripEnd = legEndDates[legEndDates.length - 1] || null;

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
