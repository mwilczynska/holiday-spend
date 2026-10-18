/**
 * Recompute generated cities' AUD costs at the latest USD to AUD rate (ECB cross rate), without a model call.
 *
 *   npx tsx scripts/refresh-city-cost-fx.ts --dry-run     # report what would change
 *   npx tsx scripts/refresh-city-cost-fx.ts               # apply
 *
 * Uses HOLIDAY_SPEND_DB_PATH like the app. Only cities whose active estimate stores USD anchors (v1.1 and v1.2)
 * change; hand-edited fields are kept. See src/lib/city-cost-fx-refresh.ts.
 */
import { fetchLatestUsdAudFx } from '../src/lib/usd-aud-reference-rate';
import { refreshCityCostExchangeRates } from '../src/lib/city-cost-fx-refresh';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const fx = await fetchLatestUsdAudFx();
  const summary = refreshCityCostExchangeRates(fx, { dryRun });
  const { cities, ...totals } = summary;
  console.log(JSON.stringify(totals, null, 2));
  const withManual = cities.filter((city) => city.manualFields.length);
  if (withManual.length) {
    console.log(`Hand-edited fields kept in ${withManual.length} cities:`);
    for (const city of withManual) console.log(`  ${city.cityId}: ${city.manualFields.join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
