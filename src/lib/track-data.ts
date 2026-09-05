import { db } from '@/db';
import { cities, countries, expenseTags, expenses, itineraryLegs } from '@/db/schema';
import { and, asc, desc, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import { buildExpenseTrackPageMetadata } from '@/lib/expense-track-page';
import { deriveLegDates } from '@/lib/itinerary-leg-dates';
import { EXPENSE_PAGE_SIZE } from '@/lib/performance-bounds';

/**
 * The queries behind `/track`, shared by `/api/expenses?view=track`, `/api/itinerary?view=track`
 * and the server-rendered page, so the page can arrive with its first screen of data already in the
 * HTML rather than fetching it after the bundle mounts.
 *
 * Only the unfiltered first page is server-rendered. Every filter and page change still goes
 * through the API, which is the right split: the initial view is the one every visit pays for, and
 * the rest are deliberate interactions.
 */
export interface TrackExpenseFilters {
  leg?: string | null;
  cat?: string | null;
  tag?: string | null;
  from?: string | null;
  to?: string | null;
  source?: string | null;
  page?: number;
  pageSize?: number;
}

export function buildTrackExpenseQuery() {
  return db
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
}

export function buildTrackConditions(userId: string, filters: TrackExpenseFilters) {
  const conditions = [eq(expenses.userId, userId), ne(expenses.isDeleted, 1)];
  if (filters.leg) conditions.push(eq(expenses.legId, parseInt(filters.leg)));
  if (filters.cat) conditions.push(eq(expenses.category, filters.cat));
  if (filters.from) conditions.push(gte(expenses.date, filters.from));
  if (filters.to) conditions.push(lte(expenses.date, filters.to));
  if (filters.source) conditions.push(eq(expenses.source, filters.source));
  return conditions;
}

export async function loadTaggedExpenseIds(tag?: string | null) {
  if (!tag) return null;
  const rows = await db
    .select({ expenseId: expenseTags.expenseId })
    .from(expenseTags)
    .where(eq(expenseTags.tagId, parseInt(tag)));
  return new Set(rows.map((row) => row.expenseId));
}

export async function loadTrackExpensePage(userId: string, filters: TrackExpenseFilters = {}) {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? EXPENSE_PAGE_SIZE;
  const conditions = buildTrackConditions(userId, filters);
  const taggedExpenseIds = await loadTaggedExpenseIds(filters.tag);

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
    ? await buildTrackExpenseQuery()
        .where(and(...conditions, inArray(expenses.id, pageIds)))
        .orderBy(desc(expenses.date), desc(expenses.id))
    : [];

  return {
    items,
    totalCount: pageMetadata.totalCount,
    totalAud: pageMetadata.totalAud,
    expenseIds: pageMetadata.expenseIds,
    page,
    pageSize,
  };
}

export async function loadTrackLegs(userId: string) {
  const trackLegs = await db
    .select({
      id: itineraryLegs.id,
      cityId: itineraryLegs.cityId,
      cityName: cities.name,
      countryName: countries.name,
      startDate: itineraryLegs.startDate,
      endDate: itineraryLegs.endDate,
      nights: itineraryLegs.nights,
      sortOrder: itineraryLegs.sortOrder,
    })
    .from(itineraryLegs)
    .leftJoin(cities, eq(itineraryLegs.cityId, cities.id))
    .leftJoin(countries, eq(cities.countryId, countries.id))
    .where(eq(itineraryLegs.userId, userId))
    .orderBy(asc(itineraryLegs.sortOrder));

  return deriveLegDates(trackLegs).map((leg) => ({
    id: leg.id,
    cityName: leg.cityName ?? 'Unknown',
    countryName: leg.countryName ?? 'Unknown',
    startDate: leg.startDate,
    endDate: leg.endDate,
  }));
}
