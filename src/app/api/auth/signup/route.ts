import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { userPasswords, users } from '@/db/schema';
import { error as apiError, handleError, success } from '@/lib/api-helpers';
import { buildAuthLink } from '@/lib/auth-links';
import { issueToken } from '@/lib/auth-tokens';
import { isValidEmailShape, normalizeEmail } from '@/lib/email';
import { sendVerificationEmail } from '@/lib/mailer';
import { hashPassword, validatePasswordStrength } from '@/lib/password';

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

    if (!isValidEmailShape(data.email)) {
      return apiError('Invalid email');
    }

    const strength = validatePasswordStrength(data.password);
    if (!strength.ok) {
      return apiError(strength.reason);
    }

    const email = normalizeEmail(data.email);

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (existing) {
      return success({ ok: true });
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

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
