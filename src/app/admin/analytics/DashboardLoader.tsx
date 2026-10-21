'use client';
import dynamic from 'next/dynamic';

// Browser-only: default dates use the viewer's timezone and filters come from the URL, so a server
// render would differ from the first browser render. All report data is fetched in the browser anyway.
export const DashboardLoader = dynamic(() => import('./AnalyticsDashboard').then(m => m.AnalyticsDashboard), {
  ssr: false,
  loading: () => <p role="status" className="text-sm text-muted-foreground">Loading analytics…</p>,
});
