import { instrumentRoute } from '@/lib/analytics/route';
import { error, handleError, success } from '@/lib/api-helpers';
import { requireCurrentUserId } from '@/lib/auth';
import { isDisplayCurrency } from '@/lib/display-currency';
import { CurrencyRateUnavailableError, getDisplayCurrencyState, saveDisplayCurrency } from '@/lib/display-currency-service';
export const dynamic = 'force-dynamic';
async function handleGET() {
  try { return success(await getDisplayCurrencyState(await requireCurrentUserId())); }
  catch (err) { return handleError(err); }
}
async function handlePUT(request: Request) {
  try {
    const userId = await requireCurrentUserId(), body = await request.json();
    if (!body || !isDisplayCurrency(body.currency)) return error('Select a supported display currency.', 400);
    return success(await saveDisplayCurrency(userId, body.currency));
  } catch (err) {
    if (err instanceof CurrencyRateUnavailableError) return error(err.message + ' Try again or select AUD.', 503);
    return handleError(err);
  }
}

export const GET = instrumentRoute(handleGET, '/api/settings/currency', 'GET');
export const PUT = instrumentRoute(handlePUT, '/api/settings/currency', 'PUT');
