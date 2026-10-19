/**
 * Read-only: runs the current photo lookup for every city, with the same identity and coordinates as collection,
 * and lists the cities whose pick would change. Makes no writes and downloads no images.
 *   npx tsx scripts/diff-city-image-picks.ts        (uses HOLIDAY_SPEND_DB_PATH like the app)
 * Review every change before running `scripts/collect-city-images.ts --city <id> --refresh`.
 */
import { db } from '../src/db';
import { cityImages } from '../src/db/schema';
import { lookupCityImage } from '../src/lib/city-image-lookup';
import { cityCoordinates, identityFor } from '../src/lib/city-image-service';

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Paced like the collector (about one city per second), with back-off when Wikimedia rate-limits.
async function lookupWithRetry(query: Parameters<typeof lookupCityImage>[0]) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await lookupCityImage(query);
    } catch (error) {
      if (attempt >= 4 || !/HTTP 429/.test(String(error))) throw error;
      await pause(15_000 * (attempt + 1));
    }
  }
}

async function main() {
  const rows = db.select({ cityId: cityImages.cityId, dataJson: cityImages.dataJson }).from(cityImages).all();
  const changes: string[] = [];
  for (const row of rows.sort((a, b) => a.cityId.localeCompare(b.cityId))) {
    const identity = identityFor(row.cityId);
    if (!identity) continue;
    const before = row.dataJson ? JSON.parse(row.dataJson).commonsFile ?? null : null;
    let coordinates = {};
    let searchName = identity.cityName;
    try {
      const located = await cityCoordinates(identity, fetch);
      coordinates = { latitude: located.latitude, longitude: located.longitude };
      searchName = located.searchName;
    } catch { /* matched by country, as in collection */ }
    let result;
    try {
      result = await lookupWithRetry({ name: searchName, countryName: identity.countryName, countryCode: identity.countryCode, ...coordinates });
    } catch (error) {
      changes.push(`${row.cityId}: lookup failed (${String(error).slice(0, 80)})`);
      continue;
    }
    await pause(1_000);
    const after = result.status === 'ok' ? result.image.commonsFile : `(${result.status})`;
    if (after !== before) changes.push(`${row.cityId}: ${before} -> ${after}`);
  }
  console.log(JSON.stringify({ checked: rows.length, changed: changes.length, changes }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
