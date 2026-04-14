import { db } from '@/db';
import { expenses, itineraryLegs } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { parseWiseCsv } from '@/lib/wise-csv-parser';
import { findLegForExpenseDate } from '@/lib/expense-leg-assignment';
import { prepareWiseExpenses } from '@/lib/wise-import';
import { success, error, handleError } from '@/lib/api-helpers';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const confirmImport = formData.get('confirm') === 'true';

    if (!file) return error('No file provided');

    const csvText = await file.text();
    const parsedRows = parseWiseCsv(csvText);
    const parsed = await prepareWiseExpenses(parsedRows);

    const legs = await db
      .select({
        id: itineraryLegs.id,
        cityId: itineraryLegs.cityId,
        startDate: itineraryLegs.startDate,
        endDate: itineraryLegs.endDate,
        nights: itineraryLegs.nights,
        sortOrder: itineraryLegs.sortOrder,
      })
      .from(itineraryLegs)
      .orderBy(asc(itineraryLegs.sortOrder));

    const existingTxnIds = new Set<string>();
    for (const expense of parsed) {
      if (!expense.wiseTxnId) continue;
      const existing = await db
        .select({ id: expenses.id })
        .from(expenses)
        .where(eq(expenses.wiseTxnId, expense.wiseTxnId))
        .get();
      if (existing) existingTxnIds.add(expense.wiseTxnId);
    }

    const toImport = parsed.filter((expense) => !expense.skip && !existingTxnIds.has(expense.wiseTxnId));
    const skipped = parsedRows.filter((expense) => expense.skip);
    const duplicates = parsed.filter((expense) => !expense.skip && existingTxnIds.has(expense.wiseTxnId));

    if (!confirmImport) {
      return success({
        preview: true,
        toImport: toImport.map((expense) => ({
          ...expense,
          legId: findLegForExpenseDate(expense.date, legs)?.id ?? null,
        })),
        skipped,
        duplicates,
        total: parsedRows.length,
      });
    }

    let imported = 0;
    for (const expense of toImport) {
      const matchedLeg = findLegForExpenseDate(expense.date, legs);

      await db.insert(expenses).values({
        date: expense.date,
        amount: expense.amount,
        currency: expense.currency,
        amountAud: expense.amountAud,
        category: expense.category,
        subcategory: expense.subcategory,
        description: expense.description,
        merchant: expense.merchant,
        legId: matchedLeg?.id,
        wiseTxnId: expense.wiseTxnId,
        source: 'wise_csv',
      });
      imported++;
    }

    return success({
      imported,
      skipped: skipped.length,
      duplicates: duplicates.length,
      total: parsedRows.length,
    });
  } catch (err) {
    return handleError(err);
  }
}
