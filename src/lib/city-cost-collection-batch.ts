import { z } from 'zod';

export const cityCostRegionSchema = z.enum([
  'SEA',
  'East Asia',
  'South Asia',
  'Middle East',
  'Africa',
  'Europe',
  'Latin America',
  'North America',
  'Oceania',
]);

export const cityCostCollectionCategorySchema = z.enum(['food_drinks', 'accommodation', 'activities']);

export const cityCostCollectionBatchStatusSchema = z.enum([
  'pending',
  'in_progress',
  'complete',
  'complete_with_missing',
  'blocked_on_reference_window_design',
]);

export const cityCostCollectionCitySchema = z.object({
  city: z.string().min(1),
  country: z.string().min(1),
  region: cityCostRegionSchema,
  categories: z.array(cityCostCollectionCategorySchema).min(1),
  reason: z.string().min(1),
});

export const cityCostCollectionBatchSchema = z
  .object({
    batchId: z.string().min(1),
    status: cityCostCollectionBatchStatusSchema,
    plannedCalls: z.number().int().nonnegative(),
    completedCalls: z.number().int().nonnegative().default(0),
    acceptedObservations: z.number().int().nonnegative().default(0),
    checkpoint: z.string().min(1).nullable().default(null),
    observationFiles: z.array(z.string().min(1)).default([]),
    reportFile: z.string().min(1).nullable().default(null),
    cities: z.array(cityCostCollectionCitySchema),
    reason: z.string().min(1).nullable().default(null),
  })
  .superRefine((batch, context) => {
    if (batch.completedCalls > batch.plannedCalls) {
      context.addIssue({
        code: 'custom',
        path: ['completedCalls'],
        message: 'completedCalls cannot exceed plannedCalls',
      });
    }

    if (batch.status === 'pending' && (batch.completedCalls > 0 || batch.acceptedObservations > 0)) {
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'Pending batches cannot report completed calls or accepted observations',
      });
    }

    if (['complete', 'complete_with_missing'].includes(batch.status) && batch.completedCalls !== batch.plannedCalls) {
      context.addIssue({
        code: 'custom',
        path: ['completedCalls'],
        message: 'Completed batches must account for every planned call',
      });
    }

    if (batch.acceptedObservations > 0 && !batch.observationFiles.length) {
      context.addIssue({
        code: 'custom',
        path: ['observationFiles'],
        message: 'Batches with accepted observations require observation files',
      });
    }

    if (batch.observationFiles.length && !batch.reportFile) {
      context.addIssue({
        code: 'custom',
        path: ['reportFile'],
        message: 'Batches with observations require a report file',
      });
    }

    if (batch.status === 'blocked_on_reference_window_design' && !batch.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Blocked batches require a reason',
      });
    }
  });

export const cityCostCollectionManifestSchema = z
  .object({
    schemaVersion: z.literal('city-cost-collection-batches-v1'),
    collectionPolicy: z.literal('free_llm_web_research_only'),
    callLimitPolicy: z.literal('provider_free_tier_only'),
    projectDailyCallCap: z.null(),
    checkpointAfterEveryCity: z.boolean(),
    researchPrompt: z.string().min(1),
    observationSchema: z.literal('city-cost-observation-v1'),
    batches: z.array(cityCostCollectionBatchSchema).min(1),
  })
  .superRefine((manifest, context) => {
    const batchIds = new Set<string>();
    for (let index = 0; index < manifest.batches.length; index += 1) {
      const batch = manifest.batches[index];
      if (batchIds.has(batch.batchId)) {
        context.addIssue({
          code: 'custom',
          path: ['batches', index, 'batchId'],
          message: `Duplicate batchId ${batch.batchId}`,
        });
      }
      batchIds.add(batch.batchId);

      const cityKeys = new Set<string>();
      for (let cityIndex = 0; cityIndex < batch.cities.length; cityIndex += 1) {
        const city = batch.cities[cityIndex];
        const cityKey = `${city.city}|${city.country}`;
        if (cityKeys.has(cityKey)) {
          context.addIssue({
            code: 'custom',
            path: ['batches', index, 'cities', cityIndex],
            message: `Duplicate city ${cityKey} within batch`,
          });
        }
        cityKeys.add(cityKey);
      }
    }
  });

export type CityCostCollectionManifest = z.infer<typeof cityCostCollectionManifestSchema>;
