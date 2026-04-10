import { db } from '@/db';
import { fixedCosts } from '@/db/schema';
import { success, handleError } from '@/lib/api-helpers';
import { z } from 'zod';

const createSchema = z.object({
  description: z.string().min(1),
  amountAud: z.number().positive(),
  category: z.string().optional(),
  countryId: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  isPaid: z.number().default(0),
  notes: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const all = await db.select().from(fixedCosts);
    return success(all);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const result = await db.insert(fixedCosts).values(data).returning();
    return success(result[0], 201);
  } catch (err) {
    return handleError(err);
  }
}
