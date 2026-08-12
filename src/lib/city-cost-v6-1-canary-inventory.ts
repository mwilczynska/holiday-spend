import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  normalizeV61DiskTelemetry,
  parseV61SpineResponse,
  sourceIdentityMatches,
  V61_SOURCE_CONFIG,
  V61_SPINE_SOURCES,
  type V61DiskTelemetry,
  type V61SpineResponse,
  type V61SpineSource,
} from './city-cost-v6-1-collection';

export interface V61InventoryLimits {
  sourceCallsPerCity: number;
  maxSearchesBySource: Record<V61SpineSource, number>;
  maxSearchesPerCity: number;
  directPageReadsPerCity: number;
  maxRetriesPerCall: number;
}

export interface V61InventoryCity {
  city: string;
  country: string;
}

export interface V61InventoryRegistration {
  experiment: string;
  cities: V61InventoryCity[];
  limits: V61InventoryLimits;
  prompts?: Record<string, { file: string; sha256: string }>;
  referenceWindow?: { arrival: string; departure: string; referenceDate: string };
}

export interface V61CallSlotInput {
  city: V61InventoryCity;
  source: V61SpineSource;
  rawPresent: boolean;
  telemetryPresent: boolean;
  raw?: unknown;
  telemetry?: unknown;
  maxRetriesPerCall?: number;
  directPageReadsPerCity?: number;
}

export interface V61CallSlotInventory {
  city: string;
  country: string;
  source: V61SpineSource;
  rawPresent: boolean;
  telemetryPresent: boolean;
  rawHash?: string;
  telemetryHash?: string;
  rawValid: boolean;
  telemetryValid: boolean;
  identityValid: boolean;
  limitsValid: boolean;
  terminal: boolean;
  reusable: boolean;
  invalid: boolean;
  orphan: 'none' | 'raw' | 'telemetry';
  actualProviderCall: boolean;
  providerAttempts: number;
  searchesUsed: number;
  retries: number;
  directPageReads: number;
  status: string;
  errors: string[];
  providerError: string | null;
}

export interface V61ExperimentInventory {
  experiment: string;
  registeredCallSlots: number;
  pendingCallSlots: number;
  terminalCallSlots: number;
  reusableCallSlots: number;
  invalidCallSlots: number;
  rawResponsesPresent: number;
  telemetryRecordsPresent: number;
  orphanRawResponses: number;
  orphanTelemetryRecords: number;
  actualProviderCalls: number;
  sourceCallRecords: number;
  assignmentAttempts: number | null;
  assignmentAttemptsRecorded: boolean;
  retries: number;
  searches: number;
  directPageReads: number;
  citiesWithTerminalFrame: number;
  citiesWithReusableFrame: number;
  slots: V61CallSlotInventory[];
  bySource: Record<V61SpineSource, {
    registered: number;
    pending: number;
    terminal: number;
    reusable: number;
    invalid: number;
    rawPresent: number;
    telemetryPresent: number;
  }>;
}

function hashJson(value: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function telemetryCandidate(value: unknown): V61DiskTelemetry {
  return (value && typeof value === 'object' && !Array.isArray(value))
    ? value as V61DiskTelemetry
    : {};
}

function isExplicitTerminalError(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const telemetry = value as Record<string, unknown>;
  return telemetry.status === 'error' && typeof telemetry.error === 'string' && telemetry.error.trim().length > 0;
}

export function inspectV61CallSlot(input: V61CallSlotInput): V61CallSlotInventory {
  const errors: string[] = [];
  let parsed: V61SpineResponse | undefined;
  let normalizedTelemetry: ReturnType<typeof normalizeV61DiskTelemetry> | undefined;
  let rawValid = false;
  let telemetryValid = false;
  let identityValid = false;
  let limitsValid = false;

  if (input.rawPresent) {
    try {
      parsed = parseV61SpineResponse(input.source, input.raw);
      rawValid = true;
      identityValid = sourceIdentityMatches(parsed, input.city);
      if (!identityValid) errors.push('response city/country does not match the registered call');
    } catch (error) {
      errors.push(`raw response: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    errors.push('raw response file is missing');
  }

  if (input.telemetryPresent) {
    try {
      const telemetry = telemetryCandidate(input.telemetry);
      const telemetryResponse = parsed ?? {
        schemaVersion: 'city-cost-v6-1-spine-response-v1',
        source: input.source,
        city: input.city.city,
        country: input.city.country,
        retrievalStatus: 'blocked',
        searchesUsed: 0,
        directPageReads: 0,
        notes: 'Inventory-only telemetry validation placeholder; no source value is synthesized.',
        measures: {},
      } as V61SpineResponse;
      normalizedTelemetry = normalizeV61DiskTelemetry(input.source, telemetryResponse, telemetry);
      telemetryValid = true;
      if (normalizedTelemetry.promptVersion !== V61_SOURCE_CONFIG[input.source].promptFile) {
        errors.push(`telemetry promptVersion ${normalizedTelemetry.promptVersion} does not match ${V61_SOURCE_CONFIG[input.source].promptFile}`);
        telemetryValid = false;
      }
    } catch (error) {
      errors.push(`telemetry: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    errors.push('telemetry file is missing');
  }

  const telemetry = normalizedTelemetry;
  const searchesUsed = telemetry?.searchesUsed ?? parsed?.searchesUsed ?? 0;
  const retries = telemetry?.retries ?? 0;
  const directPageReads = telemetry?.directPageReads ?? parsed?.directPageReads ?? 0;
  if (searchesUsed > V61_SOURCE_CONFIG[input.source].maxSearches) errors.push('source search ceiling exceeded');
  if (directPageReads !== 0) errors.push('direct page read recorded');
  if (retries < 0 || retries > (input.maxRetriesPerCall ?? 1)) errors.push('retry ceiling exceeded');
  limitsValid = searchesUsed <= V61_SOURCE_CONFIG[input.source].maxSearches
    && directPageReads === 0
    && retries >= 0
    && retries <= (input.maxRetriesPerCall ?? 1)
    && directPageReads <= (input.directPageReadsPerCity ?? 0);

  const terminal = (input.rawPresent && input.telemetryPresent) || isExplicitTerminalError(input.telemetry);
  const orphan = input.rawPresent && !input.telemetryPresent
    ? 'raw'
    : !input.rawPresent && input.telemetryPresent
      ? 'telemetry'
      : 'none';
  const terminalProviderError = isExplicitTerminalError(input.telemetry);
  const invalid = terminal && !terminalProviderError && (!rawValid || !telemetryValid || !identityValid || !limitsValid);
  const reusable = terminal && input.rawPresent && input.telemetryPresent
    && rawValid && telemetryValid && identityValid && limitsValid;
  const providerError = telemetry?.error ?? null;

  return {
    city: input.city.city,
    country: input.city.country,
    source: input.source,
    rawPresent: input.rawPresent,
    telemetryPresent: input.telemetryPresent,
    rawHash: input.rawPresent ? hashJson(input.raw) : undefined,
    telemetryHash: input.telemetryPresent ? hashJson(input.telemetry) : undefined,
    rawValid,
    telemetryValid,
    identityValid,
    limitsValid,
    terminal,
    reusable,
    invalid,
    orphan,
    actualProviderCall: Boolean(telemetry && telemetry.attempts > 0),
    providerAttempts: Math.max(0, telemetry?.attempts ?? 0),
    searchesUsed,
    retries,
    directPageReads,
    status: parsed?.retrievalStatus ?? telemetry?.status ?? (terminal ? 'error' : 'pending'),
    errors,
    providerError,
  };
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function readOptionalJson(file: string) {
  if (!fs.existsSync(file)) return { present: false, value: undefined };
  try {
    return { present: true, value: JSON.parse(fs.readFileSync(file, 'utf8')) as unknown };
  } catch (error) {
    return { present: true, value: undefined, error: error instanceof Error ? error.message : String(error) };
  }
}

export function inspectV61Experiment(
  registration: V61InventoryRegistration,
  experimentDir: string,
): V61ExperimentInventory {
  const slots: V61CallSlotInventory[] = [];
  const bySource = Object.fromEntries(V61_SPINE_SOURCES.map((source) => [source, {
    registered: 0, pending: 0, terminal: 0, reusable: 0, invalid: 0, rawPresent: 0, telemetryPresent: 0,
  }])) as V61ExperimentInventory['bySource'];
  const expectedRaw = new Set<string>();
  const expectedTelemetry = new Set<string>();

  for (const city of registration.cities) {
    const citySlug = slug(city.city);
    for (const source of V61_SPINE_SOURCES) {
      const key = `${citySlug}/${source}.json`;
      expectedRaw.add(key);
      expectedTelemetry.add(key);
      const raw = readOptionalJson(path.join(experimentDir, 'raw', citySlug, `${source}.json`));
      const telemetry = readOptionalJson(path.join(experimentDir, 'telemetry', citySlug, `${source}.json`));
      const slot = inspectV61CallSlot({
        city,
        source,
        rawPresent: raw.present,
        telemetryPresent: telemetry.present,
        raw: raw.value,
        telemetry: telemetry.value,
        maxRetriesPerCall: registration.limits.maxRetriesPerCall,
        directPageReadsPerCity: registration.limits.directPageReadsPerCity,
      });
      if (raw.error) slot.errors.unshift(`raw response JSON: ${raw.error}`);
      if (telemetry.error) slot.errors.unshift(`telemetry JSON: ${telemetry.error}`);
      if (raw.error || telemetry.error) {
        slot.rawValid = false;
        slot.telemetryValid = false;
        slot.reusable = false;
        slot.invalid = slot.terminal;
      }
      slots.push(slot);
      const counts = bySource[source];
      counts.registered += 1;
      if (!slot.terminal) counts.pending += 1;
      if (slot.terminal) counts.terminal += 1;
      if (slot.reusable) counts.reusable += 1;
      if (slot.invalid) counts.invalid += 1;
      if (slot.rawPresent) counts.rawPresent += 1;
      if (slot.telemetryPresent) counts.telemetryPresent += 1;
    }
  }

  const countOrphans = (directory: string, expected: Set<string>) => {
    if (!fs.existsSync(directory)) return 0;
    let count = 0;
    for (const cityEntry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!cityEntry.isDirectory()) continue;
      const cityDir = path.join(directory, cityEntry.name);
      for (const file of fs.readdirSync(cityDir)) {
        if (file.endsWith('.json') && !expected.has(`${cityEntry.name}/${file}`)) count += 1;
      }
    }
    return count;
  };
  const orphanRawResponses = countOrphans(path.join(experimentDir, 'raw'), expectedRaw);
  const orphanTelemetryRecords = countOrphans(path.join(experimentDir, 'telemetry'), expectedTelemetry);
  const assignmentPath = path.join(experimentDir, 'assignments.json');
  let assignmentAttempts: number | null = null;
  if (fs.existsSync(assignmentPath)) {
    try {
      const assignmentLedger = JSON.parse(fs.readFileSync(assignmentPath, 'utf8')) as { attempts?: unknown; assignments?: unknown[] };
      if (typeof assignmentLedger.attempts === 'number' && Number.isInteger(assignmentLedger.attempts) && assignmentLedger.attempts >= 0) {
        assignmentAttempts = assignmentLedger.attempts;
      } else if (Array.isArray(assignmentLedger.assignments)) {
        assignmentAttempts = assignmentLedger.assignments.length;
      }
    } catch {
      assignmentAttempts = null;
    }
  }
  const terminalCallSlots = slots.filter((slot) => slot.terminal).length;
  const registeredCallSlots = slots.length;
  const reusableCallSlots = slots.filter((slot) => slot.reusable).length;
  const pendingCallSlots = slots.filter((slot) => !slot.terminal).length;
  const byCity = registration.cities.map((city) => slots.filter((slot) => slot.city === city.city));

  return {
    experiment: registration.experiment,
    registeredCallSlots,
    pendingCallSlots,
    terminalCallSlots,
    reusableCallSlots,
    invalidCallSlots: slots.filter((slot) => slot.invalid).length,
    rawResponsesPresent: slots.filter((slot) => slot.rawPresent).length,
    telemetryRecordsPresent: slots.filter((slot) => slot.telemetryPresent).length,
    orphanRawResponses,
    orphanTelemetryRecords,
    actualProviderCalls: slots.reduce((sum, slot) => sum + slot.providerAttempts, 0),
    sourceCallRecords: slots.filter((slot) => slot.telemetryPresent).length,
    assignmentAttempts,
    assignmentAttemptsRecorded: assignmentAttempts !== null,
    retries: slots.reduce((sum, slot) => sum + slot.retries, 0),
    searches: slots.reduce((sum, slot) => sum + slot.searchesUsed, 0),
    directPageReads: slots.reduce((sum, slot) => sum + slot.directPageReads, 0),
    citiesWithTerminalFrame: byCity.filter((citySlots) => citySlots.every((slot) => slot.terminal)).length,
    citiesWithReusableFrame: byCity.filter((citySlots) => citySlots.every((slot) => slot.reusable)).length,
    slots,
    bySource,
  };
}
