import { db } from '@/db';
import { expenses, itineraryLegs, cities, countries, fixedCosts, tags, expenseTags } from '@/db/schema';
import { and, asc, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import { requireCurrentUserId } from '@/lib/auth';
import { handleError } from '@/lib/api-helpers';

export async function GET(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    // The same filters `/api/expenses` accepts, so an export from the expenses screen matches
    // what is on screen rather than silently returning everything. Settings passes none, so its
    // full-trip export is unchanged.
    const legFilter = searchParams.get('leg');
    const categoryFilter = searchParams.get('cat');
    const tagFilter = searchParams.get('tag');
    const fromFilter = searchParams.get('from');
    const toFilter = searchParams.get('to');
    const sourceFilter = searchParams.get('source');

    const expenseConditions = [eq(expenses.userId, userId), ne(expenses.isDeleted, 1)];
    if (legFilter) expenseConditions.push(eq(expenses.legId, Number.parseInt(legFilter, 10)));
    if (categoryFilter) expenseConditions.push(eq(expenses.category, categoryFilter));
    if (fromFilter) expenseConditions.push(gte(expenses.date, fromFilter));
    if (toFilter) expenseConditions.push(lte(expenses.date, toFilter));
    if (sourceFilter) expenseConditions.push(eq(expenses.source, sourceFilter));

    let allExpenses = await db
      .select()
      .from(expenses)
      .where(and(...expenseConditions))
      .orderBy(asc(expenses.date));

    if (tagFilter) {
      const tagId = Number.parseInt(tagFilter, 10);
      const tagged = await db
        .select({ expenseId: expenseTags.expenseId })
        .from(expenseTags)
        .where(eq(expenseTags.tagId, tagId));
      const taggedIds = new Set(tagged.map((entry) => entry.expenseId));
      allExpenses = allExpenses.filter((expense) => taggedIds.has(expense.id));
    }
    const allLegs = await db.select().from(itineraryLegs).where(eq(itineraryLegs.userId, userId)).orderBy(asc(itineraryLegs.sortOrder));
    const allCities = await db.select().from(cities);
    const allCountries = await db.select().from(countries);
    const allFixed = await db.select().from(fixedCosts).where(eq(fixedCosts.userId, userId));
    const allTags = await db.select().from(tags).where(eq(tags.userId, userId));
    const allExpenseTags = allExpenses.length > 0 && allTags.length > 0
      ? await db
          .select()
          .from(expenseTags)
          .where(
            and(
              inArray(expenseTags.expenseId, allExpenses.map((expense) => expense.id)),
              inArray(expenseTags.tagId, allTags.map((tag) => tag.id))
            )
          )
      : [];

    if (format === 'csv') {
      // City and country are resolved here so the CSV stands on its own in a spreadsheet,
      // rather than leaving the reader to join leg_id against another export.
      const cityById = new Map(allCities.map((city) => [city.id, city]));
      const countryById = new Map(allCountries.map((country) => [country.id, country]));
      const legById = new Map(allLegs.map((leg) => [leg.id, leg]));

      const headers = ['id', 'date', 'amount', 'currency', 'amount_aud', 'category', 'subcategory', 'description', 'merchant', 'leg_id', 'city', 'country', 'source', 'logged_by', 'is_excluded'];
      const rows = allExpenses.map(e => {
        const leg = e.legId === null ? undefined : legById.get(e.legId);
        const city = leg ? cityById.get(leg.cityId) : undefined;
        const country = city?.countryId ? countryById.get(city.countryId) : undefined;
        return [
          e.id, e.date, e.amount, e.currency, e.amountAud ?? '',
          e.category, e.subcategory ?? '', e.description ?? '', e.merchant ?? '',
          e.legId ?? '', city?.name ?? '', country?.name ?? '', e.source, e.loggedBy ?? '', e.isExcluded,
        ];
      });

      const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="holiday-spend-expenses-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON export — full trip data
    const data = {
      exportedAt: new Date().toISOString(),
      countries: allCountries,
      cities: allCities,
      itinerary: allLegs,
      fixedCosts: allFixed,
      expenses: allExpenses,
      tags: allTags,
      expenseTags: allExpenseTags,
    };

    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="holiday-spend-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
