import { db } from '@/db';
import { expenseTags } from '@/db/schema';
import { success, handleError } from '@/lib/api-helpers';
import { z } from 'zod';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { tagIds } = z.object({ tagIds: z.array(z.number()) }).parse(body);
    const expenseId = parseInt(params.id);

    for (const tagId of tagIds) {
      await db.insert(expenseTags).values({ expenseId, tagId }).onConflictDoNothing();
    }

    return success({ added: tagIds.length });
  } catch (err) {
    return handleError(err);
  }
}
