import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db';
import { requireAnalyticsAdmin } from '@/lib/analytics/admin';
import { buildAnalyticsReport, parseReportQuery } from '@/lib/analytics/reports';
import { accountAnalyticsId, flushAnalytics, recordEvent } from '@/lib/analytics/service';
import { getAnalyticsStore } from '@/lib/analytics/storage';
import { setAnalyticsActor } from '@/lib/analytics/context';
import { instrumentRoute } from '@/lib/analytics/route';
import { handleError } from '@/lib/api-helpers';
import { analyticsExportResponse, requestAnalyticsExport } from '@/lib/analytics/exports';
import { accountDirectory } from '@/lib/analytics/accounts';

export const dynamic = 'force-dynamic';
async function handleGET(request: Request) {
  try {
    const user = await requireAnalyticsAdmin();
    setAnalyticsActor(user.id, true);
    const params = new URL(request.url).searchParams;
    if (params.has('exportJob')) {
      const id = z.string().uuid().parse(params.get('exportJob'));
      recordEvent('admin_accessed', { action: 'export', subject: id });
      return analyticsExportResponse(id, accountAnalyticsId(user.id), params.get('download') === 'true');
    }
    const q = parseReportQuery(params);
    flushAnalytics();
    if (q.view === 'plans') {
      if (q.revision) {
        const revision = sqlite.prepare('SELECT * FROM plan_revisions WHERE id=?').get(q.revision) as { user_id: string; subject_id: string; snapshot_json: string; summary_json: string } | undefined;
        if (!revision) return NextResponse.json({ error: 'Revision not found.' }, { status: 404 });
        recordEvent('admin_accessed', { action: q.export === 'true' ? 'export' : 'revision', subject: String(q.revision) });
        const previous = sqlite.prepare('SELECT snapshot_json FROM plan_revisions WHERE user_id=? AND subject_id=? AND id<? ORDER BY id DESC LIMIT 1').get(revision.user_id, revision.subject_id, q.revision) as { snapshot_json: string } | undefined;
        const data = { ...revision, user_id: accountAnalyticsId(revision.user_id), snapshot: JSON.parse(revision.snapshot_json), previous: previous ? JSON.parse(previous.snapshot_json) : null, summary: JSON.parse(revision.summary_json), snapshot_json: undefined, summary_json: undefined };
        return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store', ...(q.export === 'true' ? { 'Content-Disposition': `attachment; filename="plan-revision-${q.revision}.json"` } : {}) } });
      }
      const target = q.account ? (sqlite.prepare('SELECT id FROM user').all() as Array<{ id: string }>).find(row => accountAnalyticsId(row.id) === q.account)?.id ?? 'unavailable-account' : null;
      // The plan's name: the live saved plan's current name, else the name frozen in the revision (deleted plans).
      const rows = sqlite.prepare(`SELECT id,user_id,subject_id,action,created_at,summary_json,deleted,
        CASE WHEN subject_id='active' THEN 'Current plan' ELSE coalesce((SELECT name FROM saved_plans WHERE saved_plans.id=plan_revisions.subject_id), json_extract(snapshot_json,'$.snapshot.name')) END AS plan_name
        FROM plan_revisions WHERE created_at>=? AND created_at<? AND (?=0 OR id<?) AND (? IS NULL OR user_id=?) AND (? IS NULL OR operation_id=?) ORDER BY id DESC LIMIT 100`)
        .all(q.from + 'T00:00:00.000Z', new Date(Date.parse(q.to) + 86400000).toISOString(), q.cursor, q.cursor, target, target, q.operation ?? null, q.operation ?? null) as Array<{ id: number; user_id: string; summary_json: string }>;
      recordEvent('admin_accessed', { action: 'report' });
      return NextResponse.json({ data: { accounts: accountDirectory(), rows: rows.map(row => ({ ...row, user_id: accountAnalyticsId(row.user_id), summary: JSON.parse(row.summary_json), summary_json: undefined })), nextCursor: rows.length === 100 ? rows[99].id : null, note: 'Private history is retained independently of behavioral analytics. Environment, device, release and administrator filters do not apply.' } }, { headers: { 'Cache-Control': 'no-store' } });
    }
    recordEvent('admin_accessed', { action: 'report' });
    // Admins see which account activity belongs to; the events themselves stay pseudonymous.
    return NextResponse.json({ data: { ...await buildAnalyticsReport(q), accounts: accountDirectory() } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) { return handleError(err); }
}
async function handleDELETE(request: Request) {
  try {
    await requireAnalyticsAdmin();
    const { accountId } = z.object({ accountId: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(await request.json());
    const users = sqlite.prepare('SELECT id FROM user').all() as Array<{ id: string }>;
    const target = users.find(user => accountAnalyticsId(user.id) === accountId);
    if (!target) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    const before = new Date().toISOString();
    sqlite.transaction(() => {
      sqlite.prepare('INSERT OR REPLACE INTO analytics_erasure(user_id,before_at) VALUES (?,?)').run(target.id, before);
      sqlite.prepare('DELETE FROM analytics_outbox WHERE user_id=?').run(target.id);
      sqlite.prepare('DELETE FROM plan_revisions WHERE user_id=?').run(target.id);
    })();
    const store = getAnalyticsStore();
    store.transaction(() => {
      store.prepare('DELETE FROM events WHERE account_id=?').run(accountId);
      store.prepare('DELETE FROM llm_attempts WHERE account_id=?').run(accountId);
      store.prepare('DELETE FROM session_accounts WHERE account_id=?').run(accountId);
      store.exec('DELETE FROM export_chunks; DELETE FROM export_jobs;');
      store.prepare('INSERT OR REPLACE INTO collector_state VALUES (?,?)').run('erasure:' + accountId, before);
      store.prepare("INSERT OR REPLACE INTO collector_state VALUES ('exports_erased_through',?)").run(before);
      store.exec(`DELETE FROM daily_counts; INSERT INTO daily_counts SELECT substr(received_at,1,10),name,environment,administrator,count(*) FROM events GROUP BY substr(received_at,1,10),name,environment,administrator`);
    })();
    recordEvent('admin_accessed', { action: 'erase', subject: createHash('sha256').update(accountId).digest('hex') });
    return NextResponse.json({ data: { erased: true } });
  } catch (err) { return handleError(err); }
}
export const GET = instrumentRoute(handleGET, '/api/admin/analytics', 'GET');
export const DELETE = instrumentRoute(handleDELETE, '/api/admin/analytics', 'DELETE');
async function handlePOST(request: Request) {
  try {
    const user = await requireAnalyticsAdmin(); setAnalyticsActor(user.id, true);
    const { filters } = z.object({ filters: z.record(z.string(), z.string()) }).strict().parse(await request.json());
    const query = parseReportQuery(new URLSearchParams(filters));
    flushAnalytics();
    const job = requestAnalyticsExport(query, accountAnalyticsId(user.id));
    recordEvent('admin_accessed', { action: 'export', subject: job.id });
    return NextResponse.json({ data: job }, { status: 202 });
  } catch (err) { return handleError(err); }
}
export const POST = instrumentRoute(handlePOST, '/api/admin/analytics', 'POST');
