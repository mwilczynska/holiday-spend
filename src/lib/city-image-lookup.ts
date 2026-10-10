/**
 * Deterministic city photo lookup from Wikipedia / Wikimedia Commons. No API key, no LLM.
 *
 * Runs server-side after a city's coordinates are known (climate collection geocodes every new
 * city), so the article can be verified by distance rather than by name alone:
 *   1. search English Wikipedia for "<place> <country>"; skip disambiguation pages;
 *   2. keep geolocated articles within MAX_DISTANCE_KM of the city, preferring an exact title
 *      match, then a title that starts with the place name, then search order;
 *   3. take the article's lead image, or Wikidata's `image` (P18) when the lead image is missing,
 *      local to Wikipedia (possibly non-free), an SVG, or not freely licensed;
 *   4. accept only Commons files with a free licence, and return the credit data the licence needs.
 *
 * Fails closed: any mismatch returns `{ status: ... }` without an image, never a guess.
 */

export const CITY_IMAGE_USER_AGENT = 'HolidaySpend/1.0 (https://github.com/mwilczynska/holiday-spend; city images)';
export const MAX_DISTANCE_KM = 50;
const THUMB_WIDTH = 1280;
const NON_FREE = /fair use|non-free|copyrighted|all rights reserved/i;

export interface CityImageQuery {
  name: string;
  countryName: string;
  latitude: number;
  longitude: number;
}

export interface CityImage {
  source: 'article' | 'wikidata';
  articleTitle: string;
  distanceKm: number;
  commonsFile: string;
  descriptionUrl: string;
  thumbUrl: string;
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

interface ArticleCandidate { title: string; km: number; rank: number; imageName: string | null; wikidataId: string | null }

async function findArticle(query: CityImageQuery, fetchImpl: Fetch): Promise<ArticleCandidate | null> {
  const wanted = basePlaceName(query.name);
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', origin: '*',
    generator: 'search', gsrsearch: `${wanted} ${query.countryName}`, gsrlimit: '8', gsrnamespace: '0',
    prop: 'coordinates|pageimages|pageprops', piprop: 'name', ppprop: 'disambiguation|wikibase_item', colimit: 'max',
  });
  const data = await getJson(fetchImpl, `https://en.wikipedia.org/w/api.php?${params}`);
  const pages: Array<{
    index: number; title: string; pageimage?: string;
    coordinates?: Array<{ lat: number; lon: number }>;
    pageprops?: Record<string, string>;
  }> = (data?.query?.pages ?? []).slice().sort((a: { index: number }, b: { index: number }) => a.index - b.index);

  const candidates: ArticleCandidate[] = [];
  for (const page of pages) {
    if (page.pageprops && 'disambiguation' in page.pageprops) continue;
    const coord = page.coordinates?.[0];
    if (!coord) continue;
    const km = distanceKm({ lat: query.latitude, lon: query.longitude }, { lat: coord.lat, lon: coord.lon });
    if (km > MAX_DISTANCE_KM) continue;
    const titleBase = basePlaceName(page.title.split(',')[0].replace(/\s*\([^)]*\)/g, ''));
    candidates.push({
      title: page.title,
      km,
      rank: titleBase === wanted ? 2 : titleBase.startsWith(wanted) ? 1 : 0,
      imageName: page.pageimage ?? null,
      wikidataId: page.pageprops?.wikibase_item ?? null,
    });
  }
  return candidates.find((c) => c.rank === 2) ?? candidates.find((c) => c.rank === 1) ?? candidates[0] ?? null;
}

async function wikidataImage(wikidataId: string | null, fetchImpl: Fetch): Promise<string | null> {
  if (!wikidataId) return null;
  const params = new URLSearchParams({ action: 'wbgetclaims', format: 'json', entity: wikidataId, property: 'P18', origin: '*' });
  const data = await getJson(fetchImpl, `https://www.wikidata.org/w/api.php?${params}`);
  return data?.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? null;
}

async function commonsImage(fileName: string, fetchImpl: Fetch) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', origin: '*',
    titles: `File:${fileName}`, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(THUMB_WIDTH),
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
  const article = await findArticle(query, fetchImpl);
  if (!article) return { status: 'no-article' };

  const tried = new Set<string>();
  for (const source of ['article', 'wikidata'] as const) {
    const fileName = source === 'article' ? article.imageName : await wikidataImage(article.wikidataId, fetchImpl);
    if (!fileName || tried.has(fileName)) continue;
    tried.add(fileName);
    const info = await commonsImage(fileName, fetchImpl);
    if (!info) continue;
    return {
      status: 'ok',
      image: { source, articleTitle: article.title, distanceKm: Number(article.km.toFixed(1)), commonsFile: fileName, ...info },
    };
  }
  return { status: 'no-free-image', articleTitle: article.title };
}
