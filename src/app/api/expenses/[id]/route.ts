import { db } from '@/db';
import { expenses, itineraryLegs } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { success, error, handleError } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';
import { convertToAud } from '@/lib/exchange-rates';

/**
 * Every field a client may change, named explicitly. The handler previously spread the raw
 * request body into the update, which let a caller write any column on the row — `userId`,
 * `isDeleted`, `id`, `source` — not just the ones the edit form exposes.
 */
const updateSchema = z
  .object({
    date: z.string().min(1),
    amount: z.number(),
    currency: z.string().min(1),
    category: z.string().min(1),
    subcategory: z.string().nullable(),
    description: z.string().nullable(),
    merchant: z.string().nullable(),
    legId: z.number().nullable(),
    isExcluded: z.number(),
  })
  .partial();

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json();
    const data = updateSchema.parse(body);
    const id = parseInt(params.id);

    const existing = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId), ne(expenses.isDeleted, 1))).get();
    if (!existing) return error('Expense not found', 404);

    if (data.legId != null) {
      const leg = await db
        .select({ id: itineraryLegs.id })
        .from(itineraryLegs)
        .where(and(eq(itineraryLegs.id, data.legId), eq(itineraryLegs.userId, userId)))
        .get();
      if (!leg) {
        return error('Assigned leg not found', 404);
      }
    }

    /**
     * Every total in the app sums `amountAud`, never `amount`. Without recomputing it here an
     * edited amount or currency was written to `amount` while `amountAud` kept its original
     * value, so the change showed in the expenses list and was silently absent from the
     * dashboard, country and category totals.
     *
     * Fails closed: if the rate cannot be resolved the conversion is stored as null rather than
     * a plausible substitute, and the dashboard already excludes rows with no AUD conversion
     * instead of treating them as zero.
     */
    const amountChanged = data.amount !== undefined && data.amount !== existing.amount;
    const currencyChanged = data.currency !== undefined && data.currency !== existing.currency;
    const dateChanged = data.date !== undefined && data.date !== existing.date;

    let amountAud: number | null | undefined;
    if (amountChanged || currencyChanged || dateChanged) {
      const amount = data.amount ?? existing.amount;
      const currency = data.currency ?? existing.currency;
      const date = data.date ?? existing.date;
      try {
        amountAud = await convertToAud(amount, currency, date);
      } catch {
        amountAud = null;
      }
    }

    await db.update(expenses).set({
      ...data,
      ...(amountAud === undefined ? {} : { amountAud }),
      updatedAt: new Date().toISOString(),
    }).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));

    const updated = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId))).get();
    return success(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireCurrentUserId();
    const id = parseInt(params.id);
    const existing = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId), ne(expenses.isDeleted, 1))).get();
    if (!existing) return error('Expense not found', 404);

    await db.update(expenses)
      .set({ isDeleted: 1, updatedAt: new Date().toISOString() })
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
    return success({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
