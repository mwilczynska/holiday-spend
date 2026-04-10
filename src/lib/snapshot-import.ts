import { z } from 'zod';
import { CITY_GENERATION_PROVIDERS } from '@/lib/city-generation-config';
import { planSnapshotSchema, type PlanSnapshot } from '@/lib/plan-snapshot';

export const missingCityResolutionSchema = z.object({
  cityId: z.string().min(1),
  cityName: z.string().min(1),
  countryId: z.string().optional(),
  countryName: z.string().min(1),
  countryCurrencyCode: z.string().optional(),
  countryRegion: z.string().optional(),
});

export const snapshotGenerationConfigSchema = z.object({
  provider: z.enum(CITY_GENERATION_PROVIDERS).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  referenceDate: z.string().optional(),
  extraContext: z.string().optional(),
});

export const snapshotImportRequestSchema = z.object({
  snapshot: planSnapshotSchema,
  missingCityStrategy: z.enum(['placeholder', 'generate']).default('placeholder'),
  missingCityResolutions: z.array(missingCityResolutionSchema).default([]),
  generationConfig: snapshotGenerationConfigSchema.optional(),
});

export type MissingCityResolution = z.infer<typeof missingCityResolutionSchema>;
export type SnapshotImportRequest = z.infer<typeof snapshotImportRequestSchema>;

export interface SnapshotMissingCity {
  cityId: string;
  cityName: string | null;
  countryId: string | null;
  countryName: string | null;
  legCount: number;
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseSnapshotImportRequest(body: unknown): SnapshotImportRequest {
  if (typeof body === 'object' && body !== null && 'snapshot' in body) {
    return snapshotImportRequestSchema.parse(body);
  }

  return {
    snapshot: planSnapshotSchema.parse(body),
    missingCityStrategy: 'placeholder',
    missingCityResolutions: [],
  };
}

export function collectMissingSnapshotCities(
  snapshot: PlanSnapshot,
  knownCityIds: Set<string>
): SnapshotMissingCity[] {
  const missingById = new Map<string, SnapshotMissingCity>();

  for (const leg of snapshot.legs) {
    if (knownCityIds.has(leg.cityId)) continue;

    const existing = missingById.get(leg.cityId);
    if (existing) {
      existing.legCount += 1;
      existing.cityName = existing.cityName ?? normalizeText(leg.cityName);
      existing.countryId = existing.countryId ?? normalizeText(leg.countryId);
      existing.countryName = existing.countryName ?? normalizeText(leg.countryName);
      continue;
    }

    missingById.set(leg.cityId, {
      cityId: leg.cityId,
      cityName: normalizeText(leg.cityName),
      countryId: normalizeText(leg.countryId),
      countryName: normalizeText(leg.countryName),
      legCount: 1,
    });
  }

  return Array.from(missingById.values()).sort((a, b) => a.cityId.localeCompare(b.cityId));
}
