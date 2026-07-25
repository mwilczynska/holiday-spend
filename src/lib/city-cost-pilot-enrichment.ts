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

const measuredCitySizeSchema = z.object({
  status: z.literal('measured_from_public_source'),
  value: z.number().int().positive(),
  referenceYear: z.number().int().min(1900).max(2100),
  spatialUnit: z.literal('DEGURBA_city'),
  band: z.enum(['small', 'medium', 'large', 'megacity']),
  sourceName: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceRecordId: z.string().min(1),
  sourceLocation: z.string().min(1),
  notes: z.string().min(1),
});

const citySizeMetricSchema = z.discriminatedUnion('status', [
  pendingMetricSchema,
  measuredCitySizeSchema,
]);

export const TOURISM_RELAXATION_REASONS = [
  'geography_approximate',
  'numerator_partial',
  'numerator_rounded',
  'reference_year_stale',
] as const;

const measuredTourismIntensitySchema = z.object({
  status: z.literal('measured_from_public_sources'),
  value: z.number().positive(),
  referenceYear: z.number().int().min(1900).max(2100),
  spatialUnit: z.string().min(1),
  band: z.enum(['low', 'medium', 'high', 'very_high']),
  evidenceGrade: z.enum(['strict', 'relaxed']),
  relaxationReasons: z.array(z.enum(TOURISM_RELAXATION_REASONS)),
  overnightArrivals: z.number().int().positive(),
  residentPopulation: z.number().int().positive(),
  numeratorDefinition: z.string().min(1),
  denominatorDefinition: z.string().min(1),
  arrivalsSourceName: z.string().min(1),
  arrivalsSourceUrl: z.string().url(),
  populationSourceName: z.string().min(1),
  populationSourceUrl: z.string().url(),
  notes: z.string().min(1),
}).superRefine((row, context) => {
  const unique = new Set(row.relaxationReasons);
  if (unique.size !== row.relaxationReasons.length) {
    context.addIssue({ code: 'custom', path: ['relaxationReasons'], message: 'Relaxation reasons must be unique' });
  }
  if (row.evidenceGrade === 'strict' && row.relaxationReasons.length > 0) {
    context.addIssue({ code: 'custom', path: ['relaxationReasons'], message: 'A strict record cannot carry relaxation reasons' });
  }
  if (row.evidenceGrade === 'relaxed' && row.relaxationReasons.length === 0) {
    context.addIssue({ code: 'custom', path: ['relaxationReasons'], message: 'A relaxed record requires at least one relaxation reason' });
  }
});

const rejectedTourismSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
});

const pendingTourismIntensitySchema = z.object({
  status: z.literal('pending_source_collection'),
  value: z.null(),
  referenceYear: z.null(),
  spatialUnit: z.null(),
  band: z.literal('unknown'),
  sourceName: z.null(),
  sourceUrl: z.null(),
  researchOutcome: z.enum(['not_yet_screened', 'screened_no_compatible_value']),
  rejectionReason: z.enum(['incompatible_numerator', 'incompatible_geography', 'incomplete_period']).nullable(),
  screenedSources: z.array(rejectedTourismSourceSchema),
  notes: z.string().min(1),
}).superRefine((row, context) => {
  const screened = row.researchOutcome === 'screened_no_compatible_value';
  if (screened && (!row.rejectionReason || row.screenedSources.length === 0)) {
    context.addIssue({ code: 'custom', message: 'A screened rejection requires a reason and at least one source' });
  }
  if (!screened && (row.rejectionReason !== null || row.screenedSources.length !== 0)) {
    context.addIssue({ code: 'custom', message: 'An unscreened row cannot carry rejection evidence' });
  }
});

const tourismIntensityMetricSchema = z.discriminatedUnion('status', [
  pendingTourismIntensitySchema,
  measuredTourismIntensitySchema,
]);

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
    schemaVersion: z.literal('city-cost-pilot-enrichment-v4'),
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
        evidenceGrades: z.record(z.enum(['strict', 'relaxed']), z.string().min(1)),
        relaxationReasons: z.record(z.enum(TOURISM_RELAXATION_REASONS), z.string().min(1)),
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
        citySize: citySizeMetricSchema,
        tourismIntensity: tourismIntensityMetricSchema,
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

      if (city.citySize.status === 'measured_from_public_source') {
        const expectedCitySizeBand = citySizeBand(city.citySize.value);
        if (city.citySize.band !== expectedCitySizeBand) {
          context.addIssue({
            code: 'custom',
            path: ['cities', index, 'citySize', 'band'],
            message: `Expected ${expectedCitySizeBand} from population ${city.citySize.value}`,
          });
        }
      }

      if (city.tourismIntensity.status === 'measured_from_public_sources') {
        const expectedValue = city.tourismIntensity.overnightArrivals / city.tourismIntensity.residentPopulation;
        if (Math.abs(city.tourismIntensity.value - expectedValue) > 1e-9) {
          context.addIssue({
            code: 'custom',
            path: ['cities', index, 'tourismIntensity', 'value'],
            message: `Expected arrivals/population ratio ${expectedValue}`,
          });
        }
        const expectedTourismBand = tourismIntensityBand(expectedValue);
        if (city.tourismIntensity.band !== expectedTourismBand) {
          context.addIssue({
            code: 'custom',
            path: ['cities', index, 'tourismIntensity', 'band'],
            message: `Expected ${expectedTourismBand} from intensity ${expectedValue}`,
          });
        }
      }
    });
  });

export function sourceDensityBand(observedMeasureCount: number) {
  if (observedMeasureCount === 0) return 'none' as const;
  if (observedMeasureCount <= 2) return 'sparse' as const;
  if (observedMeasureCount <= 5) return 'moderate' as const;
  return 'dense' as const;
}

export function citySizeBand(population: number) {
  if (population < 100_000) return 'small' as const;
  if (population < 500_000) return 'medium' as const;
  if (population < 5_000_000) return 'large' as const;
  return 'megacity' as const;
}

export function tourismIntensityBand(arrivalsPerResident: number) {
  if (arrivalsPerResident < 1) return 'low' as const;
  if (arrivalsPerResident < 5) return 'medium' as const;
  if (arrivalsPerResident < 15) return 'high' as const;
  return 'very_high' as const;
}

export type CityCostPilotEnrichment = z.infer<typeof cityCostPilotEnrichmentSchema>;
