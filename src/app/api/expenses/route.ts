import { db } from '@/db';
import { expenses, expenseTags, itineraryLegs, cities, countries } from '@/db/schema';
import { eq, and, gte, lte, desc, inArray, ne } from 'drizzle-orm';
import { success, handleError } from '@/lib/api-helpers';
import { error } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';
import { buildExpenseTrackPageMetadata } from '@/lib/expense-track-page';
import { EXPENSE_PAGE_SIZE } from '@/lib/performance-bounds';
import { z } from 'zod';

const trackViewSchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(EXPENSE_PAGE_SIZE).default(EXPENSE_PAGE_SIZE),
});

export async function GET(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const url = new URL(request.url);
    const leg = url.searchParams.get('leg');
    const cat = url.searchParams.get('cat');
    const tag = url.searchParams.get('tag');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const source = url.searchParams.get('source');
    const isTrackView = url.searchParams.get('view') === 'track';

    const conditions = [eq(expenses.userId, userId), ne(expenses.isDeleted, 1)];
    if (leg) conditions.push(eq(expenses.legId, parseInt(leg)));
    if (cat) conditions.push(eq(expenses.category, cat));
    if (from) conditions.push(gte(expenses.date, from));
    if (to) conditions.push(lte(expenses.date, to));
    if (source) conditions.push(eq(expenses.source, source));

    let taggedExpenseIds: Set<number> | null = null;
    if (tag) {
      const tagId = parseInt(tag);
      const taggedExpenses = await db
        .select({ expenseId: expenseTags.expenseId })
        .from(expenseTags)
        .where(eq(expenseTags.tagId, tagId));
      taggedExpenseIds = new Set(taggedExpenses.map((entry) => entry.expenseId));
    }

    const buildExpenseQuery = () => db
      .select({
        id: expenses.id,
        date: expenses.date,
        amount: expenses.amount,
        currency: expenses.currency,
        amountAud: expenses.amountAud,
        category: expenses.category,
        subcategory: expenses.subcategory,
        description: expenses.description,
        merchant: expenses.merchant,
        legId: expenses.legId,
        source: expenses.source,
        loggedBy: expenses.loggedBy,
        isExcluded: expenses.isExcluded,
        cityId: itineraryLegs.cityId,
        cityName: cities.name,
        countryId: countries.id,
        countryName: countries.name,
        assignmentStartDate: itineraryLegs.startDate,
        assignmentEndDate: itineraryLegs.endDate,
      })
      .from(expenses)
      .leftJoin(itineraryLegs, eq(expenses.legId, itineraryLegs.id))
      .leftJoin(cities, eq(itineraryLegs.cityId, cities.id))
      .leftJoin(countries, eq(cities.countryId, countries.id));

    if (isTrackView) {
      const { page, pageSize } = trackViewSchema.parse({
        page: url.searchParams.get('page') ?? undefined,
        pageSize: url.searchParams.get('pageSize') ?? undefined,
      });
      const metadata = await db
        .select({
          id: expenses.id,
          date: expenses.date,
          amount: expenses.amount,
          amountAud: expenses.amountAud,
          currency: expenses.currency,
          isExcluded: expenses.isExcluded,
        })
        .from(expenses)
        .where(and(...conditions))
        .orderBy(desc(expenses.date), desc(expenses.id));
      const filteredMetadata = taggedExpenseIds
        ? metadata.filter((expense) => taggedExpenseIds.has(expense.id))
        : metadata;
      const pageMetadata = buildExpenseTrackPageMetadata(filteredMetadata, page, pageSize);
      const { pageIds } = pageMetadata;
      const items = pageIds.length > 0
        ? await buildExpenseQuery()
            .where(and(...conditions, inArray(expenses.id, pageIds)))
            .orderBy(desc(expenses.date), desc(expenses.id))
        : [];

      return success({
        items,
        totalCount: pageMetadata.totalCount,
        totalAud: pageMetadata.totalAud,
        expenseIds: pageMetadata.expenseIds,
        page,
        pageSize,
      });
    }

    let query = buildExpenseQuery().orderBy(desc(expenses.date), desc(expenses.id));
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const allExpenses = await query;

    // Preserve the legacy full-array contract for existing callers.
    if (taggedExpenseIds) {
      const filtered = allExpenses.filter((expense) => taggedExpenseIds.has(expense.id));
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
    const userId = await requireCurrentUserId();
    const body = await request.json();
    const data = createSchema.parse(body);
    if (data.legId != null) {
      const leg = await db
        .select({ id: itineraryLegs.id })
        .from(itineraryLegs)
        .where(and(eq(itineraryLegs.id, data.legId), eq(itineraryLegs.userId, userId)))
        .get();
      if (!leg) {
        return error('Assigned leg not found', 404);
      }
    }
    const result = await db.insert(expenses).values({ ...data, userId }).returning();
    return success(result[0], 201);
  } catch (err) {
    return handleError(err);
  }
}
