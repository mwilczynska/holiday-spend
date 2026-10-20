import { instrumentRoute } from '@/lib/analytics/route';
import { requireCurrentUserId } from '@/lib/auth';
import { success, handleError } from '@/lib/api-helpers';
import { loadTrackLegs } from '@/lib/track-data';
import { loadItinerary } from '@/lib/itinerary-data';
export const dynamic = 'force-dynamic';

async function handleGET(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    return success(new URL(request.url).searchParams.get('view') === 'track'
      ? await loadTrackLegs(userId) : await loadItinerary(userId));
  } catch (err) { return handleError(err); }
}

export const GET = instrumentRoute(handleGET, '/api/itinerary', 'GET');
