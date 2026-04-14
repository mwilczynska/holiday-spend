import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import type { CityEstimateData } from '@/types';
import { runJsonPromptWithProvider } from '@/lib/city-llm-client';
import { type CityGenerationProvider } from '@/lib/city-generation-config';

const generatedCitySchema = z.object({
  city: z.string().min(1),
  country: z.string().min(1),
  region: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']),
  confidence_notes: z.string().min(1),
  anchors_usd: z.object({
    beer: z.number().nonnegative(),
    coffee: z.number().nonnegative(),
    inexp_meal_1p: z.number().nonnegative(),
    midrange_meal_2p: z.number().nonnegative(),
    cocktail: z.number().nonnegative(),
    wine_glass: z.number().nonnegative(),
    hostel_dorm_1p: z.number().nonnegative(),
    hostel_private_2p: z.number().nonnegative(),
    hotel_1star_2p: z.number().nonnegative(),
    hotel_3star_2p: z.number().nonnegative(),
  }),
  tiers_aud: z.object({
    accom_shared_hostel_dorm: z.number().nonnegative(),
    accom_hostel_private_room: z.number().nonnegative(),
    accom_1_star: z.number().nonnegative(),
    accom_2_star: z.number().nonnegative(),
    accom_3_star: z.number().nonnegative(),
    accom_4_star: z.number().nonnegative(),
    food_street_food: z.number().nonnegative(),
    food_budget: z.number().nonnegative(),
    food_mid_range: z.number().nonnegative(),
    food_high_end: z.number().nonnegative(),
    drinks_none: z.number().nonnegative(),
    drinks_light: z.number().nonnegative(),
    drinks_moderate: z.number().nonnegative(),
    drinks_heavy: z.number().nonnegative(),
    activities_free: z.number().nonnegative(),
    activities_budget: z.number().nonnegative(),
    activities_mid_range: z.number().nonnegative(),
    activities_high_end: z.number().nonnegative(),
  }),
});

export type GeneratedCityPayload = z.infer<typeof generatedCitySchema>;

export interface CityGenerationRequest {
  cityName: string;
  countryName: string;
  referenceDate?: string;
  extraContext?: string;
  provider?: CityGenerationProvider;
  apiKey?: string;
  model?: string;
}

export interface CityGenerationResult {
  provider: string;
  model: string;
  promptVersion: string;
  payload: GeneratedCityPayload;
  mappedEstimate: Partial<CityEstimateData>;
  inferredAudPerUsd: number;
}

export class CityGenerationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'CityGenerationError';
    this.status = status;
  }
}

function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model response');
  }

  return JSON.parse(text.slice(start, end + 1));
}

function findRepoFile(fileName: string) {
  const candidates = [path.resolve(process.cwd(), fileName), path.resolve(process.cwd(), '..', fileName)];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`Expected file was not found. Tried: ${candidates.join(', ')}`);
}

function loadPromptTemplate(): string {
  const promptPath = findRepoFile('llm_prompt_new_cities_1.md');
  return fs.readFileSync(promptPath, 'utf8');
}

export function buildCityGenerationPrompt(request: CityGenerationRequest): { prompt: string; promptVersion: string } {
  const promptVersion = 'llm_prompt_new_cities_1.md';
  const basePrompt = loadPromptTemplate();
  const dateLine = request.referenceDate
    ? `Reference date or pricing window: ${request.referenceDate}`
    : 'Reference date or pricing window: current best available pricing';
  const contextLine = request.extraContext?.trim()
    ? `Additional context: ${request.extraContext.trim()}`
    : 'Additional context: none';

  const prompt = `${basePrompt}

Generate a city-cost entry for:
- City: ${request.cityName}
- Country: ${request.countryName}
- ${dateLine}
- ${contextLine}

Additional output requirements:
- Add a top-level string field called "confidence_notes" that explains why the confidence is high, medium, or low.
- Keep the exact nested object structure from the prompt: city, country, region, confidence, confidence_notes, anchors_usd, tiers_aud.
- Return valid JSON only. No markdown fences or extra commentary.`;

  return { prompt, promptVersion };
}

function getMissingKeyMessage(provider: CityGenerationProvider) {
  if (provider === 'anthropic') {
    return 'No Anthropic API key provided. Add one in the UI or configure ANTHROPIC_API_KEY on the server.';
  }
  if (provider === 'openai') {
    return 'No OpenAI API key provided. Add one in the UI or configure OPENAI_API_KEY on the server.';
  }
  return 'No Gemini API key provided. Add one in the UI or configure GEMINI_API_KEY on the server.';
}

function mapTiersToEstimateData(payload: GeneratedCityPayload): Partial<CityEstimateData> {
  const audPerUsd = inferAudPerUsd(payload);
  const tiers = payload.tiers_aud;
  const anchors = payload.anchors_usd;

  return {
    accomHostel: tiers.accom_shared_hostel_dorm,
    accomPrivateRoom: tiers.accom_hostel_private_room,
    accom1star: tiers.accom_1_star,
    accom2star: tiers.accom_2_star,
    accom3star: tiers.accom_3_star,
    accom4star: tiers.accom_4_star,
    foodStreet: tiers.food_street_food,
    foodBudget: tiers.food_budget,
    foodMid: tiers.food_mid_range,
    foodHigh: tiers.food_high_end,
    drinkLocalBeer: toMoney(anchors.beer * audPerUsd),
    drinkWineGlass: toMoney(anchors.wine_glass * audPerUsd),
    drinkCocktail: toMoney(anchors.cocktail * audPerUsd),
    drinkCoffee: toMoney(anchors.coffee * audPerUsd),
    drinksNone: tiers.drinks_none,
    drinksLight: tiers.drinks_light,
    drinksModerate: tiers.drinks_moderate,
    drinksHeavy: tiers.drinks_heavy,
    activitiesFree: tiers.activities_free,
    activitiesBudget: tiers.activities_budget,
    activitiesMid: tiers.activities_mid_range,
    activitiesHigh: tiers.activities_high_end,
  };
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function safeRate(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  const rate = numerator / denominator;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function inferAudPerUsd(payload: GeneratedCityPayload) {
  const anchors = payload.anchors_usd;
  const tiers = payload.tiers_aud;
  const candidateRates = [
    safeRate(tiers.accom_shared_hostel_dorm, anchors.hostel_dorm_1p * 2),
    safeRate(tiers.accom_hostel_private_room, anchors.hostel_private_2p),
    safeRate(tiers.accom_1_star, anchors.hotel_1star_2p),
    safeRate(tiers.accom_3_star, anchors.hotel_3star_2p),
    safeRate(tiers.food_street_food, anchors.inexp_meal_1p * 0.6 * 3 * 2),
    safeRate(tiers.food_budget, (anchors.inexp_meal_1p * 0.6 * 2 + anchors.inexp_meal_1p) * 2),
    safeRate(tiers.food_mid_range, (anchors.inexp_meal_1p * 0.6 + anchors.inexp_meal_1p + anchors.midrange_meal_2p / 2) * 2),
    safeRate(tiers.drinks_none, 2 * anchors.coffee),
    safeRate(tiers.drinks_light, 2 * anchors.coffee + 2 * anchors.beer),
    safeRate(tiers.drinks_moderate, 2 * anchors.coffee + 4 * anchors.beer + 2 * anchors.cocktail),
    safeRate(tiers.drinks_heavy, 2 * anchors.coffee + 6 * anchors.beer + 4 * anchors.cocktail + 2 * anchors.wine_glass),
    safeRate(tiers.activities_budget, ((anchors.inexp_meal_1p + 10) / 2) * 2),
    safeRate(tiers.activities_mid_range, ((anchors.inexp_meal_1p + 10) / 2) * 5.5),
    safeRate(tiers.activities_high_end, ((anchors.inexp_meal_1p + 10) / 2) * 12),
  ].filter((value): value is number => value !== null);

  if (!candidateRates.length) return 1.55;

  const averageRate = candidateRates.reduce((sum, value) => sum + value, 0) / candidateRates.length;
  return toMoney(averageRate);
}

export async function generateCityCostEstimate(request: CityGenerationRequest): Promise<CityGenerationResult> {
  const { prompt, promptVersion } = buildCityGenerationPrompt(request);
  let providerResponse: { provider: string; model: string; text: string } | null = null;
  try {
    providerResponse = await runJsonPromptWithProvider({
      systemPrompt: 'You are a careful travel cost estimation assistant. Return valid JSON only.',
      userPrompt: prompt,
      provider: request.provider,
      apiKey: request.apiKey,
      model: request.model,
      maxTokens: 3000,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'LLM request failed.';
    throw new CityGenerationError(message, 502);
  }

  if (!providerResponse) {
    if (request.provider) {
      throw new CityGenerationError(getMissingKeyMessage(request.provider), 400);
    }

    throw new CityGenerationError(
      'No supported LLM provider is configured. Add an API key in the UI or configure ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY on the server.',
      400
    );
  }

  let parsedPayload: GeneratedCityPayload;
  try {
    parsedPayload = generatedCitySchema.parse(extractJsonObject(providerResponse.text));
  } catch (err) {
    if (err instanceof CityGenerationError) throw err;
    throw new CityGenerationError(
      `The ${providerResponse.provider} response did not match the required city-cost JSON schema.`,
      502
    );
  }

  const inferredAudPerUsd = inferAudPerUsd(parsedPayload);

  return {
    provider: providerResponse.provider,
    model: providerResponse.model,
    promptVersion,
    inferredAudPerUsd,
    mappedEstimate: mapTiersToEstimateData(parsedPayload),
    payload: parsedPayload,
  };
}
