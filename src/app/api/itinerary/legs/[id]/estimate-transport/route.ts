import { asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { cities, countries, itineraryLegs } from '@/db/schema';
import { success, error, handleError } from '@/lib/api-helpers';
import { deriveLegDates } from '@/lib/itinerary-leg-dates';
import { getPlannerGroupSize } from '@/lib/planner-settings';
import {
  TransportEstimationError,
  estimateIntercityTransport,
} from '@/lib/transport-estimation';
import type { TransportEstimateMode } from '@/types';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  originLegId: z.number().int().optional(),
  provider: z.enum(['anthropic', 'openai', 'gemini']).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  allowedModes: z.array(z.enum(['flight', 'train', 'bus', 'ferry', 'drive', 'rental_car'])).optional(),
  referenceDate: z.string().optional(),
  extraContext: z.string().optional(),
  forceRefresh: z.boolean().optional(),
});

function buildRouteFacts(params: {
  originCountryName: string;
  destinationCountryName: string;
  originRegion: string | null | undefined;
  destinationRegion: string | null | undefined;
  travelDate: string;
  referenceDate?: string;
  groupSize: number;
}): string[] {
  const facts = [
    params.originCountryName === params.destinationCountryName
      ? 'The route stays within the same country.'
      : 'The route crosses a country border.',
    params.originRegion && params.destinationRegion && params.originRegion === params.destinationRegion
      ? `Both cities are in the same app region: ${params.originRegion}.`
      : 'The cities are in different app regions or region data is missing.',
    `The estimate should cover ${params.groupSize} traveller${params.groupSize === 1 ? '' : 's'} in total.`,
  ];

  if (params.referenceDate?.trim()) {
    facts.push(`Reference or booking context supplied by the user: ${params.referenceDate.trim()}.`);
  } else {
    facts.push(`Travel date is ${params.travelDate}.`);
  }

  return facts;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = requestSchema.parse(await request.json());
    const legId = Number.parseInt(params.id, 10);
    if (!Number.isInteger(legId)) return error('Invalid leg id.', 400);

    const rawLegs = await db.select().from(itineraryLegs).orderBy(asc(itineraryLegs.sortOrder), asc(itineraryLegs.id));
    const allLegs = deriveLegDates(rawLegs);
    const targetIndex = allLegs.findIndex((leg) => leg.id === legId);
    if (targetIndex === -1) return error('Leg not found.', 404);

    const targetLeg = allLegs[targetIndex];
    const previousLeg = body.originLegId != null
      ? allLegs.find((leg) => leg.id === body.originLegId) ?? null
      : (targetIndex > 0 ? allLegs[targetIndex - 1] : null);

    if (!previousLeg) {
      return error('Transport estimation needs a previous leg to use as the route origin.', 400);
    }

    if (!targetLeg.startDate) {
      return error('The destination leg needs a start date before transport can be estimated.', 400);
    }

    const [cityRows, countryRows, groupSize] = await Promise.all([
      db.select().from(cities),
      db.select().from(countries),
      getPlannerGroupSize(),
    ]);

    const cityMap = new Map(cityRows.map((city) => [city.id, city]));
    const countryMap = new Map(countryRows.map((country) => [country.id, country]));
    const originCity = cityMap.get(previousLeg.cityId);
    const destinationCity = cityMap.get(targetLeg.cityId);

    if (!originCity || !destinationCity) {
      return error('Both route legs need valid city records before transport can be estimated.', 400);
    }

    const originCountry = countryMap.get(originCity.countryId);
    const destinationCountry = countryMap.get(destinationCity.countryId);
    if (!originCountry || !destinationCountry) {
      return error('Both route legs need valid country records before transport can be estimated.', 400);
    }

    const allowedModes = body.allowedModes && body.allowedModes.length > 0
      ? body.allowedModes
      : (['flight', 'train', 'bus', 'ferry', 'drive'] as TransportEstimateMode[]);
    const routeFacts = buildRouteFacts({
      originCountryName: originCountry.name,
      destinationCountryName: destinationCountry.name,
      originRegion: originCountry.region,
      destinationRegion: destinationCountry.region,
      travelDate: targetLeg.startDate,
      referenceDate: body.referenceDate,
      groupSize,
    });

    const estimated = await estimateIntercityTransport({
      originCity: originCity.name,
      originCountry: originCountry.name,
      destinationCity: destinationCity.name,
      destinationCountry: destinationCountry.name,
      travelDate: targetLeg.startDate,
      groupSize,
      allowedModes,
      referenceDate: body.referenceDate,
      extraContext: body.extraContext,
      provider: body.provider,
      apiKey: body.apiKey,
      model: body.model,
      routeFacts,
    });

    return success({
      legId: targetLeg.id,
      origin: {
        legId: previousLeg.id,
        cityId: originCity.id,
        cityName: originCity.name,
        countryName: originCountry.name,
        startDate: previousLeg.startDate,
        endDate: previousLeg.endDate,
      },
      destination: {
        legId: targetLeg.id,
        cityId: destinationCity.id,
        cityName: destinationCity.name,
        countryName: destinationCountry.name,
        startDate: targetLeg.startDate,
        endDate: targetLeg.endDate,
      },
      travelDate: targetLeg.startDate,
      currency: 'AUD' as const,
      assumptions: estimated.assumptions,
      evidenceSummary: {
        modesRequested: allowedModes,
        routeFacts,
      },
      options: estimated.options,
      providerResult: estimated.providerResult,
    });
  } catch (err) {
    if (err instanceof TransportEstimationError) {
      return error(err.message, err.status);
    }
    return handleError(err);
  }
}
