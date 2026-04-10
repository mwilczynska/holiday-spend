import { db } from '@/db';
import { cities, cityEstimates, cityPriceInputs, countries } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { estimateCity } from '@/lib/estimation/orchestrator';
import { buildHybridEstimate } from '@/lib/estimation/hybrid-estimator';
import { getLLMProvider } from '@/lib/estimation/llm-provider';
import { buildEstimationPrompt } from '@/lib/estimation/prompt';
import * as xoteloClient from '@/lib/estimation/xotelo-client';
import { error, success, handleError } from '@/lib/api-helpers';
import { z } from 'zod';
import type { CityEstimateData, CityPriceInputData, EstimateConfidence } from '@/types';

const estimateSchema = z.object({
  cityId: z.string().min(1),
  cityName: z.string().min(1),
  country: z.string().min(1),
  currencyCode: z.string().default('USD'),
  sources: z.array(z.string()).default(['xotelo']),
  xoteloLocationKey: z.string().optional(),
  audRate: z.number().optional(),
});

const OUTPUT_FIELDS: Array<keyof CityEstimateData> = [
  'accomHostel',
  'accomPrivateRoom',
  'accom1star',
  'accom2star',
  'accom3star',
  'accom4star',
  'foodStreet',
  'foodBudget',
  'foodMid',
  'foodHigh',
  'drinkLocalBeer',
  'drinkImportBeer',
  'drinkWineGlass',
  'drinkCocktail',
  'drinkCoffee',
  'drinksNone',
  'drinksLight',
  'drinksModerate',
  'drinksHeavy',
  'activitiesFree',
  'activitiesBudget',
  'activitiesMid',
  'activitiesHigh',
];

const INPUT_FIELDS: Array<keyof CityPriceInputData> = [
  'accomHostel',
  'accomPrivateRoom',
  'accom1star',
  'accom2star',
  'accom3star',
  'accom4star',
  'streetMeal',
  'cheapRestaurantMeal',
  'midRestaurantMeal',
  'coffee',
  'localBeer',
  'importBeer',
  'wineGlass',
  'cocktail',
  'publicTransitRide',
  'taxiShort',
  'activityBudget',
  'activityMid',
  'activityHigh',
];

function mapInputRecord(record: Record<string, unknown> | null | undefined): Partial<CityPriceInputData> {
  if (!record) return {};

  return INPUT_FIELDS.reduce<Partial<CityPriceInputData>>((acc, field) => {
    const value = record[field];
    if (typeof value === 'number') acc[field] = value;
    return acc;
  }, {});
}

function pickPeerInput(params: {
  cityId: string;
  countryId: string;
  region: string | null;
  inputs: Array<Record<string, unknown> & { cityId: string; cityName: string; countryId: string; countryName: string; region: string | null }>;
}) {
  const { cityId, countryId, region, inputs } = params;

  const sameCountry = inputs.find((input) => input.cityId !== cityId && input.countryId === countryId);
  if (sameCountry) return sameCountry;

  if (region) {
    const sameRegion = inputs.find((input) => input.cityId !== cityId && input.region === region);
    if (sameRegion) return sameRegion;
  }

  return null;
}

function mergeLlmFill(params: {
  currentData: Partial<CityEstimateData>;
  currentSources: Record<string, string>;
  llmData: Partial<CityEstimateData>;
}) {
  const { currentData, currentSources, llmData } = params;
  let filledCount = 0;

  for (const field of OUTPUT_FIELDS) {
    if (currentData[field] != null) continue;
    const llmValue = llmData[field];
    if (llmValue == null) continue;
    currentData[field] = llmValue;
    currentSources[field] = 'llm';
    filledCount += 1;
  }

  return filledCount;
}

function pickEstimateData(data: Partial<CityEstimateData>): Partial<CityEstimateData> {
  return OUTPUT_FIELDS.reduce<Partial<CityEstimateData>>((acc, field) => {
    const value = data[field];
    if (value != null) {
      acc[field] = value;
    }
    return acc;
  }, {});
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = estimateSchema.parse(body);
    const city = await db.select().from(cities).where(eq(cities.id, data.cityId)).get();
    if (!city) {
      return error('City not found', 404);
    }
    const country = await db.select().from(countries).where(eq(countries.id, city.countryId)).get();

    let resultData: Partial<CityEstimateData> = {};
    let sourceMap: Record<string, string> = {};
    let reasoning: string | undefined;
    let confidence: EstimateConfidence | undefined;
    let llmProvider: string | undefined;
    let xoteloRaw: unknown;
    let inputSnapshot: Partial<CityPriceInputData> = {};
    let fallbackLog: string[] = [];

    if (data.sources.includes('hybrid')) {
      const activeInput = await db
        .select()
        .from(cityPriceInputs)
        .where(and(eq(cityPriceInputs.cityId, data.cityId), eq(cityPriceInputs.isActive, 1)))
        .orderBy(desc(cityPriceInputs.capturedAt))
        .get();

      const peerCandidates = await db
        .select({
          id: cityPriceInputs.id,
          cityId: cityPriceInputs.cityId,
          capturedAt: cityPriceInputs.capturedAt,
          sourceType: cityPriceInputs.sourceType,
          sourceDetail: cityPriceInputs.sourceDetail,
          confidence: cityPriceInputs.confidence,
          accomHostel: cityPriceInputs.accomHostel,
          accomPrivateRoom: cityPriceInputs.accomPrivateRoom,
          accom1star: cityPriceInputs.accom1star,
          accom2star: cityPriceInputs.accom2star,
          accom3star: cityPriceInputs.accom3star,
          accom4star: cityPriceInputs.accom4star,
          streetMeal: cityPriceInputs.streetMeal,
          cheapRestaurantMeal: cityPriceInputs.cheapRestaurantMeal,
          midRestaurantMeal: cityPriceInputs.midRestaurantMeal,
          coffee: cityPriceInputs.coffee,
          localBeer: cityPriceInputs.localBeer,
          importBeer: cityPriceInputs.importBeer,
          wineGlass: cityPriceInputs.wineGlass,
          cocktail: cityPriceInputs.cocktail,
          publicTransitRide: cityPriceInputs.publicTransitRide,
          taxiShort: cityPriceInputs.taxiShort,
          activityBudget: cityPriceInputs.activityBudget,
          activityMid: cityPriceInputs.activityMid,
          activityHigh: cityPriceInputs.activityHigh,
          notes: cityPriceInputs.notes,
          cityName: cities.name,
          countryId: cities.countryId,
          countryName: countries.name,
          region: countries.region,
        })
        .from(cityPriceInputs)
        .innerJoin(cities, eq(cityPriceInputs.cityId, cities.id))
        .innerJoin(countries, eq(cities.countryId, countries.id))
        .where(eq(cityPriceInputs.isActive, 1))
        .orderBy(desc(cityPriceInputs.capturedAt));

      let xoteloData: Partial<CityEstimateData> | undefined;
      if (data.sources.includes('xotelo') && data.xoteloLocationKey) {
        xoteloData = await xoteloClient.getAccommodationPrices(data.xoteloLocationKey, data.audRate ?? 1);
        xoteloRaw = xoteloData;
      }

      const peerInput = city && country
        ? pickPeerInput({
            cityId: data.cityId,
            countryId: city.countryId,
            region: country.region,
            inputs: peerCandidates,
          })
        : null;

      const hybridResult = buildHybridEstimate({
        manualInputs: mapInputRecord(activeInput),
        xoteloData,
        peerInputs: mapInputRecord(peerInput),
        peerContext: peerInput
          ? {
              cityName: String(peerInput.cityName),
              countryName: String(peerInput.countryName),
              region: (peerInput.region as string | null) ?? null,
            }
          : null,
      });

      resultData = pickEstimateData(hybridResult.data);
      sourceMap = Object.fromEntries(
        Object.entries(hybridResult.sources).filter(([key]) => OUTPUT_FIELDS.includes(key as keyof CityEstimateData))
      );
      inputSnapshot = hybridResult.inputSnapshot;
      fallbackLog = hybridResult.fallbackLog;
      confidence = hybridResult.confidence;
      reasoning = fallbackLog.length > 0
        ? `Hybrid estimate applied. ${fallbackLog.join(' ')}`
        : 'Hybrid estimate derived from structured anchor inputs and deterministic formulas.';

      if (data.sources.includes('llm')) {
        const provider = await getLLMProvider();
        if (provider) {
          const prompt = buildEstimationPrompt({
            cityName: data.cityName,
            country: data.country,
            currencyCode: data.currencyCode || 'USD',
            audRate: data.audRate ?? 1,
          });

          try {
            const llmResult = await provider.estimate(
              {
                cityName: data.cityName,
                country: data.country,
                currencyCode: data.currencyCode || 'USD',
                audRate: data.audRate ?? 1,
              },
              prompt
            );

            const filledCount = mergeLlmFill({
              currentData: resultData,
              currentSources: sourceMap,
              llmData: llmResult.data,
            });

            if (filledCount > 0) {
              llmProvider = provider.name;
              reasoning = [reasoning, llmResult.reasoning].filter(Boolean).join(' ');
              confidence = confidence === 'high' ? 'medium' : (llmResult.confidence || confidence || 'medium');
              fallbackLog.push(`LLM filled ${filledCount} missing output field${filledCount === 1 ? '' : 's'}.`);
            }
          } catch (err) {
            console.error('Hybrid LLM fill failed:', err);
          }
        }
      }
    } else {
      const legacyResult = await estimateCity({
        cityName: data.cityName,
        country: data.country,
        currencyCode: data.currencyCode,
        sources: data.sources,
        xoteloLocationKey: data.xoteloLocationKey,
        audRate: data.audRate,
      });

      resultData = pickEstimateData(legacyResult.data);
      sourceMap = legacyResult.sources;
      reasoning = legacyResult.reasoning;
      confidence = (legacyResult.confidence as EstimateConfidence | undefined) || undefined;
      llmProvider = legacyResult.llmProvider;
      xoteloRaw = legacyResult.xoteloRaw;
    }

    await db
      .update(cityEstimates)
      .set({ isActive: 0 })
      .where(eq(cityEstimates.cityId, data.cityId));

    const estimate = await db.insert(cityEstimates).values({
      cityId: data.cityId,
      estimatedAt: new Date().toISOString(),
      source: data.sources.join('+'),
      llmProvider: llmProvider || null,
      dataJson: JSON.stringify(resultData),
      reasoning: reasoning || null,
      confidence: confidence || null,
      xoteloData: xoteloRaw ? JSON.stringify(xoteloRaw) : null,
      sourcesJson: JSON.stringify(sourceMap),
      inputSnapshotJson: JSON.stringify(inputSnapshot),
      fallbackLogJson: JSON.stringify(fallbackLog),
      isActive: 1,
    }).returning();

    if (Object.keys(resultData).length > 0) {
      await db.update(cities).set({
        ...resultData,
        estimationSource: data.sources.join('+'),
        estimatedAt: new Date().toISOString(),
        estimationId: estimate[0]?.id,
      }).where(eq(cities.id, data.cityId));
    }

    return success({
      estimate: resultData,
      sources: sourceMap,
      reasoning,
      confidence,
      llmProvider,
      inputSnapshot,
      fallbackLog,
    });
  } catch (err) {
    return handleError(err);
  }
}
