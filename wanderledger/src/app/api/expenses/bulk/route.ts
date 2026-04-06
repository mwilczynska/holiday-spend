import { db } from '@/db';
import { expenses, expenseTags } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { success, error, handleError } from '@/lib/api-helpers';
import { z } from 'zod';

const bulkSchema = z.object({
  ids: z.array(z.number()).min(1),
  action: z.enum(['addTag', 'changeCategory', 'exclude', 'include', 'delete']),
  tagId: z.number().optional(),
  category: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = bulkSchema.parse(body);

    switch (data.action) {
      case 'addTag':
        if (!data.tagId) return error('tagId required for addTag action');
        for (const expenseId of data.ids) {
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
          .where(inArray(expenses.id, data.ids));
        break;

      case 'exclude':
        await db.update(expenses)
          .set({ isExcluded: 1 })
          .where(inArray(expenses.id, data.ids));
        break;

      case 'include':
        await db.update(expenses)
          .set({ isExcluded: 0 })
          .where(inArray(expenses.id, data.ids));
        break;

      case 'delete':
        await db.delete(expenses)
          .where(inArray(expenses.id, data.ids));
        break;
    }

    return success({ updated: data.ids.length });
  } catch (err) {
    return handleError(err);
  }
}
