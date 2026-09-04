import { db } from '@/db';
import { cities, cityEstimates, cityPriceInputs, itineraryLegs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { success, error, handleError } from '@/lib/api-helpers';

/**
 * The dataset editor is the only caller, and it sends exactly these 23 cost fields. The handler
 * previously did `set(body)` with the raw request body, so any authenticated request could write
 * any column on a row in the shared city dataset — including `estimationSource` and
 * `estimationId`, which would let a value falsely claim a provenance it does not have, and `id`,
 * which would orphan every reference to the row.
 *
 * City generation does not go through this route; it writes directly in
 * `src/lib/city-generation-service.ts`, so restricting this endpoint to cost fields does not
 * affect it.
 *
 * `.strict()` rather than the default strip, so an unexpected field is refused rather than
 * silently discarded. A new cost field must be added here deliberately, which is the fail-closed
 * behaviour this project asks for.
 */
const costFieldSchema = z.number().nullable();

const updateCitySchema = z
  .object({
    accomHostel: costFieldSchema,
    accomPrivateRoom: costFieldSchema,
    accom1star: costFieldSchema,
    accom2star: costFieldSchema,
    accom3star: costFieldSchema,
    accom4star: costFieldSchema,
    foodStreet: costFieldSchema,
    foodBudget: costFieldSchema,
    foodMid: costFieldSchema,
    foodHigh: costFieldSchema,
    drinkLocalBeer: costFieldSchema,
    drinkImportBeer: costFieldSchema,
    drinkWineGlass: costFieldSchema,
    drinkCocktail: costFieldSchema,
    drinkCoffee: costFieldSchema,
    drinksNone: costFieldSchema,
    drinksLight: costFieldSchema,
    drinksModerate: costFieldSchema,
    drinksHeavy: costFieldSchema,
    activitiesFree: costFieldSchema,
    activitiesBudget: costFieldSchema,
    activitiesMid: costFieldSchema,
    activitiesHigh: costFieldSchema,
  })
  .partial()
  .strict();

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const data = updateCitySchema.parse(body);
    const { id } = params;

    const existing = await db.select().from(cities).where(eq(cities.id, id)).get();
    if (!existing) return error('City not found', 404);

    if (Object.keys(data).length === 0) {
      return error('No editable city cost fields were provided.', 400);
    }

    await db.update(cities).set(data).where(eq(cities.id, id));
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
