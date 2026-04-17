import { db } from '@/db';
import { cities, cityEstimates, countries } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { handleError, success } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

function readInferredAudPerUsd(metadataJson: string | null) {
  if (!metadataJson) return null;

  try {
    const parsed = JSON.parse(metadataJson) as { inferredAudPerUsd?: unknown };
    return typeof parsed.inferredAudPerUsd === 'number' ? parsed.inferredAudPerUsd : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const cityRows = await db
      .select({
        cityId: cities.id,
        cityName: cities.name,
        countryId: countries.id,
        countryName: countries.name,
        region: countries.region,
        currencyCode: countries.currencyCode,
        estimationSource: cities.estimationSource,
        estimatedAt: cities.estimatedAt,
        notes: cities.notes,
        accomHostel: cities.accomHostel,
        accomPrivateRoom: cities.accomPrivateRoom,
        accom1star: cities.accom1star,
        accom2star: cities.accom2star,
        accom3star: cities.accom3star,
        accom4star: cities.accom4star,
        foodStreet: cities.foodStreet,
        foodBudget: cities.foodBudget,
        foodMid: cities.foodMid,
        foodHigh: cities.foodHigh,
        drinksNone: cities.drinksNone,
        drinksLight: cities.drinksLight,
        drinksModerate: cities.drinksModerate,
        drinksHeavy: cities.drinksHeavy,
        activitiesFree: cities.activitiesFree,
        activitiesBudget: cities.activitiesBudget,
        activitiesMid: cities.activitiesMid,
        activitiesHigh: cities.activitiesHigh,
        currentEstimateId: cityEstimates.id,
        currentEstimateSource: cityEstimates.source,
        currentEstimateProvider: cityEstimates.llmProvider,
        currentEstimateConfidence: cityEstimates.confidence,
        currentEstimateReasoning: cityEstimates.reasoning,
        currentEstimateAt: cityEstimates.estimatedAt,
      })
      .from(cities)
      .leftJoin(countries, eq(cities.countryId, countries.id))
      .leftJoin(cityEstimates, eq(cities.estimationId, cityEstimates.id));

    const historyRows = await db
      .select({
        id: cityEstimates.id,
        cityId: cityEstimates.cityId,
        cityName: cities.name,
        countryName: countries.name,
        estimatedAt: cityEstimates.estimatedAt,
        source: cityEstimates.source,
        llmProvider: cityEstimates.llmProvider,
        confidence: cityEstimates.confidence,
        reasoning: cityEstimates.reasoning,
        metadataJson: cityEstimates.metadataJson,
        isActive: cityEstimates.isActive,
      })
      .from(cityEstimates)
      .innerJoin(cities, eq(cityEstimates.cityId, cities.id))
      .innerJoin(countries, eq(cities.countryId, countries.id))
      .orderBy(desc(cityEstimates.estimatedAt));

    const history = historyRows.map(({ metadataJson, ...row }) => ({
      ...row,
      inferredAudPerUsd: readInferredAudPerUsd(metadataJson),
    }));

    const historyByCity = new Map<string, typeof history>();
    for (const row of history) {
      const bucket = historyByCity.get(row.cityId) ?? [];
      bucket.push(row);
      historyByCity.set(row.cityId, bucket);
    }

    const rows = cityRows
      .map((row) => ({
        ...row,
        currentEstimate: row.currentEstimateId
          ? {
              id: row.currentEstimateId,
              source: row.currentEstimateSource,
              llmProvider: row.currentEstimateProvider,
              confidence: row.currentEstimateConfidence,
              reasoning: row.currentEstimateReasoning,
              estimatedAt: row.currentEstimateAt,
            }
          : null,
        estimateHistory: historyByCity.get(row.cityId) ?? [],
      }))
      .sort((a, b) => `${a.countryName || ''}-${a.cityName}`.localeCompare(`${b.countryName || ''}-${b.cityName}`));

    const sourceBreakdownMap = new Map<string, number>();
    for (const row of rows) {
      const key = row.estimationSource || 'unknown';
      sourceBreakdownMap.set(key, (sourceBreakdownMap.get(key) ?? 0) + 1);
    }

    const summary = {
      cityCount: rows.length,
      countryCount: new Set(rows.map((row) => row.countryId).filter(Boolean)).size,
      sourceBreakdown: Array.from(sourceBreakdownMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source)),
      historyCount: historyRows.length,
    };

    return success({
      summary,
      rows,
      history,
    });
  } catch (err) {
    return handleError(err);
  }
}
