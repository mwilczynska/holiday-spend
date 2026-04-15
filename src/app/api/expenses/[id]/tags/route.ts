import { db } from '@/db';
import { expenseTags, expenses, tags } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { success, handleError } from '@/lib/api-helpers';
import { error } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';
import { z } from 'zod';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json();
    const { tagIds } = z.object({ tagIds: z.array(z.number()) }).parse(body);
    const expenseId = parseInt(params.id);

    const expense = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
      .get();
    if (!expense) return error('Expense not found', 404);

    const ownedTags = tagIds.length > 0
      ? await db
          .select({ id: tags.id })
          .from(tags)
          .where(and(eq(tags.userId, userId), inArray(tags.id, tagIds)))
      : [];

    for (const tagId of ownedTags.map((tag) => tag.id)) {
      await db.insert(expenseTags).values({ expenseId, tagId }).onConflictDoNothing();
    }

    return success({ added: ownedTags.length });
  } catch (err) {
    return handleError(err);
  }
}
