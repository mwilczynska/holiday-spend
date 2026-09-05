import { db } from '@/db';
import { cities, countries, expenses, fixedCosts, itineraryLegs, itineraryLegTransports } from '@/db/schema';
import { NextResponse } from 'next/server';
import { error, handleError, success } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';
import { CityGenerationError } from '@/lib/city-generation';
import { getIntercityTransportTotal, groupIntercityTransportsByLegId, normalizeIntercityTransports } from '@/lib/intercity-transport';
import { getPlannerGroupSize, setPlannerGroupSize } from '@/lib/planner-settings';
import { resolveMissingCities } from '@/lib/resolve-missing-cities';
import {
  collectMissingSnapshotCities,
  parseSnapshotImportRequest,
} from '@/lib/snapshot-import';
import { asc, eq, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    const legs = await db.select().from(itineraryLegs).where(eq(itineraryLegs.userId, userId)).orderBy(asc(itineraryLegs.sortOrder));
    const transports = legs.length > 0
      ? await db
          .select()
          .from(itineraryLegTransports)
          .where(inArray(itineraryLegTransports.legId, legs.map((leg) => leg.id)))
          .orderBy(asc(itineraryLegTransports.legId), asc(itineraryLegTransports.sortOrder), asc(itineraryLegTransports.id))
      : [];
    const allFixedCosts = await db.select().from(fixedCosts).where(eq(fixedCosts.userId, userId));
    const allCities = await db.select().from(cities);
    const allCountries = await db.select().from(countries);
    const groupSize = await getPlannerGroupSize(userId);

    const transportMap = groupIntercityTransportsByLegId(transports);
    const cityMap = new Map(allCities.map((city) => [city.id, city]));
    const countryMap = new Map(allCountries.map((country) => [country.id, country]));

    return success({
      version: 1,
      exportedAt: new Date().toISOString(),
      groupSize,
      legs: legs.map((leg, index) => {
        const intercityTransports = normalizeIntercityTransports(transportMap.get(leg.id));
        const city = cityMap.get(leg.cityId);
        const country = city ? countryMap.get(city.countryId) : null;
        return {
          ...leg,
          cityName: city?.name ?? null,
          countryId: city?.countryId ?? null,
          countryName: country?.name ?? null,
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
    const userId = await requireCurrentUserId();
    const body = await request.json();
    const importRequest = parseSnapshotImportRequest(body);
    const { snapshot, missingCityStrategy, generationConfig } = importRequest;

    const cityRows = await db.select({ id: cities.id }).from(cities);
    const knownCityIds = new Set(cityRows.map((row) => row.id));
    const resolutionByCityId = new Map(
      importRequest.missingCityResolutions.map((resolution) => [resolution.cityId, resolution])
    );

    const missingCities = collectMissingSnapshotCities(snapshot, knownCityIds);
    if (missingCities.length > 0) {
      const unresolvedCities = missingCities.filter((missingCity) => {
        const resolution = resolutionByCityId.get(missingCity.cityId);
        return !resolution?.cityName.trim() || !resolution.countryName.trim();
      });

      if (unresolvedCities.length > 0) {
        return NextResponse.json(
          {
            error: 'Cannot import snapshot. Resolve all missing cities before importing.',
            missingCities,
          },
          { status: 400 }
        );
      }
    }

    const { createdCountries, createdCities, generatedCities, knownCountryIds } = await resolveMissingCities({
      resolutions: Array.from(resolutionByCityId.values()),
      missingCityStrategy,
      generationConfig,
    });

    const missingCountry = snapshot.fixedCosts.find((cost) => cost.countryId && !knownCountryIds.has(cost.countryId));
    if (missingCountry?.countryId) {
      return error(`Cannot import snapshot. Unknown country id "${missingCountry.countryId}".`, 400);
    }

    /**
     * Importing a snapshot replaces the itinerary: it detaches every expense from its leg, then
     * deletes all legs and fixed costs, then rebuilds from the snapshot. Those writes used to run
     * as separate statements, and on better-sqlite3 each one commits immediately — so a failure
     * anywhere in the rebuild left the itinerary and fixed costs deleted, only partly restored,
     * and every expense orphaned from its leg. That is the linkage the planned-versus-actual
     * dashboard depends on.
     *
     * One transaction now covers the whole replacement, so an import either lands completely or
     * leaves the previous itinerary exactly as it was. The callback is synchronous because that is
     * what the better-sqlite3 driver requires; `.run()` and `.all()` replace `await`.
     *
     * Deliberately outside: `resolveMissingCities` above may have created countries and cities,
     * possibly through LLM generation. Those are additive dataset rows, they are not user
     * itinerary state, and keeping them on a failed import avoids paying for the same generation
     * twice. The group-size write moved below the transaction for the same fail-closed reason —
     * a rejected import must not leave the traveller count changed.
     */
    const importedLegIdBySnapshotKey = new Map<number, number>();

    await db.transaction((tx) => {
      tx.update(expenses).set({ legId: null }).where(eq(expenses.userId, userId)).run();
      tx.delete(itineraryLegs).where(eq(itineraryLegs.userId, userId)).run();
      tx.delete(fixedCosts).where(eq(fixedCosts.userId, userId)).run();

      for (let index = 0; index < snapshot.legs.length; index += 1) {
        const leg = snapshot.legs[index];
        const intercityTransportCost = getIntercityTransportTotal(leg.intercityTransports);
        const intercityTransportNote = leg.intercityTransports.find((transport) => transport.note)?.note ?? null;

        const inserted = tx
          .insert(itineraryLegs)
          .values({
            userId,
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
            sortOrder: index + 1,
            notes: leg.notes ?? null,
            status: leg.status,
          })
          .returning()
          .all();

        const insertedLeg = inserted[0];
        importedLegIdBySnapshotKey.set(leg.id ?? index, insertedLeg.id);

        if (leg.intercityTransports.length > 0) {
          tx
            .insert(itineraryLegTransports)
            .values(
              leg.intercityTransports.map((transport, transportIndex) => ({
                legId: insertedLeg.id,
                mode: transport.mode ?? null,
                note: transport.note ?? null,
                cost: transport.cost,
                sortOrder: transport.sortOrder ?? transportIndex,
              }))
            )
            .run();
        }
      }

      if (snapshot.fixedCosts.length > 0) {
        tx
          .insert(fixedCosts)
          .values(
            snapshot.fixedCosts.map((cost) => ({
              userId,
              description: cost.description,
              amountAud: cost.amountAud,
              category: cost.category ?? null,
              countryId: cost.countryId ?? null,
              date: cost.date ?? null,
              isPaid: cost.isPaid ?? 0,
              notes: cost.notes ?? null,
            }))
          )
          .run();
      }
    });

    await setPlannerGroupSize(userId, snapshot.groupSize);


    return success({
      imported: true,
      legCount: snapshot.legs.length,
      fixedCostCount: snapshot.fixedCosts.length,
      importedLegIds: Array.from(importedLegIdBySnapshotKey.values()),
      createdCountries,
      createdCities,
      generatedCities,
    });
  } catch (err) {
    if (err instanceof CityGenerationError) {
      return error(err.message, err.status);
    }
    return handleError(err);
  }
}
