import { db } from '@/db';
import { itineraryLegs } from '@/db/schema';
import { success, handleError } from '@/lib/api-helpers';
import { z } from 'zod';
import { sql } from 'drizzle-orm';

const createSchema = z.object({
  cityId: z.string().min(1),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  nights: z.number().int().min(1),
  accomTier: z.string().default('2star'),
  foodTier: z.string().default('mid'),
  drinksTier: z.string().default('moderate'),
  activitiesTier: z.string().default('mid'),
  intercityTransportCost: z.number().default(0),
  intercityTransportNote: z.string().nullable().optional(),
  splitPct: z.number().default(50),
  notes: z.string().nullable().optional(),
  status: z.string().default('planned'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    // Get next sort order
    const maxOrder = await db
      .select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` })
      .from(itineraryLegs)
      .get();

    const result = await db.insert(itineraryLegs).values({
      ...data,
      sortOrder: (maxOrder?.max ?? 0) + 1,
    }).returning();

    return success(result[0], 201);
  } catch (err) {
    return handleError(err);
  }
}
