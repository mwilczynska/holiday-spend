import { getExchangeRate } from '@/lib/exchange-rates';
import { success, handleError } from '@/lib/api-helpers';

export async function GET(
  _request: Request,
  { params }: { params: { currency: string; date: string } }
) {
  try {
    const rate = await getExchangeRate(params.currency, params.date);
    return success({ currency: params.currency, date: params.date, rate, to: 'AUD' });
  } catch (err) {
    return handleError(err);
  }
}
