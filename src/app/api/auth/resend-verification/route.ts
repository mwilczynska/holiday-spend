import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { userPasswords, users } from '@/db/schema';
import { authSuccess, handleAuthError, RateLimitError } from '@/lib/auth-responses';
import { buildAuthLink } from '@/lib/auth-links';
import { invalidateUserTokens, issueToken } from '@/lib/auth-tokens';
import { checkRateLimit } from '@/lib/rate-limit';
import { isValidEmailShape, normalizeEmail } from '@/lib/email';
import { sendVerificationEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const resendSchema = z.object({
  email: z.string().optional().default(''),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = resendSchema.parse(body);
    const normalizedEmail = normalizeEmail(data.email);

    const emailLimit = await checkRateLimit(`resend-verification:email:${normalizedEmail}`, {
      max: 3,
      windowSeconds: 60 * 60,
    });

    if (!emailLimit.allowed) {
      throw new RateLimitError(emailLimit.retryAfterSeconds);
    }

    if (!isValidEmailShape(data.email)) {
      return authSuccess({ ok: true });
    }
    const email = normalizedEmail;

    const user = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (!user || user.emailVerified) {
      return authSuccess({ ok: true });
    }

    const native = await db
      .select({ userId: userPasswords.userId })
      .from(userPasswords)
      .where(eq(userPasswords.userId, user.id))
      .get();

    if (!native) {
      return authSuccess({ ok: true });
    }

    await invalidateUserTokens(user.id, 'verify_email');
    const issued = await issueToken(user.id, 'verify_email');
    const verifyUrl = buildAuthLink('/verify-email', issued.rawToken, request);
    await sendVerificationEmail(email, verifyUrl);

    return authSuccess({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
