import {
  parseV61SpineResponse,
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
}

export interface V61CanaryEvaluation {
  passed: boolean;
  completeCities: number;
  artifactCandidates: number;
  artifactFraction: number;
  cities: V61CanaryCityEvaluation[];
  problems: string[];
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
        if (parsed.city !== record.city || parsed.country !== record.country) {
          problems.push(`${source} response city/country changed`);
        }
        parsedResponses[source] = parsed;
      } catch (error) {
        problems.push(`${source} response failed schema/limit validation: ${error instanceof Error ? error.message : String(error)}`);
      }
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
    const schemaValid = V61_SPINE_SOURCES.every((source) => parsedResponses[source] !== undefined);
    const sourceComplete = V61_SPINE_SOURCES.every((source) => parsedResponses[source]?.retrievalStatus === 'complete');
    if (!sourceComplete) problems.push('one or more source responses are not complete');
    const materializationComplete = Boolean(record.materialization?.complete && Object.keys(record.materialization.tiersAud).length === 19);
    const provenanceRoundTrip = provenanceProblems.length === 0;
    const artifactCandidate = isAllPrior(record.materialization);
    const complete = problems.length === 0 && schemaValid && sourceComplete && materializationComplete && provenanceRoundTrip;

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
    };
  });

  const completeCities = cities.filter((city) => city.complete).length;
  const artifactCandidates = cities.filter((city) => city.artifactCandidate).length;
  const artifactFraction = records.length === 0 ? 1 : artifactCandidates / records.length;
  const problems = cities.flatMap((city) => city.problems.map((problem) => `${city.city}: ${problem}`));
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
  };
}
