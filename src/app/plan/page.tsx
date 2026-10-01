import { PlanClient, type PlanInitialData } from './PlanClient';
import { requireCurrentUserId } from '@/lib/auth';
import { loadPlannerData } from '@/lib/planner-data';
export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const userId = await requireCurrentUserId();
  return <PlanClient initialData={await loadPlannerData(userId) as PlanInitialData} />;
}
