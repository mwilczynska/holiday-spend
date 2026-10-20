import { instrumentRoute } from '@/lib/analytics/route';
import { setAnalyticsActor } from '@/lib/analytics/context';
import { recordEvent } from '@/lib/analytics/service';
import { isLibraryAdmin } from '@/lib/auth-policy';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { userPasswords, users } from '@/db/schema';
import { authError, authSuccess, handleAuthError, RateLimitError } from '@/lib/auth-responses';
import { consumeTokenSync, findActiveTokenUser } from '@/lib/auth-tokens';
import { verifyPassword } from '@/lib/password';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';

export const dynamic = 'force-dynamic';

const verifySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(1),
});

/**
 * Verification requires the account's password as well as the emailed link.
 *
 * Without it, anyone who knew an allowlisted address could register it first with their own
 * password; the real owner's later signup only re-sent the link, and clicking it verified an
 * account whose password the other person knew. The link proves control of the mailbox and the
 * password proves the person in the mailbox chose it. A wrong password leaves the link usable.
 */
async function handlePOST(request: Request) {
  try {
    const clientIp = getRequestIp(request) ?? 'unknown';
    const ipLimit = await checkRateLimit(`verify-email:ip:${clientIp}`, {
      max: 20,
      windowSeconds: 60 * 60,
    });

    if (!ipLimit.allowed) {
      throw new RateLimitError(ipLimit.retryAfterSeconds);
    }

    const body = await request.json();
    const data = verifySchema.parse(body);

    const pending = findActiveTokenUser(data.token, 'verify_email');
    const stored = pending
      ? db.select({ hash: userPasswords.hash }).from(userPasswords).where(eq(userPasswords.userId, pending.userId)).get()
      : undefined;
    if (!pending || !stored) {
      return authError('This verification link is invalid or has expired.', 400);
    }
    if (!(await verifyPassword(stored.hash, data.password))) {
      return authError(
        'That password does not match this account. If you did not choose it, reset your password from the sign-in page instead.',
        400
      );
    }

    const updated = db.transaction(tx => {
      const consumed = consumeTokenSync(data.token, 'verify_email');
      if (!consumed || consumed.userId !== pending.userId) return null;
      tx.update(users).set({ emailVerified: new Date() }).where(eq(users.id, consumed.userId)).run();
      return tx.select({ email: users.email }).from(users).where(eq(users.id, consumed.userId)).get();
    });
    if (!updated) {
      return authError('This verification link is invalid or has expired.', 400);
    }

    setAnalyticsActor(pending.userId, isLibraryAdmin(updated.email));
    recordEvent('workflow_step', { workflow: 'auth', step: 'verification_completed', outcome: 'success' });
    return authSuccess({ ok: true, email: updated?.email ?? null });
  } catch (err) {
    return handleAuthError(err);
  }
}

export const POST = instrumentRoute(handlePOST, '/api/auth/verify-email', 'POST');
