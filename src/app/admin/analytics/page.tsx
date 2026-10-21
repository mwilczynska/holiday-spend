import { notFound } from 'next/navigation';
import { requireAnalyticsAdmin } from '@/lib/analytics/admin';
import { accountAnalyticsId } from '@/lib/analytics/service';
import { DashboardLoader } from './DashboardLoader';
export const dynamic = 'force-dynamic';
export default async function AnalyticsPage() {
  let user;
  try { user = await requireAnalyticsAdmin(); } catch { notFound(); }
  return <DashboardLoader initialEnvironment={process.env.HOLIDAY_SPEND_ANALYTICS_ENV || process.env.NODE_ENV || 'development'} selfAccountId={accountAnalyticsId(user.id)} />;
}
