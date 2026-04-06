import { db } from '@/db';
import { expenses, expenseTags } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { success, handleError } from '@/lib/api-helpers';
import { z } from 'zod';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const leg = url.searchParams.get('leg');
    const cat = url.searchParams.get('cat');
    const tag = url.searchParams.get('tag');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const source = url.searchParams.get('source');

    const conditions = [];
    if (leg) conditions.push(eq(expenses.legId, parseInt(leg)));
    if (cat) conditions.push(eq(expenses.category, cat));
    if (from) conditions.push(gte(expenses.date, from));
    if (to) conditions.push(lte(expenses.date, to));
    if (source) conditions.push(eq(expenses.source, source));

    let query = db.select().from(expenses).orderBy(desc(expenses.date));
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const allExpenses = await query;

    // If filtering by tag, do a post-filter
    if (tag) {
      const tagId = parseInt(tag);
      const taggedExpenseIds = await db
        .select({ expenseId: expenseTags.expenseId })
        .from(expenseTags)
        .where(eq(expenseTags.tagId, tagId));
      const idSet = new Set(taggedExpenseIds.map(t => t.expenseId));
      const filtered = allExpenses.filter(e => idSet.has(e.id));
      return success(filtered);
    }

    return success(allExpenses);
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  date: z.string().min(1),
  amount: z.number(),
  currency: z.string().min(1),
  amountAud: z.number().optional(),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  description: z.string().optional(),
  merchant: z.string().optional(),
  legId: z.number().optional(),
  source: z.string().default('manual'),
  wiseTxnId: z.string().optional(),
  loggedBy: z.string().optional(),
  isExcluded: z.number().default(0),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const result = await db.insert(expenses).values(data).returning();
    return success(result[0], 201);
  } catch (err) {
    return handleError(err);
  }
}
