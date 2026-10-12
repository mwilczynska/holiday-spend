import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { authError, authSuccess, handleAuthError, RateLimitError } from '@/lib/auth-responses';
import { consumeTokenSync } from '@/lib/auth-tokens';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';

export const dynamic = 'force-dynamic';

const verifySchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request) {
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

    const updated = db.transaction(tx => {
      const consumed = consumeTokenSync(data.token, 'verify_email');
      if (!consumed) return null;
      tx.update(users).set({ emailVerified: new Date() }).where(eq(users.id, consumed.userId)).run();
      return tx.select({ email: users.email }).from(users).where(eq(users.id, consumed.userId)).get();
    });
    if (!updated) {
      return authError('This verification link is invalid or has expired.', 400);
    }

    return authSuccess({ ok: true, email: updated?.email ?? null });
  } catch (err) {
    return handleAuthError(err);
  }
}
