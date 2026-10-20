import { instrumentRoute } from '@/lib/analytics/route';
import { loadSavedPlanSummaries } from '@/lib/saved-plan-data';
import { db } from '@/db';
import { materializeHistoricalPlan, recordNewSavedPlan } from '@/lib/analytics/history';
import { savedPlans } from '@/db/schema';
import { requireCurrentUserId } from '@/lib/auth';
import { error, handleError, success } from '@/lib/api-helpers';
import { planSnapshotSchema } from '@/lib/plan-snapshot';

export const dynamic = 'force-dynamic';

async function handleGET() {
  try {
    const userId = await requireCurrentUserId();
    const rows = await loadSavedPlanSummaries(userId);

    return success(rows);
  } catch (err) {
    return handleError(err);
  }
}

async function handlePOST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json();

    const { name, snapshot } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return error('Plan name is required.', 400);
    }

    const parsed = planSnapshotSchema.parse(snapshot);
    const snapshotJson = JSON.stringify(parsed);

    const calculated = materializeHistoricalPlan(userId, parsed).summary;
    const legCount = calculated.legCount;
    const totalNights = calculated.totalNights;
    const totalBudget = calculated.totalBudgetAud;
    const fixedCostCount = parsed.fixedCosts.length;

    const inserted = db.transaction(tx => {
    const rows = tx
      .insert(savedPlans)
      .values({
        userId,
        name: name.trim(),
        snapshotJson,
        groupSize: parsed.groupSize,
        legCount,
        totalNights,
        totalBudget,
        fixedCostCount,
      })
      .returning({ id: savedPlans.id, name: savedPlans.name, createdAt: savedPlans.createdAt }).all();
    recordNewSavedPlan(userId, rows[0].id, parsed);
    return rows;
    });

    return success(inserted[0], 201);
  } catch (err) {
    return handleError(err);
  }
}

export const GET = instrumentRoute(handleGET, '/api/saved-plans', 'GET');
export const POST = instrumentRoute(handlePOST, '/api/saved-plans', 'POST');
