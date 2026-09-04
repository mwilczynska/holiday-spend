import { db } from '@/db';
import { cities, cityEstimates, countries } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { handleError, success } from '@/lib/api-helpers';
import {
  readCityEstimateProvenance,
  type CityEstimateProvenance,
} from '@/lib/city-estimate-provenance';

export const dynamic = 'force-dynamic';

/**
 * List views render only scalar provenance badges; the anchors, FX, input snapshot and
 * source blobs are shown for one selected city at a time. Sending them for every city and
 * every history row accounted for 91% of this response, so they are served on demand
 * through `?cityId=` instead.
 */
function toListProvenance(provenance: CityEstimateProvenance | null) {
  if (!provenance) return null;

  // Named explicitly rather than removing the heavy keys, so a new blob field added to
  // CityEstimateProvenance cannot silently start shipping in the list payload.
  return {
    methodologyVersion: provenance.methodologyVersion,
    source: provenance.source,
    provider: provenance.provider,
    model: provenance.model,
    promptVersion: provenance.promptVersion,
    reasoningEffort: provenance.reasoningEffort,
    evidenceBasis: provenance.evidenceBasis,
    formulaVersion: provenance.formulaVersion,
    confidence: provenance.confidence,
    confidenceNotes: provenance.confidenceNotes,
    comparableCityReasoning: provenance.comparableCityReasoning,
    inferredAudPerUsd: provenance.inferredAudPerUsd,
    priorBasis: provenance.priorBasis,
  };
}

function readInferredAudPerUsd(metadataJson: string | null) {
  if (!metadataJson) return null;

  try {
    const parsed = JSON.parse(metadataJson) as { inferredAudPerUsd?: unknown };
    return typeof parsed.inferredAudPerUsd === 'number' ? parsed.inferredAudPerUsd : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const datasetView = requestUrl.searchParams.get('view') === 'dataset';
    const provenanceCityId = requestUrl.searchParams.get('cityId');

    // Full provenance for a single city, fetched when one is selected on /dataset.
    if (provenanceCityId) {
      const cityRow = await db
        .select({
          source: cityEstimates.source,
          provider: cityEstimates.llmProvider,
          model: cityEstimates.llmModel,
          promptVersion: cityEstimates.promptVersion,
          confidence: cityEstimates.confidence,
          metadataJson: cityEstimates.metadataJson,
          anchorsJson: cityEstimates.anchorsJson,
          inputSnapshotJson: cityEstimates.inputSnapshotJson,
          sourcesJson: cityEstimates.sourcesJson,
        })
        .from(cities)
        .leftJoin(cityEstimates, eq(cities.estimationId, cityEstimates.id))
        .where(eq(cities.id, provenanceCityId))
        .get();

      if (!cityRow) {
        return success({ cityId: provenanceCityId, currentEstimateProvenance: null, history: [] });
      }

      const cityHistoryRows = await db
        .select({
          id: cityEstimates.id,
          source: cityEstimates.source,
          llmProvider: cityEstimates.llmProvider,
          llmModel: cityEstimates.llmModel,
          promptVersion: cityEstimates.promptVersion,
          confidence: cityEstimates.confidence,
          metadataJson: cityEstimates.metadataJson,
          anchorsJson: cityEstimates.anchorsJson,
          inputSnapshotJson: cityEstimates.inputSnapshotJson,
          sourcesJson: cityEstimates.sourcesJson,
        })
        .from(cityEstimates)
        .where(eq(cityEstimates.cityId, provenanceCityId))
        .orderBy(desc(cityEstimates.estimatedAt));

      return success({
        cityId: provenanceCityId,
        currentEstimateProvenance: readCityEstimateProvenance({
          source: cityRow.source,
          provider: cityRow.provider,
          model: cityRow.model,
          promptVersion: cityRow.promptVersion,
          confidence: cityRow.confidence,
          metadataJson: cityRow.metadataJson,
          anchorsJson: cityRow.anchorsJson,
          inputSnapshotJson: cityRow.inputSnapshotJson,
          sourcesJson: cityRow.sourcesJson,
        }),
        history: cityHistoryRows.map((row) => ({
          id: row.id,
          provenance: readCityEstimateProvenance({
            source: row.source,
            provider: row.llmProvider,
            model: row.llmModel,
            promptVersion: row.promptVersion,
            confidence: row.confidence,
            metadataJson: row.metadataJson,
            anchorsJson: row.anchorsJson,
            inputSnapshotJson: row.inputSnapshotJson,
            sourcesJson: row.sourcesJson,
          }),
        })),
      });
    }
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
        drinkLocalBeer: cities.drinkLocalBeer,
        drinkImportBeer: cities.drinkImportBeer,
        drinkWineGlass: cities.drinkWineGlass,
        drinkCocktail: cities.drinkCocktail,
        drinkCoffee: cities.drinkCoffee,
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
        currentEstimateModel: cityEstimates.llmModel,
        currentEstimatePromptVersion: cityEstimates.promptVersion,
        currentEstimateConfidence: cityEstimates.confidence,
        currentEstimateReasoning: cityEstimates.reasoning,
        currentEstimateAt: cityEstimates.estimatedAt,
        currentEstimateMetadataJson: cityEstimates.metadataJson,
        currentEstimateAnchorsJson: cityEstimates.anchorsJson,
        currentEstimateInputSnapshotJson: cityEstimates.inputSnapshotJson,
        currentEstimateSourcesJson: cityEstimates.sourcesJson,
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
        llmModel: cityEstimates.llmModel,
        promptVersion: cityEstimates.promptVersion,
        confidence: cityEstimates.confidence,
        reasoning: cityEstimates.reasoning,
        metadataJson: cityEstimates.metadataJson,
        anchorsJson: cityEstimates.anchorsJson,
        inputSnapshotJson: cityEstimates.inputSnapshotJson,
        sourcesJson: cityEstimates.sourcesJson,
        isActive: cityEstimates.isActive,
      })
      .from(cityEstimates)
      .innerJoin(cities, eq(cityEstimates.cityId, cities.id))
      .innerJoin(countries, eq(cities.countryId, countries.id))
      .orderBy(desc(cityEstimates.estimatedAt));

    const history = historyRows.map(({ metadataJson, anchorsJson, inputSnapshotJson, sourcesJson, ...row }) => {
      const provenance = readCityEstimateProvenance({
        source: row.source,
        provider: row.llmProvider,
        model: row.llmModel,
        promptVersion: row.promptVersion,
        confidence: row.confidence,
        metadataJson,
        anchorsJson,
        inputSnapshotJson,
        sourcesJson,
      });

      return {
        ...row,
        inferredAudPerUsd: readInferredAudPerUsd(metadataJson),
        provenance: datasetView ? toListProvenance(provenance) : provenance,
      };
    });

    const historyByCity = new Map<string, typeof history>();
    if (!datasetView) {
      for (const row of history) {
        const bucket = historyByCity.get(row.cityId) ?? [];
        bucket.push(row);
        historyByCity.set(row.cityId, bucket);
      }
    }

    // The dataset screen already receives the canonical city rows from
    // /api/countries and keeps only the provenance from this response, so build
    // that shape directly rather than assembling 200+ full rows, attaching
    // history to each, sorting them, and then discarding all of it.
    const rows = datasetView
      ? cityRows.map((row) => ({
          cityId: row.cityId,
          currentEstimateProvenance: toListProvenance(
            readCityEstimateProvenance({
              source: row.currentEstimateSource,
              provider: row.currentEstimateProvider,
              model: row.currentEstimateModel,
              promptVersion: row.currentEstimatePromptVersion,
              confidence: row.currentEstimateConfidence,
              metadataJson: row.currentEstimateMetadataJson,
              anchorsJson: row.currentEstimateAnchorsJson,
              inputSnapshotJson: row.currentEstimateInputSnapshotJson,
              sourcesJson: row.currentEstimateSourcesJson,
            })
          ),
        }))
      : cityRows
      .map((row) => {
        const {
          currentEstimateMetadataJson,
          currentEstimateAnchorsJson,
          currentEstimateInputSnapshotJson,
          currentEstimateSourcesJson,
          ...cityRow
        } = row;

        return {
          ...cityRow,
          currentEstimateProvenance: readCityEstimateProvenance({
            source: row.currentEstimateSource,
            provider: row.currentEstimateProvider,
            model: row.currentEstimateModel,
            promptVersion: row.currentEstimatePromptVersion,
            confidence: row.currentEstimateConfidence,
            metadataJson: currentEstimateMetadataJson,
            anchorsJson: currentEstimateAnchorsJson,
            inputSnapshotJson: currentEstimateInputSnapshotJson,
            sourcesJson: currentEstimateSourcesJson,
          }),
          currentEstimate: row.currentEstimateId
            ? {
                id: row.currentEstimateId,
                source: row.currentEstimateSource,
                llmProvider: row.currentEstimateProvider,
                llmModel: row.currentEstimateModel,
                promptVersion: row.currentEstimatePromptVersion,
                confidence: row.currentEstimateConfidence,
                reasoning: row.currentEstimateReasoning,
                estimatedAt: row.currentEstimateAt,
              }
            : null,
          estimateHistory: historyByCity.get(row.cityId) ?? [],
        };
      })
      .sort((a, b) => `${a.countryName || ''}-${a.cityName}`.localeCompare(`${b.countryName || ''}-${b.cityName}`));

    // Derived from the query rows rather than the response rows, so the summary is
    // identical whichever shape `rows` took above.
    const sourceBreakdownMap = new Map<string, number>();
    for (const row of cityRows) {
      const key = row.estimationSource || 'unknown';
      sourceBreakdownMap.set(key, (sourceBreakdownMap.get(key) ?? 0) + 1);
    }

    const summary = {
      cityCount: cityRows.length,
      countryCount: new Set(cityRows.map((row) => row.countryId).filter(Boolean)).size,
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
