import { db } from '@/db';
import { savedPlans } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function loadSavedPlanSummaries(userId: string) {
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
  return rows;
}
