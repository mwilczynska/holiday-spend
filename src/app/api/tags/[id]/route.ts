import { db } from '@/db';
import { tags } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { success, error, handleError } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json();
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
