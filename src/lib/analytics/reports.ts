import { z } from 'zod';
import { getAnalyticsStore } from './storage';
import { collectorHealth } from './service';
export const reportQuerySchema = z.object({
  view: z.enum(['overview', 'journeys', 'funnels', 'plans', 'llm', 'health']).default('overview'),
  from: z.string().date(), to: z.string().date(),
  environment: z.enum(['production', 'development', 'test']).default('production'),
  includeAdmins: z.enum(['true', 'false']).default('false'),
  account: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  release: z.string().max(100).optional(),
  device: z.enum(['mobile', 'desktop', 'unknown']).optional(),
  feature: z.enum(['planner', 'expenses', 'currency', 'cities', 'transport', 'auth', 'settings']).optional(),
  cursor: z.coerce.number().int().nonnegative().default(0),
  revision: z.coerce.number().int().positive().optional(),
  export: z.enum(['true', 'false']).optional(),
}).strict().superRefine((v, ctx) => {
  const days = (Date.parse(v.to) - Date.parse(v.from)) / 86400000;
  if (days < 0 || days > 366) ctx.addIssue({ code: 'custom', message: 'Choose an ordered date range of at most 366 days.' });
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export function parseReportQuery(params: URLSearchParams) {
  return reportQuerySchema.parse({ from: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10), ...Object.fromEntries(params) });
}
function predicate(q: ReportQuery, llm = false) {
  const clauses = [`${llm ? 'started_at' : 'received_at'} >= @from`, `${llm ? 'started_at' : 'received_at'} < @until`, 'environment=@environment'];
  const args: Record<string, string | number> = { from: q.from + 'T00:00:00.000Z', until: new Date(Date.parse(q.to) + 86400000).toISOString(), environment: q.environment };
  if (q.includeAdmins === 'false') clauses.push('administrator=0');
  if (q.account) { clauses.push('account_id=@account'); args.account = q.account; }
  if (q.release) { clauses.push('release=@release'); args.release = q.release; }
  if (q.device && !llm) { clauses.push('device=@device'); args.device = q.device; }
  if (q.feature) {
    if (llm) { clauses.push('feature=@feature'); args.feature = q.feature === 'transport' ? 'transport' : 'city'; }
    else {
      const routes: Record<string, string[]> = { planner: ['/plan', '/api/itinerary%', '/api/saved-plans%'], expenses: ['/track%', '/api/expenses%', '/api/tags%'], currency: ['/api/settings/currency'], cities: ['/dataset', '/api/cities%'], transport: ['/api/itinerary/legs/[id]/estimate-transport'], auth: ['/login', '/signup', '/api/auth%'], settings: ['/settings%', '/api/settings%', '/api/planner/settings'] };
      clauses.push('(' + routes[q.feature].map((route, i) => { args['route' + i] = route; return 'route LIKE @route' + i; }).join(' OR ') + ')');
    }
  }
  return { where: clauses.join(' AND '), args };
}
export function buildAnalyticsReport(q: ReportQuery) {
  const database = getAnalyticsStore();
  const { where, args } = predicate(q);
  const generatedAt = new Date().toISOString();
  if (q.view === 'health') return { generatedAt, health: collectorHealth(), interruptedAttempts: database.prepare("SELECT count(*) AS count FROM llm_attempts WHERE status='started' AND started_at < ?").get(new Date(Date.now() - 1200_000).toISOString()) };
  if (q.view === 'journeys') {
    const rows = database.prepare(`SELECT sequence,payload_json FROM events WHERE ${where} AND sequence > @cursor ORDER BY sequence LIMIT 100`).all({ ...args, cursor: q.cursor }) as Array<{ sequence: number; payload_json: string }>;
    return { generatedAt, rows: rows.map(r => ({ sequence: r.sequence, ...JSON.parse(r.payload_json) })), nextCursor: rows.length === 100 ? rows[99].sequence : null };
  }
  if (q.view === 'llm') {
    const llm = predicate(q, true);
    const rows = database.prepare(`SELECT * FROM llm_attempts WHERE ${llm.where} ORDER BY started_at DESC LIMIT 100`).all(llm.args);
    const totals = database.prepare(`SELECT count(*) AS attempts,count(DISTINCT operation_id) AS operations,
      sum(input_tokens) AS inputTokens,sum(output_tokens) AS outputTokens,sum(reasoning_tokens) AS reasoningTokens,
      sum(CASE WHEN input_tokens IS NULL OR output_tokens IS NULL THEN 1 ELSE 0 END) AS unknownUsage,
      sum(CASE WHEN status NOT IN ('received','started') THEN 1 ELSE 0 END) AS failures FROM llm_attempts WHERE ${llm.where}`).get(llm.args);
    const durations = database.prepare(`SELECT duration_ms FROM llm_attempts WHERE ${llm.where} AND duration_ms IS NOT NULL ORDER BY duration_ms`).all(llm.args) as Array<{ duration_ms: number }>;
    return { generatedAt, rows, totals, p50: percentile(durations.map(d => d.duration_ms), .5), p95: percentile(durations.map(d => d.duration_ms), .95), cost: null,
      filterNote: q.device ? 'Provider attempts do not carry device categories; the device filter applies to product events only.' : null };
  }
  if (q.view === 'funnels') {
    // Each stage must occur after its predecessor, within seven days of the first stage.
    const definitions = [
      { name: 'Account activation', steps: ['page_viewed:/signup', 'workflow_step:login_succeeded', 'mutation_committed:leg_created', 'mutation_committed:plan_saved'] },
      { name: 'Planning', steps: ['page_viewed:/plan', 'mutation_committed:leg_created', 'mutation_committed:plan_saved'] },
      { name: 'Wise import', steps: ['workflow_step:preview', 'mutation_committed:expenses_imported'] },
      { name: 'City generation', steps: ['workflow_step:generation_requested', 'request_completed:cities.create-with-generation'] },
    ];
    const events = database.prepare(`SELECT coalesce(account_id,session_id) AS identity,name,received_at,route,payload_json FROM events WHERE ${where} ORDER BY received_at,sequence`).all(args) as Array<{ identity: string | null; name: string; received_at: string; route: string; payload_json: string }>;
    const funnels = definitions.map(def => {
      const progress = new Map<string, { stage: number; start: number }>();
      const counts = def.steps.map(() => 0);
      for (const event of events) {
        if (!event.identity) continue;
        const data = JSON.parse(event.payload_json).properties;
        const value = event.name === 'page_viewed' ? event.route : data.action ?? data.step ?? data.control ?? data.resource;
        const key = event.name + ':' + value;
        const current = progress.get(event.identity) ?? { stage: 0, start: Date.parse(event.received_at) };
        if (current.stage >= def.steps.length || Date.parse(event.received_at) - current.start > 7 * 86400000) continue;
        const expected = def.steps[current.stage];
        if ((expected === key || expected === 'mutation_committed:leg_created' && key === 'mutation_committed:leg_created_with_city') && data.outcome !== 'failure' && (data.status == null || data.status < 400)) {
          counts[current.stage]++; current.stage++; progress.set(event.identity, current);
        }
      }
      return { name: def.name, steps: def.steps.map((step, i) => ({ name: step.split(':')[1], users: counts[i], conversion: counts[0] ? counts[i] / counts[0] : null })) };
    });
    const activation = `name='mutation_committed' AND json_extract(payload_json,'$.properties.action') IN ('leg_created','leg_created_with_city','expenses.post')`;
    const scope = where.replace('received_at >= @from AND received_at < @until AND ', '').replace(/(?<!@)\b(environment|administrator|account_id|release|device|route)\b/g, 'e.$1');
    const cohorts = database.prepare(`WITH activated AS (
      SELECT e.account_id,min(e.received_at) AS activated_at FROM events e WHERE e.account_id IS NOT NULL AND ${activation} AND ${scope} GROUP BY e.account_id
    ) SELECT a.account_id,a.activated_at,
      max(CASE WHEN date(e.received_at)=date(a.activated_at,'+1 day') THEN 1 ELSE 0 END) AS d1,
      max(CASE WHEN date(e.received_at)=date(a.activated_at,'+7 day') THEN 1 ELSE 0 END) AS d7,
      max(CASE WHEN date(e.received_at)=date(a.activated_at,'+30 day') THEN 1 ELSE 0 END) AS d30
      FROM activated a JOIN events e ON e.account_id=a.account_id
      WHERE e.purpose='behavior' AND ${scope} AND a.activated_at>=@from AND a.activated_at<@until GROUP BY a.account_id`).all(args) as Array<{ activated_at: string; d1: number; d7: number; d30: number }>;
    const retention = [1, 7, 30].map(day => {
      const eligible = cohorts.filter(c => Date.parse(c.activated_at.slice(0, 10)) + (day + 1) * 86400000 <= Date.now());
      return { day, eligible: eligible.length, returned: eligible.filter(c => c[('d' + day) as 'd1' | 'd7' | 'd30']).length };
    });
    return { generatedAt, funnels, retention, note: 'Observed journeys only. Opt-outs and blocked requests reduce coverage. Day boundaries are UTC.' };
  }
  const totals = database.prepare(`SELECT count(*) AS events,
    count(DISTINCT CASE WHEN purpose='behavior' THEN account_id END) AS activeAccounts,
    count(DISTINCT CASE WHEN purpose='behavior' THEN session_id END) AS sessions,
    sum(CASE WHEN name='request_completed' AND json_extract(payload_json,'$.properties.status')>=400 THEN 1 ELSE 0 END) AS failedRequests,
    sum(CASE WHEN name='request_completed' THEN 1 ELSE 0 END) AS requests
    FROM events WHERE ${where}`).get(args);
  const daily = database.prepare(`SELECT substr(received_at,1,10) AS day,count(*) AS events,count(DISTINCT CASE WHEN purpose='behavior' THEN account_id END) AS accounts FROM events WHERE ${where} GROUP BY day ORDER BY day`).all(args);
  const features = database.prepare(`SELECT route,count(*) AS events,count(DISTINCT account_id) AS accounts FROM events WHERE ${where} AND purpose='behavior' GROUP BY route ORDER BY events DESC LIMIT 30`).all(args);
  const controls = database.prepare(`SELECT json_extract(payload_json,'$.properties.control') AS control,count(*) AS activations FROM events WHERE ${where} AND name='control_activated' GROUP BY control ORDER BY activations DESC LIMIT 50`).all(args);
  return { generatedAt, totals, daily, features, controls, health: collectorHealth() };
}
function percentile(sorted: number[], quantile: number) { return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)] : null; }
