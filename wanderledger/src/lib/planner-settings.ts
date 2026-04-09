import { db } from '@/db';
import { appSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const DEFAULT_GROUP_SIZE = 2;

function normalizeGroupSize(value: number) {
  return Math.min(5, Math.max(1, Math.round(value || DEFAULT_GROUP_SIZE)));
}

export async function getPlannerGroupSize(): Promise<number> {
  const row = await db.select().from(appSettings).where(eq(appSettings.key, 'planner_group_size')).get();
  const parsed = Number.parseInt(row?.value || '', 10);
  return Number.isFinite(parsed) ? normalizeGroupSize(parsed) : DEFAULT_GROUP_SIZE;
}

export async function setPlannerGroupSize(groupSize: number): Promise<number> {
  const normalized = normalizeGroupSize(groupSize);
  await db.insert(appSettings).values({
    key: 'planner_group_size',
    value: String(normalized),
  }).onConflictDoUpdate({
    target: appSettings.key,
    set: { value: String(normalized) },
  });
  return normalized;
}
