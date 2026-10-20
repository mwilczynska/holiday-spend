import { instrumentRoute } from '@/lib/analytics/route';
import { requireLibraryAdmin } from '@/lib/library-auth';
import { success, error, handleError } from '@/lib/api-helpers';
import { fetchLatestUsdAudFx } from '@/lib/usd-aud-reference-rate';
import { refreshCityCostExchangeRates } from '@/lib/city-cost-fx-refresh';

// POST /api/cities/exchange-rate-refresh  { "dryRun": true }
// Library admins recompute generated cities' AUD costs at the latest ECB USD to AUD rate. No model call; hand-edited
// fields are kept.
async function handlePOST(request: Request) {
  try {
    await requireLibraryAdmin();
    const body = await request.json().catch(() => ({}));
    const dryRun = Boolean((body as { dryRun?: unknown }).dryRun);
    let fx;
    try {
      fx = await fetchLatestUsdAudFx();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'The exchange-rate source could not be read.';
      return error(`Exchange rates were not refreshed: ${detail} Try again later.`, 502);
    }
    return success(refreshCityCostExchangeRates(fx, { dryRun }));
  } catch (err) {
    return handleError(err);
  }
}

export const POST = instrumentRoute(handlePOST, '/api/cities/exchange-rate-refresh', 'POST');
