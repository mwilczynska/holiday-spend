import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { userPasswords, users } from '@/db/schema';
import { authError, authSuccess, handleAuthError, RateLimitError } from '@/lib/auth-responses';
import { consumeToken, invalidateUserTokens } from '@/lib/auth-tokens';
import { hashPassword, validatePasswordStrength } from '@/lib/password';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';

export const dynamic = 'force-dynamic';

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const clientIp = getRequestIp(request) ?? 'unknown';
    const ipLimit = await checkRateLimit(`reset-password:ip:${clientIp}`, {
      max: 10,
      windowSeconds: 15 * 60,
    });

    if (!ipLimit.allowed) {
      throw new RateLimitError(ipLimit.retryAfterSeconds);
    }

    const body = await request.json();
    const data = resetPasswordSchema.parse(body);

    const strength = validatePasswordStrength(data.newPassword);
    if (!strength.ok) {
      return authError(strength.reason);
    }

    const consumed = await consumeToken(data.token, 'reset_password');
    if (!consumed) {
      return authError('This reset link is invalid or has expired.', 400);
    }

    const hash = await hashPassword(data.newPassword);
    const updatedPassword = await db
      .update(userPasswords)
      .set({
        hash,
        updatedAt: sql`(datetime('now'))`,
        lastChangedAt: sql`(datetime('now'))`,
      })
      .where(eq(userPasswords.userId, consumed.userId))
      .run();

    if (updatedPassword.changes === 0) {
      return authError('This reset link is invalid or has expired.', 400);
    }

    await invalidateUserTokens(consumed.userId, 'reset_password');
    await db
      .update(users)
      .set({
        tokenVersion: sql`${users.tokenVersion} + 1`,
      })
      .where(eq(users.id, consumed.userId))
      .run();

    return authSuccess({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
