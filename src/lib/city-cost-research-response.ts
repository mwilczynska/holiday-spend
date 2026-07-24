import { z } from 'zod';
import {
  cityCostObservationSchema,
  type CityCostObservation,
} from './city-cost-observation';
import {
  cityCostCollectionCategorySchema,
  cityCostRegionSchema,
} from './city-cost-collection-batch';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export const RESEARCH_MEASURES_BY_CATEGORY = {
  food_drinks: [
    'inexpensive_restaurant_meal_1p',
    'midrange_restaurant_meal_2p',
    'cappuccino_1',
    'domestic_draft_beer_1',
    'cocktail_1',
    'wine_glass_1',
  ],
  accommodation: [
    'hostel_dorm_bed_1p',
    'hostel_private_room_2p',
    'hotel_1star_room_2p',
    'hotel_2star_room_2p',
    'hotel_3star_room_2p',
    'hotel_4star_room_2p',
  ],
  activities: [
    'paid_attraction_adult_1',
    'half_day_group_activity_adult_1',
    'full_day_premium_activity_adult_1',
  ],
} as const;

export const cityCostResearchAssignmentSchema = z.object({
  schemaVersion: z.literal('city-cost-research-assignment-v1'),
  city: z.string().min(1),
  country: z.string().min(1),
  region: cityCostRegionSchema,
  category: cityCostCollectionCategorySchema,
  batchId: z.string().min(1),
  referenceDate: z.string().regex(isoDate),
  pricingWindow: z.string().min(1),
  context: z.string().default('None.'),
});

const cityCostResearchCallSchema = z.object({
  city: z.string().min(1),
  country: z.string().min(1),
  region: cityCostRegionSchema,
  category: cityCostCollectionCategorySchema,
  batchId: z.string().min(1),
  status: z.enum(['complete', 'partial', 'no_public_evidence']),
});

const missingEvidenceSchema = z.object({
  measure: z.string().min(1),
  reason: z.string().min(1),
  attemptedUrls: z.array(z.string().url()).default([]),
});

export const cityCostResearchResponseSchema = z.object({
  call: cityCostResearchCallSchema,
  observations: z.array(cityCostObservationSchema),
  missing: z.array(missingEvidenceSchema),
});

export type CityCostResearchAssignment = z.infer<
  typeof cityCostResearchAssignmentSchema
>;
export type CityCostResearchResponse = z.infer<
  typeof cityCostResearchResponseSchema
>;

export class CityCostResearchResponseError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join('\n'));
    this.name = 'CityCostResearchResponseError';
  }
}

function formatZodIssues(error: z.ZodError) {
  return error.issues.map(
    (issue) => `${issue.path.join('.') || 'response'}: ${issue.message}`
  );
}

export function extractCityCostResearchJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```$/i.exec(trimmed);
  const jsonText = fenced?.[1].trim() ?? trimmed;

  if (!jsonText.startsWith('{') || !jsonText.endsWith('}')) {
    throw new CityCostResearchResponseError([
      'response: expected one raw JSON object or one JSON code fence with no surrounding commentary',
    ]);
  }

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new CityCostResearchResponseError([
      `response: invalid JSON (${error instanceof Error ? error.message : 'unknown error'})`,
    ]);
  }
}

function validateCallAssignment(
  response: CityCostResearchResponse,
  assignment: CityCostResearchAssignment,
  issues: string[]
) {
  for (const field of [
    'city',
    'country',
    'region',
    'category',
    'batchId',
  ] as const) {
    if (response.call[field] !== assignment[field]) {
      issues.push(
        `call.${field}: expected ${assignment[field]}, received ${response.call[field]}`
      );
    }
  }
}

function validateObservations(
  observations: CityCostObservation[],
  assignment: CityCostResearchAssignment,
  allowedMeasures: Set<string>,
  issues: string[]
) {
  const ids = new Set<string>();

  observations.forEach((observation, index) => {
    const prefix = `observations.${index}`;
    if (ids.has(observation.observationId)) {
      issues.push(`${prefix}.observationId: duplicate ${observation.observationId}`);
    }
    ids.add(observation.observationId);

    for (const field of ['city', 'country', 'region'] as const) {
      if (observation[field] !== assignment[field]) {
        issues.push(
          `${prefix}.${field}: expected ${assignment[field]}, received ${observation[field]}`
        );
      }
    }
    if (observation.batchId !== assignment.batchId) {
      issues.push(
        `${prefix}.batchId: expected ${assignment.batchId}, received ${observation.batchId}`
      );
    }
    if (!allowedMeasures.has(observation.measure)) {
      issues.push(
        `${prefix}.measure: ${observation.measure} is outside the ${assignment.category} assignment`
      );
    }
    if (observation.valueStatus !== 'direct') {
      issues.push(`${prefix}.valueStatus: research responses must be direct evidence`);
    }
    if (observation.extractionMethod !== 'browser_research') {
      issues.push(
        `${prefix}.extractionMethod: research responses must use browser_research`
      );
    }
    if (observation.reviewerStatus !== 'unreviewed') {
      issues.push(
        `${prefix}.reviewerStatus: runner output must remain unreviewed until a separate review step`
      );
    }
  });
}

function validateCoverage(
  response: CityCostResearchResponse,
  requestedMeasures: readonly string[],
  issues: string[]
) {
  const requested = new Set<string>(requestedMeasures);
  const observed = new Set<string>(
    response.observations.map((observation) => observation.measure)
  );
  const missing = new Set<string>();

  response.missing.forEach((entry, index) => {
    if (!requested.has(entry.measure)) {
      issues.push(
        `missing.${index}.measure: ${entry.measure} is outside the assigned category`
      );
    }
    if (missing.has(entry.measure)) {
      issues.push(`missing.${index}.measure: duplicate ${entry.measure}`);
    }
    if (observed.has(entry.measure)) {
      issues.push(
        `missing.${index}.measure: ${entry.measure} cannot be both observed and missing`
      );
    }
    missing.add(entry.measure);
  });

  for (const measure of requestedMeasures) {
    if (!observed.has(measure) && !missing.has(measure)) {
      issues.push(`coverage: ${measure} must be observed or explicitly missing`);
    }
  }

  if (response.call.status === 'complete' && missing.size > 0) {
    issues.push('call.status: complete responses cannot contain missing measures');
  }
  if (
    response.call.status === 'partial' &&
    (response.observations.length === 0 || missing.size === 0)
  ) {
    issues.push(
      'call.status: partial responses require at least one observation and one missing measure'
    );
  }
  if (
    response.call.status === 'no_public_evidence' &&
    (response.observations.length > 0 || missing.size !== requested.size)
  ) {
    issues.push(
      'call.status: no_public_evidence requires zero observations and every requested measure marked missing'
    );
  }
}

export function parseCityCostResearchResponse(
  text: string,
  assignmentInput: unknown
): CityCostResearchResponse {
  const assignmentResult = cityCostResearchAssignmentSchema.safeParse(assignmentInput);
  if (!assignmentResult.success) {
    throw new CityCostResearchResponseError(
      formatZodIssues(assignmentResult.error).map((issue) => `assignment.${issue}`)
    );
  }

  const responseResult = cityCostResearchResponseSchema.safeParse(
    extractCityCostResearchJson(text)
  );
  if (!responseResult.success) {
    throw new CityCostResearchResponseError(formatZodIssues(responseResult.error));
  }

  const assignment = assignmentResult.data;
  const response = responseResult.data;
  const requestedMeasures = RESEARCH_MEASURES_BY_CATEGORY[assignment.category];
  const allowedMeasures = new Set<string>(requestedMeasures);
  const issues: string[] = [];

  validateCallAssignment(response, assignment, issues);
  validateObservations(response.observations, assignment, allowedMeasures, issues);
  validateCoverage(response, requestedMeasures, issues);

  if (issues.length) {
    throw new CityCostResearchResponseError(issues);
  }
  return response;
}

export function renderCityCostResearchPrompt(
  template: string,
  assignmentInput: unknown
) {
  const assignment = cityCostResearchAssignmentSchema.parse(assignmentInput);
  const replacements: Record<string, string> = {
    city: assignment.city,
    country: assignment.country,
    region: assignment.region,
    category: assignment.category,
    batch_id: assignment.batchId,
    reference_date: assignment.referenceDate,
    pricing_window: assignment.pricingWindow,
    context: assignment.context,
  };

  const rendered = Object.entries(replacements).reduce(
    (prompt, [key, value]) => prompt.replaceAll(`{{${key}}}`, value),
    template
  );
  const unresolved = rendered.match(/{{[a-z_]+}}/g);
  if (unresolved) {
    throw new CityCostResearchResponseError([
      `prompt: unresolved template variables ${Array.from(new Set(unresolved)).join(', ')}`,
    ]);
  }
  return rendered;
}
