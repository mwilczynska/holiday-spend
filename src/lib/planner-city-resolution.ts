import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { cities, countries } from '@/db/schema';
import { runJsonPromptWithProvider } from '@/lib/city-llm-client';
import { generateAndPersistCityEstimate } from '@/lib/city-generation-service';
import {
  CountryMetadataResolutionError,
  findExistingCountryForCanonical,
  resolveCountryCreationDefaults,
  slugifyId,
} from '@/lib/country-metadata';
import type { GenerateAndPersistCityEstimateInput } from '@/lib/city-generation-service';

const plannerCityMetadataSchema = z.object({
  city: z.string().min(1),
  country: z.string().min(1),
  confidence_notes: z.string().min(1),
});

type CountryRow = typeof countries.$inferSelect;
type CityRow = typeof cities.$inferSelect;

export interface ResolveOrCreatePlannerCityInput extends Pick<
  GenerateAndPersistCityEstimateInput,
  'provider' | 'apiKey' | 'model' | 'referenceDate' | 'extraContext'
> {
  cityName: string;
  countryName: string;
}

export interface ResolveOrCreatePlannerCityResult {
  cityId: string;
  cityName: string;
  countryId: string;
  countryName: string;
  createdCountry: boolean;
  createdCity: boolean;
  generatedCity: boolean;
  reusedExistingCity: boolean;
}

export class PlannerCityResolutionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PlannerCityResolutionError';
    this.status = status;
  }
}

function normalizeFreeText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model response');
  }

  return JSON.parse(text.slice(start, end + 1));
}

function matchesCountry(country: CountryRow, countryName: string) {
  const target = slugifyId(countryName);
  return country.id === target || slugifyId(country.name) === target;
}

function findMatchingCountry(countryRows: CountryRow[], countryName: string) {
  return countryRows.find((country) => matchesCountry(country, countryName)) ?? null;
}

function findMatchingCity(cityRows: CityRow[], countryRows: CountryRow[], cityName: string, countryName: string) {
  const targetCity = slugifyId(cityName);
  const targetCountry = slugifyId(countryName);
  const countryById = new Map(countryRows.map((country) => [country.id, country]));

  return (
    cityRows.find((city) => {
      if (slugifyId(city.name) !== targetCity) return false;
      if (city.countryId === targetCountry) return true;

      const country = countryById.get(city.countryId);
      return country ? slugifyId(country.name) === targetCountry : false;
    }) ?? null
  );
}

function allocateUniqueId(baseId: string, existingIds: Set<string>, fallbackSuffix?: string) {
  if (!existingIds.has(baseId)) return baseId;

  const secondaryBase = fallbackSuffix ? `${baseId}-${fallbackSuffix}` : `${baseId}-2`;
  if (!existingIds.has(secondaryBase)) return secondaryBase;

  let counter = 2;
  while (existingIds.has(`${secondaryBase}-${counter}`)) {
    counter += 1;
  }

  return `${secondaryBase}-${counter}`;
}

async function resolvePlannerCityMetadata(input: ResolveOrCreatePlannerCityInput) {
  const contextLine = input.extraContext?.trim()
    ? `Additional context: ${input.extraContext.trim()}`
    : 'Additional context: none';
  const referenceDateLine = input.referenceDate?.trim()
    ? `Reference date or travel window: ${input.referenceDate.trim()}`
    : 'Reference date or travel window: current';

  let providerResponse: { provider: string; model: string; text: string } | null = null;
  try {
    providerResponse = await runJsonPromptWithProvider({
      systemPrompt: 'You are a careful travel planner metadata assistant. Return valid JSON only.',
      userPrompt: `Resolve the planner metadata for this city request.

User input:
- City: ${input.cityName}
- Country: ${input.countryName}
- ${referenceDateLine}
- ${contextLine}

Return one JSON object with exactly these fields:
- "city": the canonical city name in common English usage
- "country": the canonical country name in common English usage
- "confidence_notes": one short sentence explaining any ambiguity

Rules:
- Keep the city within the user-specified country. Do not substitute a different city.
- The server resolves country currency and region from the canonical dataset, so do not invent metadata fields beyond the JSON schema above.
- Return JSON only. No markdown fences or extra commentary.`,
      provider: input.provider,
      apiKey: input.apiKey,
      model: input.model,
      maxTokens: 600,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to resolve city metadata.';
    throw new PlannerCityResolutionError(message, 502);
  }

  if (!providerResponse) {
    throw new PlannerCityResolutionError(
      'No supported LLM provider is configured. Add an API key in the UI or configure ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY on the server.',
      400
    );
  }

  try {
    return plannerCityMetadataSchema.parse(extractJsonObject(providerResponse.text));
  } catch {
    throw new PlannerCityResolutionError('The model response did not match the required planner-city metadata schema.', 502);
  }
}

export async function resolveOrCreatePlannerCity(input: ResolveOrCreatePlannerCityInput): Promise<ResolveOrCreatePlannerCityResult> {
  const requestedCityName = normalizeFreeText(input.cityName);
  const requestedCountryName = normalizeFreeText(input.countryName);

  if (!requestedCityName || !requestedCountryName) {
    throw new PlannerCityResolutionError('City name and country name are required.');
  }

  const [countryRows, cityRows] = await Promise.all([
    db.select().from(countries),
    db.select().from(cities),
  ]);

  const initialCityMatch = findMatchingCity(cityRows, countryRows, requestedCityName, requestedCountryName);
  if (initialCityMatch) {
    const existingCountry = countryRows.find((country) => country.id === initialCityMatch.countryId);
    if (!existingCountry) {
      throw new PlannerCityResolutionError('Existing city is linked to a missing country record.', 500);
    }

    return {
      cityId: initialCityMatch.id,
      cityName: initialCityMatch.name,
      countryId: existingCountry.id,
      countryName: existingCountry.name,
      createdCountry: false,
      createdCity: false,
      generatedCity: false,
      reusedExistingCity: true,
    };
  }

  const metadata = await resolvePlannerCityMetadata(input);
  const canonicalCityName = normalizeFreeText(metadata.city) || requestedCityName;
  const canonicalCountryName = normalizeFreeText(metadata.country) || requestedCountryName;

  let resolvedCountry = findMatchingCountry(countryRows, canonicalCountryName) ?? findMatchingCountry(countryRows, requestedCountryName);
  const canonicalCityMatch = findMatchingCity(cityRows, countryRows, canonicalCityName, canonicalCountryName);

  if (canonicalCityMatch) {
    const existingCountry = countryRows.find((country) => country.id === canonicalCityMatch.countryId);
    if (!existingCountry) {
      throw new PlannerCityResolutionError('Existing city is linked to a missing country record.', 500);
    }

    const existingCountryDefaults = resolveCountryCreationDefaults({
      id: existingCountry.id,
      name: existingCountry.name,
    });
    const knownRegion = existingCountry.region || existingCountryDefaults?.dbInsert.region || null;

    if (!existingCountry.region && knownRegion) {
      await db
        .update(countries)
        .set({ region: knownRegion })
        .where(eq(countries.id, existingCountry.id));
    }

    return {
      cityId: canonicalCityMatch.id,
      cityName: canonicalCityMatch.name,
      countryId: existingCountry.id,
      countryName: existingCountry.name,
      createdCountry: false,
      createdCity: false,
      generatedCity: false,
      reusedExistingCity: true,
    };
  }

  let createdCountryId: string | null = null;
  let createdCityId: string | null = null;

  try {
    const countryDefaults =
      findExistingCountryForCanonical(countryRows, { name: canonicalCountryName }) ??
      findExistingCountryForCanonical(countryRows, { name: requestedCountryName }) ??
      null;

    if (!countryDefaults) {
      throw new PlannerCityResolutionError(
        `"${canonicalCountryName}" is not in the canonical country dataset. Add it to src/lib/data/country-metadata.overrides.json (or the upstream source) and regenerate with "npm run country-metadata:generate" before creating planner cities in that country.`,
        400
      );
    }

    resolvedCountry = countryDefaults.existing ?? resolvedCountry;

    if (!resolvedCountry) {
      await db.insert(countries).values(countryDefaults.dbInsert);

      createdCountryId = countryDefaults.dbInsert.id;
      resolvedCountry = {
        ...countryDefaults.dbInsert,
      };
      countryRows.push(resolvedCountry);
    } else if (!resolvedCountry.region) {
      await db
        .update(countries)
        .set({ region: countryDefaults.dbInsert.region })
        .where(eq(countries.id, resolvedCountry.id));

      resolvedCountry = {
        ...resolvedCountry,
        region: countryDefaults.dbInsert.region,
      };
    }

    const existingIds = new Set(cityRows.map((city) => city.id));
    const baseCityId = slugifyId(canonicalCityName);
    const cityId = allocateUniqueId(baseCityId, existingIds, resolvedCountry.id);

    await db.insert(cities).values({
      id: cityId,
      name: canonicalCityName,
      countryId: resolvedCountry.id,
      estimationSource: 'planner_llm_generation_pending',
      estimatedAt: new Date().toISOString(),
      notes: 'Created automatically during planner add-leg LLM flow.',
    });

    createdCityId = cityId;

    await generateAndPersistCityEstimate({
      cityId,
      provider: input.provider,
      apiKey: input.apiKey,
      model: input.model,
      referenceDate: input.referenceDate,
      extraContext: input.extraContext,
    });

    return {
      cityId,
      cityName: canonicalCityName,
      countryId: resolvedCountry.id,
      countryName: resolvedCountry.name,
      createdCountry: Boolean(createdCountryId),
      createdCity: true,
      generatedCity: true,
      reusedExistingCity: false,
    };
  } catch (err) {
    if (createdCityId) {
      await db.delete(cities).where(eq(cities.id, createdCityId));
    }
    if (createdCountryId) {
      await db.delete(countries).where(eq(countries.id, createdCountryId));
    }

    if (err instanceof PlannerCityResolutionError) {
      throw err;
    }
    if (err instanceof CountryMetadataResolutionError) {
      throw new PlannerCityResolutionError(err.message, 400);
    }

    const message = err instanceof Error ? err.message : 'Failed to resolve and create planner city.';
    throw new PlannerCityResolutionError(message, 502);
  }
}
