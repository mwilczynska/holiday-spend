'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';

type Row = Record<string, unknown>;
interface Report {
  generatedAt?: string; totals?: Record<string, number | null>; daily?: Array<{ day: string; events: number; accounts: number }>;
  features?: Row[]; controls?: Row[]; rows?: Row[]; nextCursor?: number | null; note?: string;
  health?: Row; interruptedAttempts?: Row; p50?: number | null; p95?: number | null;
  funnels?: Array<{ name: string; steps: Array<{ name: string; users: number; conversion: number | null }> }>;
  retention?: Array<{ day: number; eligible: number; returned: number }>;
}
const tabs = ['overview', 'journeys', 'funnels', 'plans', 'llm', 'health'] as const;
function text(value: unknown) { return value == null ? 'Unavailable' : typeof value === 'object' ? JSON.stringify(value) : String(value); }
function time(value: unknown) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : text(value); }
function Table({ rows, columns }: { rows: Row[]; columns: Array<{ key: string; label: string; render?: (value: unknown, row: Row) => ReactNode }> }) {
  return <div className="max-h-[60vh] overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-background"><tr>{columns.map(c => <th key={c.key} className="whitespace-nowrap border-b p-3 font-medium text-muted-foreground">{c.label}</th>)}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={text(row.id ?? row.sequence ?? i)} className="border-b last:border-0 hover:bg-muted/30">{columns.map(c => <td key={c.key} className="max-w-md break-words p-3 align-top">{c.render ? c.render(row[c.key], row) : text(row[c.key])}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="py-12 text-center text-muted-foreground">No records in this selection.</p>}</div>;
}
function diff(before: unknown, after: unknown, prefix = ''): Row[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    const a = before as Row, b = after as Row;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(key => diff(a[key], b[key], prefix ? prefix + '.' + key : key));
  }
  return [{ field: prefix, before: before ?? null, after: after ?? null }];
}
export function AnalyticsDashboard({ initialEnvironment }: { initialEnvironment: string }) {
  const [view, setView] = useState<(typeof tabs)[number]>('overview');
  const [from, setFrom] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [environment, setEnvironment] = useState(initialEnvironment);
  const [admins, setAdmins] = useState(false);
  const [account, setAccount] = useState('');
  const [release, setRelease] = useState('');
  const [feature, setFeature] = useState('');
  const [device, setDevice] = useState('');
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState<Row | null>(null);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const generation = useRef(0);
  const query = useCallback((cursor = 0) => {
    const params = new URLSearchParams({ view, from, to, environment, includeAdmins: String(admins), cursor: String(cursor) });
    if (account) params.set('account', account); if (release) params.set('release', release); if (feature) params.set('feature', feature); if (device) params.set('device', device);
    return params;
  }, [view, from, to, environment, admins, account, release, feature, device]);
  const load = useCallback(async (cursor = 0) => {
    const append = cursor > 0;
    const version = ++generation.current;
    setLoading(true); setError(null);
    try {
      const response = await fetch('/api/admin/analytics?' + query(cursor), { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !body.data || typeof body.data !== 'object') throw new Error(body.error || 'Analytics could not be loaded.');
      if (version !== generation.current) return;
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
      const params = query(); params.set('revision', String(id));
      const response = await fetch('/api/admin/analytics?' + params, { cache: 'no-store' }); const body = await response.json();
      if (!response.ok || !body?.data?.snapshot) throw new Error(body.error || 'Revision unavailable.');
      setRevision(body.data);
    } catch (err) { setRevisionError(err instanceof Error ? err.message : 'Revision unavailable.'); }
  }
  const filterClass = 'h-9 rounded-md border bg-background px-2 text-sm';
  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">Product analytics</h1><p className="mt-2 text-sm text-muted-foreground">First-party usage, private plan history and provider diagnostics.</p></div><Button data-analytics="analytics.refresh" variant="outline" disabled={loading} onClick={() => void load()}>Refresh</Button></header>
    <div className="flex flex-wrap items-end gap-3 border-y py-4">
      <label className="grid gap-1 text-xs">From<input aria-label="From date" className={filterClass} type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label className="grid gap-1 text-xs">Through<input aria-label="Through date" className={filterClass} type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      <label className="grid gap-1 text-xs">Environment<select className={filterClass} value={environment} onChange={e => setEnvironment(e.target.value)}><option>production</option><option>development</option><option>test</option></select></label>
      <label className="grid gap-1 text-xs">Feature<select className={filterClass} value={feature} onChange={e => setFeature(e.target.value)}><option value="">All features</option>{['planner', 'expenses', 'currency', 'cities', 'transport', 'auth', 'settings'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label className="grid gap-1 text-xs">Device<select className={filterClass} value={device} onChange={e => setDevice(e.target.value)}><option value="">All devices</option><option>mobile</option><option>desktop</option><option>unknown</option></select></label>
      <label className="grid gap-1 text-xs">Account ID<input className={filterClass + ' w-36'} placeholder="Pseudonymous ID" value={account} onChange={e => setAccount(e.target.value)} /></label>
      <label className="grid gap-1 text-xs">Release<input className={filterClass + ' w-28'} value={release} onChange={e => setRelease(e.target.value)} /></label>
      <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={admins} onChange={e => setAdmins(e.target.checked)} />Include administrators</label>
    </div>
    <nav aria-label="Analytics views" className="flex gap-1 overflow-x-auto border-b">{tabs.map(tab => <button data-analytics={'analytics.' + tab} key={tab} aria-current={view === tab ? 'page' : undefined} onClick={() => setView(tab)} className={'whitespace-nowrap border-b-2 px-4 py-3 text-sm capitalize ' + (view === tab ? 'border-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground')}>{tab}</button>)}</nav>
    {loading && <p role="status" className="text-sm text-muted-foreground">Loading analytics…</p>}
    {error && <div role="alert" className="text-sm text-destructive">{error} {data ? 'Previously loaded results are stale.' : 'Results unavailable.'} <Button variant="link" onClick={() => void load()}>Retry</Button></div>}
    {data && <>
      {data.note && <p className="text-sm text-muted-foreground">{data.note}</p>}
      {view === 'overview' && <>
        <div className="grid grid-cols-2 gap-6 py-2 md:grid-cols-4">{[['Active accounts', data.totals?.activeAccounts], ['Observed sessions', data.totals?.sessions], ['Events', data.totals?.events], ['Failed requests / total', `${data.totals?.failedRequests ?? 0} / ${data.totals?.requests ?? 0}`]].map(([label, value]) => <div key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{value ?? 0}</p></div>)}</div>
        <section aria-label="Daily activity" className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.daily || []}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="events" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={.12} isAnimationActive={false} /></AreaChart></ResponsiveContainer></section>
        <h2 className="text-lg font-semibold">Feature usage</h2><Table rows={data.features || []} columns={[{ key: 'route', label: 'Route' }, { key: 'events', label: 'Events' }, { key: 'accounts', label: 'Accounts' }]} />
        <h2 className="text-lg font-semibold">Controls used</h2><Table rows={data.controls || []} columns={[{ key: 'control', label: 'Control' }, { key: 'activations', label: 'Activations' }]} />
      </>}
      {view === 'journeys' && <Table rows={data.rows || []} columns={[{ key: 'occurredAt', label: 'Occurred', render: time }, { key: 'receivedAt', label: 'Received', render: time }, { key: 'name', label: 'Event' }, { key: 'accountId', label: 'Account', render: v => v ? <button className="text-primary underline" onClick={() => setAccount(String(v))}>{String(v).slice(0, 12)}</button> : 'Anonymous' }, { key: 'route', label: 'Route' }, { key: 'operationId', label: 'Operation' }, { key: 'properties', label: 'Details' }]} />}
      {view === 'funnels' && <>
        {data.funnels?.map(funnel => <section key={funnel.name} className="space-y-3"><h2 className="text-lg font-semibold">{funnel.name}</h2><Table rows={funnel.steps} columns={[{ key: 'name', label: 'Step' }, { key: 'users', label: 'Observed users' }, { key: 'conversion', label: 'From first step', render: v => typeof v === 'number' ? (v * 100).toFixed(1) + '%' : 'Unavailable' }]} /></section>)}
        <h2 className="text-lg font-semibold">Return after activation</h2><Table rows={data.retention || []} columns={[{ key: 'day', label: 'Day' }, { key: 'eligible', label: 'Mature accounts' }, { key: 'returned', label: 'Returned' }]} />
      </>}
      {view === 'plans' && <>
        <Table rows={data.rows || []} columns={[{ key: 'created_at', label: 'Saved', render: time }, { key: 'action', label: 'Action' }, { key: 'subject_id', label: 'Plan' }, { key: 'summary', label: 'Summary (AUD)' }, { key: 'id', label: 'Details', render: id => <Button variant="link" onClick={() => void inspect(id)}>View revision {text(id)}</Button> }]} />
        {revisionError && <p role="alert" className="text-destructive">{revisionError}</p>}
        {revision && <section className="space-y-4 border-t pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Revision {text(revision.id)}</h2><a className="text-sm text-primary underline" href={'/api/admin/analytics?' + new URLSearchParams({ view: 'plans', from, to, revision: String(revision.id), export: 'true' })}>Export private revision</a></div><p className="text-sm text-muted-foreground">Differences include private itinerary content. Baselines show the state captured when history began.</p><Table rows={diff(revision.previous, revision.snapshot).slice(0, 1000)} columns={[{ key: 'field', label: 'Field' }, { key: 'before', label: 'Before' }, { key: 'after', label: 'After' }]} /></section>}
      </>}
      {view === 'llm' && <>
        <div className="flex flex-wrap gap-8 text-sm"><p>Operations: <strong>{data.totals?.operations ?? 0}</strong></p><p>Attempts: <strong>{data.totals?.attempts ?? 0}</strong></p><p>p50 / p95: <strong>{text(data.p50)} / {text(data.p95)} ms</strong></p><p>Cost unavailable · user-supplied provider keys</p></div>
        <Table rows={data.rows || []} columns={[{ key: 'started_at', label: 'Started', render: time }, { key: 'feature', label: 'Feature' }, { key: 'provider', label: 'Provider' }, { key: 'model', label: 'Model' }, { key: 'effort', label: 'Effort' }, { key: 'status', label: 'Status' }, { key: 'duration_ms', label: 'Duration (ms)' }, { key: 'input_tokens', label: 'Input tokens' }, { key: 'output_tokens', label: 'Output tokens' }, { key: 'reasoning_tokens', label: 'Reasoning tokens' }, { key: 'attempt_number', label: 'Attempt' }, { key: 'operation_id', label: 'Operation' }]} />
        <p className="text-sm text-muted-foreground">Unknown token usage stays unavailable. Provider receipt does not imply validation or persistence succeeded; correlate the operation with its server outcome.</p>
      </>}
      {view === 'health' && <Table rows={Object.entries({ ...data.health, interruptedAttempts: data.interruptedAttempts?.count }).map(([key, value]) => ({ key, value }))} columns={[{ key: 'key', label: 'Measure' }, { key: 'value', label: 'Value', render: text }]} />}
      {data.nextCursor && <Button disabled={loading} variant="outline" onClick={() => void load(data.nextCursor ?? 0)}>Load more</Button>}
      <p className="border-t pt-4 text-xs text-muted-foreground">{data.generatedAt ? `Updated ${time(data.generatedAt)}. ` : ''}Times use your browser timezone; daily buckets use UTC. Behavioral coverage excludes opt-outs and unavailable browser events. Records have no scheduled expiry.</p>
    </>}
  </div>;
}
