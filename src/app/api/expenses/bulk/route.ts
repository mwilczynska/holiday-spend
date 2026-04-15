import { db } from '@/db';
import { expenses, expenseTags, tags } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { success, error, handleError } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';
import { z } from 'zod';

const bulkSchema = z.object({
  ids: z.array(z.number()).min(1),
  action: z.enum(['addTag', 'changeCategory', 'exclude', 'include', 'delete']),
  tagId: z.number().optional(),
  category: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json();
    const data = bulkSchema.parse(body);
    const ownedExpenses = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.userId, userId), inArray(expenses.id, data.ids)));
    const ownedExpenseIds = ownedExpenses.map((expense) => expense.id);
    if (ownedExpenseIds.length === 0) {
      return success({ updated: 0 });
    }

    switch (data.action) {
      case 'addTag':
        if (!data.tagId) return error('tagId required for addTag action');
        {
          const tag = await db
            .select({ id: tags.id })
            .from(tags)
            .where(and(eq(tags.id, data.tagId), eq(tags.userId, userId)))
            .get();
          if (!tag) return error('Tag not found', 404);
        }
        for (const expenseId of ownedExpenseIds) {
          await db.insert(expenseTags).values({
            expenseId,
            tagId: data.tagId,
          }).onConflictDoNothing();
        }
        break;

      case 'changeCategory':
        if (!data.category) return error('category required for changeCategory action');
        await db.update(expenses)
          .set({ category: data.category })
          .where(and(eq(expenses.userId, userId), inArray(expenses.id, ownedExpenseIds)));
        break;

      case 'exclude':
        await db.update(expenses)
          .set({ isExcluded: 1 })
          .where(and(eq(expenses.userId, userId), inArray(expenses.id, ownedExpenseIds)));
        break;

      case 'include':
        await db.update(expenses)
          .set({ isExcluded: 0 })
          .where(and(eq(expenses.userId, userId), inArray(expenses.id, ownedExpenseIds)));
        break;

      case 'delete':
        await db.delete(expenses)
          .where(and(eq(expenses.userId, userId), inArray(expenses.id, ownedExpenseIds)));
        break;
    }

    return success({ updated: ownedExpenseIds.length });
  } catch (err) {
    return handleError(err);
  }
}
