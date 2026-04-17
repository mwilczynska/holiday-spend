import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { userPasswords, users } from '@/db/schema';
import { handleError, success } from '@/lib/api-helpers';
import { buildAuthLink } from '@/lib/auth-links';
import { invalidateUserTokens, issueToken } from '@/lib/auth-tokens';
import { isValidEmailShape, normalizeEmail } from '@/lib/email';
import { sendPasswordResetEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const forgotPasswordSchema = z.object({
  email: z.string().optional().default(''),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = forgotPasswordSchema.parse(body);

    if (!isValidEmailShape(data.email)) {
      return success({ ok: true });
    }

    const email = normalizeEmail(data.email);

    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (!user) {
      return success({ ok: true });
    }

    const nativePassword = await db
      .select({ userId: userPasswords.userId })
      .from(userPasswords)
      .where(eq(userPasswords.userId, user.id))
      .get();

    if (!nativePassword) {
      return success({ ok: true });
    }

    await invalidateUserTokens(user.id, 'reset_password');
    const issued = await issueToken(user.id, 'reset_password', {
      userAgent: request.headers.get('user-agent'),
    });
    const resetUrl = buildAuthLink('/reset-password', issued.rawToken, request);
    await sendPasswordResetEmail(email, resetUrl);

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
