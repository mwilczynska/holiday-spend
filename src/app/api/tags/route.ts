import { db } from '@/db';
import { tags, expenseTags, expenses } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { success, handleError } from '@/lib/api-helpers';
import { z } from 'zod';

export async function GET() {
  try {
    const allTags = await db.select().from(tags);

    // Get counts and sums for each tag
    const tagStats = await db
      .select({
        tagId: expenseTags.tagId,
        count: sql<number>`COUNT(*)`,
        totalAud: sql<number>`COALESCE(SUM(${expenses.amountAud}), 0)`,
      })
      .from(expenseTags)
      .leftJoin(expenses, eq(expenseTags.expenseId, expenses.id))
      .groupBy(expenseTags.tagId);

    const statsMap = new Map(tagStats.map(s => [s.tagId, s]));

    const result = allTags.map(tag => ({
      ...tag,
      expenseCount: statsMap.get(tag.id)?.count ?? 0,
      totalAud: statsMap.get(tag.id)?.totalAud ?? 0,
    }));

    return success(result);
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const result = await db.insert(tags).values(data).returning();
    return success(result[0], 201);
  } catch (err) {
    return handleError(err);
  }
}
