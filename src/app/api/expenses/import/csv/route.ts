import { db } from '@/db';
import { expenses, itineraryLegs } from '@/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { parseWiseCsvFiles } from '@/lib/wise-csv-parser';
import { findLegForExpenseDate } from '@/lib/expense-leg-assignment';
import { prepareWiseExpenses } from '@/lib/wise-import';
import { success, error, handleError } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';

// Kept well under the SQLite bind-parameter cap, which is 999 on older builds. The duplicate
// lookup binds one parameter per id plus the user; each inserted row binds a dozen.
const DUPLICATE_LOOKUP_CHUNK = 400;
const INSERT_CHUNK = 50;

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

    // Duplicate detection issued one SELECT per parsed row. `wise_txn_id` carries a UNIQUE index,
    // so the whole upload can be checked in a handful of statements instead. Chunked because the
    // number of bind parameters in one `IN` list is capped, and an upload has no fixed size.
    const txnIds = parsed
      .map((expense) => expense.wiseTxnId)
      .filter((id): id is string => Boolean(id));

    const existingTxnIds = new Set<string>();
    for (let offset = 0; offset < txnIds.length; offset += DUPLICATE_LOOKUP_CHUNK) {
      const chunk = txnIds.slice(offset, offset + DUPLICATE_LOOKUP_CHUNK);
      const found = await db
        .select({ wiseTxnId: expenses.wiseTxnId })
        .from(expenses)
        .where(and(eq(expenses.userId, userId), inArray(expenses.wiseTxnId, chunk)));
      for (const row of found) {
        if (row.wiseTxnId) existingTxnIds.add(row.wiseTxnId);
      }
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

    const rowsToInsert = toImport.map((expense) => ({
      userId,
      date: expense.date,
      amount: expense.amount,
      currency: expense.currency,
      amountAud: expense.amountAud,
      category: expense.category,
      subcategory: expense.subcategory,
      description: expense.description,
      merchant: expense.merchant,
      legId: findLegForExpenseDate(expense.date, legs)?.id,
      wiseTxnId: expense.wiseTxnId,
      source: 'wise_csv' as const,
    }));

    /**
     * The rows were inserted one at a time, each committing on its own. A failure partway through
     * therefore returned an error to the caller while leaving an unreported number of rows already
     * written — the user is told the import failed and cannot tell how much of it landed.
     *
     * The duplicate check above is a read followed by a write, so it is a race: another import of
     * overlapping data can commit between the two, and the UNIQUE index on `wise_txn_id` then
     * rejects a row somewhere in the middle of this one. A disk or I/O failure does the same.
     * (Repeats *within* a single upload are not a trigger — `prepareWiseExpenses` groups by
     * transaction id and sums, because Wise splits some transactions across several lines.)
     *
     * One transaction makes the import all-or-nothing, so a rejected import leaves the ledger
     * exactly as it was and can simply be retried.
     */
    let imported = 0;
    if (rowsToInsert.length > 0) {
      await db.transaction((tx) => {
        for (let offset = 0; offset < rowsToInsert.length; offset += INSERT_CHUNK) {
          const chunk = rowsToInsert.slice(offset, offset + INSERT_CHUNK);
          tx.insert(expenses).values(chunk).run();
        }
      });
      imported = rowsToInsert.length;
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
