import { db } from '@/db';
import { expenses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { success, error, handleError } from '@/lib/api-helpers';

export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const existing = await db.select().from(expenses).where(eq(expenses.id, id)).get();
    if (!existing) return error('Expense not found', 404);

    const newValue = existing.isExcluded ? 0 : 1;
    await db.update(expenses).set({ isExcluded: newValue }).where(eq(expenses.id, id));

    return success({ id, isExcluded: newValue });
  } catch (err) {
    return handleError(err);
  }
}
