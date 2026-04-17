import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  appSettings,
  expenses,
  fixedCosts,
  itineraryLegs,
  tags,
  userPreferences,
  users,
} from '@/db/schema';
import { normalizeEmail } from '@/lib/email';

type EnsureUserRowInput = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

export async function ensureUserRow(input: EnsureUserRowInput) {
  const normalizedEmail =
    typeof input.email === 'string' && input.email.trim() ? normalizeEmail(input.email) : null;

  await db
    .insert(users)
    .values({
      id: input.id,
      email: normalizedEmail,
      name: input.name ?? null,
      image: input.image ?? null,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: normalizedEmail,
        name: input.name ?? null,
        image: input.image ?? null,
      },
    });
}

export async function claimLegacyDataForUser(userId: string) {
  const userPrefs = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
  if (!userPrefs) {
    const legacyGroupSize = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'planner_group_size'))
      .get();

    const parsedGroupSize = Number.parseInt(legacyGroupSize?.value || '', 10);
    const plannerGroupSize = Number.isFinite(parsedGroupSize) ? parsedGroupSize : 2;

    await db
      .insert(userPreferences)
      .values({
        userId,
        plannerGroupSize,
      })
      .onConflictDoNothing();
  }

  const existingOwnedLeg = await db
    .select({ id: itineraryLegs.id })
    .from(itineraryLegs)
    .where(eq(itineraryLegs.userId, userId))
    .get();

  if (!existingOwnedLeg) {
    await db.update(itineraryLegs).set({ userId }).where(isNull(itineraryLegs.userId));
    await db.update(expenses).set({ userId }).where(isNull(expenses.userId));
    await db.update(fixedCosts).set({ userId }).where(isNull(fixedCosts.userId));
    await db.update(tags).set({ userId }).where(isNull(tags.userId));
  }

  await db.update(expenses).set({ userId }).where(and(isNull(expenses.userId), isNull(expenses.legId)));
}
