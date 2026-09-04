import { db } from '@/db';
import { tags } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { success, error, handleError } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';
import { z } from 'zod';

/**
 * As with fixed costs, the row is scoped to the caller by the WHERE clause, but writing the raw
 * body would still let `userId` or `id` be set from the request.
 */
const updateTagSchema = z
  .object({
    name: z.string().min(1),
    color: z.string().nullable(),
  })
  .partial()
  .strict();

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireCurrentUserId();
    const body = updateTagSchema.parse(await request.json());
    const id = parseInt(params.id);

    const existing = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId))).get();
    if (!existing) return error('Tag not found', 404);

    await db.update(tags).set(body).where(and(eq(tags.id, id), eq(tags.userId, userId)));
    const updated = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId))).get();
    return success(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireCurrentUserId();
    const id = parseInt(params.id);
    // Cascade will handle expense_tags
    await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
    return success({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
