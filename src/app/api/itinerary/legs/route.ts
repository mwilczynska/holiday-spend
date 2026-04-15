import { db } from '@/db';
import { itineraryLegs, itineraryLegTransports } from '@/db/schema';
import { requireCurrentUserId } from '@/lib/auth';
import { success, error, handleError } from '@/lib/api-helpers';
import { getIntercityTransportTotal, normalizeIntercityTransports } from '@/lib/intercity-transport';
import { validateLegDates } from '@/lib/itinerary-validation';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';

const intercityTransportSchema = z.object({
  mode: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  cost: z.number().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

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
  intercityTransports: z.array(intercityTransportSchema).optional(),
  notes: z.string().nullable().optional(),
  status: z.string().default('planned'),
});

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json();
    const data = createSchema.parse(body);
    const intercityTransports = normalizeIntercityTransports(data.intercityTransports);
    const intercityTransportCost = intercityTransports.length > 0
      ? getIntercityTransportTotal(intercityTransports)
      : data.intercityTransportCost;
    const intercityTransportNote = intercityTransports.length > 0
      ? intercityTransports.find((transport) => transport.note)?.note ?? null
      : data.intercityTransportNote ?? null;
    const dateError = validateLegDates(data);
    if (dateError) return error(dateError, 400);

    // Get next sort order
    const maxOrder = await db
      .select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` })
      .from(itineraryLegs)
      .where(eq(itineraryLegs.userId, userId))
      .get();

    const legData = { ...data };
    delete legData.intercityTransports;

    const result = await db.insert(itineraryLegs).values({
      ...legData,
      userId,
      intercityTransportCost,
      intercityTransportNote,
      sortOrder: (maxOrder?.max ?? 0) + 1,
    }).returning();

    const leg = result[0];
    if (leg && intercityTransports.length > 0) {
      await db.insert(itineraryLegTransports).values(
        intercityTransports.map((transport, index) => ({
          legId: leg.id,
          mode: transport.mode,
          note: transport.note,
          cost: transport.cost,
          sortOrder: transport.sortOrder ?? index,
        }))
      );
    }

    return success(result[0], 201);
  } catch (err) {
    return handleError(err);
  }
}
