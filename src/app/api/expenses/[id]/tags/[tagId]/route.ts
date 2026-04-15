import { db } from '@/db';
import { expenseTags, expenses, tags } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { success, handleError } from '@/lib/api-helpers';
import { error } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; tagId: string } }
) {
  try {
    const userId = await requireCurrentUserId();
    const expenseId = parseInt(params.id);
    const tagId = parseInt(params.tagId);

    const expense = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
      .get();
    if (!expense) return error('Expense not found', 404);

    const tag = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
      .get();
    if (!tag) return error('Tag not found', 404);

    await db.delete(expenseTags).where(
      and(eq(expenseTags.expenseId, expenseId), eq(expenseTags.tagId, tagId))
    );

    return success({ removed: true });
  } catch (err) {
    return handleError(err);
  }
}
