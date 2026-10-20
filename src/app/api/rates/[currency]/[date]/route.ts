import { instrumentRoute } from '@/lib/analytics/route';
import { requireCurrentUserId } from '@/lib/auth';
import { getExchangeRate } from '@/lib/exchange-rates';
import { success, handleError } from '@/lib/api-helpers';

async function handleGET(
  _request: Request,
  { params }: { params: Promise<{ currency: string; date: string }> }
) {
  try {
    await requireCurrentUserId();
    const rate = await getExchangeRate((await params).currency, (await params).date);
    return success({ currency: (await params).currency, date: (await params).date, rate, to: 'AUD' });
  } catch (err) {
    return handleError(err);
  }
}

export const GET = instrumentRoute(handleGET, '/api/rates/[currency]/[date]', 'GET');
