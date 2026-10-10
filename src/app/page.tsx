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
  cityComparison: [],
  actualCategoryTotals: {},
  plannedCategoryTotals: {},
  burnData: [],
  countryBands: [],
  readError: 'Dashboard data could not be loaded.',
};

export default async function DashboardPage() {
  const userId = await requireCurrentUserId();
  let initialData = EMPTY;

  try {
    const inputs = await loadDashboardInputs(userId);
    const plannedVsActual = buildPlannedVsActual(inputs);
    const burnRate = buildBurnRate(inputs);

    initialData = {
      summary: buildDashboardSummary(inputs) as DashboardInitialData['summary'],
      comparison: plannedVsActual.comparison as DashboardInitialData['comparison'],
      cityComparison: plannedVsActual.cityComparison as DashboardInitialData['cityComparison'],
      actualCategoryTotals: plannedVsActual.actualCategoryTotals,
      plannedCategoryTotals: plannedVsActual.plannedCategoryTotals,
      burnData: burnRate.cumulative as DashboardInitialData['burnData'],
      countryBands: burnRate.countryBands as DashboardInitialData['countryBands'],
    };
  } catch {
    // Preserve the read failure in the HTML. The client can retry without claiming an empty trip.
  }

  return <DashboardClient initialData={initialData} />;
}
