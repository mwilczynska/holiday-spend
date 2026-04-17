import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { userPasswords, users } from '@/db/schema';
import { handleError, success } from '@/lib/api-helpers';
import { buildAuthLink } from '@/lib/auth-links';
import { invalidateUserTokens, issueToken } from '@/lib/auth-tokens';
import { isValidEmailShape, normalizeEmail } from '@/lib/email';
import { sendVerificationEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const resendSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = resendSchema.parse(body);

    if (!isValidEmailShape(data.email)) {
      return success({ ok: true });
    }

    const email = normalizeEmail(data.email);

    const user = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (!user || user.emailVerified) {
      return success({ ok: true });
    }

    const native = await db
      .select({ userId: userPasswords.userId })
      .from(userPasswords)
      .where(eq(userPasswords.userId, user.id))
      .get();

    if (!native) {
      return success({ ok: true });
    }

    await invalidateUserTokens(user.id, 'verify_email');
    const issued = await issueToken(user.id, 'verify_email');
    const verifyUrl = buildAuthLink('/verify-email', issued.rawToken, request);
    await sendVerificationEmail(email, verifyUrl);

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
