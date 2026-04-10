import { db } from '@/db';
import { cities, countries, expenses, fixedCosts, itineraryLegs, itineraryLegTransports } from '@/db/schema';
import { NextResponse } from 'next/server';
import { error, handleError, success } from '@/lib/api-helpers';
import { CityGenerationError } from '@/lib/city-generation';
import { getIntercityTransportTotal, groupIntercityTransportsByLegId, normalizeIntercityTransports } from '@/lib/intercity-transport';
import { getPlannerGroupSize, setPlannerGroupSize } from '@/lib/planner-settings';
import { resolveMissingCities } from '@/lib/resolve-missing-cities';
import {
  collectMissingSnapshotCities,
  parseSnapshotImportRequest,
} from '@/lib/snapshot-import';
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
    const allCities = await db.select().from(cities);
    const allCountries = await db.select().from(countries);
    const groupSize = await getPlannerGroupSize();

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

    await setPlannerGroupSize(snapshot.groupSize);

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
