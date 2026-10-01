import { handleError, success } from '@/lib/api-helpers';
import { loadCityProvenance, loadEstimates } from '@/lib/estimate-data';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const cityId = query.get('cityId');
    return success(cityId ? await loadCityProvenance(cityId) : await loadEstimates(query.get('view') === 'dataset'));
  } catch (err) { return handleError(err); }
}
