import { db } from '@/db';
import { tags } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { success, error, handleError } from '@/lib/api-helpers';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const id = parseInt(params.id);

    const existing = await db.select().from(tags).where(eq(tags.id, id)).get();
    if (!existing) return error('Tag not found', 404);

    await db.update(tags).set(body).where(eq(tags.id, id));
    const updated = await db.select().from(tags).where(eq(tags.id, id)).get();
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
    const id = parseInt(params.id);
    // Cascade will handle expense_tags
    await db.delete(tags).where(eq(tags.id, id));
    return success({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
