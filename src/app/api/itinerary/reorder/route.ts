import { db } from '@/db';
import { itineraryLegs } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { requireCurrentUserId } from '@/lib/auth';
import { success, handleError } from '@/lib/api-helpers';
import { z } from 'zod';

const reorderSchema = z.object({
  legIds: z.array(z.number()),
});

export async function PUT(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json();
    const { legIds } = reorderSchema.parse(body);
    const ownedLegs = await db
      .select({ id: itineraryLegs.id })
      .from(itineraryLegs)
      .where(and(eq(itineraryLegs.userId, userId), inArray(itineraryLegs.id, legIds)));
    const ownedLegIds = new Set(ownedLegs.map((leg) => leg.id));

    for (let i = 0; i < legIds.length; i++) {
      if (!ownedLegIds.has(legIds[i])) continue;
      await db
        .update(itineraryLegs)
        .set({ sortOrder: i + 1 })
        .where(and(eq(itineraryLegs.id, legIds[i]), eq(itineraryLegs.userId, userId)));
    }

    return success({ reordered: true });
  } catch (err) {
    return handleError(err);
  }
}
