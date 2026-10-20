import { sqlite } from '@/db';
import { ensurePlanBaselines } from './history';
import { ensureAnalyticsWorker, recordEvent } from './service';
import { createHash } from 'node:crypto';
import { normalizedPage } from './routes';
import { getAnalyticsStore } from './storage';
export function startAnalytics() {
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const users = sqlite.prepare('SELECT id FROM user').all() as Array<{ id: string }>;
  for (const user of users) ensurePlanBaselines(user.id);
  getAnalyticsStore().prepare("UPDATE llm_attempts SET status='interrupted',ended_at=? WHERE status='started' AND coalesce(json_extract(metadata_json,'$.process'),'') != ?")
    .run(new Date().toISOString(), process.pid + ':' + Math.round(performance.timeOrigin));
  ensureAnalyticsWorker();
}
export function captureServerError(error: { name?: string; digest?: string }, phase: 'render' | 'request', routePath?: string) {
  recordEvent('server_error', { fingerprint: createHash('sha256').update((error.name || 'Error') + ':' + (error.digest || 'unknown')).digest('hex'), phase }, { route: normalizedPage(routePath || '') ?? 'unknown' });
}
