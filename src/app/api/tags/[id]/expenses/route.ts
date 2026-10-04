import { db } from '@/db';
import { tags, expenseTags, expenses } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { getExpenseAudAmount } from '@/lib/expense-aud';
import { success, error, handleError } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireCurrentUserId();
    const tagId = parseInt(params.id);

    const tag = await db.select().from(tags).where(and(eq(tags.id, tagId), eq(tags.userId, userId))).get();
    if (!tag) return error('Tag not found', 404);

    const taggedExpenses = await db
      .select({ expense: expenses })
      .from(expenseTags)
      .innerJoin(expenses, eq(expenseTags.expenseId, expenses.id))
      .where(and(eq(expenseTags.tagId, tagId), eq(expenses.userId, userId), ne(expenses.isDeleted, 1)));

    const expenseList = taggedExpenses.map(t => t.expense);
    const totalAud = expenseList.filter(expense => !expense.isExcluded).reduce((sum, expense) => sum + getExpenseAudAmount(expense), 0);

    return success({
      tag,
      expenses: expenseList,
      totalAud,
      count: expenseList.length,
    });
  } catch (err) {
    return handleError(err);
  }
}
