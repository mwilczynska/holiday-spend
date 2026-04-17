import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { userPasswords, users } from '@/db/schema';
import { authSuccess, handleAuthError, RateLimitError } from '@/lib/auth-responses';
import { buildAuthLink } from '@/lib/auth-links';
import { invalidateUserTokens, issueToken } from '@/lib/auth-tokens';
import { checkRateLimit } from '@/lib/rate-limit';
import { isValidEmailShape, normalizeEmail } from '@/lib/email';
import { sendPasswordResetEmail } from '@/lib/mailer';
import { getRequestIp } from '@/lib/request-ip';

export const dynamic = 'force-dynamic';

const forgotPasswordSchema = z.object({
  email: z.string().optional().default(''),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = forgotPasswordSchema.parse(body);
    const clientIp = getRequestIp(request) ?? 'unknown';
    const normalizedEmail = normalizeEmail(data.email);

    const [ipLimit, emailLimit] = await Promise.all([
      checkRateLimit(`forgot-password:ip:${clientIp}`, {
        max: 5,
        windowSeconds: 60 * 60,
      }),
      checkRateLimit(`forgot-password:email:${normalizedEmail || 'unknown'}`, {
        max: 5,
        windowSeconds: 60 * 60,
      }),
    ]);

    if (!ipLimit.allowed) {
      throw new RateLimitError(ipLimit.retryAfterSeconds);
    }
    if (!emailLimit.allowed) {
      throw new RateLimitError(emailLimit.retryAfterSeconds);
    }

    if (!isValidEmailShape(data.email)) {
      return authSuccess({ ok: true });
    }
    const email = normalizedEmail;

    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (!user) {
      return authSuccess({ ok: true });
    }

    const nativePassword = await db
      .select({ userId: userPasswords.userId })
      .from(userPasswords)
      .where(eq(userPasswords.userId, user.id))
      .get();

    if (!nativePassword) {
      return authSuccess({ ok: true });
    }

    await invalidateUserTokens(user.id, 'reset_password');
    const issued = await issueToken(user.id, 'reset_password', {
      userAgent: request.headers.get('user-agent'),
    });
    const resetUrl = buildAuthLink('/reset-password', issued.rawToken, request);
    await sendPasswordResetEmail(email, resetUrl);

    return authSuccess({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
