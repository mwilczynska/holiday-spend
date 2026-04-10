import { db } from '@/db';
import { expenses, itineraryLegs, cities, countries, fixedCosts, tags, expenseTags } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { handleError } from '@/lib/api-helpers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    const allExpenses = await db.select().from(expenses).orderBy(asc(expenses.date));
    const allLegs = await db.select().from(itineraryLegs).orderBy(asc(itineraryLegs.sortOrder));
    const allCities = await db.select().from(cities);
    const allCountries = await db.select().from(countries);
    const allFixed = await db.select().from(fixedCosts);
    const allTags = await db.select().from(tags);
    const allExpenseTags = await db.select().from(expenseTags);

    if (format === 'csv') {
      // Export expenses as CSV
      const headers = ['id', 'date', 'amount', 'currency', 'amount_aud', 'category', 'subcategory', 'description', 'merchant', 'leg_id', 'source', 'logged_by', 'is_excluded'];
      const rows = allExpenses.map(e => [
        e.id, e.date, e.amount, e.currency, e.amountAud ?? '',
        e.category, e.subcategory ?? '', e.description ?? '', e.merchant ?? '',
        e.legId ?? '', e.source, e.loggedBy ?? '', e.isExcluded,
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="wanderledger-expenses-${new Date().toISOString().split('T')[0]}.csv"`,
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
        'Content-Disposition': `attachment; filename="wanderledger-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
