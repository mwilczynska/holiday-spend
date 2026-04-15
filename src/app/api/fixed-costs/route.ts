import { db } from '@/db';
import { fixedCosts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { success, handleError } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';
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
    const userId = await requireCurrentUserId();
    const all = await db.select().from(fixedCosts).where(eq(fixedCosts.userId, userId));
    return success(all);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json();
    const data = createSchema.parse(body);
    const result = await db.insert(fixedCosts).values({ ...data, userId }).returning();
    return success(result[0], 201);
  } catch (err) {
    return handleError(err);
  }
}
