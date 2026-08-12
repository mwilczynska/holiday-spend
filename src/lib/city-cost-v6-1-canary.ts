import {
  parseV61SpineResponse,
  sourceIdentityMatches,
  V61_SOURCE_CONFIG,
  V61_SPINE_SOURCES,
  type V61CollectionCallTelemetry,
  type V61SpineResponse,
  type V61SpineSource,
} from './city-cost-v6-1-collection';

export interface V61CanaryWindow {
  arrival: string;
  departure: string;
  referenceDate: string;
}

export interface V61CanaryProvenanceFields {
  methodologyVersion: string;
  evidenceGrades: unknown;
  intervals: unknown;
  anchors: unknown;
  telemetry: unknown;
  missingness: unknown;
  priorBasis: unknown;
  inputSnapshot: unknown;
  sources: unknown;
}

export interface V61CanaryCityRecord {
  city: string;
  country: string;
  window: V61CanaryWindow;
  responses: Partial<Record<V61SpineSource, unknown>>;
  telemetry: V61CollectionCallTelemetry[];
  materialization?: {
    complete: boolean;
    tiersAud: Record<string, unknown>;
  };
  directPageReads?: number;
  searches?: number;
  provenance?: {
    expected: V61CanaryProvenanceFields;
    persisted: V61CanaryProvenanceFields;
    api: V61CanaryProvenanceFields;
  };
  invalidResponses?: Partial<Record<V61SpineSource, string>>;
  collectionError?: string;
}

export interface V61CanaryLimits {
  sourceCallsPerCity: number;
  maxSearchesBySource: Record<V61SpineSource, number>;
  maxSearchesPerCity: number;
  directPageReadsPerCity: number;
  maxRetriesPerCall: number;
}

export interface V61CanaryRegistrationCriteria {
  window: V61CanaryWindow;
  limits: V61CanaryLimits;
  completeCitiesMinimum: number;
  artifactBatchMaximumFraction: number;
}

export interface V61CanaryCityEvaluation {
  city: string;
  complete: boolean;
  schemaValid: boolean;
  sourceCallCount: number;
  searches: number;
  directPageReads: number;
  artifactCandidate: boolean;
  provenanceRoundTrip: boolean;
  problems: string[];
  parsedResponses: Partial<Record<V61SpineSource, V61SpineResponse>>;
  invalidResponses: Partial<Record<V61SpineSource, string>>;
  observedMeasures: number;
  sourceStatuses: Partial<Record<V61SpineSource, V61SpineResponse['retrievalStatus'] | 'error' | 'invalid' | 'missing'>>;
}

export interface V61CanaryArtifactSignature {
  id: string;
  affectedCities: number;
  fraction: number;
  reason: string;
}

export interface V61CanaryEvaluation {
  passed: boolean;
  completeCities: number;
  artifactCandidates: number;
  artifactFraction: number;
  cities: V61CanaryCityEvaluation[];
  problems: string[];
  attemptedCalls: number;
  validResponses: number;
  invalidResponses: number;
  retries: number;
  searches: number;
  directPageReads: number;
  observedMeasureCounts: Record<string, number>;
  sourceStatusCounts: Record<string, Record<string, number>>;
  artifactSignatures: V61CanaryArtifactSignature[];
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isOneNightWindow(window: V61CanaryWindow) {
  const arrival = Date.parse(`${window.arrival}T00:00:00Z`);
  const departure = Date.parse(`${window.departure}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(window.arrival)
    && /^\d{4}-\d{2}-\d{2}$/.test(window.departure)
    && departure - arrival === 86_400_000;
}

function compareProvenance(provenance: V61CanaryCityRecord['provenance']) {
  if (!provenance) return ['persistence/API provenance evidence is missing'];
  const problems: string[] = [];
  const fields: Array<keyof V61CanaryProvenanceFields> = [
    'methodologyVersion',
    'evidenceGrades',
    'intervals',
    'anchors',
    'telemetry',
    'missingness',
    'priorBasis',
    'inputSnapshot',
    'sources',
  ];
  for (const field of fields) {
    if (!sameJson(provenance.expected[field], provenance.persisted[field])) {
      problems.push(`persistence changed ${field}`);
    }
    if (!sameJson(provenance.persisted[field], provenance.api[field])) {
      problems.push(`API parser changed ${field}`);
    }
  }
  return problems;
}

function isAllPrior(materialization: V61CanaryCityRecord['materialization']) {
  if (!materialization) return true;
  const tiers = Object.values(materialization.tiersAud);
  return tiers.length === 0 || tiers.every((tier) => {
    const value = tier as { evidenceBasis?: unknown; evidenceGrade?: unknown };
    return value.evidenceBasis === 'imputed' || value.evidenceGrade === 'D';
  });
}

function containsCanonicalDomesticBeerLabel(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const measures = (raw as { measures?: unknown }).measures;
  if (!measures || typeof measures !== 'object' || Array.isArray(measures)) return false;
  const beer = (measures as Record<string, unknown>).domestic_draft_beer_1;
  if (!beer || typeof beer !== 'object' || Array.isArray(beer)) return false;
  const candidate = beer as Record<string, unknown>;
  if (candidate.status === 'observed') return false;
  const evidence = [candidate.sourceTitle, candidate.evidenceText, candidate.query]
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
  return /Domestic Draft Beer \((?:0\.5 Liter|1 Pint)\)/.test(evidence);
}

export function evaluateV61CanaryBatch(
  registration: V61CanaryRegistrationCriteria,
  records: V61CanaryCityRecord[],
): V61CanaryEvaluation {
  const cities = records.map((record) => {
    const problems: string[] = [];
    const parsedResponses: Partial<Record<V61SpineSource, V61SpineResponse>> = {};
    const expectedSources = new Set(V61_SPINE_SOURCES);
    const responseSources = Object.keys(record.responses);
    const telemetrySources = record.telemetry.map((call) => call.source);
    if (record.collectionError) problems.push(`Stage B collection failed: ${record.collectionError}`);

    if (record.window.arrival !== registration.window.arrival
      || record.window.departure !== registration.window.departure
      || record.window.referenceDate !== registration.window.referenceDate
      || !isOneNightWindow(record.window)) {
      problems.push('reference window drifted from the registered one-night window');
    }

    if (record.telemetry.length !== registration.limits.sourceCallsPerCity) {
      problems.push(`expected exactly ${registration.limits.sourceCallsPerCity} source-call records`);
    }
    for (const source of V61_SPINE_SOURCES) {
      if (!responseSources.includes(source)) problems.push(`missing ${source} response record`);
      if (telemetrySources.filter((value) => value === source).length !== 1) {
        problems.push(`expected exactly one ${source} telemetry record`);
      }
      const raw = record.responses[source];
      if (raw === undefined) continue;
      try {
        const parsed = parseV61SpineResponse(source, raw);
        if (!sourceIdentityMatches(parsed, record)) {
          problems.push(`${source} response city/country changed`);
        }
        parsedResponses[source] = parsed;
      } catch (error) {
        problems.push(`${source} response failed schema/limit validation: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const invalidResponses = record.invalidResponses ?? {};
    for (const [source, error] of Object.entries(invalidResponses)) {
      problems.push(`${source} response failed schema/limit validation: ${error}`);
    }
    for (const source of responseSources) {
      if (!expectedSources.has(source as V61SpineSource)) problems.push(`unexpected source response ${source}`);
    }

    const searches = record.telemetry.reduce((sum, call) => sum + call.searchesUsed, 0);
    const directPageReads = record.telemetry.reduce((sum, call) => sum + call.directPageReads, 0);
    for (const call of record.telemetry) {
      const maxSearches = V61_SOURCE_CONFIG[call.source]?.maxSearches ?? 0;
      const registeredMax = registration.limits.maxSearchesBySource[call.source] ?? maxSearches;
      if (call.searchesUsed > registeredMax) problems.push(`${call.source} exceeded its search ceiling`);
      if (call.directPageReads !== 0) problems.push(`${call.source} recorded a direct page read`);
      if (call.retries > registration.limits.maxRetriesPerCall) problems.push(`${call.source} exceeded retry limit`);
    }
    if (searches > registration.limits.maxSearchesPerCity) problems.push('city exceeded total search ceiling');
    if (directPageReads > registration.limits.directPageReadsPerCity) problems.push('city exceeded direct-page-read ceiling');

    const provenanceProblems = compareProvenance(record.provenance);
    problems.push(...provenanceProblems);
    const schemaValid = V61_SPINE_SOURCES.every((source) => parsedResponses[source] !== undefined)
      && Object.keys(invalidResponses).length === 0;
    const materializationComplete = Boolean(record.materialization?.complete && Object.keys(record.materialization.tiersAud).length === 19);
    const provenanceRoundTrip = provenanceProblems.length === 0;
    const artifactCandidate = isAllPrior(record.materialization);
    // A schema-valid partial source response is an allowed operational result:
    // the materializer may apply an explicit category fallback. Only an
    // all-prior bundle is excluded as source coverage via artifactCandidate.
    const complete = problems.length === 0 && schemaValid && materializationComplete && provenanceRoundTrip && !artifactCandidate;

    return {
      city: record.city,
      complete,
      schemaValid,
      sourceCallCount: record.telemetry.length,
      searches,
      directPageReads,
      artifactCandidate,
      provenanceRoundTrip,
      problems,
      parsedResponses,
      invalidResponses,
      observedMeasures: Object.values(parsedResponses).flatMap((response) => Object.values(response.measures)).filter((measure) => measure.status === 'observed').length,
      sourceStatuses: Object.fromEntries(V61_SPINE_SOURCES.map((source) => [
        source,
        parsedResponses[source]?.retrievalStatus
          ?? (invalidResponses[source] ? 'invalid' : record.telemetry.find((call) => call.source === source)?.status ?? 'missing'),
      ])),
    };
  });

  const completeCities = cities.filter((city) => city.complete).length;
  const artifactCandidates = cities.filter((city) => city.artifactCandidate).length;
  const artifactFraction = records.length === 0 ? 1 : artifactCandidates / records.length;
  const problems = cities.flatMap((city) => city.problems.map((problem) => `${city.city}: ${problem}`));
  const observedMeasureCounts: Record<string, number> = {};
  for (const city of cities) {
    for (const response of Object.values(city.parsedResponses)) {
      for (const [measure, value] of Object.entries(response.measures)) {
        if (value.status === 'observed') observedMeasureCounts[measure] = (observedMeasureCounts[measure] ?? 0) + 1;
      }
    }
  }
  const sourceStatusCounts: Record<string, Record<string, number>> = {};
  for (const city of cities) {
    for (const [source, status] of Object.entries(city.sourceStatuses)) {
      const counts = sourceStatusCounts[source] ?? (sourceStatusCounts[source] = {});
      counts[status] = (counts[status] ?? 0) + 1;
    }
  }
  const canonicalBeerLabelRejections = records.filter((record) => containsCanonicalDomesticBeerLabel(record.responses.numbeo_drinks)).length;
  const artifactSignatures: V61CanaryArtifactSignature[] = [];
  if (records.length > 0 && canonicalBeerLabelRejections / records.length > registration.artifactBatchMaximumFraction) {
    const fraction = canonicalBeerLabelRejections / records.length;
    const signature = {
      id: 'numbeo_domestic_draft_beer_canonical_label_rejected',
      affectedCities: canonicalBeerLabelRejections,
      fraction,
      reason: `The canonical Domestic Draft Beer (0.5 Liter)/(1 Pint) label was present but was not observed in ${canonicalBeerLabelRejections}/${records.length} Numbeo responses.`,
    } satisfies V61CanaryArtifactSignature;
    artifactSignatures.push(signature);
    problems.push(`artifact signature failed: ${signature.reason} This exceeds the ${(registration.artifactBatchMaximumFraction * 100).toFixed(0)}% batch limit.`);
  }
  if (completeCities < registration.completeCitiesMinimum) {
    problems.push(`complete-city threshold failed: ${completeCities} < ${registration.completeCitiesMinimum}`);
  }
  if (artifactFraction > registration.artifactBatchMaximumFraction) {
    problems.push(`artifact-candidate threshold failed: ${artifactCandidates}/${records.length} > ${registration.artifactBatchMaximumFraction}`);
  }

  return {
    passed: problems.length === 0,
    completeCities,
    artifactCandidates,
    artifactFraction,
    cities,
    problems,
    attemptedCalls: records.reduce((sum, record) => sum + record.telemetry.length, 0),
    validResponses: cities.reduce((sum, city) => sum + Object.keys(city.parsedResponses).length, 0),
    invalidResponses: cities.reduce((sum, city) => sum + Object.keys(city.invalidResponses).length, 0),
    retries: records.reduce((sum, record) => sum + record.telemetry.reduce((calls, call) => calls + call.retries, 0), 0),
    searches: records.reduce((sum, record) => sum + record.telemetry.reduce((calls, call) => calls + call.searchesUsed, 0), 0),
    directPageReads: records.reduce((sum, record) => sum + record.telemetry.reduce((calls, call) => calls + call.directPageReads, 0), 0),
    observedMeasureCounts,
    sourceStatusCounts,
    artifactSignatures,
  };
}
