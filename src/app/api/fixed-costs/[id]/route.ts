import { db } from '@/db';
import { fixedCosts } from '@/db/schema';
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

    const existing = await db.select().from(fixedCosts).where(and(eq(fixedCosts.id, id), eq(fixedCosts.userId, userId))).get();
    if (!existing) return error('Fixed cost not found', 404);

    await db.update(fixedCosts).set(body).where(and(eq(fixedCosts.id, id), eq(fixedCosts.userId, userId)));
    const updated = await db.select().from(fixedCosts).where(and(eq(fixedCosts.id, id), eq(fixedCosts.userId, userId))).get();
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
    const existing = await db.select().from(fixedCosts).where(and(eq(fixedCosts.id, id), eq(fixedCosts.userId, userId))).get();
    if (!existing) return error('Fixed cost not found', 404);

    await db.delete(fixedCosts).where(and(eq(fixedCosts.id, id), eq(fixedCosts.userId, userId)));
    return success({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
