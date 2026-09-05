import { TrackClient, type TrackInitialData } from '@/app/track/TrackClient';
import { requireCurrentUserId } from '@/lib/auth';
import { loadTrackExpensePage, loadTrackLegs } from '@/lib/track-data';
import { EXPENSE_PAGE_SIZE } from '@/lib/performance-bounds';

/**
 * The unfiltered first page is loaded here rather than fetched after the bundle mounts.
 *
 * Measured before this change on a production build: the HTML arrived in about 11 ms carrying no
 * rows, and the two API requests did not start until 188 ms, finishing at 231 ms. They were not
 * slow — they were queued behind the bundle downloading, parsing and mounting.
 *
 * `force-dynamic` because the response is per-user and must not be cached across sessions.
 */
export const dynamic = 'force-dynamic';

const EMPTY: TrackInitialData = {
  expenses: [],
  legs: [],
  totalCount: 0,
  totalAud: 0,
  expenseIds: [],
};

export default async function TrackPage() {
  let initialData = EMPTY;

  try {
    const userId = await requireCurrentUserId();
    const [page, legs] = await Promise.all([
      loadTrackExpensePage(userId, { page: 0, pageSize: EXPENSE_PAGE_SIZE }),
      loadTrackLegs(userId),
    ]);

    initialData = {
      expenses: page.items as TrackInitialData['expenses'],
      legs,
      totalCount: page.totalCount,
      totalAud: page.totalAud,
      expenseIds: page.expenseIds,
    };
  } catch {
    // Middleware redirects unauthenticated requests before this runs, so reaching here means the
    // data could not be read. Render the shell and let the client's own fetch report the problem,
    // exactly as it did before this page was server-rendered.
  }

  return <TrackClient initialData={initialData} />;
}
