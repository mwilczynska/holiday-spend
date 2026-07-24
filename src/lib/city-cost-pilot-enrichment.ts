import { z } from 'zod';
import { cityCostRegionSchema } from './city-cost-collection-batch';

export const PILOT_CITY_SIZE_BANDS = ['small', 'medium', 'large', 'megacity', 'unknown'] as const;
export const PILOT_TOURISM_INTENSITY_BANDS = ['low', 'medium', 'high', 'very_high', 'unknown'] as const;
export const PILOT_SOURCE_DENSITY_BANDS = ['none', 'sparse', 'moderate', 'dense'] as const;

const pendingMetricSchema = z.object({
  status: z.literal('pending_source_collection'),
  value: z.null(),
  referenceYear: z.null(),
  spatialUnit: z.null(),
  band: z.literal('unknown'),
  sourceName: z.null(),
  sourceUrl: z.null(),
  notes: z.string().min(1),
});

const sourceDensitySchema = z.object({
  status: z.literal('measured_from_retained_evidence'),
  acceptedObservationCount: z.number().int().nonnegative(),
  observedMeasureCount: z.number().int().nonnegative(),
  distinctSourceCount: z.number().int().nonnegative(),
  categoriesWithEvidence: z.array(z.enum(['accommodation', 'food', 'drinks', 'activities'])),
  band: z.enum(PILOT_SOURCE_DENSITY_BANDS),
  derivation: z.string().min(1),
});

export const cityCostPilotEnrichmentSchema = z
  .object({
    schemaVersion: z.literal('city-cost-pilot-enrichment-v1'),
    enrichmentId: z.string().min(1),
    pilotSource: z.string().min(1),
    observationManifestSource: z.string().min(1),
    generatedAt: z.string().datetime(),
    definitions: z.object({
      citySize: z.object({
        estimand: z.string().min(1),
        preferredSourceOrder: z.array(z.string().min(1)).min(1),
        bands: z.record(z.string(), z.string().min(1)),
      }),
      tourismIntensity: z.object({
        estimand: z.string().min(1),
        preferredSourceOrder: z.array(z.string().min(1)).min(1),
        bands: z.record(z.string(), z.string().min(1)),
      }),
      publicSourceDensity: z.object({
        estimand: z.string().min(1),
        bands: z.record(z.string(), z.string().min(1)),
      }),
    }),
    cities: z.array(
      z.object({
        city: z.string().min(1),
        country: z.string().min(1),
        region: cityCostRegionSchema,
        citySize: pendingMetricSchema,
        tourismIntensity: pendingMetricSchema,
        publicSourceDensity: sourceDensitySchema,
      })
    ).length(36),
  })
  .superRefine((artifact, context) => {
    const keys = new Set<string>();
    artifact.cities.forEach((city, index) => {
      const key = `${city.city}|${city.country}`;
      if (keys.has(key)) {
        context.addIssue({ code: 'custom', path: ['cities', index], message: `Duplicate city ${key}` });
      }
      keys.add(key);

      const density = city.publicSourceDensity;
      const expectedBand = sourceDensityBand(density.observedMeasureCount);
      if (density.band !== expectedBand) {
        context.addIssue({
          code: 'custom',
          path: ['cities', index, 'publicSourceDensity', 'band'],
          message: `Expected ${expectedBand} from ${density.observedMeasureCount} observed measures`,
        });
      }
      if (density.acceptedObservationCount === 0 && density.distinctSourceCount !== 0) {
        context.addIssue({
          code: 'custom',
          path: ['cities', index, 'publicSourceDensity', 'distinctSourceCount'],
          message: 'A zero-observation city cannot have a retained numeric source',
        });
      }
    });
  });

export function sourceDensityBand(observedMeasureCount: number) {
  if (observedMeasureCount === 0) return 'none' as const;
  if (observedMeasureCount <= 2) return 'sparse' as const;
  if (observedMeasureCount <= 5) return 'moderate' as const;
  return 'dense' as const;
}

export type CityCostPilotEnrichment = z.infer<typeof cityCostPilotEnrichmentSchema>;

