export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return;
  const { sqlite } = await import('@/db');
  const { ensurePlanBaselines } = await import('@/lib/analytics/history');
  const { ensureAnalyticsWorker } = await import('@/lib/analytics/service');
  const { getAnalyticsStore } = await import('@/lib/analytics/storage');
  // A failed baseline is surfaced at startup; later history writes also fail atomically.
  const users = sqlite.prepare('SELECT id FROM user').all() as Array<{ id: string }>;
  for (const user of users) ensurePlanBaselines(user.id);
  getAnalyticsStore().prepare("UPDATE llm_attempts SET status='interrupted',ended_at=? WHERE status='started' AND coalesce(json_extract(metadata_json,'$.process'),'') != ?")
    .run(new Date().toISOString(), process.pid + ':' + Math.round(performance.timeOrigin));
  ensureAnalyticsWorker();
}
