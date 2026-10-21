'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, LineChart, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, StatTile } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';
import {
  UNAVAILABLE, VITALS, actionLabel, describeProperties, eventLabel, formatAud, formatBytes, formatDateTime, formatDay,
  daysBefore, defaultThrough, formatDiffValue, formatDuration, formatNumber, formatVital, humanize, rateVital, routeLabel, stepLabel, zeroFillDays,
} from './format';

type Row = Record<string, unknown>;
interface Report {
  generatedAt?: string; totals?: Record<string, number | null>; daily?: Array<{ day: string; events: number; accounts: number }>;
  features?: Row[]; controls?: Row[]; rows?: Row[]; nextCursor?: number | null; note?: string;
  health?: Row; interruptedAttempts?: Row; p50?: number | null; p95?: number | null;
  requestHealth?: Row[]; vitals?: Row[]; errorGroups?: Row[];
  /** Pseudonymous account ID → email, served to analytics administrators with every report. */
  accounts?: Record<string, string>;
  funnels?: Array<{ name: string; steps: Array<{ name: string; users: number; conversion: number | null }> }>;
  retention?: Array<{ day: number; eligible: number; returned: number }>;
}
const VIEWS = [
  { id: 'overview', label: 'Overview' }, { id: 'journeys', label: 'Journeys' }, { id: 'funnels', label: 'Funnels' },
  { id: 'plans', label: 'Plan history' }, { id: 'llm', label: 'LLM' }, { id: 'health', label: 'Health' },
] as const;
type View = (typeof VIEWS)[number]['id'];
const FEATURES = ['planner', 'expenses', 'currency', 'cities', 'transport', 'auth', 'settings'];

interface Filters { view: View; from: string; to: string; environment: string; admins: boolean; account: string; operation: string; release: string; feature: string; device: string }
function defaultFilters(environment: string): Filters {
  // Administrators are included by default: on a private, owner-run deployment they are most of the use.
  const to = defaultThrough();
  return { view: 'overview', from: daysBefore(to, 29), to, environment, admins: true, account: '', operation: '', release: '', feature: '', device: '' };
}
/** Filters live in the URL, so a reload or a shared link reopens the same report. */
function filtersFromUrl(environment: string): Filters {
  const base = defaultFilters(environment);
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  return {
    ...base,
    view: VIEWS.some(v => v.id === view) ? view as View : base.view,
    from: params.get('from') ?? base.from, to: params.get('to') ?? base.to,
    environment: params.get('environment') ?? base.environment,
    admins: params.has('includeAdmins') ? params.get('includeAdmins') === 'true' : base.admins,
    account: params.get('account') ?? '', operation: params.get('operation') ?? '', release: params.get('release') ?? '',
    feature: params.get('feature') ?? '', device: params.get('device') ?? '',
  };
}

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const thClass = '[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:border-b [&>th]:bg-secondary [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold [&>th]:whitespace-nowrap';

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={cn('grid gap-1.5 text-xs font-semibold text-slate-700', className)}>{label}{children}</label>;
}

interface Column { key: string; label: string; className?: string; render?: (value: unknown, row: Row) => ReactNode }
function DataTable({ rows, columns, empty = 'Nothing recorded for these filters.', minWidth }: { rows: Row[]; columns: Column[]; empty?: string; minWidth?: string }) {
  if (!rows.length) return <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  return <div className="max-h-[32rem] overflow-auto rounded-xl border">
    <table className={cn('w-full border-separate border-spacing-0 text-sm', minWidth)}>
      <thead className="text-xs text-slate-600"><tr className={thClass}>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={String(row.id ?? row.sequence ?? i)} className="align-top hover:bg-secondary [&>td]:border-b">
        {columns.map(c => <td key={c.key} className={cn('px-3 py-2', c.className)}>{c.render ? c.render(row[c.key], row) : formatCell(row[c.key])}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}
function formatCell(value: unknown) { return typeof value === 'number' ? formatNumber(value) : value == null || value === '' ? UNAVAILABLE : String(value); }

function Section({ title, description, action, children }: { title: string; description?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return <Card>
    <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
      <div className="space-y-1"><CardTitle>{title}</CardTitle>{description ? <CardDescription>{description}</CardDescription> : null}</div>
      {action}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>;
}

function shortId(value: unknown) { return String(value).slice(0, 8); }

export function AnalyticsDashboard({ initialEnvironment, selfAccountId }: { initialEnvironment: string; selfAccountId: string }) {
  const [filters, setFilters] = useState<Filters>(() => filtersFromUrl(initialEnvironment));
  const [showMore, setShowMore] = useState(() => { const f = filtersFromUrl(initialEnvironment); return Boolean(f.account || f.operation || f.release || f.feature || f.device || f.environment !== initialEnvironment); });
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState<Row | null>(null);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [exportJob, setExportJob] = useState<{ id: string; state: string } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [erasureStatus, setErasureStatus] = useState<string | null>(null);
  // Kept across reloads so names don't flicker back to IDs while a report loads.
  const [directory, setDirectory] = useState<Record<string, string>>({});
  const generation = useRef(0);
  const set = (patch: Partial<Filters>) => setFilters(current => ({ ...current, ...patch }));
  const { view, from, to, environment, admins, account, operation, release, feature, device } = filters;

  const query = useCallback((cursor = 0) => {
    const params = new URLSearchParams({ view, from, to, environment, includeAdmins: String(admins), cursor: String(cursor) });
    if (account) params.set('account', account); if (release) params.set('release', release); if (feature) params.set('feature', feature);
    if (device) params.set('device', device); if (operation) params.set('operation', operation);
    return params;
  }, [view, from, to, environment, admins, account, release, feature, device, operation]);

  useEffect(() => {
    const params = query(); params.delete('cursor');
    window.history.replaceState(null, '', window.location.pathname + '?' + params);
  }, [query]);

  const load = useCallback(async (cursor = 0) => {
    const append = cursor > 0;
    const version = ++generation.current;
    setLoading(true); setError(null);
    try {
      const response = await fetch('/api/admin/analytics?' + query(cursor), { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !body.data || typeof body.data !== 'object') throw new Error(body.error || 'Analytics could not be loaded.');
      if (version !== generation.current) return;
      if (body.data.accounts && typeof body.data.accounts === 'object') setDirectory(body.data.accounts);
      setData(current => append ? { ...body.data, rows: [...current?.rows ?? [], ...body.data.rows ?? []] } : body.data);
    } catch (err) { if (version === generation.current) setError(err instanceof Error ? err.message : 'Analytics could not be loaded.'); }
    finally { if (version === generation.current) setLoading(false); }
  }, [query]);
  useEffect(() => {
    const version = generation.current;
    const timer = setTimeout(() => { setRevision(null); setData(null); void load(); }, 0);
    return () => { clearTimeout(timer); generation.current = version + 1000; };
  }, [load]);

  async function inspect(id: unknown) {
    setRevisionError(null);
    try {
      const params = query(); params.set('view', 'plans'); params.set('revision', String(id));
      const response = await fetch('/api/admin/analytics?' + params, { cache: 'no-store' }); const body = await response.json();
      if (!response.ok || !body?.data?.snapshot) throw new Error(body.error || 'Revision unavailable.');
      setRevision(body.data);
    } catch (err) { setRevisionError(err instanceof Error ? err.message : 'Revision unavailable.'); }
  }
  async function startExport() {
    setExportError(null);
    try {
      const response = await fetch('/api/admin/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filters: Object.fromEntries(query()) }) });
      const body = await response.json();
      if (!response.ok || !body?.data?.id) throw new Error(body.error || 'Export could not be queued.');
      setExportJob(body.data);
    } catch (err) { setExportError(err instanceof Error ? err.message : 'Export could not be queued.'); }
  }
  async function eraseAccount() {
    if (!/^[a-f0-9]{64}$/.test(account) || !window.confirm('Erase analytics, LLM records and private plan revisions for this account? Current app data stays saved. Existing analytics exports will also be removed.')) return;
    setErasureStatus('Erasing…');
    try {
      const response = await fetch('/api/admin/analytics', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account }) });
      const body = await response.json();
      if (!response.ok || body?.data?.erased !== true) throw new Error(body.error || 'Erasure could not be confirmed.');
      setErasureStatus('Recorded analytics and history erased. Future collection follows the account preference.');
      setExportJob(null); setRevision(null); void load();
    } catch (err) { setErasureStatus(err instanceof Error ? err.message : 'Erasure could not be confirmed. Retry.'); }
  }
  useEffect(() => {
    if (!exportJob || !['queued', 'running'].includes(exportJob.state)) return;
    let cancelled = false;
    const timer = setInterval(() => { void fetch('/api/admin/analytics?exportJob=' + exportJob.id).then(async response => {
      const body = await response.json(); if (!response.ok || !body?.data?.state) throw new Error(body.error || 'Export status unavailable.');
      if (!cancelled) setExportJob(body.data);
    }).catch(() => { if (!cancelled) setExportError('Export status unavailable. Refresh to retry.'); }); }, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [exportJob]);

  /** An account as "You" or a short pseudonymous ID; clicking filters the report to it. */
  const accountName = (value: string) => value === selfAccountId ? 'You' : directory[value] ?? shortId(value);
  const accountButton = (value: unknown) => value
    ? <button data-analytics="analytics.filter-account" type="button" title={(directory[String(value)] ? directory[String(value)] + ' · ' : '') + String(value)} className="font-medium text-brand-teal underline-offset-2 hover:underline" onClick={() => set({ account: String(value) })}>{accountName(String(value))}</button>
    : <span className="text-muted-foreground">Signed out</span>;
  const operationButton = (value: unknown) => value
    ? <button data-analytics="analytics.filter-operation" type="button" title={String(value)} className="font-mono text-xs text-brand-teal underline-offset-2 hover:underline" onClick={() => set({ operation: String(value) })}>{shortId(value)}</button>
    : <span className="text-muted-foreground">{UNAVAILABLE}</span>;
  const moreFiltersActive = Boolean(account || operation || release || feature || device || environment !== initialEnvironment);

  return <div className="min-w-0 space-y-5">
    <PageHeader icon={LineChart} title="Analytics" description="How the app is used, private plan history and LLM provider diagnostics. Only analytics administrators can open this page."
      actions={<Button data-analytics="analytics.refresh" variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />Refresh</Button>} />

    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From" className="w-40"><Input type="date" value={from} max={to} onChange={e => set({ from: e.target.value })} /></Field>
          <Field label="Through" className="w-40"><Input type="date" value={to} min={from} onChange={e => set({ to: e.target.value })} /></Field>
          <label className="flex h-10 items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--brand-teal))]" checked={admins} onChange={e => set({ admins: e.target.checked })} />Include administrators</label>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button data-analytics="analytics.more-filters" variant="ghost" size="sm" aria-expanded={showMore} onClick={() => setShowMore(v => !v)}><SlidersHorizontal className="mr-2 h-4 w-4" />{showMore ? 'Fewer filters' : 'More filters'}{moreFiltersActive && !showMore ? <Badge variant="secondary" className="ml-1">on</Badge> : null}</Button>
            {moreFiltersActive ? <Button data-analytics="analytics.clear-filters" variant="ghost" size="sm" onClick={() => set({ account: '', operation: '', release: '', feature: '', device: '', environment: initialEnvironment })}>Clear filters</Button> : null}
          </div>
        </div>
        {showMore ? <div className="grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Environment"><select className={selectClass} value={environment} onChange={e => set({ environment: e.target.value })}>{['production', 'development', 'test'].map(v => <option key={v} value={v}>{humanize(v)}</option>)}</select></Field>
          <Field label="Feature"><select className={selectClass} value={feature} onChange={e => set({ feature: e.target.value })}><option value="">All features</option>{FEATURES.map(v => <option key={v} value={v}>{humanize(v)}</option>)}</select></Field>
          <Field label="Device"><select className={selectClass} value={device} onChange={e => set({ device: e.target.value })}><option value="">All devices</option>{['mobile', 'desktop', 'unknown'].map(v => <option key={v} value={v}>{humanize(v)}</option>)}</select></Field>
          <Field label="Account"><select className={selectClass} value={account} onChange={e => set({ account: e.target.value })}>
            <option value="">All accounts</option>
            {account && !directory[account] ? <option value={account}>{shortId(account)} (no longer an account)</option> : null}
            {Object.entries(directory).sort(([, a], [, b]) => a.localeCompare(b)).map(([id, email]) => <option key={id} value={id}>{id === selfAccountId ? email + ' (you)' : email}</option>)}
          </select></Field>
          <Field label="Operation ID"><Input placeholder="All operations" value={operation} onChange={e => set({ operation: e.target.value.trim() })} /></Field>
          <Field label="Release"><Input placeholder="All releases" value={release} onChange={e => set({ release: e.target.value.trim() })} /></Field>
        </div> : null}
      </CardContent>
    </Card>

    <Tabs value={view} onValueChange={value => set({ view: value as View })} className="gap-0">
      <div className="overflow-x-auto"><TabsList className="h-9">
        {VIEWS.map(v => <TabsTrigger data-analytics={'analytics.' + v.id} key={v.id} value={v.id} className="px-3">{v.label}</TabsTrigger>)}
      </TabsList></div>
    </Tabs>

    {loading && !data ? <p role="status" className="text-sm text-muted-foreground">Loading analytics…</p> : null}
    {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error} {data ? 'The figures below are from the previous load.' : 'Results unavailable.'} <Button data-analytics="analytics.retry" variant="link" className="h-auto p-0" onClick={() => void load()}>Retry</Button></div> : null}

    {data ? <div className="space-y-5">
      {data.note ? <p className="text-sm text-muted-foreground">{data.note}</p> : null}

      {view === 'overview' ? <>
        <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
          <StatTile label="Active accounts" value={formatNumber(data.totals?.activeAccounts ?? 0)} subtext="Signed-in accounts with activity" />
          <StatTile label="Sessions" value={formatNumber(data.totals?.sessions ?? 0)} subtext="Browser tabs, 30 minutes idle ends one" />
          <StatTile label="Events recorded" value={formatNumber(data.totals?.events ?? 0)} subtext="Usage plus server diagnostics" />
          <StatTile label="Failed API requests" tone={(data.totals?.failedRequests ?? 0) > 0 ? 'warn' : 'default'} value={formatNumber(data.totals?.failedRequests ?? 0)} subtext={'of ' + formatNumber(data.totals?.requests ?? 0) + ' requests'} />
        </div>
        <Section title="Daily activity" description="Events per day, all sources. Days are UTC.">
          <div className="h-60"><ResponsiveContainer width="100%" height="100%">
            <AreaChart data={zeroFillDays(data.daily || [], from, to, { events: 0, accounts: 0 })} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tickFormatter={day => formatDay(day)} tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} width={44} />
              <Tooltip labelFormatter={day => formatDay(String(day), true)} formatter={(value, name) => [formatNumber(value), name === 'events' ? 'Events' : 'Accounts']} />
              <Area type="monotone" dataKey="events" stroke="#0f766e" strokeWidth={2} fill="#0f766e" fillOpacity={0.1} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer></div>
        </Section>
        <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start">
          <Section title="Pages" description="Usage events by page, excluding server diagnostics.">
            <DataTable rows={data.features || []} columns={[{ key: 'route', label: 'Page', render: routeLabel }, { key: 'events', label: 'Events' }, { key: 'accounts', label: 'Accounts' }]} />
          </Section>
          <Section title="Controls used" description="Buttons, links and switches, by how often they were used.">
            <DataTable rows={data.controls || []} columns={[{ key: 'control', label: 'Control', render: v => <span title={String(v)}>{v ? humanize(String(v)) : UNAVAILABLE}</span> }, { key: 'activations', label: 'Uses' }]} />
          </Section>
        </div>
      </> : null}

      {view === 'journeys' ? <Section title="Event timeline" description="Newest first. Hover a time to see when the server received it."
        action={<Button data-analytics="analytics.export" variant="outline" size="sm" disabled={exportJob?.state === 'queued' || exportJob?.state === 'running'} onClick={() => void startExport()}><Download className="mr-2 h-4 w-4" />Export matched events</Button>}>
        {exportJob ? <p className="mb-3 text-sm" role="status">Export {exportJob.state}. {exportJob.state === 'complete' ? <a data-analytics="analytics.export-download" className="font-medium text-brand-teal underline" href={'/api/admin/analytics?exportJob=' + exportJob.id + '&download=true'}>Download JSON Lines</a> : null}</p> : null}
        {exportError ? <p role="alert" className="mb-3 text-sm text-destructive">{exportError}</p> : null}
        <DataTable minWidth="min-w-[860px]" rows={data.rows || []} columns={[
          { key: 'occurredAt', label: 'When', className: 'whitespace-nowrap', render: (v, row) => <span title={'Received ' + formatDateTime(row.receivedAt)}>{formatDateTime(v)}</span> },
          { key: 'name', label: 'Event', render: v => <span title={String(v)} className="font-medium">{eventLabel(v)}</span> },
          { key: 'accountId', label: 'Account', render: accountButton },
          { key: 'route', label: 'Page', render: routeLabel },
          { key: 'properties', label: 'Details', render: v => <DetailList value={v} onInspect={id => void inspect(id)} /> },
          { key: 'operationId', label: 'Operation', render: operationButton },
        ]} />
      </Section> : null}

      {view === 'funnels' ? <>
        <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start">
          {data.funnels?.map(funnel => <Section key={funnel.name} title={funnel.name} description="Distinct people reaching each step within seven days, in order.">
            <Funnel steps={funnel.steps} />
          </Section>)}
        </div>
        <Section title="Return after activation" description="Accounts that came back 1, 7 and 30 days after first adding a leg or expense. Only accounts old enough to have reached that day count.">
          <div className="grid gap-3.5 sm:grid-cols-3">{(data.retention || []).map(r => <StatTile key={r.day} label={'Day ' + r.day} value={r.eligible ? Math.round(r.returned / r.eligible * 100) + '%' : UNAVAILABLE} subtext={formatNumber(r.returned) + ' of ' + formatNumber(r.eligible) + ' accounts'} />)}</div>
        </Section>
      </> : null}

      {view === 'plans' ? <Section title="Plan history" description="Every saved change to a plan. History began when analytics was installed.">
        <DataTable minWidth="min-w-[760px]" rows={data.rows || []} columns={[
          { key: 'created_at', label: 'When', className: 'whitespace-nowrap', render: formatDateTime },
          { key: 'user_id', label: 'Account', render: accountButton },
          { key: 'plan_name', label: 'Plan', render: (v, row) => <span className="font-medium">{v ? String(v) : UNAVAILABLE}{row.deleted ? <Badge variant="secondary" className="ml-2">Deleted</Badge> : null}</span> },
          { key: 'action', label: 'Change', className: 'whitespace-nowrap', render: actionLabel },
          { key: 'summary', label: 'Plan totals', render: v => <PlanSummary value={v} /> },
          { key: 'id', label: '', render: id => <Button data-analytics="analytics.view-revision" variant="link" className="h-auto p-0" onClick={() => void inspect(id)}>View revision</Button> },
        ]} />
      </Section> : null}

      {view === 'llm' ? <>
        <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
          <StatTile label="Operations" value={formatNumber(data.totals?.operations ?? 0)} subtext="Generation or estimate requests" />
          <StatTile label="Provider attempts" value={formatNumber(data.totals?.attempts ?? 0)} subtext="Including retries" />
          <StatTile label="Duration" value={formatDuration(data.p50)} subtext={'median · p95 ' + formatDuration(data.p95)} />
          <StatTile label="Tokens" value={formatNumber(data.totals?.outputTokens ?? null)} subtext={'output · input ' + formatNumber(data.totals?.inputTokens ?? null)} />
        </div>
        <Section title="Provider attempts" description="One row per request to a provider. Cost is not shown: requests use each person's own API key.">
          <DataTable minWidth="min-w-[980px]" rows={data.rows || []} columns={[
            { key: 'started_at', label: 'Started', className: 'whitespace-nowrap', render: formatDateTime },
            { key: 'account_id', label: 'Account', render: accountButton },
            { key: 'feature', label: 'Feature', render: v => humanize(String(v ?? '')) || UNAVAILABLE },
            { key: 'provider', label: 'Provider', render: v => humanize(String(v ?? '')) || UNAVAILABLE },
            { key: 'model', label: 'Model' },
            { key: 'effort', label: 'Effort' },
            { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
            { key: 'duration_ms', label: 'Duration', className: 'whitespace-nowrap', render: formatDuration },
            { key: 'input_tokens', label: 'Input tokens' },
            { key: 'output_tokens', label: 'Output tokens' },
            { key: 'attempt_number', label: 'Attempt' },
            { key: 'operation_id', label: 'Operation', render: operationButton },
          ]} />
          <p className="mt-3 text-xs text-muted-foreground">Missing token counts mean the provider did not report them. A received response does not mean the result was valid or saved; filter by its operation to see what happened next.</p>
        </Section>
      </> : null}

      {view === 'health' ? <HealthView data={data} account={account} erasureStatus={erasureStatus} onErase={() => void eraseAccount()} /> : null}

      {data.nextCursor ? <Button data-analytics="analytics.load-more" disabled={loading} variant="outline" onClick={() => void load(data.nextCursor ?? 0)}>Load older records</Button> : null}

      {revisionError ? <p role="alert" className="text-sm text-destructive">{revisionError}</p> : null}
      {revision ? <Section title={'Revision ' + formatCell(revision.id)} description="What changed compared with the previous revision of this plan. Includes private itinerary details."
        action={<a data-analytics="analytics.export-revision" className="text-sm font-medium text-brand-teal underline" href={'/api/admin/analytics?' + new URLSearchParams({ view: 'plans', from, to, revision: String(revision.id), export: 'true' })}>Export private revision</a>}>
        <DataTable empty="No differences: this is the first revision of the plan." rows={diffRows(revision.previous, revision.snapshot).slice(0, 1000)} columns={[
          { key: 'field', label: 'Field', render: v => <span className="font-mono text-xs">{String(v)}</span> },
          { key: 'before', label: 'Before', render: formatDiffValue }, { key: 'after', label: 'After', render: formatDiffValue },
        ]} />
      </Section> : null}

      <p className="text-xs text-muted-foreground">{data.generatedAt ? `Updated ${formatDateTime(data.generatedAt)}. ` : ''}Times are in your timezone; daily totals use UTC days. People who turned analytics off, and events a browser could not send, are not counted. Records have no scheduled expiry.</p>
    </div> : null}
  </div>;
}

function diffRows(before: unknown, after: unknown, prefix = ''): Row[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    const a = before as Row, b = after as Row;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(key => diffRows(a[key], b[key], prefix ? prefix + '.' + key : key));
  }
  return [{ field: prefix, before: before ?? null, after: after ?? null }];
}

function DetailList({ value, onInspect }: { value: unknown; onInspect: (id: number) => void }) {
  const pairs = describeProperties(value);
  const revisionId = value && typeof value === 'object' ? (value as Row).revisionId : undefined;
  if (!pairs.length) return <span className="text-muted-foreground">{UNAVAILABLE}</span>;
  return <div className="flex flex-wrap items-center gap-1.5">
    {pairs.filter(([label]) => label !== 'Revision id').map(([label, text]) => <span key={label} className="rounded-md bg-secondary px-1.5 py-0.5 text-xs"><span className="text-muted-foreground">{label}:</span> {text}</span>)}
    {typeof revisionId === 'number' ? <Button data-analytics="analytics.inspect-revision" variant="link" className="h-auto p-0 text-xs" onClick={() => onInspect(revisionId)}>Inspect revision</Button> : null}
  </div>;
}

function PlanSummary({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object') return <span className="text-muted-foreground">{UNAVAILABLE}</span>;
  const s = value as Row;
  return <span className="whitespace-nowrap">{formatNumber(s.legCount)} legs · {formatNumber(s.totalNights)} nights · {formatAud(s.totalBudgetAud)}</span>;
}

function Funnel({ steps }: { steps: Array<{ name: string; users: number; conversion: number | null }> }) {
  if (!steps.length || !steps[0].users) return <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">Nobody started this journey in the selected period.</p>;
  return <ol className="space-y-3">{steps.map((step, i) => <li key={step.name} className="space-y-1">
    <div className="flex items-baseline justify-between gap-3 text-sm"><span><span className="mr-2 text-xs text-muted-foreground">{i + 1}</span>{stepLabel(step.name)}</span>
      <span className="tabular-nums"><strong>{formatNumber(step.users)}</strong> <span className="text-muted-foreground">{step.conversion == null ? '' : '· ' + Math.round(step.conversion * 100) + '%'}</span></span></div>
    <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-brand-teal" style={{ width: Math.max(2, Math.round((step.conversion ?? 0) * 100)) + '%' }} /></div>
  </li>)}</ol>;
}

function StatusBadge({ status }: { status: unknown }) {
  const value = String(status ?? '');
  const ok = value === 'received' || value === 'completed' || value === 'success';
  const pending = value === 'started';
  return <Badge variant={ok ? 'outline' : pending ? 'secondary' : 'destructive'} className={ok ? 'border-[#CDEBD9] bg-success-soft text-success' : undefined}>{humanize(value) || UNAVAILABLE}</Badge>;
}

function HealthView({ data, account, erasureStatus, onErase }: { data: Report; account: string; erasureStatus: string | null; onErase: () => void }) {
  const h = (data.health ?? {}) as Row;
  const pending = typeof h.pending === 'number' ? h.pending : 0;
  const disk = typeof h.diskUsedPercent === 'number' ? h.diskUsedPercent : null;
  const interrupted = Number((data.interruptedAttempts as Row | undefined)?.count ?? 0);
  const vitals = useMemo(() => (data.vitals || []).map(row => ({ ...row, rating: rateVital(String(row.metric), row.p75) })), [data.vitals]);
  return <>
    <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-3">
      <StatTile label="Event delivery" tone={h.deliveryDelayed ? 'warn' : 'good'} value={h.deliveryDelayed ? 'Delayed' : 'On time'}
        subtext={pending ? `${formatNumber(pending)} waiting since ${formatDateTime(h.oldest)}` : 'Nothing waiting'} />
      <StatTile label="Last delivery" value={formatDateTime(h.lastFlush)} subtext={h.lastError ? 'Last error: ' + String(h.lastError) : 'No delivery errors'} tone={h.lastError ? 'warn' : 'default'} />
      <StatTile label="Disk used" tone={disk == null ? 'default' : disk >= 80 ? 'warn' : 'good'} value={disk == null ? UNAVAILABLE : disk + '%'}
        subtext={h.diskAlert === 'critical' ? 'Critical: free space now' : h.diskAlert === 'warning' ? 'Warning: over 80%' : disk == null ? 'Disk size unavailable' : 'Below the 80% warning level'} />
      <StatTile label="Analytics database" value={formatBytes(h.bytes)} subtext="Size on disk" />
      <StatTile label="Interrupted LLM attempts" tone={interrupted ? 'warn' : 'default'} value={formatNumber(interrupted)} subtext="Stopped by a restart or stalled over 30 minutes" />
    </div>
    <Section title="API reliability" description="Requests per endpoint, most failures first.">
      <DataTable rows={data.requestHealth || []} columns={[
        { key: 'route', label: 'Endpoint', render: v => <span className="font-mono text-xs">{String(v ?? UNAVAILABLE)}</span> },
        { key: 'requests', label: 'Requests' },
        { key: 'failures', label: 'Failures', render: v => <span className={cn(Number(v) > 0 && 'font-semibold text-[#9A4B00]')}>{formatNumber(v)}</span> },
        { key: 'averageMs', label: 'Average', render: formatDuration },
      ]} />
    </Section>
    <Section title="Page speed (Web Vitals)" description="Measured in visitors' browsers. 75th percentile, rated against Google's thresholds.">
      <DataTable rows={vitals} columns={[
        { key: 'metric', label: 'Measure', render: v => <span><span className="font-medium">{VITALS[String(v)]?.label ?? String(v)}</span><span className="block text-xs text-muted-foreground">{VITALS[String(v)]?.meaning}</span></span> },
        { key: 'p75', label: '75th percentile', render: (v, row) => <span className="inline-flex items-center gap-2">{formatVital(String(row.metric), v)}<VitalBadge rating={row.rating as ReturnType<typeof rateVital>} /></span> },
        { key: 'worst', label: 'Worst', render: (v, row) => formatVital(String(row.metric), v) },
        { key: 'samples', label: 'Samples' },
      ]} />
    </Section>
    <Section title="Errors" description="Browser and server errors grouped by fingerprint. Messages are never recorded.">
      <DataTable empty="No errors recorded for these filters." rows={data.errorGroups || []} columns={[
        { key: 'name', label: 'Source', render: eventLabel },
        { key: 'fingerprint', label: 'Fingerprint', render: v => <span className="font-mono text-xs">{String(v ?? UNAVAILABLE)}</span> },
        { key: 'occurrences', label: 'Occurrences' },
      ]} />
    </Section>
    <Card className="border-red-200">
      <CardHeader className="pb-3"><CardTitle>Erase an account&apos;s analytics</CardTitle>
        <CardDescription>Removes that account&apos;s analytics, LLM records and plan history. Their trips, expenses and plans stay. Choose the account by clicking it in any table, or pick it under More filters. Existing exports are also removed.</CardDescription></CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button data-analytics="analytics.erase" variant="destructive" disabled={!/^[a-f0-9]{64}$/.test(account) || erasureStatus === 'Erasing…'} onClick={onErase}>Erase account analytics and history</Button>
        {!/^[a-f0-9]{64}$/.test(account) ? <span className="text-sm text-muted-foreground">No account selected.</span> : null}
        {erasureStatus ? <p role="status" className="text-sm">{erasureStatus}</p> : null}
      </CardContent>
    </Card>
  </>;
}

function VitalBadge({ rating }: { rating: ReturnType<typeof rateVital> }) {
  if (!rating) return null;
  const styles = { good: 'border-[#CDEBD9] bg-success-soft text-success', 'needs-improvement': 'border-[#F6D9AE] bg-[#FFF5E6] text-[#9A4B00]', poor: 'border-red-200 bg-red-50 text-red-700' };
  return <Badge variant="outline" className={styles[rating]}>{rating === 'good' ? 'Good' : rating === 'poor' ? 'Poor' : 'Needs work'}</Badge>;
}
