import { z } from 'zod';

const positiveInteger = z.number().int().positive();
const text = z.string().nullable();
const range = z.object({ min: positiveInteger, max: positiveInteger }).refine(value => value.max >= value.min);
export const fixedCostsReadSchema = z.array(z.object({
  id: positiveInteger, description: z.string(), amountAud: z.number().finite().nonnegative(),
  category: text, countryId: text, date: text, isPaid: z.number().int().nullable(), notes: text,
}));
export const settingsCountriesReadSchema = z.array(z.object({ id: z.string(), name: z.string() }));
export const travellerSettingsReadSchema = z.object({ groupSize: z.number().int().min(1).max(5) });
export const llmSettingsReadSchema = z.object({
  maxOutputTokens: positiveInteger, requestTimeoutMs: positiveInteger,
  defaults: z.object({ maxOutputTokens: positiveInteger, requestTimeoutMs: positiveInteger }),
  limits: z.object({ maxOutputTokens: range, requestTimeoutMs: range }),
});
