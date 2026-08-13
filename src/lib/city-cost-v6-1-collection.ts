import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import type {
  CityGenerationProvider,
  CityGenerationReasoningEffort,
} from './city-generation-config';
import {
  runJsonPromptWithWebSearch,
  type ProviderSearchResponse,
} from './transport-estimation';
import {
  loadV6SourceCalibrationOffset,
  type V6AnchorInput,
} from './city-cost-methodology-v6';
import type { V5AnchorStatus } from './city-cost-methodology-v5';
import { findKnownCountryMetadata, slugifyId } from './country-metadata';

/** The v6.1 source boundary. These names are intentionally not v6.0 ticket/item anchors. */
export const V61_SPINE_SOURCES = ['expedia_3star', 'budgetyourtrip_daily_tiers', 'numbeo_drinks'] as const;
export type V61SpineSource = (typeof V61_SPINE_SOURCES)[number];

export const V61_SOURCE_MEASURES = {
  expedia_3star: ['hotel_3star_room_2p'],
  budgetyourtrip_daily_tiers: [
    'byt_food_budget_per_person_day',
    'byt_food_mid_per_person_day',
    'byt_food_high_per_person_day',
    'byt_activities_budget_per_person_day',
    'byt_activities_mid_per_person_day',
    'byt_activities_high_per_person_day',
  ],
  numbeo_drinks: ['cappuccino_1', 'domestic_draft_beer_1'],
} as const satisfies Record<V61SpineSource, readonly string[]>;

export type V61SourceMeasure = (typeof V61_SOURCE_MEASURES)[V61SpineSource][number];

export const V61_SOURCE_CONFIG: Record<
  V61SpineSource,
  {
    promptFile: string;
    measures: readonly V61SourceMeasure[];
    grade: 'A' | 'B';
    maxSearches: number;
  }
> = {
  expedia_3star: {
    promptFile: 'llm_prompt_city_cost_v6_1_expedia_3star.md',
    measures: V61_SOURCE_MEASURES.expedia_3star,
    grade: 'B',
    maxSearches: 4,
  },
  budgetyourtrip_daily_tiers: {
    promptFile: 'llm_prompt_city_cost_v6_1_budgetyourtrip_daily_tiers.md',
    measures: V61_SOURCE_MEASURES.budgetyourtrip_daily_tiers,
    grade: 'B',
    maxSearches: 4,
  },
  numbeo_drinks: {
    promptFile: 'llm_prompt_city_cost_v6_1_numbeo_drinks.md',
    measures: V61_SOURCE_MEASURES.numbeo_drinks,
    grade: 'A',
    maxSearches: 2,
  },
};

export const V61_SEARCHES_PER_CITY_MAX = Object.values(V61_SOURCE_CONFIG).reduce(
  (total, source) => total + source.maxSearches,
  0
);

const measureStatusSchema = z.enum(['observed', 'not_found', 'blocked', 'stale', 'class_absent']);
const v61MeasureSchema = z
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
  .strict()
  .superRefine((measure, context) => {
    if (measure.status === 'observed') {
      if (measure.value === null) context.addIssue({ code: 'custom', path: ['value'], message: 'Observed measures require a value' });
      if (!measure.currency) context.addIssue({ code: 'custom', path: ['currency'], message: 'Observed measures require a currency' });
      if (!measure.sourceUrl) context.addIssue({ code: 'custom', path: ['sourceUrl'], message: 'Observed measures require a source URL' });
      if (!measure.sourceTitle.trim()) context.addIssue({ code: 'custom', path: ['sourceTitle'], message: 'Observed measures require a source title' });
      if (!measure.evidenceText.trim()) context.addIssue({ code: 'custom', path: ['evidenceText'], message: 'Observed measures require evidence text' });
      if (!measure.query.trim()) context.addIssue({ code: 'custom', path: ['query'], message: 'Observed measures require a query' });
    }
    if (measure.status !== 'observed' && measure.value !== null) {
      context.addIssue({ code: 'custom', path: ['value'], message: 'Non-observed measures must use null value' });
    }
  });

type V61ParsedMeasure = z.infer<typeof v61MeasureSchema>;

/**
 * Numbeo displays the domestic draft-beer serving in either of these
 * canonical units. Stage B preserves the displayed unit and does no
 * conversion between them.
 */
export const V61_DOMESTIC_DRAFT_BEER_LABELS = [
  'Domestic Draft Beer (0.5 Liter)',
  'Domestic Draft Beer (1 Pint)',
] as const;

function hasCanonicalDomesticDraftBeerEvidence(measure: V61ParsedMeasure) {
  const evidence = [measure.sourceTitle, measure.evidenceText, measure.query].join('\n');
  const hasCanonicalLabel = V61_DOMESTIC_DRAFT_BEER_LABELS.some((label) => evidence.includes(label));
  const isDisallowedVariant = /\b(?:bottled|imported)\b/i.test(evidence) && /\bbeer\b/i.test(evidence);
  return hasCanonicalLabel && !isDisallowedVariant;
}

const baseResponseShape = {
  schemaVersion: z.literal('city-cost-v6-1-spine-response-v1'),
  city: z.string().min(1),
  country: z.string().min(1),
  retrievalStatus: z.enum(['complete', 'partial', 'not_found', 'blocked']),
  searchesUsed: z.number().int().nonnegative(),
  directPageReads: z.number().int().nonnegative(),
  notes: z.string().default(''),
};

const v61ResponseSchemas: Record<V61SpineSource, z.ZodTypeAny> = {
  expedia_3star: z.object({
    ...baseResponseShape,
    source: z.literal('expedia_3star'),
    measures: z.object({
      hotel_3star_room_2p: v61MeasureSchema,
    }).strict(),
  }).strict(),
  budgetyourtrip_daily_tiers: z.object({
    ...baseResponseShape,
    source: z.literal('budgetyourtrip_daily_tiers'),
    measures: z.object({
      byt_food_budget_per_person_day: v61MeasureSchema,
      byt_food_mid_per_person_day: v61MeasureSchema,
      byt_food_high_per_person_day: v61MeasureSchema,
      byt_activities_budget_per_person_day: v61MeasureSchema,
      byt_activities_mid_per_person_day: v61MeasureSchema,
      byt_activities_high_per_person_day: v61MeasureSchema,
    }).strict(),
  }).strict(),
  numbeo_drinks: z.object({
    ...baseResponseShape,
    source: z.literal('numbeo_drinks'),
    measures: z.object({
      cappuccino_1: v61MeasureSchema,
      domestic_draft_beer_1: v61MeasureSchema,
    }).strict(),
  }).strict(),
};

export type V61SpineResponse = {
  schemaVersion: 'city-cost-v6-1-spine-response-v1';
  source: V61SpineSource;
  city: string;
  country: string;
  retrievalStatus: 'complete' | 'partial' | 'not_found' | 'blocked';
  searchesUsed: number;
  directPageReads: number;
  notes: string;
  measures: Partial<Record<V61SourceMeasure, V61ParsedMeasure>>;
};

export type V61DiskTelemetry = {
  source?: V61SpineSource;
  promptVersion?: string;
  provider?: string;
  model?: string;
  attempts?: number;
  providerCalls?: number;
  retries?: number;
  status?: V61CollectionCallTelemetry['status'] | V61SpineResponse['retrievalStatus'];
  searchesUsed?: number;
  directPageReads?: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  latencyMs?: number | null;
  error?: string | null;
  reasoningEffort?: CityGenerationReasoningEffort;
};

export interface V61SpineFact extends V61ParsedMeasure {
  measure: V61SourceMeasure;
  source: V61SpineSource;
  retrievalStatus: V61SpineResponse['retrievalStatus'];
  provider: string;
  model: string;
  promptVersion: string;
}

export interface V61CollectionCallTelemetry {
  source: V61SpineSource;
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
  reasoningEffort?: CityGenerationReasoningEffort;
}

export type V61AnchorInputs = Partial<Record<V61SourceMeasure, V6AnchorInput>>;

export interface V61CollectionResult {
  anchors: V61AnchorInputs;
  facts: V61SpineFact[];
  /** Parsed schema objects exactly as returned by each provider call, retained for canary/migration audit. */
  rawResponses: Record<V61SpineSource, unknown>;
  /** Unedited provider envelopes. Kept in the collection experiment/persistence layer, not fixture materializations. */
  providerRawResponses?: Partial<Record<V61SpineSource, unknown>>;
  telemetry: V61CollectionCallTelemetry[];
  llmCalls: number;
  searches: number;
  promptVersions: string[];
}

export class V61CollectionError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'V61CollectionError';
    this.status = status;
  }
}

function repoFile(relativePath: string) {
  const candidates = [
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), '..', relativePath),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new V61CollectionError(`Expected v6.1 prompt file was not found: ${candidates.join(', ')}`, 500);
  return found;
}

export interface V61CollectionDates {
  referenceDate: string;
  arrivalDate: string;
  departureDate: string;
}

function normalizeNonObservedEvidenceFields(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const candidate = { ...(raw as Record<string, unknown>) };
  if (!candidate.measures || typeof candidate.measures !== 'object' || Array.isArray(candidate.measures)) return candidate;

  candidate.measures = Object.fromEntries(
    Object.entries(candidate.measures as Record<string, unknown>).map(([measure, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [measure, value];
      const normalized = { ...(value as Record<string, unknown>) };
      if (normalized.status !== 'observed') {
        for (const field of ['sourceTitle', 'evidenceText', 'query']) {
          if (normalized[field] === null) normalized[field] = '';
        }
      }
      return [measure, normalized];
    })
  );
  return candidate;
}

export function renderV61Prompt(source: V61SpineSource, city: string, country: string, dates: V61CollectionDates) {
  const template = fs.readFileSync(repoFile(`docs/prompts/${V61_SOURCE_CONFIG[source].promptFile}`), 'utf8');
  const rendered = template
    .replaceAll('{{city}}', city)
    .replaceAll('{{country}}', country)
    .replaceAll('{{arrivalDate}}', dates.arrivalDate)
    .replaceAll('{{departureDate}}', dates.departureDate)
    .replaceAll('{{referenceDate}}', dates.referenceDate);
  const unresolved = rendered.match(/{{[a-zA-Z_]+}}/g);
  if (unresolved) throw new V61CollectionError(`Unresolved v6.1 prompt variables: ${unresolved.join(', ')}`, 500);
  return rendered;
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```$/i.exec(trimmed);
  const jsonText = fenced?.[1].trim() ?? trimmed;
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start === -1 || end <= start) throw new V61CollectionError('The v6.1 spine response did not contain a JSON object.', 502);
  try {
    return JSON.parse(jsonText.slice(start, end + 1));
  } catch (error) {
    throw new V61CollectionError(`The v6.1 spine response was not valid JSON: ${error instanceof Error ? error.message : 'unknown error'}`, 502);
  }
}

export function parseV61SpineResponse(source: V61SpineSource, raw: unknown): V61SpineResponse {
  const parsed = v61ResponseSchemas[source].parse(normalizeNonObservedEvidenceFields(raw)) as V61SpineResponse;
  if (parsed.source !== source) {
    throw new V61CollectionError(`Expected a ${source} v6.1 spine response, received ${parsed.source}.`, 502);
  }
  const config = V61_SOURCE_CONFIG[source];
  if (parsed.searchesUsed > config.maxSearches) {
    throw new V61CollectionError(`${source} exceeded its v6.1 search limit of ${config.maxSearches}.`, 502);
  }
  if (parsed.directPageReads !== 0) {
    throw new V61CollectionError(`The ${source} response reported a direct page read; v6.1 is search-snippet only.`, 502);
  }
  if (source === 'numbeo_drinks') {
    const beer = parsed.measures.domestic_draft_beer_1;
    if (!beer) throw new V61CollectionError('The numbeo_drinks response omitted domestic_draft_beer_1.', 502);
    if (beer.status === 'observed' && !hasCanonicalDomesticDraftBeerEvidence(beer)) {
      throw new V61CollectionError(
        'Observed domestic_draft_beer_1 must preserve the canonical Numbeo row label Domestic Draft Beer (0.5 Liter) or Domestic Draft Beer (1 Pint); bottled/imported beer is not accepted.',
        502,
      );
    }
  }
  return parsed;
}

export function sourceIdentityMatches(
  left: { city: string; country: string },
  right: { city: string; country: string },
) {
  const leftCountry = findKnownCountryMetadata(left.country);
  const rightCountry = findKnownCountryMetadata(right.country);
  const countriesMatch = leftCountry && rightCountry
    ? leftCountry.id === rightCountry.id
    : slugifyId(left.country) === slugifyId(right.country);
  return slugifyId(left.city) === slugifyId(right.city) && countriesMatch;
}

export function createBlockedV61SpineResponse(
  source: V61SpineSource,
  city: string,
  country: string,
  reason: string,
): V61SpineResponse {
  return {
    schemaVersion: 'city-cost-v6-1-spine-response-v1',
    source,
    city,
    country,
    retrievalStatus: 'blocked',
    searchesUsed: 0,
    directPageReads: 0,
    notes: reason,
    measures: Object.fromEntries(V61_SOURCE_CONFIG[source].measures.map((measure) => [measure, {
      status: 'blocked' as const,
      value: null,
      currency: null,
      sourceUrl: null,
      sourceTitle: '',
      evidenceText: '',
      query: '',
      taxStatus: 'unknown' as const,
    }])),
  };
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

function rounded(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sourceFactToAnchor(source: V61SpineSource, fact: V61ParsedMeasure & { measure: V61SourceMeasure }, model: string, promptVersion: string) {
  const missingStatus = fact.status as Exclude<V5AnchorStatus, 'observed' | 'modelled' | 'imputed'>;
  if (fact.status !== 'observed') {
    return {
      valueAud: null,
      status: missingStatus,
      evidenceGrade: 'D' as const,
      sourceIds: fact.sourceUrl ? [`${source}:${fact.sourceUrl}`] : [`${source}:no-result`],
      modelVersions: [model, promptVersion],
      missingness: missingStatus,
    } satisfies V6AnchorInput;
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
    } satisfies V6AnchorInput;
  }

  const sourceOffset = source === 'expedia_3star'
    ? loadV6SourceCalibrationOffset('hotel_3star_room_2p')
    : null;
  const intervalPct = source === 'numbeo_drinks' ? 10 : source === 'budgetyourtrip_daily_tiers' ? 35 : sourceOffset?.intervalPct ?? 41;
  const calibratedValueAud = fact.value * rate * (sourceOffset?.expediaToBookingMultiplier ?? 1);
  return {
    valueAud: rounded(calibratedValueAud),
    status: 'observed' as const,
    evidenceGrade: V61_SOURCE_CONFIG[source].grade,
    intervalPct,
    sourceIds: [
      `${source}:${fact.sourceUrl}`,
      ...(sourceOffset ? [`v6-source-offset:${sourceOffset.fit?.provenance ?? 'booking-expedia'}`] : []),
    ],
    modelVersions: [model, promptVersion, ...(sourceOffset ? ['city-cost-v6-source-offset-v1'] : [])],
  } satisfies V6AnchorInput;
}

export function normalizeV61DiskTelemetry(source: V61SpineSource, response: V61SpineResponse, input: V61DiskTelemetry | undefined): V61CollectionCallTelemetry {
  const telemetry = input ?? {};
  if (telemetry.source && telemetry.source !== source) {
    throw new V61CollectionError(`Telemetry source does not match ${source}.`, 502);
  }
  const attempts = telemetry.attempts ?? telemetry.providerCalls ?? 1;
  const searchesUsed = telemetry.searchesUsed ?? response.searchesUsed;
  const directPageReads = telemetry.directPageReads ?? response.directPageReads;
  if (searchesUsed > V61_SOURCE_CONFIG[source].maxSearches) {
    throw new V61CollectionError(`${source} telemetry exceeded its v6.1 search limit.`, 502);
  }
  if (directPageReads !== 0) {
    throw new V61CollectionError(`The ${source} telemetry reported a direct page read.`, 502);
  }
  const startedAt = telemetry.startedAt ?? new Date().toISOString();
  const completedAt = telemetry.completedAt ?? startedAt;
  return {
    source,
    promptVersion: telemetry.promptVersion ?? V61_SOURCE_CONFIG[source].promptFile,
    provider: telemetry.provider ?? 'delegated-gpt-5.6-luna',
    model: telemetry.model ?? 'gpt-5.6-luna',
    attempts,
    retries: telemetry.retries ?? Math.max(0, attempts - 1),
    status: telemetry.status ?? response.retrievalStatus,
    searchesUsed,
    directPageReads,
    startedAt,
    completedAt,
    durationMs: telemetry.durationMs ?? telemetry.latencyMs ?? 0,
    error: telemetry.error ?? null,
    reasoningEffort: telemetry.reasoningEffort ?? 'none',
  };
}

function factsAndAnchors(source: V61SpineSource, response: V61SpineResponse, telemetry: V61CollectionCallTelemetry) {
  const facts = V61_SOURCE_CONFIG[source].measures.map((measure) => ({
    measure,
    source,
    ...(response.measures[measure] as V61ParsedMeasure),
    retrievalStatus: response.retrievalStatus,
    provider: telemetry.provider,
    model: telemetry.model,
    promptVersion: telemetry.promptVersion,
  })) as V61SpineFact[];
  const anchors = Object.fromEntries(
    facts.map((fact) => [fact.measure, sourceFactToAnchor(source, fact, telemetry.model, telemetry.promptVersion)])
  ) as V61AnchorInputs;
  return { facts, anchors };
}

export function buildV61CollectionResultFromSpineResponses(input: {
  city: string;
  country: string;
  responses: Record<V61SpineSource, unknown>;
  telemetry?: Partial<Record<V61SpineSource, V61DiskTelemetry>>;
}): V61CollectionResult {
  const parsed = V61_SPINE_SOURCES.map((source) => {
    const response = parseV61SpineResponse(source, input.responses[source]);
    if (!sourceIdentityMatches({ city: response.city, country: response.country }, input)) {
      throw new V61CollectionError(`The ${source} response changed the requested city or country.`, 502);
    }
    const normalizedTelemetry = normalizeV61DiskTelemetry(source, response, input.telemetry?.[source]);
    const { facts, anchors } = factsAndAnchors(source, response, normalizedTelemetry);
    return { facts, anchors, telemetry: normalizedTelemetry };
  });

  const searches = parsed.reduce((total, result) => total + result.telemetry.searchesUsed, 0);
  if (searches > V61_SEARCHES_PER_CITY_MAX) {
    throw new V61CollectionError(`The v6.1 production search budget exceeded ${V61_SEARCHES_PER_CITY_MAX} searches for this city.`, 502);
  }
  return {
    anchors: Object.assign({}, ...parsed.map((result) => result.anchors)),
    facts: parsed.flatMap((result) => result.facts),
    rawResponses: Object.fromEntries(
      V61_SPINE_SOURCES.map((source) => [source, input.responses[source]])
    ) as Record<V61SpineSource, unknown>,
    providerRawResponses: {},
    telemetry: parsed.map((result) => result.telemetry),
    llmCalls: parsed.reduce((total, result) => total + result.telemetry.attempts, 0),
    searches,
    promptVersions: parsed.map((result) => result.telemetry.promptVersion),
  };
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function blockedResult(input: {
  source: V61SpineSource;
  city: string;
  country: string;
  provider: string;
  model: string;
  promptVersion: string;
  startedAt: string;
  startTime: number;
  error: string;
  attempts?: number;
  retries?: number;
  status?: 'blocked' | 'error';
  reasoningEffort?: CityGenerationReasoningEffort;
}) {
  const {
    source,
    city,
    country,
    provider,
    model,
    promptVersion,
    startedAt,
    startTime,
    error,
  } = input;
  const response: V61SpineResponse = {
    schemaVersion: 'city-cost-v6-1-spine-response-v1',
    source,
    city,
    country,
    retrievalStatus: 'blocked',
    searchesUsed: 0,
    directPageReads: 0,
    notes: error,
    measures: Object.fromEntries(V61_SOURCE_CONFIG[source].measures.map((measure) => [measure, {
      status: 'blocked' as const,
      value: null,
      currency: null,
      sourceUrl: null,
      sourceTitle: '',
      evidenceText: '',
      query: '',
      taxStatus: 'unknown' as const,
    }])),
  };
  const telemetry: V61CollectionCallTelemetry = {
    source,
    promptVersion,
    provider,
    model,
    attempts: input.attempts ?? 1,
    retries: input.retries ?? 0,
    status: input.status ?? 'blocked',
    searchesUsed: 0,
    directPageReads: 0,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    error,
    reasoningEffort: input.reasoningEffort ?? 'none',
  };
  return { response, rawResponse: response, providerRawResponse: null, telemetry, ...factsAndAnchors(source, response, telemetry) };
}

async function collectV61SpineCall(input: {
  source: V61SpineSource;
  city: string;
  country: string;
  dates: V61CollectionDates;
  provider?: CityGenerationProvider;
  apiKey?: string;
  model?: string;
  reasoningEffort?: CityGenerationReasoningEffort;
}) {
  const config = V61_SOURCE_CONFIG[input.source];
  const promptVersion = config.promptFile;
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const provider = input.provider ?? (
    process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.OPENAI_API_KEY ? 'openai' : process.env.GEMINI_API_KEY ? 'gemini' : 'unresolved'
  );
  const model = input.model ?? 'unresolved';

  try {
    if (provider === 'unresolved') {
      return blockedResult({
        source: input.source,
        city: input.city,
        country: input.country,
        provider,
        model,
        promptVersion,
        startedAt,
        startTime,
        attempts: 0,
        error: 'No provider key is configured for the v6.1 search-enabled source call.',
      });
    }

    const response: ProviderSearchResponse | null = await runJsonPromptWithWebSearch({
      provider,
      systemPrompt: 'You are a careful source extractor. Return valid JSON only; never estimate or calculate.',
      userPrompt: renderV61Prompt(input.source, input.city, input.country, input.dates),
      apiKey: input.apiKey,
      model: input.model,
      reasoningEffort: input.reasoningEffort,
      maxTokens: 2600,
    });
    if (!response) {
      return blockedResult({
        source: input.source,
        city: input.city,
        country: input.country,
        provider,
        model,
        promptVersion,
        startedAt,
        startTime,
        attempts: 0,
        error: `No ${provider} API key is configured for the v6.1 search-enabled source call.`,
      });
    }
    const candidate = extractJsonObject(response.text);
    if (!candidate || typeof candidate !== 'object') {
      throw new V61CollectionError('The v6.1 spine response was not an object.', 502);
    }
    // Provider/tool telemetry is authoritative for search usage. The JSON
    // field remains in the schema for audit readability but is normalized here
    // before validation so model-written counts cannot bypass the ceiling.
    const normalizedCandidate = {
      ...(candidate as Record<string, unknown>),
      searchesUsed: response.searchesUsed,
    };
    const parsed = parseV61SpineResponse(input.source, normalizedCandidate);
    if (!sourceIdentityMatches({ city: parsed.city, country: parsed.country }, input)) {
      throw new V61CollectionError(`The ${input.source} response changed the requested city or country.`, 502);
    }
    const telemetry: V61CollectionCallTelemetry = {
      source: input.source,
      promptVersion,
      provider: response.provider,
      model: response.model,
      attempts: response.attempts,
      retries: response.retries,
      status: parsed.retrievalStatus,
      searchesUsed: parsed.searchesUsed,
      directPageReads: parsed.directPageReads,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      error: null,
      reasoningEffort: input.reasoningEffort ?? 'none',
    };
    return {
      ...factsAndAnchors(input.source, parsed, telemetry),
      rawResponse: parsed,
      providerRawResponse: response.rawResponse ?? response.text,
      telemetry,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return blockedResult({
      source: input.source,
      city: input.city,
      country: input.country,
      provider,
      model,
      promptVersion,
      startedAt,
      startTime,
      status: 'error',
      error: message,
    });
  }
}

export async function collectCityCostV61Anchors(input: {
  city: string;
  country: string;
  region?: string | null;
  referenceDate?: string;
  arrivalDate?: string;
  departureDate?: string;
  provider?: CityGenerationProvider;
  apiKey?: string;
  model?: string;
  reasoningEffort?: CityGenerationReasoningEffort;
}): Promise<V61CollectionResult> {
  const referenceDate = input.referenceDate?.slice(0, 10) || input.arrivalDate?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const arrivalDate = input.arrivalDate?.slice(0, 10) || referenceDate;
  const departureDate = input.departureDate?.slice(0, 10) || addDays(arrivalDate, 1);
  if (!isIsoDate(arrivalDate) || !isIsoDate(departureDate) || departureDate <= arrivalDate) {
    throw new V61CollectionError(`Invalid v6.1 Expedia window: ${arrivalDate} to ${departureDate}.`, 400);
  }
  const dates = { referenceDate, arrivalDate, departureDate } satisfies V61CollectionDates;
  const results = [] as Awaited<ReturnType<typeof collectV61SpineCall>>[];
  for (const source of V61_SPINE_SOURCES) {
    results.push(await collectV61SpineCall({
      source,
      city: input.city,
      country: input.country,
      dates,
      provider: input.provider,
      apiKey: input.apiKey,
      model: input.model,
      reasoningEffort: input.reasoningEffort,
    }));
  }
  const searches = results.reduce((total, result) => total + result.telemetry.searchesUsed, 0);
  if (searches > V61_SEARCHES_PER_CITY_MAX) {
    throw new V61CollectionError(`The v6.1 production search budget exceeded ${V61_SEARCHES_PER_CITY_MAX} searches for this city.`, 502);
  }
  return {
    anchors: Object.assign({}, ...results.map((result) => result.anchors)),
    facts: results.flatMap((result) => result.facts),
    rawResponses: Object.fromEntries(
      results.map((result) => [result.telemetry.source, result.rawResponse])
    ) as Record<V61SpineSource, unknown>,
    providerRawResponses: Object.fromEntries(
      results.map((result) => [result.telemetry.source, result.providerRawResponse]).filter(([, value]) => value !== null && value !== undefined)
    ) as Partial<Record<V61SpineSource, unknown>>,
    telemetry: results.map((result) => result.telemetry),
    llmCalls: results.reduce((total, result) => total + result.telemetry.attempts, 0),
    searches,
    promptVersions: results.map((result) => result.telemetry.promptVersion),
  };
}
