import { db } from '@/db';
import { savedPlans } from '@/db/schema';
import { requireCurrentUserId } from '@/lib/auth';
import { error, handleError, success } from '@/lib/api-helpers';
import { planSnapshotSchema } from '@/lib/plan-snapshot';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    const rows = await db
      .select({
        id: savedPlans.id,
        name: savedPlans.name,
        groupSize: savedPlans.groupSize,
        legCount: savedPlans.legCount,
        totalNights: savedPlans.totalNights,
        totalBudget: savedPlans.totalBudget,
        fixedCostCount: savedPlans.fixedCostCount,
        createdAt: savedPlans.createdAt,
        updatedAt: savedPlans.updatedAt,
      })
      .from(savedPlans)
      .where(eq(savedPlans.userId, userId))
      .orderBy(desc(savedPlans.createdAt));

    return success(rows);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json();

    const { name, snapshot, summary } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return error('Plan name is required.', 400);
    }

    const parsed = planSnapshotSchema.parse(snapshot);
    const snapshotJson = JSON.stringify(parsed);

    const legCount = summary?.legCount ?? parsed.legs.length;
    const totalNights = summary?.totalNights ?? parsed.legs.reduce((sum: number, leg: { nights: number }) => sum + leg.nights, 0);
    const totalBudget = summary?.totalBudget ?? 0;
    const fixedCostCount = summary?.fixedCostCount ?? parsed.fixedCosts.length;

    const inserted = await db
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
      .returning({ id: savedPlans.id, name: savedPlans.name, createdAt: savedPlans.createdAt });

    return success(inserted[0], 201);
  } catch (err) {
    return handleError(err);
  }
}
