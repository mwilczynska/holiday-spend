import { db } from '@/db';
import { cities, countries, expenses, fixedCosts, itineraryLegs, itineraryLegTransports } from '@/db/schema';
import { error, handleError, success } from '@/lib/api-helpers';
import { getIntercityTransportTotal, groupIntercityTransportsByLegId, normalizeIntercityTransports } from '@/lib/intercity-transport';
import { getPlannerGroupSize, setPlannerGroupSize } from '@/lib/planner-settings';
import { planSnapshotSchema } from '@/lib/plan-snapshot';
import { asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const legs = await db.select().from(itineraryLegs).orderBy(asc(itineraryLegs.sortOrder));
    const transports = await db
      .select()
      .from(itineraryLegTransports)
      .orderBy(asc(itineraryLegTransports.legId), asc(itineraryLegTransports.sortOrder), asc(itineraryLegTransports.id));
    const allFixedCosts = await db.select().from(fixedCosts);
    const groupSize = await getPlannerGroupSize();

    const transportMap = groupIntercityTransportsByLegId(transports);

    return success({
      version: 1,
      exportedAt: new Date().toISOString(),
      groupSize,
      legs: legs.map((leg, index) => {
        const intercityTransports = normalizeIntercityTransports(transportMap.get(leg.id));
        return {
          ...leg,
          sortOrder: leg.sortOrder ?? index + 1,
          intercityTransportCost: getIntercityTransportTotal(intercityTransports),
          intercityTransportNote: intercityTransports.find((transport) => transport.note)?.note ?? null,
          intercityTransports,
        };
      }),
      fixedCosts: allFixedCosts,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const snapshot = planSnapshotSchema.parse(body);
    await setPlannerGroupSize(snapshot.groupSize);

    const cityRows = await db.select({ id: cities.id }).from(cities);
    const countryRows = await db.select({ id: countries.id }).from(countries);
    const knownCityIds = new Set(cityRows.map((row) => row.id));
    const knownCountryIds = new Set(countryRows.map((row) => row.id));

    const missingCity = snapshot.legs.find((leg) => !knownCityIds.has(leg.cityId));
    if (missingCity) {
      return error(`Cannot import snapshot. Unknown city id "${missingCity.cityId}".`, 400);
    }

    const missingCountry = snapshot.fixedCosts.find((cost) => cost.countryId && !knownCountryIds.has(cost.countryId));
    if (missingCountry?.countryId) {
      return error(`Cannot import snapshot. Unknown country id "${missingCountry.countryId}".`, 400);
    }

    await db.update(expenses).set({ legId: null });
    await db.delete(itineraryLegs);
    await db.delete(fixedCosts);

    const importedLegIdBySnapshotKey = new Map<number, number>();

    for (let index = 0; index < snapshot.legs.length; index += 1) {
      const leg = snapshot.legs[index];
      const intercityTransportCost = getIntercityTransportTotal(leg.intercityTransports);
      const intercityTransportNote = leg.intercityTransports.find((transport) => transport.note)?.note ?? null;

      const inserted = await db
        .insert(itineraryLegs)
        .values({
          cityId: leg.cityId,
          startDate: leg.startDate ?? null,
          endDate: leg.endDate ?? null,
          nights: leg.nights,
          accomTier: leg.accomTier,
          foodTier: leg.foodTier,
          drinksTier: leg.drinksTier,
          activitiesTier: leg.activitiesTier,
          accomOverride: leg.accomOverride ?? null,
          foodOverride: leg.foodOverride ?? null,
          drinksOverride: leg.drinksOverride ?? null,
          activitiesOverride: leg.activitiesOverride ?? null,
          transportOverride: leg.transportOverride ?? null,
          intercityTransportCost,
          intercityTransportNote,
          splitPct: leg.splitPct,
          sortOrder: index + 1,
          notes: leg.notes ?? null,
          status: leg.status,
        })
        .returning();

      const insertedLeg = inserted[0];
      importedLegIdBySnapshotKey.set(leg.id ?? index, insertedLeg.id);

      if (leg.intercityTransports.length > 0) {
        await db.insert(itineraryLegTransports).values(
          leg.intercityTransports.map((transport, transportIndex) => ({
            legId: insertedLeg.id,
            mode: transport.mode ?? null,
            note: transport.note ?? null,
            cost: transport.cost,
            sortOrder: transport.sortOrder ?? transportIndex,
          }))
        );
      }
    }

    if (snapshot.fixedCosts.length > 0) {
      await db.insert(fixedCosts).values(
        snapshot.fixedCosts.map((cost) => ({
          description: cost.description,
          amountAud: cost.amountAud,
          category: cost.category ?? null,
          countryId: cost.countryId ?? null,
          date: cost.date ?? null,
          isPaid: cost.isPaid ?? 0,
          notes: cost.notes ?? null,
        }))
      );
    }

    return success({
      imported: true,
      legCount: snapshot.legs.length,
      fixedCostCount: snapshot.fixedCosts.length,
      importedLegIds: Array.from(importedLegIdBySnapshotKey.values()),
    });
  } catch (err) {
    return handleError(err);
  }
}
