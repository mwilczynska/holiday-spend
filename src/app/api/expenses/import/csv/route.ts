import { db } from '@/db';
import { expenses, itineraryLegs } from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { parseWiseCsvFiles } from '@/lib/wise-csv-parser';
import { findLegForExpenseDate } from '@/lib/expense-leg-assignment';
import { prepareWiseExpenses } from '@/lib/wise-import';
import { success, error, handleError } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const formData = await request.formData();
    const files = formData.getAll('file').filter(isUploadedFile);
    const confirmImport = formData.get('confirm') === 'true';

    if (files.length === 0) return error('No file provided');

    // Parse each export independently. Concatenating raw CSV strings would
    // leave the second (and later) header rows in the transaction data.
    const csvTexts = await Promise.all(files.map((file) => file.text()));
    const parsedRows = parseWiseCsvFiles(csvTexts);
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
      .where(eq(itineraryLegs.userId, userId))
      .orderBy(asc(itineraryLegs.sortOrder));

    const existingTxnIds = new Set<string>();
    for (const expense of parsed) {
      if (!expense.wiseTxnId) continue;
      const existing = await db
        .select({ id: expenses.id })
        .from(expenses)
        .where(and(eq(expenses.userId, userId), eq(expenses.wiseTxnId, expense.wiseTxnId)))
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
        userId,
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

function isUploadedFile(value: FormDataEntryValue): value is File {
  return typeof value !== 'string' && typeof value.text === 'function';
}
