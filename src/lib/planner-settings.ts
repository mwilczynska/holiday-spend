import { db } from '@/db';
import { userPreferences } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const DEFAULT_GROUP_SIZE = 2;

function normalizeGroupSize(value: number) {
  return Math.min(5, Math.max(1, Math.round(value || DEFAULT_GROUP_SIZE)));
}

export async function getPlannerGroupSize(userId: string): Promise<number> {
  const row = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .get();
  return row?.plannerGroupSize != null ? normalizeGroupSize(row.plannerGroupSize) : DEFAULT_GROUP_SIZE;
}

export async function setPlannerGroupSize(userId: string, groupSize: number): Promise<number> {
  const normalized = normalizeGroupSize(groupSize);
  await db.insert(userPreferences).values({
    userId,
    plannerGroupSize: normalized,
  }).onConflictDoUpdate({
    target: userPreferences.userId,
    set: {
      plannerGroupSize: normalized,
      updatedAt: new Date().toISOString(),
    },
  });
  return normalized;
}
