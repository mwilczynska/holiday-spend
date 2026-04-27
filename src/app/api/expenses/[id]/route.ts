import { db } from '@/db';
import { expenses, itineraryLegs } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { success, error, handleError } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json();
    const id = parseInt(params.id);

    const existing = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId), ne(expenses.isDeleted, 1))).get();
    if (!existing) return error('Expense not found', 404);

    if (body.legId != null) {
      const leg = await db
        .select({ id: itineraryLegs.id })
        .from(itineraryLegs)
        .where(and(eq(itineraryLegs.id, body.legId), eq(itineraryLegs.userId, userId)))
        .get();
      if (!leg) {
        return error('Assigned leg not found', 404);
      }
    }

    await db.update(expenses).set({
      ...body,
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
