import { DashboardClient, type DashboardInitialData } from '@/app/DashboardClient';
import { requireCurrentUserId } from '@/lib/auth';
import {
  buildBurnRate,
  buildDashboardSummary,
  buildPlannedVsActual,
  loadDashboardInputs,
} from '@/lib/dashboard-data';

/**
 * The dashboard's data is loaded here rather than fetched after the bundle mounts.
 *
 * Measured before this change, on a production build: the HTML arrived in about 7 ms carrying no
 * data, and the dashboard request did not start until 569 ms — after the whole bundle had
 * downloaded, parsed and mounted. The request itself took 34 ms. Nothing was slow; everything was
 * waiting in a queue behind everything else.
 *
 * `force-dynamic` because the response is per-user and must not be cached across sessions.
 */
export const dynamic = 'force-dynamic';

const EMPTY: DashboardInitialData = {
  summary: null,
  comparison: [],
  actualCategoryTotals: {},
  plannedCategoryTotals: {},
  burnData: [],
  countryBands: [],
};

export default async function DashboardPage() {
  let initialData = EMPTY;

  try {
    const inputs = await loadDashboardInputs(await requireCurrentUserId());
    const plannedVsActual = buildPlannedVsActual(inputs);
    const burnRate = buildBurnRate(inputs);

    initialData = {
      summary: buildDashboardSummary(inputs) as DashboardInitialData['summary'],
      comparison: plannedVsActual.comparison as DashboardInitialData['comparison'],
      actualCategoryTotals: plannedVsActual.actualCategoryTotals,
      plannedCategoryTotals: plannedVsActual.plannedCategoryTotals,
      burnData: burnRate.cumulative as DashboardInitialData['burnData'],
      countryBands: burnRate.countryBands as DashboardInitialData['countryBands'],
    };
  } catch {
    // Middleware redirects unauthenticated requests before this runs, so reaching here means the
    // data could not be read rather than that the user is anonymous. Render the shell and let the
    // client's own fetch report the problem, exactly as it did before this page was server-rendered.
  }

  return <DashboardClient initialData={initialData} />;
}
