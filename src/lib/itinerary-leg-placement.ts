import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { itineraryLegs } from '@/db/schema';
import { deriveLegDates } from '@/lib/itinerary-leg-dates';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface PlacedLeg {
  startDate: string | null;
  endDate: string | null;
  nights: number;
  sortOrder?: number | null;
}

/**
 * Position for a new leg starting on `startDate` among legs already in itinerary order (with derived dates): after
 * every leg that starts on or before it, so a leg added for the same day as an existing one goes after it. Undated
 * input, or a date after every leg, appends.
 */
export function dateOrderInsertionIndex(orderedLegs: PlacedLeg[], startDate: string | null | undefined): number {
  if (!startDate) return orderedLegs.length;
  const derived = deriveLegDates(orderedLegs);
  const index = derived.findIndex((leg) => leg.startDate != null && leg.startDate > startDate);
  return index === -1 ? orderedLegs.length : index;
}

/**
 * Inside `tx`, makes room for a new leg in date order and returns the sort order it should take. Legs from that
 * position onwards move down by one; with no start date the leg is appended as before.
 */
export function reserveLegSortOrder(tx: Tx, userId: string, startDate: string | null | undefined): number {
  const legs = tx
    .select({ id: itineraryLegs.id, startDate: itineraryLegs.startDate, endDate: itineraryLegs.endDate,
      nights: itineraryLegs.nights, sortOrder: itineraryLegs.sortOrder })
    .from(itineraryLegs)
    .where(eq(itineraryLegs.userId, userId))
    .orderBy(asc(itineraryLegs.sortOrder), asc(itineraryLegs.id))
    .all();
  const index = dateOrderInsertionIndex(legs, startDate);
  if (index >= legs.length) return Math.max(0, ...legs.map((leg) => leg.sortOrder ?? 0)) + 1;

  // Renumber so sort orders are dense and the slot at `index` is free.
  legs.forEach((leg, position) => {
    const sortOrder = position < index ? position + 1 : position + 2;
    if (leg.sortOrder !== sortOrder) {
      tx.update(itineraryLegs).set({ sortOrder })
        .where(and(eq(itineraryLegs.id, leg.id), eq(itineraryLegs.userId, userId))).run();
    }
  });
  return index + 1;
}

