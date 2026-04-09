import { db } from '@/db';
import { itineraryLegs, itineraryLegTransports } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getIntercityTransportTotal, normalizeIntercityTransports } from '@/lib/intercity-transport';
import { validateLegDates } from '@/lib/itinerary-validation';
import { success, error, handleError } from '@/lib/api-helpers';
import { z } from 'zod';

const intercityTransportSchema = z.object({
  id: z.number().int().optional(),
  mode: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  cost: z.number().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const id = parseInt(params.id);

    const existing = await db.select().from(itineraryLegs).where(eq(itineraryLegs.id, id)).get();
    if (!existing) return error('Leg not found', 404);

    const dateError = validateLegDates({
      startDate: body.startDate ?? existing.startDate,
      endDate: body.endDate ?? existing.endDate,
    });
    if (dateError) return error(dateError, 400);

    const nextTransports = Array.isArray(body.intercityTransports)
      ? normalizeIntercityTransports(z.array(intercityTransportSchema).parse(body.intercityTransports))
      : null;

    const updateBody = { ...body } as Record<string, unknown>;
    delete updateBody.intercityTransports;

    if (nextTransports) {
      updateBody.intercityTransportCost = getIntercityTransportTotal(nextTransports);
      updateBody.intercityTransportNote = nextTransports.find((transport) => transport.note)?.note ?? null;
    }

    await db.update(itineraryLegs).set(updateBody).where(eq(itineraryLegs.id, id));

    if (nextTransports) {
      await db.delete(itineraryLegTransports).where(eq(itineraryLegTransports.legId, id));

      if (nextTransports.length > 0) {
        await db.insert(itineraryLegTransports).values(
          nextTransports.map((transport, index) => ({
            legId: id,
            mode: transport.mode,
            note: transport.note,
            cost: transport.cost,
            sortOrder: transport.sortOrder ?? index,
          }))
        );
      }
    }

    const updated = await db.select().from(itineraryLegs).where(eq(itineraryLegs.id, id)).get();

    return success(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    const existing = await db.select().from(itineraryLegs).where(eq(itineraryLegs.id, id)).get();
    if (!existing) return error('Leg not found', 404);

    await db.delete(itineraryLegs).where(eq(itineraryLegs.id, id));
    return success({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
