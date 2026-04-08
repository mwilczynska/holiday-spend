import { db } from '@/db';
import { cities, cityPriceInputs } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { error, handleError, success } from '@/lib/api-helpers';
import { z } from 'zod';

const inputSchema = z.object({
  sourceType: z.string().min(1),
  sourceDetail: z.string().nullable().optional(),
  confidence: z.string().nullable().optional(),
  accomHostel: z.number().nullable().optional(),
  accomPrivateRoom: z.number().nullable().optional(),
  accom1star: z.number().nullable().optional(),
  accom2star: z.number().nullable().optional(),
  accom3star: z.number().nullable().optional(),
  accom4star: z.number().nullable().optional(),
  streetMeal: z.number().nullable().optional(),
  cheapRestaurantMeal: z.number().nullable().optional(),
  midRestaurantMeal: z.number().nullable().optional(),
  coffee: z.number().nullable().optional(),
  localBeer: z.number().nullable().optional(),
  importBeer: z.number().nullable().optional(),
  wineGlass: z.number().nullable().optional(),
  cocktail: z.number().nullable().optional(),
  publicTransitRide: z.number().nullable().optional(),
  taxiShort: z.number().nullable().optional(),
  activityBudget: z.number().nullable().optional(),
  activityMid: z.number().nullable().optional(),
  activityHigh: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cityId = params.id;
    const city = await db.select().from(cities).where(eq(cities.id, cityId)).get();
    if (!city) return error('City not found', 404);

    const inputs = await db
      .select()
      .from(cityPriceInputs)
      .where(eq(cityPriceInputs.cityId, cityId))
      .orderBy(desc(cityPriceInputs.capturedAt));

    return success({
      current: inputs.find((input) => input.isActive) || null,
      history: inputs,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cityId = params.id;
    const city = await db.select().from(cities).where(eq(cities.id, cityId)).get();
    if (!city) return error('City not found', 404);

    const body = await request.json();
    const data = inputSchema.parse(body);

    await db
      .update(cityPriceInputs)
      .set({ isActive: 0 })
      .where(and(eq(cityPriceInputs.cityId, cityId), eq(cityPriceInputs.isActive, 1)));

    const result = await db
      .insert(cityPriceInputs)
      .values({
        cityId,
        capturedAt: new Date().toISOString(),
        sourceType: data.sourceType,
        sourceDetail: data.sourceDetail || null,
        confidence: data.confidence || null,
        accomHostel: data.accomHostel ?? null,
        accomPrivateRoom: data.accomPrivateRoom ?? null,
        accom1star: data.accom1star ?? null,
        accom2star: data.accom2star ?? null,
        accom3star: data.accom3star ?? null,
        accom4star: data.accom4star ?? null,
        streetMeal: data.streetMeal ?? null,
        cheapRestaurantMeal: data.cheapRestaurantMeal ?? null,
        midRestaurantMeal: data.midRestaurantMeal ?? null,
        coffee: data.coffee ?? null,
        localBeer: data.localBeer ?? null,
        importBeer: data.importBeer ?? null,
        wineGlass: data.wineGlass ?? null,
        cocktail: data.cocktail ?? null,
        publicTransitRide: data.publicTransitRide ?? null,
        taxiShort: data.taxiShort ?? null,
        activityBudget: data.activityBudget ?? null,
        activityMid: data.activityMid ?? null,
        activityHigh: data.activityHigh ?? null,
        notes: data.notes || null,
        isActive: 1,
      })
      .returning();

    return success(result[0]);
  } catch (err) {
    return handleError(err);
  }
}
