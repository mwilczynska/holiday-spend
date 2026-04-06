import { db } from '@/db';
import { itineraryLegs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateLegDates } from '@/lib/itinerary-validation';
import { success, error, handleError } from '@/lib/api-helpers';

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

    await db.update(itineraryLegs).set(body).where(eq(itineraryLegs.id, id));
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
