/**
 * Re-apply the current v1.2 correction table to every v1.2 city from its stored raw USD anchors, at the city's stored
 * exchange rate, without a model call.
 *
 *   npx tsx scripts/recorrect-city-costs.ts --dry-run     # report what would change
 *   npx tsx scripts/recorrect-city-costs.ts               # apply
 *
 * Uses HOLIDAY_SPEND_DB_PATH like the app. Hand-edited fields are kept; the previous corrected anchors are kept in the
 * estimate's `correctionHistory`. See src/lib/city-cost-recorrect.ts.
 */
import { recorrectCityCosts } from '../src/lib/city-cost-recorrect';

const summary = recorrectCityCosts({ dryRun: process.argv.includes('--dry-run') });
const { cities, ...totals } = summary;
console.log(JSON.stringify(totals, null, 2));
const withManual = cities.filter((city) => city.manualFields.length);
if (withManual.length) {
  console.log(`Hand-edited fields kept in ${withManual.length} cities:`);
  for (const city of withManual) console.log(`  ${city.cityId}: ${city.manualFields.join(', ')}`);
}
