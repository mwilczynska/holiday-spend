import { db } from '@/db';
import { tags, expenseTags, expenses } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { getExpenseAudAmount } from '@/lib/expense-aud';
import { success, error, handleError } from '@/lib/api-helpers';
import { isTagNameConflict } from '@/lib/tag-validation';
import { requireCurrentUserId } from '@/lib/auth';
import { z } from 'zod';

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    const allTags = await db.select().from(tags).where(eq(tags.userId, userId));

    const taggedExpenses = await db
      .select({
        tagId: expenseTags.tagId,
        amount: expenses.amount,
        amountAud: expenses.amountAud,
        currency: expenses.currency,
        isExcluded: expenses.isExcluded,
      })
      .from(expenseTags)
      .innerJoin(expenses, eq(expenseTags.expenseId, expenses.id))
      .where(and(eq(expenses.userId, userId), ne(expenses.isDeleted, 1)));

    const statsMap = new Map<number, { count: number; totalAud: number }>();
    for (const expense of taggedExpenses) {
      const stats = statsMap.get(expense.tagId) ?? { count: 0, totalAud: 0 };
      stats.count += 1;
      if (!expense.isExcluded) stats.totalAud += getExpenseAudAmount(expense);
      statsMap.set(expense.tagId, stats);
    }

    const result = allTags.map(tag => ({
      ...tag,
      expenseCount: statsMap.get(tag.id)?.count ?? 0,
      totalAud: statsMap.get(tag.id)?.totalAud ?? 0,
    }));

    return success(result);
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1),
  color: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json();
    const data = createSchema.parse(body);
    const result = await db.insert(tags).values({ ...data, userId }).returning();
    return success(result[0], 201);
  } catch (err) {
    if (isTagNameConflict(err)) return error('A tag with this name already exists. Choose a different name.', 409);
    return handleError(err);
  }
}
