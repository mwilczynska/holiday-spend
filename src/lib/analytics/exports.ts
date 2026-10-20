import { getAnalyticsStore } from './storage';
import { parseReportQuery, predicate, type ReportQuery } from './query';
import { readAnalyticsQuery, type AnalyticsReader } from './reader';
const EXPORT_CHUNK_SIZE = 2500;
let processing = false;
export function requestAnalyticsExport(query: ReportQuery, requestedBy: string) {
  const store = getAnalyticsStore();
  const id = crypto.randomUUID();
  const maximum = (store.prepare('SELECT coalesce(max(sequence),0) AS maximum FROM events').get() as { maximum: number }).maximum;
  store.prepare("INSERT INTO export_jobs(id,requested_by,state,query_json,maximum,created_at) VALUES (?,?,'queued',?,?,?)")
    .run(id, requestedBy, JSON.stringify(query), maximum, new Date().toISOString());
  return { id, state: 'queued' };
}
export async function processAnalyticsExports(read: AnalyticsReader = readAnalyticsQuery) {
  if (processing) return;
  const store = getAnalyticsStore();
  const job = store.prepare("SELECT * FROM export_jobs WHERE state IN ('queued','running') ORDER BY created_at LIMIT 1").get() as { id: string; query_json: string; cursor: number; maximum: number } | undefined;
  if (!job) return;
  processing = true;
  try {
    const query = parseReportQuery(new URLSearchParams(JSON.parse(job.query_json)));
    const filter = predicate(query);
    const index = query.operation ? 'events_operation' : query.account ? 'events_account_time' : 'events_timeline_all';
    const rows = await read(`SELECT sequence,payload_json FROM events INDEXED BY ${index} WHERE ${filter.where} AND sequence>@cursor AND sequence<=@maximum ORDER BY sequence LIMIT ${EXPORT_CHUNK_SIZE}`,
      { ...filter.args, cursor: job.cursor, maximum: job.maximum }) as Array<{ sequence: number; payload_json: string }>;
    store.transaction(() => {
      // An account erasure may invalidate this export while the reader is working.
      if (!store.prepare("SELECT 1 FROM export_jobs WHERE id=? AND state IN ('queued','running')").get(job.id)) return;
      if (rows.length) {
        const cursor = rows[rows.length - 1].sequence;
        store.prepare('INSERT OR IGNORE INTO export_chunks(job_id,part,data) VALUES (?,?,?)').run(job.id, cursor, rows.map(row => row.payload_json).join('\n') + '\n');
        store.prepare("UPDATE export_jobs SET cursor=?,state='running' WHERE id=?").run(cursor, job.id);
      }
      if (rows.length < EXPORT_CHUNK_SIZE) store.prepare("UPDATE export_jobs SET state='complete' WHERE id=?").run(job.id);
    })();
  } catch { store.prepare("UPDATE export_jobs SET state='failed',error_code='export_failed' WHERE id=?").run(job.id); }
  finally { processing = false; }
}
export function analyticsExportResponse(id: string, requestedBy: string, download: boolean): Response {
  const store = getAnalyticsStore();
  const job = store.prepare('SELECT id,state,cursor,created_at,error_code FROM export_jobs WHERE id=? AND requested_by=?').get(id, requestedBy) as { id: string; state: string } | undefined;
  if (!job) return Response.json({ error: 'Export not found.' }, { status: 404 });
  if (!download) return Response.json({ data: job }, { headers: { 'Cache-Control': 'no-store' } });
  if (job.state !== 'complete') return Response.json({ error: 'Export is not complete.' }, { status: 409 });
  let part = 0;
  const body = new ReadableStream({ pull(controller) {
    const row = store.prepare('SELECT part,data FROM export_chunks WHERE job_id=? AND part>? ORDER BY part LIMIT 1').get(id, part) as { part: number; data: string } | undefined;
    if (!row) { controller.close(); return; }
    part = row.part; controller.enqueue(new TextEncoder().encode(row.data));
  } });
  return new Response(body, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/x-ndjson', 'Content-Disposition': `attachment; filename="analytics-${id}.jsonl"` } });
}
