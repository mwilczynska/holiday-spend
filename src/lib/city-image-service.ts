import fs from 'fs';
import path from 'path';
import { eq, inArray } from 'drizzle-orm';
import { db, dataDirectory } from '@/db';
import { cities, cityImages } from '@/db/schema';
import { findKnownCountryMetadata } from './country-metadata';
import { getStoredCityClimates } from './city-climate-service';
import { geocodingUrl, resolveClimateLocation } from './climate-provider';
import { CITY_IMAGE_USER_AGENT, lookupCityImage, type CityImage } from './city-image-lookup';
import type { CityImageView } from './city-image-view';

/**
 * Collects one free photo per city (see city-image-lookup.ts) and stores it next to the database,
 * so pages serve local files and never call Wikimedia while rendering.
 *
 * Collected once, like climate: a new city fetches after it is saved, a batch script fills the
 * library, and results (including misses) are kept until the city's name or country changes or a
 * refresh is requested. Failure never blocks saving a city; pages fall back to the drawn scene.
 */

export const CITY_IMAGE_VERSION = 'wikimedia_commons_v1';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// Commons returns thumbnails from either host; nothing else is downloaded.
const MEDIA_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export type CityImageStatus = 'ok' | 'no-location' | 'no-article' | 'no-free-image' | 'error';
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
type CityIdentity = { cityId: string; cityName: string; countryCode: string; countryName: string };
type CityImageRow = typeof cityImages.$inferSelect;

export type { CityImageView } from './city-image-view';

export function cityImageDirectory() {
  return path.join(dataDirectory, 'city-images');
}

/** City ids are slugs; anything else is encoded so it can never escape the image directory. */
function fileStem(cityId: string) {
  return /^[a-z0-9][a-z0-9-]*$/.test(cityId) ? cityId : `city-${Buffer.from(cityId).toString('hex')}`;
}

export function cityImageFilePath(fileName: string) {
  const resolved = path.resolve(cityImageDirectory(), fileName);
  if (path.dirname(resolved) !== path.resolve(cityImageDirectory())) throw new Error('Invalid city image path.');
  return resolved;
}

function identityFor(cityId: string): CityIdentity | null {
  const city = db.select({ id: cities.id, name: cities.name, countryId: cities.countryId }).from(cities).where(eq(cities.id, cityId)).get();
  if (!city) return null;
  const country = findKnownCountryMetadata(city.countryId);
  if (!country) return null;
  return { cityId: city.id, cityName: city.name, countryCode: country.iso2, countryName: country.name };
}

function rowMatches(row: CityImageRow, identity: CityIdentity) {
  return row.cityName === identity.cityName && row.countryCode === identity.countryCode && row.version === CITY_IMAGE_VERSION;
}

function parseImage(dataJson: string | null): CityImage | null {
  if (!dataJson) return null;
  try {
    const value = JSON.parse(dataJson) as CityImage;
    return typeof value?.commonsFile === 'string' && typeof value?.license === 'string' ? value : null;
  } catch {
    return null;
  }
}

function toView(row: CityImageRow): CityImageView | null {
  const image = parseImage(row.dataJson);
  if (row.status !== 'ok' || !image || !row.largeFile || !row.smallFile) return null;
  // A database copied without its image folder must fall back to the drawn scene, not a broken image.
  if (!fs.existsSync(cityImageFilePath(row.largeFile)) || !fs.existsSync(cityImageFilePath(row.smallFile))) return null;
  // The fetch time versions the URL, so browsers can cache each file indefinitely.
  const version = encodeURIComponent(row.fetchedAt ?? row.lastAttemptAt);
  const base = `/city-images/${encodeURIComponent(row.cityId)}?v=${version}`;
  return {
    cityId: row.cityId,
    src: base,
    smallSrc: `${base}&size=small`,
    articleTitle: image.articleTitle,
    artist: image.artist || 'Unknown author',
    license: image.license,
    licenseUrl: image.licenseUrl,
    descriptionUrl: image.descriptionUrl,
  };
}

/** Read stored photos for a set of cities. No network; rows for renamed cities are ignored. */
export function getCityImageViews(cityIds: readonly string[]): Record<string, CityImageView> {
  const ids = Array.from(new Set(cityIds.filter(Boolean)));
  if (!ids.length) return {};
  try {
    return readCityImageViews(ids);
  } catch (error) {
    // Photos are decorative: a read problem shows drawn scenes instead of failing the page.
    console.warn('[city-image] Could not read stored photos: ' + (error instanceof Error ? error.message : 'unknown error'));
    return {};
  }
}

function readCityImageViews(ids: string[]): Record<string, CityImageView> {
  const rows = db.select({ image: cityImages, currentName: cities.name, countryId: cities.countryId })
    .from(cityImages)
    .innerJoin(cities, eq(cityImages.cityId, cities.id))
    .where(inArray(cityImages.cityId, ids))
    .all();
  const result: Record<string, CityImageView> = {};
  for (const { image, currentName, countryId } of rows) {
    const country = findKnownCountryMetadata(countryId);
    if (!country || image.cityName !== currentName || image.countryCode !== country.iso2 || image.version !== CITY_IMAGE_VERSION) continue;
    const view = toView(image);
    if (view) result[image.cityId] = view;
  }
  return result;
}

export function getCityImageRow(cityId: string) {
  return db.select().from(cityImages).where(eq(cityImages.cityId, cityId)).get();
}

async function cityCoordinates(identity: CityIdentity, fetchImpl: Fetch) {
  const climate = (await getStoredCityClimates([identity.cityId]))[identity.cityId];
  if (climate?.location) return { latitude: climate.location.latitude, longitude: climate.location.longitude };
  // No saved climate yet (or its collection failed): geocode exactly as climate collection does.
  const response = await fetchImpl(geocodingUrl(identity.cityName, identity.countryCode).toString(), { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Geocoding failed (HTTP ${response.status}).`);
  const location = resolveClimateLocation(await response.json(), identity.cityName, identity.countryCode);
  return { latitude: location.latitude, longitude: location.longitude };
}

async function download(url: string, fetchImpl: Fetch) {
  const host = new URL(url).host;
  if (!MEDIA_HOSTS.has(host)) throw new Error(`Unexpected image host ${host}.`);
  const response = await fetchImpl(url, { headers: { 'User-Agent': CITY_IMAGE_USER_AGENT }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Image download failed (HTTP ${response.status}).`);
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const extension = IMAGE_TYPES[type];
  if (!extension) throw new Error(`Unsupported image type ${type || 'unknown'}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw new Error(`Image size ${bytes.length} bytes is out of range.`);
  return { bytes, extension };
}

function writeAtomically(fileName: string, bytes: Buffer) {
  const target = cityImageFilePath(fileName);
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, target);
}

function removeFile(fileName: string | null | undefined, keep: Array<string | null>) {
  if (!fileName || keep.includes(fileName)) return;
  try { fs.unlinkSync(cityImageFilePath(fileName)); } catch { /* already gone */ }
}

/** Write only if the city still has the name and country the lookup used. */
function persistIfCurrent(identity: CityIdentity, row: typeof cityImages.$inferInsert) {
  const current = identityFor(identity.cityId);
  if (!current || current.cityName !== identity.cityName || current.countryCode !== identity.countryCode) return false;
  db.insert(cityImages).values(row).onConflictDoUpdate({
    target: cityImages.cityId,
    set: {
      cityName: row.cityName, countryCode: row.countryCode, status: row.status, dataJson: row.dataJson,
      largeFile: row.largeFile, smallFile: row.smallFile, fetchedAt: row.fetchedAt,
      lastAttemptAt: row.lastAttemptAt, lastError: row.lastError, version: row.version,
    },
  }).run();
  return true;
}

/** After a city is deleted (its row cascades), remove the files the row pointed to. */
export function removeCityImageFiles(row: Pick<CityImageRow, 'largeFile' | 'smallFile'> | undefined) {
  removeFile(row?.largeFile, []);
  removeFile(row?.smallFile, []);
}

const pending = new Map<string, Promise<CityImageStatus | null>>();

export interface EnsureCityImageOptions {
  /** Look again even when a current result (including a recorded miss) exists. */
  refresh?: boolean;
  /** Retry rows whose last attempt failed for a transient reason (network, HTTP). */
  retryErrors?: boolean;
  /** Retry recorded misses too, e.g. after the matching rules change. */
  retryMisses?: boolean;
  fetchImpl?: Fetch;
}

/**
 * Return the city's stored image status, collecting it once when there is no current result.
 * Returns null when the city no longer exists or its country is unknown.
 */
export async function ensureCityImage(cityId: string, options: EnsureCityImageOptions = {}): Promise<CityImageStatus | null> {
  const identity = identityFor(cityId);
  if (!identity) return null;
  const key = JSON.stringify([identity.cityId, identity.cityName, identity.countryCode]);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const operation = (async (): Promise<CityImageStatus | null> => {
    const existing = getCityImageRow(cityId);
    const current = existing && rowMatches(existing, identity) ? existing : null;
    const retry = (options.retryErrors && current?.status === 'error') || (options.retryMisses && current?.status !== 'ok');
    if (current && !options.refresh && !retry) {
      return current.status as CityImageStatus;
    }

    const fetchImpl = options.fetchImpl ?? fetch;
    const attemptedAt = new Date().toISOString();
    const base = { cityId, cityName: identity.cityName, countryCode: identity.countryCode, lastAttemptAt: attemptedAt, version: CITY_IMAGE_VERSION };
    // A refresh that fails for a transient reason keeps the previous photo. A deterministic miss
    // means the current rules no longer accept that photo for this city, so it is dropped.
    const recordFailure = (status: CityImageStatus, message: string | null) => {
      const keepPrevious = status === 'error' && current?.status === 'ok' ? current : null;
      const persisted = persistIfCurrent(identity, keepPrevious
        ? { ...base, status: 'ok', dataJson: keepPrevious.dataJson, largeFile: keepPrevious.largeFile, smallFile: keepPrevious.smallFile, fetchedAt: keepPrevious.fetchedAt, lastError: message ?? status }
        : { ...base, status, dataJson: null, largeFile: null, smallFile: null, fetchedAt: null, lastError: message });
      if (persisted && !keepPrevious) {
        removeFile(existing?.largeFile, []);
        removeFile(existing?.smallFile, []);
      }
      return keepPrevious ? 'ok' : status;
    };

    // Coordinates allow a distance check. A place the geocoder cannot pin down (an island, a region,
    // an ambiguous name) is matched by its Wikidata country instead. Network failures are errors.
    let coordinates: { latitude: number; longitude: number } | null = null;
    let geocodeMiss: string | null = null;
    try {
      coordinates = await cityCoordinates(identity, fetchImpl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Geocoding failed.';
      if (!/ambiguous|No matching/i.test(message)) return recordFailure('error', message.slice(0, 500));
      geocodeMiss = message;
    }

    try {
      const result = await lookupCityImage({
        name: identity.cityName, countryName: identity.countryName, countryCode: identity.countryCode, ...coordinates,
      }, fetchImpl);
      if (result.status !== 'ok') {
        const detail = [geocodeMiss, result.articleTitle ? `Article: ${result.articleTitle}` : null].filter(Boolean).join(' ');
        return recordFailure(geocodeMiss && result.status === 'no-article' ? 'no-location' : result.status, detail || null);
      }

      const [large, small] = [await download(result.image.thumbUrl, fetchImpl), await download(result.image.smallThumbUrl, fetchImpl)];
      fs.mkdirSync(cityImageDirectory(), { recursive: true });
      // Versioned names: a write that loses a race never touches the files the stored row uses.
      const stem = `${fileStem(cityId)}-${Date.now().toString(36)}`;
      const largeFile = `${stem}.${large.extension}`;
      const smallFile = `${stem}-small.${small.extension}`;
      writeAtomically(largeFile, large.bytes);
      writeAtomically(smallFile, small.bytes);
      const persisted = persistIfCurrent(identity, {
        ...base, status: 'ok', dataJson: JSON.stringify(result.image), largeFile, smallFile,
        fetchedAt: new Date().toISOString(), lastError: null,
      });
      if (!persisted) {
        removeFile(largeFile, []);
        removeFile(smallFile, []);
        return null;
      }
      removeFile(existing?.largeFile, [largeFile, smallFile]);
      removeFile(existing?.smallFile, [largeFile, smallFile]);
      return 'ok';
    } catch (error) {
      return recordFailure('error', (error instanceof Error ? error.message : 'Image collection failed.').slice(0, 500));
    }
  })();

  pending.set(key, operation);
  try {
    return await operation;
  } finally {
    pending.delete(key);
  }
}

/** For city creation paths: collect the photo, log the outcome, and never throw. */
export async function collectCityImageQuietly(cityId: string, options: EnsureCityImageOptions = {}) {
  try {
    const status = await ensureCityImage(cityId, options);
    if (status && status !== 'ok') console.warn(`[city-image] No photo for ${cityId}: ${status}.`);
    return status;
  } catch (error) {
    console.warn(`[city-image] Photo collection failed for ${cityId}: ${error instanceof Error ? error.message : 'unknown error'}`);
    return null;
  }
}
