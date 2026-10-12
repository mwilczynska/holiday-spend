import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
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
    .onConflictDoNothing({ target: users.id });
}

export async function initializeUserPreferences(userId: string) {
  const userPrefs = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
  if (!userPrefs) {
    await db
      .insert(userPreferences)
      .values({
        userId,
        plannerGroupSize: 2,
      })
      .onConflictDoNothing();
  }

  // Unowned records require an explicit administrative migration. Signing in must
  // never give a new account another traveller's legacy records.
}
