import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { cities, cityClimate } from '@/db/schema';
import { findKnownCountryMetadata } from './country-metadata';
import { CLIMATE_END_YEAR, CLIMATE_START_YEAR, type CityClimate } from './climate';
import { fetchCityClimate } from './climate-provider';

export const CITY_CLIMATE_DATA_VERSION = 'era5_seamless_2021_2025_v1';

export type CityClimateWithRefreshMetadata = CityClimate & {
  collectedAt?: string;
  refreshFailedAt?: string;
};

export type EnsureCityClimateOptions = {
  refresh?: boolean;
};

type CityClimateRow = typeof cityClimate.$inferSelect;
type CityIdentity = { cityId: string; cityName: string; countryCode: string };

const coordinate = { latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) };
const climateMonthSchema = z.object({
  month: z.number().int().min(1).max(12),
  temperatureC: z.number().finite().min(-90).max(65),
  highC: z.number().finite().min(-90).max(65),
  lowC: z.number().finite().min(-90).max(65),
  rainfallMm: z.number().finite().min(0),
});
const climateDataSchema = z.object({
  cityId: z.string().min(1),
  location: z.object({
    name: z.string().min(1),
    countryCode: z.string().length(2),
    ...coordinate,
    queryName: z.string().min(1).optional(),
    sourceUrl: z.string().url().optional(),
  }),
  period: z.literal(`${CLIMATE_START_YEAR}–${CLIMATE_END_YEAR}`),
  sourceUrl: z.string().url(),
  grid: z.object({ ...coordinate, elevation: z.number().finite(), timezone: z.string().min(1) }),
  months: z.array(climateMonthSchema).length(12),
});

const pendingCollections = new Map<string, Promise<CityClimateWithRefreshMetadata | null>>();
let activeCollections = 0;
const collectionWaiters: Array<() => void> = [];

function now() {
  return new Date().toISOString();
}

function currentIdentity(cityId: string): CityIdentity | null {
  const city = db.select({ id: cities.id, name: cities.name, countryId: cities.countryId })
    .from(cities)
    .where(eq(cities.id, cityId))
    .get();
  if (!city) return null;
  const country = findKnownCountryMetadata(city.countryId);
  if (!country) return null;
  return { cityId: city.id, cityName: city.name, countryCode: country.iso2 };
}

function identityMatches(row: CityClimateRow, identity: CityIdentity) {
  return row.cityId === identity.cityId
    && row.cityName === identity.cityName
    && row.countryCode === identity.countryCode
    && row.version === CITY_CLIMATE_DATA_VERSION;
}

function climateFromJson(dataJson: string | null, identity: CityIdentity): CityClimate | null {
  if (!dataJson) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(dataJson);
  } catch {
    return null;
  }
  const parsed = climateDataSchema.safeParse(raw);
  if (!parsed.success || parsed.data.cityId !== identity.cityId || parsed.data.location.countryCode !== identity.countryCode) return null;
  if (parsed.data.months.some((month, index) => month.month !== index + 1 || month.lowC > month.temperatureC || month.highC < month.temperatureC)) {
    return null;
  }
  return parsed.data as CityClimate;
}

function withPersistenceMetadata(
  climate: CityClimate,
  row: Pick<CityClimateRow, 'collectedAt' | 'lastAttemptAt' | 'lastError'>,
): CityClimateWithRefreshMetadata {
  return {
    ...climate,
    ...(row.collectedAt ? { collectedAt: row.collectedAt } : {}),
    ...(row.lastError && row.lastAttemptAt ? { refreshFailedAt: row.lastAttemptAt } : {}),
  };
}

function findCityClimateRow(cityId: string): CityClimateRow | undefined {
  return db.select().from(cityClimate).where(eq(cityClimate.cityId, cityId)).get();
}

function upsertIfIdentityCurrent(identity: CityIdentity, row: typeof cityClimate.$inferInsert) {
  return db.transaction((tx) => {
    const current = tx.select({ id: cities.id, name: cities.name, countryId: cities.countryId })
      .from(cities)
      .where(eq(cities.id, identity.cityId))
      .get();
    if (!current || current.name !== identity.cityName) return false;
    const country = findKnownCountryMetadata(current.countryId);
    if (!country || country.iso2 !== identity.countryCode) return false;

    tx.insert(cityClimate)
      .values(row)
      .onConflictDoUpdate({
        target: cityClimate.cityId,
        set: {
          cityName: row.cityName,
          countryCode: row.countryCode,
          dataJson: row.dataJson,
          collectedAt: row.collectedAt,
          lastAttemptAt: row.lastAttemptAt,
          lastError: row.lastError,
          version: row.version,
        },
      })
      .run();
    return true;
  });
}

async function withCollectionSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (activeCollections >= 3) await new Promise<void>((resolve) => collectionWaiters.push(resolve));
  else activeCollections += 1;

  try {
    return await operation();
  } finally {
    const next = collectionWaiters.shift();
    if (next) next();
    else activeCollections -= 1;
  }
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Climate provider request failed.';
  return message.slice(0, 500) || 'Climate provider request failed.';
}

/**
 * Read persisted results for a batch of city ids without making provider calls.
 * Missing or stale rows are omitted so the caller can request a one-time collection.
 * A matching recorded first-collection failure is returned as null to avoid retrying
 * it on every page load.
 */
export async function getStoredCityClimates(
  cityIds: readonly string[],
): Promise<Record<string, CityClimateWithRefreshMetadata | null>> {
  const ids = Array.from(new Set(cityIds.filter((cityId) => typeof cityId === 'string' && cityId.length > 0)));
  if (!ids.length) return {};

  const rows = db.select({
    cityId: cityClimate.cityId,
    cityName: cityClimate.cityName,
    countryCode: cityClimate.countryCode,
    dataJson: cityClimate.dataJson,
    collectedAt: cityClimate.collectedAt,
    lastAttemptAt: cityClimate.lastAttemptAt,
    lastError: cityClimate.lastError,
    version: cityClimate.version,
    currentCityName: cities.name,
    countryId: cities.countryId,
  })
    .from(cityClimate)
    .innerJoin(cities, eq(cityClimate.cityId, cities.id))
    .where(inArray(cityClimate.cityId, ids))
    .all();

  const result: Record<string, CityClimateWithRefreshMetadata | null> = {};
  for (const row of rows) {
    const country = findKnownCountryMetadata(row.countryId);
    if (!country) continue;
    const identity: CityIdentity = { cityId: row.cityId, cityName: row.currentCityName, countryCode: country.iso2 };
    if (row.cityName !== identity.cityName || row.countryCode !== identity.countryCode || row.version !== CITY_CLIMATE_DATA_VERSION) {
      continue;
    }

    if (row.dataJson === null) {
      const pendingKey = JSON.stringify([row.cityId, identity.cityName, identity.countryCode]);
      if (row.lastError === null && pendingCollections.has(pendingKey)) continue;
      result[row.cityId] = null;
      continue;
    }

    const climate = climateFromJson(row.dataJson, identity);
    if (climate) result[row.cityId] = withPersistenceMetadata(climate, row);
    // Corrupt JSON is omitted so the caller can ask ensureCityClimate to repair it once.
  }
  return result;
}

/**
 * Return a current stored result or collect it once. Explicit retries pass
 * `{ refresh: true }`; a matching saved failure is otherwise returned as null.
 */
export async function ensureCityClimate(
  cityId: string,
  cityName: string,
  countryCode: string,
  options: EnsureCityClimateOptions = {},
): Promise<CityClimateWithRefreshMetadata | null> {
  const identity = currentIdentity(cityId);
  if (!identity || identity.cityName !== cityName || identity.countryCode !== countryCode) return null;

  const pendingKey = JSON.stringify([cityId, identity.cityName, identity.countryCode]);
  const pending = pendingCollections.get(pendingKey);
  if (pending) return pending;

  const operation = (async () => {
    const existing = findCityClimateRow(cityId);
    if (existing && identityMatches(existing, identity) && !options.refresh) {
      if (existing.dataJson === null) return null;
      const climate = climateFromJson(existing.dataJson, identity);
      if (climate) return withPersistenceMetadata(climate, existing);
    }

    const attemptStartedAt = now();
    const previousClimate = existing && identityMatches(existing, identity)
      ? climateFromJson(existing.dataJson, identity)
      : null;
    const previousDataJson = previousClimate ? existing?.dataJson ?? null : null;
    const previousCollectedAt = previousClimate ? existing?.collectedAt ?? null : null;

    // Persist an attempt marker before network work. If the process exits mid-request,
    // the next ordinary read will not fan out another provider call on every load.
    const attemptRecorded = upsertIfIdentityCurrent(identity, {
      cityId,
      cityName: identity.cityName,
      countryCode: identity.countryCode,
      dataJson: previousDataJson,
      collectedAt: previousCollectedAt,
      lastAttemptAt: attemptStartedAt,
      lastError: null,
      version: CITY_CLIMATE_DATA_VERSION,
    });
    if (!attemptRecorded) return null;

    return withCollectionSlot(async () => {
      try {
        const fetched = await fetchCityClimate(cityId, identity.cityName, identity.countryCode);
        const parsed = climateDataSchema.parse(fetched);
        if (parsed.cityId !== cityId || parsed.location.countryCode !== identity.countryCode || parsed.months.some((month, index) => month.month !== index + 1 || month.lowC > month.temperatureC || month.highC < month.temperatureC)) {
          throw new Error('Climate provider returned data for a different city or invalid monthly values.');
        }

        const collectedAt = now();
        const dataJson = JSON.stringify(parsed);
        const persisted = upsertIfIdentityCurrent(identity, {
          cityId,
          cityName: identity.cityName,
          countryCode: identity.countryCode,
          dataJson,
          collectedAt,
          lastAttemptAt: attemptStartedAt,
          lastError: null,
          version: CITY_CLIMATE_DATA_VERSION,
        });
        if (!persisted) return null;
        return { ...(parsed as CityClimate), collectedAt };
      } catch (error) {
        const message = safeErrorMessage(error);
        const persisted = upsertIfIdentityCurrent(identity, {
          cityId,
          cityName: identity.cityName,
          countryCode: identity.countryCode,
          dataJson: previousDataJson,
          collectedAt: previousCollectedAt,
          lastAttemptAt: attemptStartedAt,
          lastError: message,
          version: CITY_CLIMATE_DATA_VERSION,
        });
        if (!persisted) return null;

        if (!previousClimate) return null;
        return {
          ...(previousClimate as CityClimate),
          ...(previousCollectedAt ? { collectedAt: previousCollectedAt } : {}),
          refreshFailedAt: attemptStartedAt,
        };
      }
    });
  })();

  pendingCollections.set(pendingKey, operation);
  try {
    return await operation;
  } finally {
    if (pendingCollections.get(pendingKey) === operation) pendingCollections.delete(pendingKey);
  }
}
