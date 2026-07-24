import { z } from 'zod';
import { CITY_COST_MEASURES } from './city-cost-observation';

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

export const cityCostCollectionReportSchema = z
  .object({
    schemaVersion: z.literal('city-cost-collection-report-v1'),
    batchId: z.string().min(1),
    checkpoint: z.string().min(1),
    collectionPolicy: z.literal('free_llm_web_research_only'),
    projectDailyCallCap: z.null(),
    completedCityCategoryCalls: z.number().int().nonnegative(),
    cities: z.array(z.string().min(1)).min(1),
    acceptedObservations: z.number().int().nonnegative(),
    rejectedObservations: z.number().int().nonnegative(),
    sources: z
      .array(
        z.object({
          name: z.string().min(1),
          accessBasis: z.string().min(1),
          termsUrl: z.string().url().optional(),
          methodologyUrl: z.string().url().optional(),
        })
      )
      .min(1),
    coverage: z.partialRecord(z.enum(CITY_COST_MEASURES), z.number().int().nonnegative()),
    missing: z.array(
      z.object({
        city: z.string().min(1),
        measure: z.enum(CITY_COST_MEASURES),
        reason: z.string().min(1),
      })
    ),
    remainingCategories: z.array(z.string().min(1)),
    notes: z.string().min(1),
  })
  .superRefine((report, context) => {
    const coverageCount = Object.values(report.coverage).reduce((total, count) => total + count, 0);
    if (coverageCount !== report.acceptedObservations) {
      context.addIssue({
        code: 'custom',
        path: ['coverage'],
        message: `Coverage totals ${coverageCount}, expected ${report.acceptedObservations} accepted observations`,
      });
    }

    const cityNames = new Set<string>();
    for (let index = 0; index < report.cities.length; index += 1) {
      const city = report.cities[index];
      if (cityNames.has(city)) {
        context.addIssue({ code: 'custom', path: ['cities', index], message: `Duplicate city ${city}` });
      }
      cityNames.add(city);
    }
  });

export type CityCostCollectionManifest = z.infer<typeof cityCostCollectionManifestSchema>;
export type CityCostCollectionReport = z.infer<typeof cityCostCollectionReportSchema>;
