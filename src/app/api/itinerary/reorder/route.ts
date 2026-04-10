import { db } from '@/db';
import { itineraryLegs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { success, handleError } from '@/lib/api-helpers';
import { z } from 'zod';

const reorderSchema = z.object({
  legIds: z.array(z.number()),
});

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { legIds } = reorderSchema.parse(body);

    for (let i = 0; i < legIds.length; i++) {
      await db
        .update(itineraryLegs)
        .set({ sortOrder: i + 1 })
        .where(eq(itineraryLegs.id, legIds[i]));
    }

    return success({ reordered: true });
  } catch (err) {
    return handleError(err);
  }
}
