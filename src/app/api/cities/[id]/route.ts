import { db } from '@/db';
import { cities, cityEstimates, cityPriceInputs, itineraryLegs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { success, error, handleError } from '@/lib/api-helpers';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { id } = params;

    const existing = await db.select().from(cities).where(eq(cities.id, id)).get();
    if (!existing) return error('City not found', 404);

    await db.update(cities).set(body).where(eq(cities.id, id));
    const updated = await db.select().from(cities).where(eq(cities.id, id)).get();

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
    const { id } = params;

    const existing = await db.select().from(cities).where(eq(cities.id, id)).get();
    if (!existing) return error('City not found', 404);

    const linkedLeg = await db
      .select({ id: itineraryLegs.id })
      .from(itineraryLegs)
      .where(eq(itineraryLegs.cityId, id))
      .get();

    if (linkedLeg) {
      return error('This city is used in the itinerary and cannot be deleted until those itinerary legs are removed.', 409);
    }

    await db.delete(cityEstimates).where(eq(cityEstimates.cityId, id));
    await db.delete(cityPriceInputs).where(eq(cityPriceInputs.cityId, id));
    await db.delete(cities).where(eq(cities.id, id));

    return success({ id, deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
