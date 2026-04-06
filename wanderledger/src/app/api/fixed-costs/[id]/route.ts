import { db } from '@/db';
import { fixedCosts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { success, error, handleError } from '@/lib/api-helpers';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const id = parseInt(params.id);

    const existing = await db.select().from(fixedCosts).where(eq(fixedCosts.id, id)).get();
    if (!existing) return error('Fixed cost not found', 404);

    await db.update(fixedCosts).set(body).where(eq(fixedCosts.id, id));
    const updated = await db.select().from(fixedCosts).where(eq(fixedCosts.id, id)).get();
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
    const existing = await db.select().from(fixedCosts).where(eq(fixedCosts.id, id)).get();
    if (!existing) return error('Fixed cost not found', 404);

    await db.delete(fixedCosts).where(eq(fixedCosts.id, id));
    return success({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
