import { db } from '@/db';
import { tags, expenseTags, expenses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { success, error, handleError } from '@/lib/api-helpers';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tagId = parseInt(params.id);

    const tag = await db.select().from(tags).where(eq(tags.id, tagId)).get();
    if (!tag) return error('Tag not found', 404);

    const taggedExpenses = await db
      .select({ expense: expenses })
      .from(expenseTags)
      .innerJoin(expenses, eq(expenseTags.expenseId, expenses.id))
      .where(eq(expenseTags.tagId, tagId));

    const expenseList = taggedExpenses.map(t => t.expense);
    const totalAud = expenseList.reduce((sum, e) => sum + (e.amountAud ?? 0), 0);

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
