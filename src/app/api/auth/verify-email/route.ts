import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { error as apiError, handleError, success } from '@/lib/api-helpers';
import { consumeToken } from '@/lib/auth-tokens';

export const dynamic = 'force-dynamic';

const verifySchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = verifySchema.parse(body);

    const consumed = await consumeToken(data.token, 'verify_email');
    if (!consumed) {
      return apiError('This verification link is invalid or has expired.', 400);
    }

    await db
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.id, consumed.userId));

    const updated = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, consumed.userId))
      .get();

    return success({ ok: true, email: updated?.email ?? null });
  } catch (err) {
    return handleError(err);
  }
}
