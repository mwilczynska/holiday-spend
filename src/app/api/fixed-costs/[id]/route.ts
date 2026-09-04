import { db } from '@/db';
import { fixedCosts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { success, error, handleError } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';
import { z } from 'zod';

/**
 * The handler previously wrote the raw request body. The row is scoped to the caller by the
 * WHERE clause, but a body containing `userId` would still move it to another account, and
 * `id` could be rewritten. Only the fields the settings screen edits are accepted.
 */
const updateFixedCostSchema = z
  .object({
    description: z.string().min(1),
    amountAud: z.number(),
    category: z.string().nullable(),
    countryId: z.string().nullable(),
    date: z.string().nullable(),
    notes: z.string().nullable(),
    isPaid: z.number().int().min(0).max(1),
  })
  .partial()
  .strict();

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireCurrentUserId();
    const body = updateFixedCostSchema.parse(await request.json());
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
