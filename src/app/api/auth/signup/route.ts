import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { userPasswords, users } from '@/db/schema';
import { authError, authSuccess, handleAuthError, RateLimitError } from '@/lib/auth-responses';
import { buildAuthLink } from '@/lib/auth-links';
import { issueToken } from '@/lib/auth-tokens';
import { checkRateLimit } from '@/lib/rate-limit';
import { isValidEmailShape, normalizeEmail } from '@/lib/email';
import { sendVerificationEmail } from '@/lib/mailer';
import { hashPassword, validatePasswordStrength } from '@/lib/password';
import { getRequestIp } from '@/lib/request-ip';

export const dynamic = 'force-dynamic';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = signupSchema.parse(body);
    const clientIp = getRequestIp(request) ?? 'unknown';
    const normalizedEmail = normalizeEmail(data.email);

    const [ipLimit, emailLimit] = await Promise.all([
      checkRateLimit(`signup:ip:${clientIp}`, {
        max: 5,
        windowSeconds: 60 * 60,
      }),
      checkRateLimit(`signup:email:${normalizedEmail}`, {
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
      return authError('Invalid email');
    }

    const strength = validatePasswordStrength(data.password);
    if (!strength.ok) {
      return authError(strength.reason);
    }
    const email = normalizedEmail;

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (existing) {
      return authSuccess({ ok: true });
    }

    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      email,
      name: data.name?.trim() || null,
      emailVerified: null,
    });

    const hash = await hashPassword(data.password);
    await db.insert(userPasswords).values({ userId, hash });

    const issued = await issueToken(userId, 'verify_email');
    const verifyUrl = buildAuthLink('/verify-email', issued.rawToken, request);
    await sendVerificationEmail(email, verifyUrl);

    return authSuccess({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
