import { db } from '@/db';
import { cities } from '@/db/schema';
import { error, success, handleError } from '@/lib/api-helpers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const createSchema = z.object({
  id: z.string().min(1),
  countryId: z.string().min(1),
  name: z.string().min(1),
  accomHostel: z.number().optional(),
  accomPrivateRoom: z.number().optional(),
  accom1star: z.number().optional(),
  accom2star: z.number().optional(),
  accom3star: z.number().optional(),
  accom4star: z.number().optional(),
  foodStreet: z.number().optional(),
  foodBudget: z.number().optional(),
  foodMid: z.number().optional(),
  foodHigh: z.number().optional(),
  drinkLocalBeer: z.number().optional(),
  drinkImportBeer: z.number().optional(),
  drinkWineGlass: z.number().optional(),
  drinkCocktail: z.number().optional(),
  drinkCoffee: z.number().optional(),
  drinksNone: z.number().optional(),
  drinksLight: z.number().optional(),
  drinksModerate: z.number().optional(),
  drinksHeavy: z.number().optional(),
  activitiesFree: z.number().optional(),
  activitiesBudget: z.number().optional(),
  activitiesMid: z.number().optional(),
  activitiesHigh: z.number().optional(),
  estimationSource: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const allCities = await db.select().from(cities);
    return success(allCities);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const existingCity = await db.select({ id: cities.id }).from(cities).where(eq(cities.id, data.id)).get();
    if (existingCity) {
      return error(`City id "${data.id}" already exists. Choose a different id or update the existing city.`, 409);
    }

    await db.insert(cities).values({
      ...data,
      estimatedAt: new Date().toISOString(),
    });

    return success(data, 201);
  } catch (err) {
    return handleError(err);
  }
}
