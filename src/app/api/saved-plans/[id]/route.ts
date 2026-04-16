import { db } from '@/db';
import { savedPlans } from '@/db/schema';
import { requireCurrentUserId } from '@/lib/auth';
import { error, handleError, success } from '@/lib/api-helpers';
import { planSnapshotSchema } from '@/lib/plan-snapshot';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function findOwnedPlan(planId: string, userId: string) {
  const rows = await db
    .select()
    .from(savedPlans)
    .where(and(eq(savedPlans.id, planId), eq(savedPlans.userId, userId)));
  return rows[0] ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireCurrentUserId();
    const plan = await findOwnedPlan(params.id, userId);
    if (!plan) {
      return error('Saved plan not found.', 404);
    }

    const snapshot = planSnapshotSchema.parse(JSON.parse(plan.snapshotJson));

    return success({
      id: plan.id,
      name: plan.name,
      groupSize: plan.groupSize,
      legCount: plan.legCount,
      totalNights: plan.totalNights,
      totalBudget: plan.totalBudget,
      fixedCostCount: plan.fixedCostCount,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      snapshot,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireCurrentUserId();
    const plan = await findOwnedPlan(params.id, userId);
    if (!plan) {
      return error('Saved plan not found.', 404);
    }

    const body = await request.json();
    const name = body.name;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return error('Plan name is required.', 400);
    }

    const updated = await db
      .update(savedPlans)
      .set({ name: name.trim(), updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) })
      .where(eq(savedPlans.id, params.id))
      .returning({ id: savedPlans.id, name: savedPlans.name, updatedAt: savedPlans.updatedAt });

    return success(updated[0]);
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
    const plan = await findOwnedPlan(params.id, userId);
    if (!plan) {
      return error('Saved plan not found.', 404);
    }

    await db.delete(savedPlans).where(eq(savedPlans.id, params.id));

    return success({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
