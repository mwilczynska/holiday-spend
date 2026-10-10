/**
 * Deterministic city photo lookup from Wikipedia / Wikimedia Commons. No API key, no LLM.
 *
 * Runs server-side after a city's coordinates are known (climate collection geocodes every new
 * city), so the article can be verified by distance rather than by name alone:
 *   1. search English Wikipedia for "<place> <country>"; skip disambiguation pages;
 *   2. keep geolocated articles within MAX_DISTANCE_KM of the city, preferring an exact title
 *      match, then a title that starts with the place name, then search order;
 *      without coordinates (the geocoder cannot place islands, regions or some spellings), keep
 *      only a title match or the top search result, and require its Wikidata country (P17) to be
 *      the city's country, found from the ISO code (P297);
 *   3. take the article's lead image, or Wikidata's `image` (P18) when the lead image is missing,
 *      local to Wikipedia (possibly non-free), an SVG, or not freely licensed;
 *   4. accept only Commons files with a free licence, and return the credit data the licence needs.
 *
 * Fails closed: any mismatch returns `{ status: ... }` without an image, never a guess.
 */

export const CITY_IMAGE_USER_AGENT = 'HolidaySpend/1.0 (https://github.com/mwilczynska/holiday-spend; city images)';
export const MAX_DISTANCE_KM = 50;
export const LARGE_WIDTH = 1280;
export const SMALL_WIDTH = 500;
const NON_FREE = /fair use|non-free|copyrighted|all rights reserved/i;

export interface CityImageQuery {
  name: string;
  countryName: string;
  /** ISO 3166-1 alpha-2; used to verify the article's country when there are no coordinates. */
  countryCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface CityImage {
  source: 'article' | 'wikidata';
  articleTitle: string;
  /** How the article was confirmed to be this city. */
  locationCheck: 'coordinates' | 'country';
  distanceKm: number | null;
  commonsFile: string;
  descriptionUrl: string;
  thumbUrl: string;
  /** About 500px wide, for cards; the same file as `thumbUrl`. */
  smallThumbUrl: string;
  width: number;
  height: number;
  license: string;
  licenseUrl: string | null;
  artist: string;
  credit: string;
  attributionRequired: boolean;
}

export type CityImageResult =
  | { status: 'ok'; image: CityImage }
  | { status: 'no-article' | 'no-free-image'; articleTitle?: string };

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** "Bali (Ubud)" -> "ubud", "Hội An" -> "hoi an": compare on the most specific plain-ASCII name. */
export function basePlaceName(name: string) {
  const inner = name.match(/\(([^)]+)\)/)?.[1];
  return (inner ?? name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\([^)]*\)/g, '').toLowerCase().trim();
}

const stripHtml = (value: unknown) => String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function getJson(fetchImpl: Fetch, url: string) {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': CITY_IMAGE_USER_AGENT, 'Api-User-Agent': CITY_IMAGE_USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).host}`);
  return response.json();
}

interface ArticleCandidate {
  title: string; index: number; km: number | null; rank: number; imageName: string | null; wikidataId: string | null;
}

async function searchArticles(query: CityImageQuery, fetchImpl: Fetch): Promise<ArticleCandidate[]> {
  const wanted = basePlaceName(query.name);
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', origin: '*',
    generator: 'search', gsrsearch: `${wanted} ${query.countryName}`, gsrlimit: '8', gsrnamespace: '0',
    // Many city articles mark their infobox coordinates as non-primary, so ask for all of them.
    prop: 'coordinates|pageimages|pageprops', piprop: 'name', ppprop: 'disambiguation|wikibase_item',
    colimit: 'max', coprimary: 'all',
  });
  const data = await getJson(fetchImpl, `https://en.wikipedia.org/w/api.php?${params}`);
  const pages: Array<{
    index: number; title: string; pageimage?: string;
    coordinates?: Array<{ lat: number; lon: number }>;
    pageprops?: Record<string, string>;
  }> = (data?.query?.pages ?? []).slice().sort((a: { index: number }, b: { index: number }) => a.index - b.index);

  const hasPoint = typeof query.latitude === 'number' && typeof query.longitude === 'number';
  const candidates: ArticleCandidate[] = [];
  let wikidataCoordinateLookups = 0;
  for (const page of pages) {
    if (page.pageprops && 'disambiguation' in page.pageprops) continue;
    if (NOT_A_PLACE.test(page.title)) continue;
    const titleBase = basePlaceName(page.title.split(',')[0].replace(/\s*\([^)]*\)/g, ''));
    const rank = rankTitle(titleBase, wanted);
    // Place articles are geolocated; this also excludes lists, people and topics. An article can
    // list several points (Seoul's first is South Korea's centre), so any point near the city
    // counts. An exact title match with no usable point may still have one on its Wikidata item.
    const points = (page.coordinates ?? []).map((point) => ({
      point,
      km: hasPoint ? distanceKm({ lat: query.latitude!, lon: query.longitude! }, point) : null,
    }));
    let nearest = points.find((entry) => entry.km === null)
      ?? points.filter((entry) => entry.km! <= MAX_DISTANCE_KM).sort((a, b) => a.km! - b.km!)[0]
      ?? null;
    if (!nearest && rank === 2 && page.pageprops?.wikibase_item && wikidataCoordinateLookups < 2) {
      wikidataCoordinateLookups += 1;
      const point = await wikidataCoordinate(page.pageprops.wikibase_item, fetchImpl);
      const km = point && hasPoint ? distanceKm({ lat: query.latitude!, lon: query.longitude! }, point) : null;
      if (point && (km === null || km <= MAX_DISTANCE_KM)) nearest = { point, km };
    }
    if (!nearest) continue;
    const km = nearest.km;
    candidates.push({
      title: page.title,
      index: page.index,
      km,
      rank,
      imageName: page.pageimage ?? null,
      wikidataId: page.pageprops?.wikibase_item ?? null,
    });
  }
  return candidates;
}

/** "Sa Pa" and "Sapa", "Nukuʻalofa" and "Nukualofa" compare equal. */
const compact = (value: string) => value.replace(/[^a-z0-9]/g, '');

/** Facilities, buildings and events inside a place are never the place itself. */
const NOT_A_PLACE = new RegExp(
  '\\b(airport|showground|stadium|arena|circuit|station|railway|university|hospital|museum|palace|temple|'
  + 'church|cathedral|basilica|mosque|hotel|resort|festival|fashion week|games|race|crush|disaster|earthquake|'
  + 'bombing|attack|fire|massacre|riots?|protests?|election)\\b|^\\d{4}\\b',
  'i',
);

/** Words that can follow a place name and still name the place, or the area around it. */
const PLACE_SUFFIX = /^(city|town|village|municipality|district|county|province|prefecture|region|state|governorate|island|islands|valley|beach|old town)$/;

/**
 * 2: the title is the place name, ignoring spacing and punctuation ("Sa Pa" = "Sapa").
 * 1: the place name followed by a place word ("Ko Lanta district", "Jeju Province").
 * 0: anything else.
 */
function rankTitle(titleBase: string, wanted: string) {
  if (compact(titleBase) === compact(wanted)) return 2;
  if (titleBase.startsWith(`${wanted} `) && PLACE_SUFFIX.test(titleBase.slice(wanted.length + 1))) return 1;
  return 0;
}

async function wikidataCoordinate(wikidataId: string, fetchImpl: Fetch): Promise<{ lat: number; lon: number } | null> {
  const params = new URLSearchParams({ action: 'wbgetclaims', format: 'json', entity: wikidataId, property: 'P625', origin: '*' });
  const data = await getJson(fetchImpl, `https://www.wikidata.org/w/api.php?${params}`);
  const value = data?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  return typeof value?.latitude === 'number' && typeof value?.longitude === 'number' ? { lat: value.latitude, lon: value.longitude } : null;
}

/**
 * Best title match; among equal titles the nearest wins ("Querétaro (city)" over the state article
 * that shares its name). Otherwise the first geolocated search result.
 */
const best = (candidates: ArticleCandidate[]) => {
  for (const rank of [2, 1]) {
    const matches = candidates.filter((c) => c.rank === rank).sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
    if (matches.length) return matches[0];
  }
  return candidates[0] ?? null;
};

async function countryItem(countryCode: string, fetchImpl: Fetch): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', list: 'search', srlimit: '5',
    srsearch: `haswbstatement:P297=${countryCode.toUpperCase()}`,
  });
  const data = await getJson(fetchImpl, `https://www.wikidata.org/w/api.php?${params}`);
  return (data?.query?.search ?? []).map((row: { title: string }) => row.title).filter((id: string) => /^Q\d+$/.test(id));
}

async function itemCountries(wikidataId: string, fetchImpl: Fetch): Promise<string[]> {
  const params = new URLSearchParams({ action: 'wbgetclaims', format: 'json', entity: wikidataId, property: 'P17', origin: '*' });
  const data = await getJson(fetchImpl, `https://www.wikidata.org/w/api.php?${params}`);
  return (data?.claims?.P17 ?? []).map((claim: { mainsnak?: { datavalue?: { value?: { id?: string } } } }) => claim.mainsnak?.datavalue?.value?.id)
    .filter((id: unknown): id is string => typeof id === 'string');
}

/** Without coordinates: a title match or the top result, confirmed by its Wikidata country. */
async function findArticleByCountry(query: CityImageQuery, candidates: ArticleCandidate[], fetchImpl: Fetch) {
  if (!query.countryCode) return null;
  const top = candidates.reduce<ArticleCandidate | null>((first, c) => (!first || c.index < first.index ? c : first), null);
  const ordered = [
    ...candidates.filter((c) => c.rank === 2),
    ...candidates.filter((c) => c.rank === 1),
    ...(top && top.rank === 0 ? [top] : []),
  ].filter((c) => c.wikidataId);
  if (!ordered.length) return null;
  const countryIds = await countryItem(query.countryCode, fetchImpl);
  if (!countryIds.length) return null;
  for (const candidate of ordered.slice(0, 3)) {
    // A territory such as Hong Kong is itself the "country" item.
    if (countryIds.includes(candidate.wikidataId!)) return candidate;
    const countries = await itemCountries(candidate.wikidataId!, fetchImpl);
    if (countries.some((id) => countryIds.includes(id))) return candidate;
  }
  return null;
}

async function wikidataImage(wikidataId: string | null, fetchImpl: Fetch): Promise<string | null> {
  if (!wikidataId) return null;
  const params = new URLSearchParams({ action: 'wbgetclaims', format: 'json', entity: wikidataId, property: 'P18', origin: '*' });
  const data = await getJson(fetchImpl, `https://www.wikidata.org/w/api.php?${params}`);
  return data?.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? null;
}

async function commonsImage(fileName: string, fetchImpl: Fetch, width = LARGE_WIDTH) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', origin: '*',
    titles: `File:${fileName}`, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(width),
  });
  const data = await getJson(fetchImpl, `https://commons.wikimedia.org/w/api.php?${params}`);
  const page = data?.query?.pages?.[0];
  const info = page && !page.missing ? page.imageinfo?.[0] : null;
  if (!info) return null; // Not on Commons: a local Wikipedia file, which may be non-free.
  const meta = info.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value);
  if (info.mime === 'image/svg+xml' || !license || NON_FREE.test(license)) return null;
  return {
    descriptionUrl: String(info.descriptionurl),
    thumbUrl: String(info.thumburl ?? info.url),
    width: Number(info.width),
    height: Number(info.height),
    license,
    licenseUrl: meta.LicenseUrl?.value ? String(meta.LicenseUrl.value) : null,
    artist: stripHtml(meta.Artist?.value),
    credit: stripHtml(meta.Credit?.value),
    attributionRequired: meta.AttributionRequired?.value !== 'false',
  };
}

export async function lookupCityImage(query: CityImageQuery, fetchImpl: Fetch = fetch): Promise<CityImageResult> {
  const candidates = await searchArticles(query, fetchImpl);
  const byCoordinates = typeof query.latitude === 'number' && typeof query.longitude === 'number';
  const article = byCoordinates ? best(candidates) : await findArticleByCountry(query, candidates, fetchImpl);
  if (!article) return { status: 'no-article' };

  const tried = new Set<string>();
  for (const source of ['article', 'wikidata'] as const) {
    const fileName = source === 'article' ? article.imageName : await wikidataImage(article.wikidataId, fetchImpl);
    if (!fileName || tried.has(fileName)) continue;
    tried.add(fileName);
    const info = await commonsImage(fileName, fetchImpl);
    if (!info) continue;
    const small = await commonsImage(fileName, fetchImpl, SMALL_WIDTH);
    if (!small) continue;
    return {
      status: 'ok',
      image: {
        source, articleTitle: article.title, locationCheck: byCoordinates ? 'coordinates' : 'country',
        distanceKm: article.km === null ? null : Number(article.km.toFixed(1)), commonsFile: fileName, ...info, smallThumbUrl: small.thumbUrl },
    };
  }
  return { status: 'no-free-image', articleTitle: article.title };
}
