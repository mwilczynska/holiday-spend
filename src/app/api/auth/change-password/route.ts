import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { userPasswords, users } from '@/db/schema';
import { requireCurrentUser } from '@/lib/auth';
import {
  authError,
  authSuccess,
  handleAuthError,
  RateLimitError,
} from '@/lib/auth-responses';
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/password';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();

    const rateLimit = await checkRateLimit(`change-password:user:${user.id}`, {
      max: 10,
      windowSeconds: 15 * 60,
    });

    if (!rateLimit.allowed) {
      throw new RateLimitError(rateLimit.retryAfterSeconds);
    }

    const body = await request.json();
    const data = changePasswordSchema.parse(body);

    const strength = validatePasswordStrength(data.newPassword);
    if (!strength.ok) {
      return authError(strength.reason);
    }

    const stored = await db
      .select({ hash: userPasswords.hash })
      .from(userPasswords)
      .where(eq(userPasswords.userId, user.id))
      .get();

    if (!stored) {
      return authError('No password is set on this account.', 400);
    }

    const currentOk = await verifyPassword(stored.hash, data.currentPassword);
    if (!currentOk) {
      return authError('Current password is incorrect.', 400);
    }

    const newHash = await hashPassword(data.newPassword);
    await db
      .update(userPasswords)
      .set({
        hash: newHash,
        updatedAt: sql`(datetime('now'))`,
        lastChangedAt: sql`(datetime('now'))`,
      })
      .where(eq(userPasswords.userId, user.id));

    await db
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, user.id));

    return authSuccess({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
