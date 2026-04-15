import { db } from '@/db';
import { expenses } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { success, error, handleError } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';

export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireCurrentUserId();
    const id = parseInt(params.id);
    const existing = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId))).get();
    if (!existing) return error('Expense not found', 404);

    const newValue = existing.isExcluded ? 0 : 1;
    await db.update(expenses).set({ isExcluded: newValue }).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));

    return success({ id, isExcluded: newValue });
  } catch (err) {
    return handleError(err);
  }
}
