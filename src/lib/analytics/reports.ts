import { readAnalyticsQuery, type AnalyticsReader } from './reader';
import { collectorHealth } from './service';
import { predicate, type ReportQuery } from './query';
export { parseReportQuery, reportQuerySchema, predicate } from './query';
export type { ReportQuery } from './query';
export async function buildAnalyticsReport(q: ReportQuery, reader: AnalyticsReader = readAnalyticsQuery) {
  const read = reader;
  const { where, args } = predicate(q);
  const generatedAt = new Date().toISOString();
  if (q.view === 'health') return { generatedAt, health: collectorHealth(),
    interruptedAttempts: (await read("SELECT count(*) AS count FROM llm_attempts WHERE status='interrupted' OR (status='started' AND started_at < ?)", new Date(Date.now() - 1800000).toISOString(), 'get')),
    requestHealth: (await read(`SELECT route,count(*) AS requests,sum(CASE WHEN status>=400 THEN 1 ELSE 0 END) AS failures,round(avg(duration_ms),2) AS averageMs FROM events WHERE ${where} AND name='request_completed' GROUP BY route ORDER BY failures DESC LIMIT 50`, args, 'all')),
    vitals: await Promise.all(((await read(`SELECT metric_name AS metric,count(*) AS samples,round(max(metric_value),2) AS worst FROM events WHERE ${where} AND name='web_vital' GROUP BY metric`, args, 'all')) as Array<{ metric: string; samples: number; worst: number }>)
      // Web Vitals are conventionally summarised at the 75th percentile of page loads.
      .map(async row => ({ ...row, p75: ((await read(`SELECT round(metric_value,2) AS value FROM events WHERE ${where} AND name='web_vital' AND metric_name=@metric ORDER BY metric_value LIMIT 1 OFFSET @offset`,
        { ...args, metric: row.metric, offset: Math.max(0, Math.ceil(row.samples * 0.75) - 1) }, 'get')) as { value: number } | undefined)?.value ?? null }))),
    errorGroups: (await read(`SELECT name,json_extract(payload_json,'$.properties.fingerprint') AS fingerprint,count(*) AS occurrences FROM events WHERE ${where} AND name IN ('server_error','browser_error') GROUP BY name,fingerprint ORDER BY occurrences DESC LIMIT 30`, args, 'all')),
  };
  if (q.view === 'journeys') {
    const index = q.operation ? 'events_operation' : q.account ? 'events_account_time' : 'events_timeline_all';
    const rows = (await read(`SELECT sequence,payload_json FROM events INDEXED BY ${index} WHERE ${where} AND (@cursor=0 OR sequence < @cursor) ORDER BY sequence DESC LIMIT 100`, { ...args, cursor: q.cursor }, 'all')) as Array<{ sequence: number; payload_json: string }>;
    return { generatedAt, rows: rows.map(r => ({ sequence: r.sequence, ...JSON.parse(r.payload_json) })), nextCursor: rows.length === 100 ? rows[99].sequence : null };
  }
  if (q.view === 'llm') {
    const llm = predicate(q, true);
    const rows = (await read(`SELECT rowid AS sequence,* FROM llm_attempts WHERE ${llm.where} AND (@cursor=0 OR rowid<@cursor) ORDER BY rowid DESC LIMIT 100`, { ...llm.args, cursor: q.cursor }, 'all')) as Array<Record<string, unknown> & { sequence: number }>;
    const totals = (await read(`SELECT count(*) AS attempts,count(DISTINCT operation_id) AS operations,
      sum(input_tokens) AS inputTokens,sum(output_tokens) AS outputTokens,sum(reasoning_tokens) AS reasoningTokens,
      sum(CASE WHEN input_tokens IS NULL OR output_tokens IS NULL THEN 1 ELSE 0 END) AS unknownUsage,
      sum(CASE WHEN status NOT IN ('received','started') THEN 1 ELSE 0 END) AS failures FROM llm_attempts WHERE ${llm.where}`, llm.args, 'get'));
    const durationCount = (await read(`SELECT count(*) AS n FROM llm_attempts WHERE ${llm.where} AND duration_ms IS NOT NULL`, llm.args, 'get')) as { n: number };
    const quantile = async (value: number) => durationCount.n ? ((await read(`SELECT duration_ms FROM llm_attempts WHERE ${llm.where} AND duration_ms IS NOT NULL ORDER BY duration_ms LIMIT 1 OFFSET @offset`, { ...llm.args, offset: Math.max(0, Math.ceil(durationCount.n * value) - 1) }, 'get')) as { duration_ms: number }).duration_ms : null;
    return { generatedAt, rows, nextCursor: rows.length === 100 ? rows[99].sequence : null, totals, p50: await quantile(.5), p95: await quantile(.95), cost: null,
      filterNote: q.device ? 'Provider attempts do not carry device categories; the device filter applies to product events only.' : null };
  }
  if (q.view === 'funnels') {
    // Each stage must occur after its predecessor, within seven days of the first stage.
    const definitions = [
      { name: 'Account activation', steps: ['page_viewed:/signup', 'workflow_step:signup_created', 'workflow_step:verification_completed', 'workflow_step:login_succeeded', 'mutation_committed:leg_created', 'mutation_committed:plan_saved'] },
      { name: 'Planning', steps: ['page_viewed:/plan', 'mutation_committed:leg_created', 'mutation_committed:plan_saved'] },
      { name: 'Wise import', steps: ['workflow_step:preview', 'mutation_committed:expenses_imported'] },
      { name: 'City generation', steps: ['workflow_step:generation_requested', 'request_completed:cities.create-with-generation'] },
    ];
    const funnels = await Promise.all(definitions.map(async def => {
      const funnelIndex = q.operation ? 'events_operation' : q.account ? 'events_account_time' : 'events_funnel_v2';
      const bindings = { ...args };
      const stages = def.steps.map((step, index) => {
        const [name, value] = step.split(':'); bindings['name' + index] = name; bindings['value' + index] = value;
        const field = name === 'page_viewed' ? 'route' : 'stage_value';
        const match = `name=@name${index} AND (${field}=@value${index}${value === 'leg_created' ? ` OR ${field}='leg_created_with_city'` : ''})${name === 'page_viewed' ? ' AND stage_value IS NULL' : ''}${name === 'request_completed' ? ' AND status<400' : ''}`;
        if (!index) return `s0 AS (SELECT event_identity AS identity,min(sequence) AS seq,received_at AS started_at FROM events INDEXED BY ${funnelIndex} WHERE ${where} AND ${match} AND event_identity IS NOT NULL GROUP BY event_identity)`;
        return `s${index} AS (SELECT s${index - 1}.identity,s${index - 1}.started_at,min(e.sequence) AS seq FROM events e INDEXED BY ${funnelIndex} JOIN s${index - 1} ON e.event_identity=s${index - 1}.identity WHERE ${where} AND ${match} AND e.sequence>s${index - 1}.seq AND julianday(e.received_at)-julianday(s${index - 1}.started_at)<=7 GROUP BY s${index - 1}.identity)`;
      });
      const counts = ((await read('WITH ' + stages.join(',') + ' ' + def.steps.map((_, i) => `SELECT count(*) AS n FROM s${i}`).join(' UNION ALL '), bindings, 'all')) as Array<{ n: number }>).map(row => row.n);
      return { name: def.name, steps: def.steps.map((step, i) => ({ name: step.split(':')[1], users: counts[i], conversion: counts[0] ? counts[i] / counts[0] : null })) };
    }));
    const activation = `name='mutation_committed' AND stage_value IN ('leg_created','leg_created_with_city','expenses.post')`;
    const scope = where.replace('received_at >= @from AND received_at < @until AND ', '').replace(/(?<!@)\b(environment|administrator|account_id|operation_id|release|device|route)\b/g, 'e.$1');
    const activitySource = q.operation ? 'events e INDEXED BY events_account_time' : 'event_rollups e INDEXED BY event_rollups_account_day';
    const activityDate = q.operation ? 'date(e.received_at)' : 'e.day';
    const activityTime = q.operation ? 'e.received_at' : 'e.day';
    const activationSource = q.operation ? 'events e INDEXED BY events_operation' : 'event_rollups e';
    const activationTime = q.operation ? 'e.received_at' : 'e.day';
    const cohortWindow = q.operation ? 'a.activated_at>=@from AND a.activated_at<@until' : 'a.activated_at>=substr(@from,1,10) AND a.activated_at<substr(@until,1,10)';
    const cohorts = (await read(`WITH activated AS (
      SELECT e.account_id,min(${activationTime}) AS activated_at FROM ${activationSource} WHERE e.account_id IS NOT NULL ${q.operation ? '' : "AND e.account_id!=''"} AND ${activation} AND ${scope} GROUP BY e.account_id
    ) SELECT a.account_id,a.activated_at,
      max(CASE WHEN ${activityDate}=date(a.activated_at,'+1 day') THEN 1 ELSE 0 END) AS d1,
      max(CASE WHEN ${activityDate}=date(a.activated_at,'+7 day') THEN 1 ELSE 0 END) AS d7,
      max(CASE WHEN ${activityDate}=date(a.activated_at,'+30 day') THEN 1 ELSE 0 END) AS d30
      FROM activated a LEFT JOIN ${activitySource} ON e.account_id=a.account_id
      AND e.purpose='behavior' ${q.operation ? '' : "AND e.account_id!=''"} AND ${scope} AND ${activityTime}>=date(a.activated_at,'+1 day') AND ${activityTime}<date(a.activated_at,'+31 day')
      WHERE ${cohortWindow} GROUP BY a.account_id`, args, 'all')) as Array<{ activated_at: string; d1: number; d7: number; d30: number }>;
    const retention = [1, 7, 30].map(day => {
      const eligible = cohorts.filter(c => Date.parse(c.activated_at.slice(0, 10)) + (day + 1) * 86400000 <= Date.now());
      return { day, eligible: eligible.length, returned: eligible.filter(c => c[('d' + day) as 'd1' | 'd7' | 'd30']).length };
    });
    return { generatedAt, funnels, retention, note: 'Observed journeys only. Opt-outs and blocked requests reduce coverage. Day boundaries are UTC.' };
  }
  if (!q.operation) {
    const rollupWhere = where.replace('received_at >= @from AND received_at < @until', 'day >= substr(@from,1,10) AND day < substr(@until,1,10)');
    const totals = await read(`SELECT coalesce(sum(event_count),0) AS events,
      count(DISTINCT CASE WHEN purpose='behavior' THEN nullif(account_id,'') END) AS activeAccounts,
      (SELECT count(DISTINCT session_id) FROM event_sessions WHERE ${rollupWhere}) AS sessions,
      sum(CASE WHEN name='request_completed' AND failed=1 THEN event_count ELSE 0 END) AS failedRequests,
      sum(CASE WHEN name='request_completed' THEN event_count ELSE 0 END) AS requests FROM event_rollups WHERE ${rollupWhere}`, args, 'get');
    const daily = await read(`SELECT day,sum(event_count) AS events,count(DISTINCT CASE WHEN purpose='behavior' THEN nullif(account_id,'') END) AS accounts FROM event_rollups WHERE ${rollupWhere} GROUP BY day ORDER BY day`, args);
    const features = await read(`SELECT route,sum(event_count) AS events,count(DISTINCT nullif(account_id,'')) AS accounts FROM event_rollups WHERE ${rollupWhere} AND purpose='behavior' GROUP BY route ORDER BY events DESC LIMIT 30`, args);
    const controls = await read(`SELECT nullif(control_id,'') AS control,sum(event_count) AS activations FROM event_rollups WHERE ${rollupWhere} AND name='control_activated' GROUP BY control_id ORDER BY activations DESC LIMIT 50`, args);
    return { generatedAt, totals, daily, features, controls, health: collectorHealth() };
  }
  const totals = (await read(`SELECT count(*) AS events,
    count(DISTINCT CASE WHEN purpose='behavior' THEN account_id END) AS activeAccounts,
    count(DISTINCT CASE WHEN purpose='behavior' THEN session_id END) AS sessions,
    sum(CASE WHEN name='request_completed' AND status>=400 THEN 1 ELSE 0 END) AS failedRequests,
    sum(CASE WHEN name='request_completed' THEN 1 ELSE 0 END) AS requests
    FROM events WHERE ${where}`, args, 'get'));
  const daily = (await read(`SELECT substr(received_at,1,10) AS day,count(*) AS events,count(DISTINCT CASE WHEN purpose='behavior' THEN account_id END) AS accounts FROM events WHERE ${where} GROUP BY day ORDER BY day`, args, 'all'));
  const features = (await read(`SELECT route,count(*) AS events,count(DISTINCT account_id) AS accounts FROM events WHERE ${where} AND purpose='behavior' GROUP BY route ORDER BY events DESC LIMIT 30`, args, 'all'));
  const controls = (await read(`SELECT control_id AS control,count(*) AS activations FROM events WHERE ${where} AND name='control_activated' GROUP BY control_id ORDER BY activations DESC LIMIT 50`, args, 'all'));
  return { generatedAt, totals, daily, features, controls, health: collectorHealth() };
}
