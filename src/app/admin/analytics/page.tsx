import { notFound } from 'next/navigation';
import { requireAnalyticsAdmin } from '@/lib/analytics/admin';
import { AnalyticsDashboard } from './AnalyticsDashboard';
export const dynamic = 'force-dynamic';
export default async function AnalyticsPage() {
  try { await requireAnalyticsAdmin(); } catch { notFound(); }
  return <AnalyticsDashboard initialEnvironment={process.env.HOLIDAY_SPEND_ANALYTICS_ENV || process.env.NODE_ENV || 'development'} />;
}
