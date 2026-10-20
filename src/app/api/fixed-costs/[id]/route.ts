import { instrumentRoute } from '@/lib/analytics/route';
import { db } from '@/db';
import { withPlanRevision } from '@/lib/analytics/history';
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

async function handlePUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireCurrentUserId();
    const body = updateFixedCostSchema.parse(await request.json());
    const id = parseInt((await params).id);

    const existing = await db.select().from(fixedCosts).where(and(eq(fixedCosts.id, id), eq(fixedCosts.userId, userId))).get();
    if (!existing) return error('Fixed cost not found', 404);

    withPlanRevision(userId, 'fixed_cost_updated', tx => tx.update(fixedCosts).set(body).where(and(eq(fixedCosts.id, id), eq(fixedCosts.userId, userId))).run());
    const updated = await db.select().from(fixedCosts).where(and(eq(fixedCosts.id, id), eq(fixedCosts.userId, userId))).get();
    return success(updated);
  } catch (err) {
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
    const existing = await db.select().from(fixedCosts).where(and(eq(fixedCosts.id, id), eq(fixedCosts.userId, userId))).get();
    if (!existing) return error('Fixed cost not found', 404);

    withPlanRevision(userId, 'fixed_cost_deleted', tx => tx.delete(fixedCosts).where(and(eq(fixedCosts.id, id), eq(fixedCosts.userId, userId))).run());
    return success({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}

export const PUT = instrumentRoute(handlePUT, '/api/fixed-costs/[id]', 'PUT');
export const DELETE = instrumentRoute(handleDELETE, '/api/fixed-costs/[id]', 'DELETE');
