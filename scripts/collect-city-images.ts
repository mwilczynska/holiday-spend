/**
 * Collect free photos for every city in the database (see docs/product/city-images.md).
 *
 *   npx tsx scripts/collect-city-images.ts             # cities with no current result, plus failed attempts
 *   npx tsx scripts/collect-city-images.ts --refresh   # look again for every city
 *   npx tsx scripts/collect-city-images.ts --retry-misses   # look again where no photo was found
 *   npx tsx scripts/collect-city-images.ts --city salento --refresh
 *
 * Uses HOLIDAY_SPEND_DB_PATH like the app; photos go to the `city-images` folder beside the database.
 * Sequential and paced at about one city per second, so it can be stopped and rerun at any time.
 */
import { asc } from 'drizzle-orm';
import { db } from '../src/db';
import { cities } from '../src/db/schema';
import { ensureCityImage, getCityImageRow, cityImageDirectory } from '../src/lib/city-image-service';

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const retryMisses = args.includes('--retry-misses');
const onlyCity = args.includes('--city') ? args[args.indexOf('--city') + 1] : null;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const rows = db.select({ id: cities.id, name: cities.name }).from(cities).orderBy(asc(cities.id)).all()
    .filter((city) => !onlyCity || city.id === onlyCity);
  console.log(`Collecting photos for ${rows.length} cities into ${cityImageDirectory()}${refresh ? ' (refresh)' : ''}.`);
  const counts: Record<string, number> = {};
  const misses: string[] = [];
  for (const city of rows) {
    const before = getCityImageRow(city.id)?.lastAttemptAt;
    const status = (await ensureCityImage(city.id, { refresh, retryErrors: true, retryMisses })) ?? 'skipped (unknown country)';
    const row = getCityImageRow(city.id);
    const contacted = row?.lastAttemptAt !== before;
    counts[status] = (counts[status] ?? 0) + 1;
    if (status !== 'ok') misses.push(`${city.name} (${city.id}): ${status}${row?.lastError ? ` - ${row.lastError}` : ''}`);
    if (contacted) {
      console.log(`${status.padEnd(13)} ${city.name}`);
      await pause(1000); // Wikimedia asks unauthenticated clients to stay well under their limits.
    }
  }
  console.log('\nSummary:', counts);
  if (misses.length) console.log(`\nNo photo:\n  ${misses.join('\n  ')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
