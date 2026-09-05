import { requireCurrentUserId } from '@/lib/auth';
import { success, handleError } from '@/lib/api-helpers';
import { loadDashboardInputs, buildPlannedVsActual } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

/**
 * Kept as its own endpoint, but the shared read and the calculation both live in
 * `src/lib/dashboard-data.ts` now. The dashboard itself uses the combined `/api/dashboard`.
 */
export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    return success(buildPlannedVsActual(await loadDashboardInputs(userId)));
  } catch (err) {
    return handleError(err);
  }
}
