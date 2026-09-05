import { requireCurrentUserId } from '@/lib/auth';
import { success, handleError } from '@/lib/api-helpers';
import {
  buildBurnRate,
  buildDashboardSummary,
  buildPlannedVsActual,
  loadDashboardInputs,
} from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

/**
 * Everything the dashboard needs, from one read.
 *
 * The page used to fetch three endpoints in parallel. They were quick individually, but each one
 * re-read the same legs, transports, cities, countries and expenses, so the same 1,300 expense
 * rows were loaded three times to render one page. The three endpoints still exist and behave
 * exactly as before; this is what the page actually calls.
 */
export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    const inputs = await loadDashboardInputs(userId);

    return success({
      summary: buildDashboardSummary(inputs),
      plannedVsActual: buildPlannedVsActual(inputs),
      burnRate: buildBurnRate(inputs),
    });
  } catch (err) {
    return handleError(err);
  }
}
