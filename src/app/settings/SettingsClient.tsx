'use client';

import { useInitialPageRefresh } from '@/lib/use-initial-page-refresh';
import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { LoadingButtonLabel, PageLoadingState } from '@/components/ui/loading-state';
import { readPageResponse } from '@/lib/read-page-response';
import { fixedCostsReadSchema, settingsCountriesReadSchema, travellerSettingsReadSchema, llmSettingsReadSchema } from '@/lib/settings-read-contract';
import { Plus, Trash2, Download } from 'lucide-react';
import Link from 'next/link';

interface FixedCost {
  id: number;
  description: string;
  amountAud: number;
  category: string | null;
  countryId: string | null;
  date: string | null;
  isPaid: number | null;
  notes: string | null;
}

interface Country {
  id: string;
  name: string;
}

interface LlmSettings {
  maxOutputTokens: number;
  requestTimeoutMs: number;
  defaults: { maxOutputTokens: number; requestTimeoutMs: number };
  limits: {
    maxOutputTokens: { min: number; max: number };
    requestTimeoutMs: { min: number; max: number };
  };
}

const CATEGORIES = ['visa', 'insurance', 'flights', 'gear', 'other'];

export interface SettingsInitialData {
  costs: FixedCost[]; countries: Country[]; groupSize: number | null; llm: LlmSettings | null;
  readError?: string | null;
}

export function SettingsClient({ initialData }: { initialData: SettingsInitialData }) {
  const [costs, setCosts] = useState<FixedCost[]>(initialData.costs);
  const [countries, setCountries] = useState<Country[]>(initialData.countries);
  const [groupSize, setGroupSize] = useState(initialData.groupSize);
  const [groupSizeStatus, setGroupSizeStatus] = useState<string | null>(null);
  const [groupSizeError, setGroupSizeError] = useState<string | null>(null);
  const [groupSizeDraft, setGroupSizeDraft] = useState<number | null>(null);
  const groupSizeDraftValue = useRef<number | null>(null);
  const [groupSizeSaving, setGroupSizeSaving] = useState(false);
  const groupSizeSubmitting = useRef(false);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState<string | null>(initialData.readError ?? null);
  const [hasLoadedData, setHasLoadedData] = useState(!initialData.readError);
  const readSequence = useRef(0);
  const [addOpen, setAddOpen] = useState(false);
  const [costError, setCostError] = useState<string | null>(null);
  const [costSaving, setCostSaving] = useState(false);
  const costSubmitting = useRef(false);
  const [llm, setLlm] = useState<LlmSettings | null>(initialData.llm);
  const [llmDraft, setLlmDraft] = useState({ maxOutputTokens: initialData.llm ? String(initialData.llm.maxOutputTokens) : '', requestTimeoutSeconds: initialData.llm ? String(Math.round(initialData.llm.requestTimeoutMs / 1000)) : '' });
  const llmDraftDirty = useRef(false);
  const [llmStatus, setLlmStatus] = useState<string | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [newCost, setNewCost] = useState({
    description: '',
    amountAud: 0,
    category: 'other',
    countryId: '',
    date: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    const sequence = ++readSequence.current;
    setLoading(true);
    try {
      const [costsRes, countriesRes, plannerSettingsRes, llmRes] = await Promise.all([
        fetch('/api/fixed-costs'),
        // Only id and name are used below, so skip the nested city rows: the full
        // payload is ~166 KB against ~5.5 KB here.
        fetch('/api/countries?includeCities=false'),
        fetch('/api/planner/settings', { cache: 'no-store' }),
        fetch('/api/settings/llm', { cache: 'no-store' }),
      ]);
      const [costsData, countriesData, plannerSettingsData, llmData] = await Promise.all([
        readPageResponse(costsRes, 'fixed costs'), readPageResponse(countriesRes, 'country options'),
        readPageResponse(plannerSettingsRes, 'traveller settings'), readPageResponse(llmRes, 'provider limits'),
      ]);
      const parsedCosts = fixedCostsReadSchema.safeParse(costsData);
      const parsedCountries = settingsCountriesReadSchema.safeParse(countriesData);
      const parsedPlanner = travellerSettingsReadSchema.safeParse(plannerSettingsData);
      const parsedLlm = llmSettingsReadSchema.safeParse(llmData);
      if (!parsedCosts.success) throw new Error('The server returned invalid fixed costs data.');
      if (!parsedCountries.success) throw new Error('The server returned invalid country options data.');
      if (!parsedPlanner.success) throw new Error('The server returned invalid traveller settings.');
      if (!parsedLlm.success) throw new Error('The server returned invalid provider limits.');
      if (sequence !== readSequence.current) return false;
      setCosts(parsedCosts.data);
      setCountries(parsedCountries.data.sort((a, b) => a.name.localeCompare(b.name)));
      setGroupSize(parsedPlanner.data.groupSize);
      setGroupSizeStatus(null);
      if (groupSizeDraftValue.current === parsedPlanner.data.groupSize) {
        groupSizeDraftValue.current = null;
        setGroupSizeDraft(null);
        setGroupSizeError(null);
        setGroupSizeStatus(`Traveller count set to ${parsedPlanner.data.groupSize}.`);
      }
      setLlm(parsedLlm.data);
      if (!llmDraftDirty.current) {
        setLlmDraft({
          maxOutputTokens: String(parsedLlm.data.maxOutputTokens),
          requestTimeoutSeconds: String(Math.round(parsedLlm.data.requestTimeoutMs / 1000)),
        });
      }
      setHasLoadedData(true);
      setReadError(null);
      return true;
    } catch (err) {
      if (sequence === readSequence.current) setReadError(err instanceof Error ? err.message : 'Could not load settings. Check your connection and retry.');
      return false;
    } finally {
      if (sequence === readSequence.current) setLoading(false);
    }
  }, []);

  useInitialPageRefresh('/settings', fetchData, !initialData.readError);

  const handleAdd = async () => {
    if (!newCost.description.trim() || !Number.isFinite(newCost.amountAud) || newCost.amountAud <= 0) return;
    await mutateFixedCost('/api/fixed-costs', 'POST', {
      ...newCost,
      description: newCost.description.trim(),
      countryId: newCost.countryId || null,
      date: newCost.date || null,
      notes: newCost.notes || null,
    }, () => {
      setAddOpen(false);
      setNewCost({ description: '', amountAud: 0, category: 'other', countryId: '', date: '', notes: '' });
    });
  };

  const mutateFixedCost = async (url: string, method: string, body?: Record<string, unknown>, onSuccess?: () => void) => {
    if (costSubmitting.current || groupSizeSubmitting.current) return;
    costSubmitting.current = true;
    setCostSaving(true);
    setCostError(null);
    try {
      const response = await fetch(url, {
        method,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || `Could not update fixed costs (HTTP ${response.status}). Try again.`);
      if (!result?.data) throw new Error('The server returned an unreadable response. Reload before retrying.');
      onSuccess?.();
      await fetchData();
    } catch (err) {
      setCostError(err instanceof Error ? err.message : 'Could not update fixed costs. Check your connection and try again.');
    } finally {
      costSubmitting.current = false;
      setCostSaving(false);
    }
  };

  const handleTogglePaid = async (cost: FixedCost) => {
    await mutateFixedCost(`/api/fixed-costs/${cost.id}`, 'PUT', { isPaid: cost.isPaid ? 0 : 1 });
  };

  const handleDelete = async (id: number) => {
    await mutateFixedCost(`/api/fixed-costs/${id}`, 'DELETE');
  };

  const saveGroupSize = async (nextGroupSize: number) => {
    if (groupSizeSubmitting.current || costSubmitting.current || loading || readError || groupSize == null) return;
    if (!Number.isInteger(nextGroupSize) || nextGroupSize < 1 || nextGroupSize > 5) return;
    groupSizeSubmitting.current = true;
    setGroupSizeSaving(true);
    groupSizeDraftValue.current = nextGroupSize;
    setGroupSizeDraft(nextGroupSize);
    setGroupSizeError(null);
    setGroupSizeStatus(null);
    try {
      const response = await fetch('/api/planner/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupSize: nextGroupSize }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `Could not save traveller count (HTTP ${response.status}).`);
      }
      const parsed = travellerSettingsReadSchema.safeParse(data?.data);
      if (!parsed.success || parsed.data.groupSize !== nextGroupSize) {
        throw new Error('The server did not confirm the requested traveller count. Check the saved count before retrying.');
      }
      setGroupSize(parsed.data.groupSize);
      groupSizeDraftValue.current = null;
      setGroupSizeDraft(null);
      setGroupSizeError(null);
      setGroupSizeStatus(`Traveller count set to ${parsed.data.groupSize}.`);
    } catch (err) {
      setGroupSizeStatus(null);
      setGroupSizeError(err instanceof Error ? err.message : 'Failed to update traveller count.');
      await fetchData();
    } finally {
      groupSizeSubmitting.current = false;
      setGroupSizeSaving(false);
    }
  };

  const handleGroupSizeChange = (value: string) => {
    if (groupSizeSubmitting.current || costSubmitting.current) return;
    const nextGroupSize = Number(value);
    if (nextGroupSize === groupSize) {
      groupSizeDraftValue.current = null;
      setGroupSizeDraft(null);
      setGroupSizeError(null);
      setGroupSizeStatus(null);
      return;
    }
    void saveGroupSize(nextGroupSize);
  };

  const saveLlmSettings = async (next: { maxOutputTokens: number | null; requestTimeoutMs: number | null }) => {
    try {
      const response = await fetch('/api/settings/llm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update provider limits.');

      setLlm((current) => (current ? { ...current, ...data.data } : current));
      setLlmDraft({
        maxOutputTokens: String(data.data.maxOutputTokens),
        requestTimeoutSeconds: String(Math.round(data.data.requestTimeoutMs / 1000)),
      });
      llmDraftDirty.current = false;
      setLlmError(null);
      setLlmStatus(
        next.maxOutputTokens === null && next.requestTimeoutMs === null
          ? 'Provider limits reset to the defaults.'
          : 'Provider limits saved.'
      );
    } catch (err) {
      setLlmStatus(null);
      setLlmError(err instanceof Error ? err.message : 'Failed to update provider limits.');
    }
  };

  const totalPaid = costs.filter(c => c.isPaid).reduce((s, c) => s + c.amountAud, 0);
  const totalUnpaid = costs.filter(c => !c.isPaid).reduce((s, c) => s + c.amountAud, 0);
  const total = totalPaid + totalUnpaid;

  if (loading && !hasLoadedData && !readError) {
    return (
      <PageLoadingState
        title="Loading settings"
        description="Preparing trip settings, fixed costs, and country options."
        cardCount={3}
        rowCount={4}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href="/settings/account">
            <Button variant="outline">Account</Button>
          </Link>
          <Link href="/dataset">
            <Button variant="outline">Dataset</Button>
          </Link>
          <Link href="/estimates">
            <Button variant="outline">Methodology</Button>
          </Link>
          <a href="/api/export?format=json" download>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export JSON</Button>
          </a>
          <a href="/api/export?format=csv" download>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export CSV</Button>
          </a>
        </div>
      </div>

      {readError ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm text-destructive">
          <div>
            <p>{readError}</p>
            <p>{hasLoadedData ? 'Showing the last loaded settings and fixed costs; they may be out of date.' : 'Settings unavailable. Traveller count, provider limits and fixed-cost totals could not be loaded.'}</p>
          </div>
          <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void fetchData()}>
            <LoadingButtonLabel idle="Retry settings" loading="Retrying..." isLoading={loading} />
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Trip Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs">
            <Label htmlFor="settings-travellers">Travellers</Label>
            <Select value={groupSizeDraft != null ? String(groupSizeDraft) : groupSize == null ? '' : String(groupSize)} onValueChange={handleGroupSizeChange} disabled={groupSizeSaving || costSaving || loading || Boolean(readError)}>
              <SelectTrigger id="settings-travellers">
                <SelectValue placeholder="Unavailable" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count} {count === 1 ? 'traveller' : 'travellers'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            City costs are stored for 2 travellers and scaled across the planner and dashboard using this setting.
          </p>
          {groupSizeDraft != null ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Unsaved selection: {groupSizeDraft} {groupSizeDraft === 1 ? 'traveller' : 'travellers'}. Last confirmed saved count: {groupSize ?? 'unavailable'}.</p>
              {groupSizeSaving ? <p role="status" className="text-sm text-muted-foreground">Saving traveller count...</p> : null}
              <div className="flex flex-wrap gap-2">
                {groupSizeError ? <Button type="button" variant="outline" size="sm" disabled={groupSizeSaving || costSaving || loading || Boolean(readError)} onClick={() => void saveGroupSize(groupSizeDraft)}>Retry traveller count</Button> : null}
                <Button type="button" variant="outline" size="sm" disabled={groupSizeSaving} onClick={() => { groupSizeDraftValue.current = null; setGroupSizeDraft(null); setGroupSizeError(null); setGroupSizeStatus(null); }}>Discard selection</Button>
              </div>
            </div>
          ) : null}
          {groupSizeStatus ? <p role="status" className="text-sm text-muted-foreground">{groupSizeStatus}</p> : null}
          {groupSizeError ? <p role="alert" className="text-sm text-destructive">{groupSizeError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider Request Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Applies to city-cost and intercity-transport generation. These are stops for a request that has gone
            wrong, not budgets. Providers bill tokens as they are produced, so a high cap costs nothing until a
            request actually needs it &mdash; and a cap that is hit part-way through is paid for and then discarded.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
            <div>
              <Label htmlFor="llm-max-tokens">Maximum output tokens</Label>
              <Input
                id="llm-max-tokens"
                type="number"
                min={llm?.limits.maxOutputTokens.min}
                max={llm?.limits.maxOutputTokens.max}
                step="1"
                value={llmDraft.maxOutputTokens}
                disabled={!hasLoadedData}
                onChange={(e) => { llmDraftDirty.current = true; setLlmDraft((p) => ({ ...p, maxOutputTokens: e.target.value })); }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Covers reasoning and the answer together. Default {llm ? llm.defaults.maxOutputTokens.toLocaleString('en-AU') : '—'}.
              </p>
            </div>
            <div>
              <Label htmlFor="llm-timeout">Request timeout (seconds)</Label>
              <Input
                id="llm-timeout"
                type="number"
                min={llm ? llm.limits.requestTimeoutMs.min / 1000 : undefined}
                max={llm ? llm.limits.requestTimeoutMs.max / 1000 : undefined}
                step="1"
                value={llmDraft.requestTimeoutSeconds}
                disabled={!hasLoadedData}
                onChange={(e) => { llmDraftDirty.current = true; setLlmDraft((p) => ({ ...p, requestTimeoutSeconds: e.target.value })); }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Default {llm ? Math.round(llm.defaults.requestTimeoutMs / 1000) : '—'}s. High reasoning effort can run
                for a couple of minutes.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!llm || loading || Boolean(readError)}
              onClick={() => saveLlmSettings({
                maxOutputTokens: llmDraft.maxOutputTokens.trim() === '' ? null : Number(llmDraft.maxOutputTokens),
                requestTimeoutMs: llmDraft.requestTimeoutSeconds.trim() === ''
                  ? null
                  : Number(llmDraft.requestTimeoutSeconds) * 1000,
              })}
            >
              Save limits
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!llm || loading || Boolean(readError)}
              onClick={() => saveLlmSettings({ maxOutputTokens: null, requestTimeoutMs: null })}
            >
              Reset to defaults
            </Button>
          </div>
          {llmStatus ? <p role="status" className="text-sm text-muted-foreground">{llmStatus}</p> : null}
          {llmError ? <p role="alert" className="text-sm text-destructive">{llmError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Fixed Costs</CardTitle>
          <Dialog open={addOpen} onOpenChange={(open) => { if (!costSaving) { setAddOpen(open); setCostError(null); } }}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={groupSizeSaving || loading || Boolean(readError)}><Plus className="h-4 w-4 mr-2" />Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Fixed Cost</DialogTitle>
                <DialogDescription className="sr-only">
                  Record a one-off cost that is not tied to a single itinerary leg.
                </DialogDescription></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fixed-cost-description">Description</Label>
                  <Input id="fixed-cost-description" value={newCost.description} onChange={(e) => setNewCost(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="fixed-cost-amount">Amount (AUD)</Label>
                  <Input id="fixed-cost-amount" type="number" min="0.01" step="any" value={newCost.amountAud || ''} onChange={(e) => setNewCost(p => ({ ...p, amountAud: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={newCost.category} onValueChange={(v) => setNewCost(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Country (optional)</Label>
                  <SearchableSelect
                    value={newCost.countryId}
                    onValueChange={(value) => setNewCost(p => ({ ...p, countryId: value }))}
                    placeholder="General"
                    searchPlaceholder="Search countries..."
                    options={[
                      { value: '', label: 'General', description: 'Not tied to a specific country.' },
                      ...countries.map((country) => ({
                        value: country.id,
                        label: country.name,
                      })),
                    ]}
                  />
                </div>
                <div>
                  <Label htmlFor="fixed-cost-date">Date (optional)</Label>
                  <Input id="fixed-cost-date" type="date" value={newCost.date} onChange={(e) => setNewCost(p => ({ ...p, date: e.target.value }))} />
                </div>
                {costError && <p role="alert" className="text-sm text-destructive">{costError}</p>}
                <Button onClick={handleAdd} className="w-full" disabled={costSaving || !newCost.description.trim() || !Number.isFinite(newCost.amountAud) || newCost.amountAud <= 0}>
                  {costSaving ? 'Saving...' : 'Add Fixed Cost'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {!addOpen && costError && <p role="alert" className="mb-3 text-sm text-destructive">{costError}</p>}
          {hasLoadedData ? <div className="flex gap-4 mb-4 text-sm">
            <span>Total: <strong>${total.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</strong></span>
            <span className="text-green-600">Paid: ${totalPaid.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
            <span className="text-orange-600">Unpaid: ${totalUnpaid.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
          </div> : <p className="mb-4 text-sm text-muted-foreground">Fixed-cost totals unavailable.</p>}

          {costs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{hasLoadedData ? 'No fixed costs yet.' : 'Fixed costs unavailable.'}</p>
          ) : (
            <div className="space-y-2">
              {costs.map((cost) => (
                <div key={cost.id} className="flex items-center gap-3 p-2 rounded border">
                  <Switch
                    aria-label={`Mark ${cost.description} as ${cost.isPaid ? 'unpaid' : 'paid'}`}
                    disabled={groupSizeSaving || costSaving || loading || Boolean(readError)}
                    checked={!!cost.isPaid}
                    onCheckedChange={() => handleTogglePaid(cost)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cost.isPaid ? 'line-through text-muted-foreground' : 'font-medium'}>
                        {cost.description}
                      </span>
                      {cost.category && (
                        <Badge variant="outline" className="text-xs capitalize">{cost.category}</Badge>
                      )}
                    </div>
                    {cost.date && <p className="text-xs text-muted-foreground">{cost.date}</p>}
                  </div>
                  <span className="font-medium">${cost.amountAud.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
                  <Button aria-label={`Delete ${cost.description}`} disabled={groupSizeSaving || costSaving || loading || Boolean(readError)} variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(cost.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
