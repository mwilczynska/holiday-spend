import { z } from 'zod';
import type { CityEstimateProvenance } from './city-estimate-provenance';

const text = z.string().nullable();
export const provenanceReadSchema = z.custom<CityEstimateProvenance>(value => Boolean(
  value && typeof value === 'object' && !Array.isArray(value) &&
  typeof (value as { methodologyVersion?: unknown }).methodologyVersion === 'string'
)).nullable();

export const datasetCountriesReadSchema = z.array(z.object({
  id: z.string(), name: z.string(), currencyCode: z.string(), region: text.optional(),
  cities: z.array(z.object({
    id: z.string(), countryId: z.string(), name: z.string(), estimationSource: text,
    estimatedAt: text.optional(), notes: text.optional(),
  }).passthrough()),
}));

export const datasetEstimatesReadSchema = z.object({
  rows: z.array(z.object({ cityId: z.string(), currentEstimateProvenance: provenanceReadSchema })),
  history: z.array(z.object({
    id: z.number().int(), cityId: z.string(), cityName: text, countryName: text,
    estimatedAt: z.string(), source: text, llmProvider: text, llmModel: text,
    promptVersion: text, confidence: text, reasoning: text,
    inferredAudPerUsd: z.number().finite().nullable(), isActive: z.number().int().nullable(),
    provenance: provenanceReadSchema.optional(),
  })),
  summary: z.object({ historyCount: z.number().int().nonnegative() }),
});
