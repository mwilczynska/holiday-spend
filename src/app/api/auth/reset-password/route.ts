import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { userPasswords, users } from '@/db/schema';
import { error as apiError, handleError, success } from '@/lib/api-helpers';
import { consumeToken, invalidateUserTokens } from '@/lib/auth-tokens';
import { hashPassword, validatePasswordStrength } from '@/lib/password';

export const dynamic = 'force-dynamic';

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = resetPasswordSchema.parse(body);

    const strength = validatePasswordStrength(data.newPassword);
    if (!strength.ok) {
      return apiError(strength.reason);
    }

    const consumed = await consumeToken(data.token, 'reset_password');
    if (!consumed) {
      return apiError('This reset link is invalid or has expired.', 400);
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
      return apiError('This reset link is invalid or has expired.', 400);
    }

    await invalidateUserTokens(consumed.userId, 'reset_password');
    await db
      .update(users)
      .set({
        tokenVersion: sql`${users.tokenVersion} + 1`,
      })
      .where(eq(users.id, consumed.userId))
      .run();

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
