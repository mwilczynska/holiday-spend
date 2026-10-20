import { db } from '@/db';
import { itineraryLegs, itineraryLegTransports } from '@/db/schema';
import { requireCurrentUserId } from '@/lib/auth';
import { success, error, handleError } from '@/lib/api-helpers';
import { getIntercityTransportTotal, normalizeIntercityTransports } from '@/lib/intercity-transport';
import { validateLegDates } from '@/lib/itinerary-validation';
import { reserveLegSortOrder } from '@/lib/itinerary-leg-placement';
import { miscellaneousExpensesSchema } from '@/lib/miscellaneous-expenses';
import { z } from 'zod';

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
  miscellaneousExpenses: miscellaneousExpensesSchema.default([]),
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

    const legData = { ...data };
    delete legData.intercityTransports;

    // A dated leg goes into date order; an undated one is appended. Placement and insert share one transaction.
    const leg = db.transaction((tx) => {
      const sortOrder = reserveLegSortOrder(tx, userId, data.startDate);
      const inserted = tx.insert(itineraryLegs).values({
        ...legData,
        userId,
        intercityTransportCost,
        intercityTransportNote,
        sortOrder,
      }).returning().get();
      if (intercityTransports.length > 0) {
        tx.insert(itineraryLegTransports).values(
          intercityTransports.map((transport, index) => ({
            legId: inserted.id,
            mode: transport.mode,
            note: transport.note,
            cost: transport.cost,
            sortOrder: transport.sortOrder ?? index,
          }))
        ).run();
      }
      return inserted;
    });

    return success(leg, 201);
  } catch (err) {
    return handleError(err);
  }
}
