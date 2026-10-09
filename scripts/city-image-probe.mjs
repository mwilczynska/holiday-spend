#!/usr/bin/env node
/**
 * Read-only probe for free city photos from Wikipedia / Wikimedia Commons.
 *
 * For each city it:
 *   1. searches English Wikipedia for "<city> <country>" and keeps the first non-disambiguation
 *      article whose coordinates lie within MAX_DISTANCE_KM of the city's stored climate
 *      coordinates (this rejects same-name places elsewhere, e.g. Salento, Italy);
 *   2. takes that article's lead image (PageImages);
 *   3. confirms the file lives on Wikimedia Commons (local enwiki files can be non-free) and reads
 *      its licence, author and attribution requirement from Commons extmetadata;
 *   4. rejects SVGs (maps, flags, coats of arms) and non-free licences.
 *
 * It writes nothing: no database changes and no downloads. It prints one line per city and a
 * summary, and with --json writes the results to a file for review.
 *
 * Usage:
 *   node scripts/city-image-probe.mjs [--db path] [--limit 20] [--cities "Salento,Agra"] [--json out.json]
 *
 * Wikimedia API etiquette: a descriptive User-Agent and roughly one request per second.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const USER_AGENT = 'HolidaySpend/1.0 (https://github.com/mwilczynska/holiday-spend; city image probe)';
const MAX_DISTANCE_KM = 50;
const THUMB_WIDTH = 1280;
const REQUEST_GAP_MS = 1000;

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const dbPath = path.resolve(arg('db', process.env.HOLIDAY_SPEND_DB_PATH || path.join('data', 'travel.db')));
const limit = Number(arg('limit', '20'));
const only = arg('cities', '')?.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean) ?? [];
const jsonOut = arg('json', null);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequest = 0;
async function getJson(url) {
  const wait = lastRequest + REQUEST_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

function distanceKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const stripHtml = (value) => (value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const NON_FREE = /fair use|non-free|copyrighted|all rights reserved/i;

// "Bali (Ubud)" -> "ubud", "Hội An" -> "hoi an": compare on the most specific plain-ASCII name.
function baseName(name) {
  const inner = name.match(/\(([^)]+)\)/)?.[1];
  return (inner ?? name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\([^)]*\)/g, '').toLowerCase().trim();
}

async function findArticle(city) {
  const query = `${baseName(city.name)} ${city.country}`;
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', origin: '*',
    generator: 'search', gsrsearch: query, gsrlimit: '8', gsrnamespace: '0',
    prop: 'coordinates|pageimages|pageprops', piprop: 'name', ppprop: 'disambiguation|wikibase_item', colimit: 'max',
  });
  const data = await getJson(`https://en.wikipedia.org/w/api.php?${params}`);
  const pages = (data.query?.pages ?? []).sort((a, b) => a.index - b.index);
  const wanted = baseName(city.name);
  const candidates = [];
  for (const page of pages) {
    if (page.pageprops && 'disambiguation' in page.pageprops) continue;
    const coord = page.coordinates?.[0];
    // "Salento, Quindío" and "Hội An (city)" both reduce to the bare place name.
    const titleBase = baseName(page.title.split(',')[0].replace(/\s*\([^)]*\)/g, ''));
    const titleRank = titleBase === wanted ? 2 : titleBase.startsWith(wanted) ? 1 : 0;
    const titleMatch = titleRank > 0;
    let km = null;
    if (city.lat != null) {
      if (!coord) continue;
      km = distanceKm({ lat: city.lat, lon: city.lon }, { lat: coord.lat, lon: coord.lon });
      if (km > MAX_DISTANCE_KM) continue;
    } else if (!titleMatch || !coord) {
      continue; // Without stored coordinates, only a titled, geolocated article is acceptable.
    }
    candidates.push({
      title: page.title, km, titleMatch, titleRank,
      imageName: page.pageimage ?? null,
      wikidataId: page.pageprops?.wikibase_item ?? null,
      locationCheck: city.lat != null ? 'coordinates' : 'title-only',
    });
  }
  // Prefer the city's own article over a landmark inside it (Ubud over Ubud Palace), keeping
  // search order within each rank.
  return candidates.find((c) => c.titleRank === 2) ?? candidates.find((c) => c.titleRank === 1) ?? candidates[0] ?? null;
}

/** Wikidata's "image" (P18) always names a Commons file; used when the article image is local. */
async function wikidataImage(wikidataId) {
  if (!wikidataId) return null;
  const params = new URLSearchParams({ action: 'wbgetclaims', format: 'json', entity: wikidataId, property: 'P18', origin: '*' });
  const data = await getJson(`https://www.wikidata.org/w/api.php?${params}`);
  return data.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? null;
}

async function commonsInfo(fileName) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', origin: '*',
    titles: `File:${fileName}`, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(THUMB_WIDTH),
  });
  const data = await getJson(`https://commons.wikimedia.org/w/api.php?${params}`);
  const page = data.query?.pages?.[0];
  if (!page || page.missing) return null; // Not on Commons: a local enwiki file, possibly non-free.
  const info = page.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  return {
    mime: info.mime,
    width: info.width,
    height: info.height,
    thumbUrl: info.thumburl ?? info.url,
    descriptionUrl: info.descriptionurl,
    license: stripHtml(meta.LicenseShortName?.value),
    licenseUrl: meta.LicenseUrl?.value ?? null,
    artist: stripHtml(meta.Artist?.value),
    credit: stripHtml(meta.Credit?.value),
    attributionRequired: meta.AttributionRequired?.value !== 'false',
  };
}

function loadCities() {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const rows = db.prepare(`
    SELECT c.id, c.name, co.name AS country, cc.data_json AS climate
    FROM cities c
    JOIN countries co ON co.id = c.country_id
    LEFT JOIN city_climate cc ON cc.city_id = c.id
    ORDER BY c.name
  `).all();
  db.close();
  return rows.map((row) => {
    let location = null;
    try { location = JSON.parse(row.climate ?? 'null')?.location ?? null; } catch { location = null; }
    const hasCoords = location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
    return { id: row.id, name: row.name, country: row.country, lat: hasCoords ? location.latitude : null, lon: hasCoords ? location.longitude : null };
  });
}

const all = loadCities();
const cities = only.length ? all.filter((city) => only.includes(city.name.toLowerCase())) : all.slice(0, limit);
console.log(`Probing ${cities.length} of ${all.length} cities; ${all.filter((c) => c.lat != null).length} have stored coordinates (${dbPath})\n`);

const results = [];
for (const city of cities) {
  const result = { cityId: city.id, city: city.name, country: city.country, status: 'no-article' };
  try {
    const article = await findArticle(city);
    if (article) {
      Object.assign(result, {
        status: 'no-image', article: article.title, locationCheck: article.locationCheck,
        distanceKm: article.km == null ? null : Number(article.km.toFixed(1)),
      });
      // Article lead image first; if it is missing, local-only, an SVG or non-free, try Wikidata P18.
      const tried = new Set();
      for (const source of ['article', 'wikidata']) {
        const fileName = source === 'article' ? article.imageName : await wikidataImage(article.wikidataId);
        if (!fileName || tried.has(fileName)) continue;
        tried.add(fileName);
        const info = await commonsInfo(fileName);
        if (!info) { result.status = 'not-on-commons'; continue; }
        if (info.mime === 'image/svg+xml') { Object.assign(result, { status: 'svg-rejected', file: fileName }); continue; }
        if (!info.license || NON_FREE.test(info.license)) { Object.assign(result, { status: 'licence-rejected', file: fileName, license: info.license }); continue; }
        Object.assign(result, { status: 'ok', imageSource: source, file: fileName, ...info });
        break;
      }
    }
  } catch (error) {
    Object.assign(result, { status: 'error', error: error instanceof Error ? error.message : String(error) });
  }
  results.push(result);
  const detail = result.status === 'ok'
    ? `${result.article} (${result.distanceKm == null ? 'title match' : `${result.distanceKm} km`}, ${result.imageSource}) · ${result.license} · ${(result.artist || 'unknown author').slice(0, 40)} · ${result.width}x${result.height}`
    : `${result.article ?? ''} ${result.file ?? ''} ${result.license ?? ''} ${result.error ?? ''}`.trim();
  console.log(`${result.status.padEnd(16)} ${`${city.name}, ${city.country}`.padEnd(34)} ${detail}`);
}

const counts = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
console.log(`\nSummary: ${JSON.stringify(counts)}  usable ${counts.ok ?? 0}/${results.length}`);
if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2));
  console.log(`Wrote ${jsonOut}`);
}
