import { db } from '@/db';
import { expenseTags } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { success, handleError } from '@/lib/api-helpers';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; tagId: string } }
) {
  try {
    const expenseId = parseInt(params.id);
    const tagId = parseInt(params.tagId);

    await db.delete(expenseTags).where(
      and(eq(expenseTags.expenseId, expenseId), eq(expenseTags.tagId, tagId))
    );

    return success({ removed: true });
  } catch (err) {
    return handleError(err);
  }
}
