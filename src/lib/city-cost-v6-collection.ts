import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import type { CityGenerationProvider } from './city-generation-config';
import { runJsonPromptWithProvider } from './city-llm-client';
import {
  loadV6SourceCalibrationOffset,
  normalizeV6Region,
  type V6AnchorInputs,
  type V6Grade,
} from './city-cost-methodology-v6';
import type { V5AnchorName, V5AnchorStatus } from './city-cost-methodology-v5';

type V6SpineSource = 'numbeo' | 'expedia_3star' | 'budgetyourtrip';

const SOURCE_CONFIG: Record<
  V6SpineSource,
  {
    promptFile: string;
    expectedSource: string;
    measures: readonly V5AnchorName[];
    grade: Exclude<V6Grade, 'C' | 'D' | 'definitional'>;
  }
> = {
  numbeo: {
    promptFile: 'llm_prompt_city_cost_v6_numbeo.md',
    expectedSource: 'numbeo',
    measures: [
      'inexpensive_restaurant_meal_1p',
      'midrange_restaurant_meal_2p',
      'cappuccino_1',
      'domestic_draft_beer_1',
      'mcmeal_combo',
    ],
    grade: 'A',
  },
  expedia_3star: {
    promptFile: 'llm_prompt_city_cost_v6_expedia_3star.md',
    expectedSource: 'expedia_3star',
    measures: ['hotel_3star_room_2p'],
    grade: 'B',
  },
  budgetyourtrip: {
    promptFile: 'llm_prompt_city_cost_v6_budgetyourtrip.md',
    expectedSource: 'budgetyourtrip',
    measures: [
      'paid_attraction_adult_1',
      'half_day_group_activity_adult_1',
      'full_day_premium_activity_adult_1',
    ],
    grade: 'B',
  },
};

const measureStatusSchema = z.enum(['observed', 'not_found', 'blocked', 'stale', 'class_absent']);
const measureSchema = z
  .object({
    status: measureStatusSchema,
    value: z.number().nonnegative().nullable().default(null),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable().default(null),
    sourceUrl: z.string().url().nullable().default(null),
    sourceTitle: z.string().default(''),
    evidenceText: z.string().default(''),
    query: z.string().default(''),
    taxStatus: z.enum(['included', 'excluded', 'mixed', 'unknown']).default('unknown'),
  })
  .superRefine((measure, context) => {
    if (measure.status === 'observed') {
      if (measure.value === null) context.addIssue({ code: 'custom', path: ['value'], message: 'Observed measures require a value' });
      if (!measure.currency) context.addIssue({ code: 'custom', path: ['currency'], message: 'Observed measures require a currency' });
      if (!measure.sourceUrl) context.addIssue({ code: 'custom', path: ['sourceUrl'], message: 'Observed measures require a source URL' });
    }
    if (measure.status !== 'observed' && measure.value !== null) {
      context.addIssue({ code: 'custom', path: ['value'], message: 'Non-observed measures must use null value' });
    }
  });

const baseResponseShape = {
  schemaVersion: z.literal('city-cost-v6-spine-response-v1'),
  city: z.string().min(1),
  country: z.string().min(1),
  retrievalStatus: z.enum(['complete', 'partial', 'not_found', 'blocked']),
  searchesUsed: z.number().int().nonnegative().max(25),
  directPageReads: z.number().int().nonnegative(),
  notes: z.string().default(''),
};

const responseSchemas: Record<V6SpineSource, z.ZodTypeAny> = {
  numbeo: z.object({
    ...baseResponseShape,
    source: z.literal('numbeo'),
    measures: z.object({
      inexpensive_restaurant_meal_1p: measureSchema,
      midrange_restaurant_meal_2p: measureSchema,
      cappuccino_1: measureSchema,
      domestic_draft_beer_1: measureSchema,
      mcmeal_combo: measureSchema,
    }),
  }),
  expedia_3star: z.object({
    ...baseResponseShape,
    source: z.literal('expedia_3star'),
    measures: z.object({ hotel_3star_room_2p: measureSchema }),
  }),
  budgetyourtrip: z.object({
    ...baseResponseShape,
    source: z.literal('budgetyourtrip'),
    measures: z.object({
      paid_attraction_adult_1: measureSchema,
      half_day_group_activity_adult_1: measureSchema,
      full_day_premium_activity_adult_1: measureSchema,
    }),
  }),
};

type ParsedMeasure = z.infer<typeof measureSchema>;

export interface V6SpineFact extends ParsedMeasure {
  measure: V5AnchorName;
  source: V6SpineSource;
  retrievalStatus: 'complete' | 'partial' | 'not_found' | 'blocked';
  provider: string;
  model: string;
  promptVersion: string;
}

export interface V6CollectionCallTelemetry {
  source: V6SpineSource;
  promptVersion: string;
  provider: string;
  model: string;
  attempts: number;
  retries: number;
  status: 'complete' | 'partial' | 'not_found' | 'blocked' | 'error';
  searchesUsed: number;
  directPageReads: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  error: string | null;
}

export interface V6CollectionResult {
  anchors: V6AnchorInputs;
  facts: V6SpineFact[];
  telemetry: V6CollectionCallTelemetry[];
  llmCalls: number;
  searches: number;
  promptVersions: string[];
}

export class V6CollectionError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'V6CollectionError';
    this.status = status;
  }
}

function repoFile(relativePath: string) {
  const candidates = [
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), '..', relativePath),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new V6CollectionError(`Expected v6 prompt file was not found: ${candidates.join(', ')}`, 500);
  return found;
}

function renderPrompt(source: V6SpineSource, city: string, country: string, referenceDate: string) {
  const template = fs.readFileSync(repoFile(`docs/prompts/${SOURCE_CONFIG[source].promptFile}`), 'utf8');
  const rendered = template
    .replaceAll('{{city}}', city)
    .replaceAll('{{country}}', country)
    .replaceAll('{{referenceDate}}', referenceDate);
  const unresolved = rendered.match(/{{[a-zA-Z_]+}}/g);
  if (unresolved) throw new V6CollectionError(`Unresolved v6 prompt variables: ${unresolved.join(', ')}`, 500);
  return rendered;
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```$/i.exec(trimmed);
  const jsonText = fenced?.[1].trim() ?? trimmed;
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start === -1 || end <= start) throw new V6CollectionError('The v6 spine response did not contain a JSON object.', 502);
  try {
    return JSON.parse(jsonText.slice(start, end + 1));
  } catch (error) {
    throw new V6CollectionError(`The v6 spine response was not valid JSON: ${error instanceof Error ? error.message : 'unknown error'}`, 502);
  }
}

function readFxRate(currency: string) {
  const snapshotPath = path.resolve(process.cwd(), 'data/reference/fx/city_cost_fx_aud_2026-07-22.json');
  const fallbackPath = path.resolve(process.cwd(), '..', 'data/reference/fx/city_cost_fx_aud_2026-07-22.json');
  const sourcePath = fs.existsSync(snapshotPath) ? snapshotPath : fallbackPath;
  const snapshot = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as {
    rates?: Record<string, { audPerUnit?: number }>;
  };
  const rate = snapshot.rates?.[currency]?.audPerUnit;
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null;
}

function sourceFactToAnchor(
  source: V6SpineSource,
  fact: ParsedMeasure,
  provider: string,
  model: string,
  promptVersion: string
) {
  const evidenceGrade = SOURCE_CONFIG[source].grade;
  const missingStatus = fact.status as Exclude<V5AnchorStatus, 'observed' | 'modelled' | 'imputed'>;
  if (fact.status !== 'observed') {
    return {
      valueAud: null,
      status: missingStatus,
      evidenceGrade: 'D' as const,
      sourceIds: fact.sourceUrl ? [`${source}:${fact.sourceUrl}`] : [`${source}:no-result`],
      modelVersions: [model, promptVersion],
      missingness: missingStatus,
    };
  }

  const rate = fact.currency ? readFxRate(fact.currency) : null;
  if (rate === null || fact.value === null) {
    return {
      valueAud: null,
      status: 'not_found' as const,
      evidenceGrade: 'D' as const,
      sourceIds: fact.sourceUrl ? [`${source}:${fact.sourceUrl}`] : [`${source}:unsupported-fx`],
      modelVersions: [model, promptVersion],
      missingness: 'not_found' as const,
    };
  }

  const rawValueAud = fact.value * rate;
  const sourceOffset = source === 'expedia_3star'
    ? loadV6SourceCalibrationOffset('hotel_3star_room_2p')
    : null;
  const calibratedValueAud = rawValueAud * (sourceOffset?.expediaToBookingMultiplier ?? 1);
  return {
    valueAud: Math.round((calibratedValueAud + Number.EPSILON) * 100) / 100,
    status: 'observed' as const,
    evidenceGrade,
    intervalPct: sourceOffset?.intervalPct,
    sourceIds: [
      `${source}:${fact.sourceUrl}`,
      ...(sourceOffset ? [`v6-source-offset:${sourceOffset.fit?.provenance ?? 'booking-expedia'}`] : []),
    ],
    modelVersions: [model, promptVersion, ...(sourceOffset ? ['city-cost-v6-source-offset-v1'] : [])],
  };
}

function isBlockError(error: unknown) {
  return /\b(429|503|blocked|rate limit|captcha|forbidden)\b/i.test(error instanceof Error ? error.message : String(error));
}

async function collectSpineCall(input: {
  source: V6SpineSource;
  city: string;
  country: string;
  referenceDate: string;
  provider?: CityGenerationProvider;
  apiKey?: string;
  model?: string;
}): Promise<{ anchors: V6AnchorInputs; facts: V6SpineFact[]; telemetry: V6CollectionCallTelemetry }> {
  const config = SOURCE_CONFIG[input.source];
  const promptVersion = config.promptFile;
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  let attempts = 0;
  let lastError: string | null = null;
  let provider = input.provider ?? 'unresolved';
  let model = input.model ?? 'unresolved';
  let searchesUsedTotal = 0;

  while (attempts < 2) {
    attempts += 1;
    try {
      const response = await runJsonPromptWithProvider({
        systemPrompt: 'You are a careful source extractor. Return valid JSON only; never estimate or calculate.',
        userPrompt: renderPrompt(input.source, input.city, input.country, input.referenceDate),
        provider: input.provider,
        apiKey: input.apiKey,
        model: input.model,
        maxTokens: 2200,
      });

      if (!response) {
        throw new V6CollectionError(
          'No supported LLM provider is configured. Add an API key in the UI or configure a provider key on the server.',
          400
        );
      }
      provider = response.provider;
      model = response.model;
      const parsed = responseSchemas[input.source].parse(extractJsonObject(response.text)) as {
        city: string;
        country: string;
        retrievalStatus: 'complete' | 'partial' | 'not_found' | 'blocked';
        searchesUsed: number;
        directPageReads: number;
        measures: Record<string, ParsedMeasure>;
      };
      if (parsed.city !== input.city || parsed.country !== input.country) {
        throw new V6CollectionError(`The ${input.source} response changed the requested city or country.`, 502);
      }
      if (parsed.directPageReads !== 0) {
        throw new V6CollectionError(`The ${input.source} response reported a direct page read; v6 production is search-snippet only.`, 502);
      }
      searchesUsedTotal += parsed.searchesUsed;
      if (parsed.retrievalStatus === 'blocked' && attempts < 2) {
        lastError = 'The source reported a block; v6 recorded one retry.';
        continue;
      }

      const facts = config.measures.map((measure) => ({
        measure,
        source: input.source,
        ...(parsed.measures[measure] as ParsedMeasure),
        retrievalStatus: parsed.retrievalStatus,
        provider,
        model,
        promptVersion,
      }));
      const anchors = Object.fromEntries(
        facts.map((fact) => [fact.measure, sourceFactToAnchor(input.source, fact, provider, model, promptVersion)])
      ) as V6AnchorInputs;
      const completedAt = new Date().toISOString();
      return {
        anchors,
        facts,
        telemetry: {
          source: input.source,
          promptVersion,
          provider,
          model,
          attempts,
          retries: attempts - 1,
          status: parsed.retrievalStatus,
          searchesUsed: searchesUsedTotal,
          directPageReads: parsed.directPageReads,
          startedAt,
          completedAt,
          durationMs: Date.now() - startTime,
          error: lastError,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (!isBlockError(error) || attempts >= 2) {
        if (error instanceof V6CollectionError && error.status === 400) throw error;
        // A repeated source block is a valid missingness outcome. Other contract errors are not.
        if (isBlockError(error)) break;
        throw new V6CollectionError(lastError, error instanceof V6CollectionError ? error.status : 502);
      }
    }
  }

  const completedAt = new Date().toISOString();
  const facts = SOURCE_CONFIG[input.source].measures.map((measure) => ({
    measure,
    source: input.source,
    status: 'blocked' as const,
    value: null,
    currency: null,
    sourceUrl: null,
    sourceTitle: '',
    evidenceText: '',
    query: '',
    taxStatus: 'unknown' as const,
    retrievalStatus: 'blocked' as const,
    provider,
    model,
    promptVersion,
  }));
  return {
    anchors: Object.fromEntries(
      facts.map((fact) => [fact.measure, sourceFactToAnchor(input.source, fact, provider, model, promptVersion)])
    ) as V6AnchorInputs,
    facts,
    telemetry: {
      source: input.source,
      promptVersion,
      provider,
      model,
      attempts,
      retries: attempts - 1,
      status: 'blocked',
      searchesUsed: 0,
      directPageReads: 0,
      startedAt,
      completedAt,
      durationMs: Date.now() - startTime,
      error: lastError,
    },
  };
}

export async function collectCityCostV6Anchors(input: {
  city: string;
  country: string;
  region?: string | null;
  referenceDate?: string;
  provider?: CityGenerationProvider;
  apiKey?: string;
  model?: string;
}): Promise<V6CollectionResult> {
  const referenceDate = input.referenceDate?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const sources: V6SpineSource[] = ['numbeo', 'expedia_3star', 'budgetyourtrip'];
  const results = [] as Awaited<ReturnType<typeof collectSpineCall>>[];
  for (const source of sources) {
    results.push(
      await collectSpineCall({
        source,
        city: input.city,
        country: input.country,
        referenceDate,
        provider: input.provider,
        apiKey: input.apiKey,
        model: input.model,
      })
    );
  }

  const anchors = Object.assign({}, ...results.map((result) => result.anchors));
  const telemetry = results.map((result) => result.telemetry);
  const searches = telemetry.reduce((total, call) => total + call.searchesUsed, 0);
  if (searches > 25) {
    throw new V6CollectionError('The v6 production search budget exceeded 25 searches for this city.', 502);
  }
  return {
    anchors,
    facts: results.flatMap((result) => result.facts),
    telemetry,
    llmCalls: telemetry.reduce((total, call) => total + call.attempts, 0),
    searches,
    promptVersions: telemetry.map((call) => call.promptVersion),
  };
}

export function v6CollectionRegion(region: string | null | undefined) {
  return normalizeV6Region(region);
}
