import { instrumentRoute } from '@/lib/analytics/route';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { handleError, success } from '@/lib/api-helpers';
import { requireCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const profileSchema = z.object({
  name: z.string().trim().max(200).nullable().optional(),
});

async function handlePATCH(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await request.json();
    const data = profileSchema.parse(body);

    const name = data.name?.trim() ? data.name.trim() : null;

    await db.update(users).set({ name }).where(eq(users.id, user.id));

    return success({ ok: true, name });
  } catch (err) {
    return handleError(err);
  }
}

export const PATCH = instrumentRoute(handlePATCH, '/api/user/profile', 'PATCH');
