import { instrumentRoute } from '@/lib/analytics/route';
import { db } from '@/db';
import { tags } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { success, error, handleError } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';
import { isTagNameConflict } from '@/lib/tag-validation';
import { z } from 'zod';

/**
 * As with fixed costs, the row is scoped to the caller by the WHERE clause, but writing the raw
 * body would still let `userId` or `id` be set from the request.
 */
const updateTagSchema = z
  .object({
    name: z.string().trim().min(1),
    color: z.string().nullable(),
  })
  .partial()
  .strict();

async function handlePUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireCurrentUserId();
    const body = updateTagSchema.parse(await request.json());
    const id = parseInt((await params).id);

    const existing = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId))).get();
    if (!existing) return error('Tag not found', 404);

    await db.update(tags).set(body).where(and(eq(tags.id, id), eq(tags.userId, userId)));
    const updated = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId))).get();
    return success(updated);
  } catch (err) {
    if (isTagNameConflict(err)) return error('A tag with this name already exists. Choose a different name.', 409);
    return handleError(err);
  }
}

async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireCurrentUserId();
    const id = parseInt((await params).id);
    // Cascade will handle expense_tags
    await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
    return success({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}

export const PUT = instrumentRoute(handlePUT, '/api/tags/[id]', 'PUT');
export const DELETE = instrumentRoute(handleDELETE, '/api/tags/[id]', 'DELETE');
