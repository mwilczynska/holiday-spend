'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import dynamic from 'next/dynamic';
import { Label } from '@/components/ui/label';
import { PageLoadingState } from '@/components/ui/loading-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExpenseTagsDialog } from '@/components/expenses/ExpenseTagsDialog';
import { buildExpenseExportHref } from '@/lib/expense-track-page';
import { EXPENSE_PAGE_SIZE } from '@/lib/performance-bounds';
import { EXPENSE_CATEGORIES } from '@/types';
import { ChevronDown, ChevronUp, Download, Edit, Eye, EyeOff, Filter, Plus, Receipt, Tags, Trash2, Upload, XCircle } from 'lucide-react';
import { PageHeader, StatTile } from '@/components/layout/PageHeader';

// Code-split like the planner's dialogs: the form loads only when Quick add opens, so it adds
// nothing to the work this page does before it becomes interactive.
const QuickAddForm = dynamic(() => import('@/components/expenses/QuickAddForm').then((m) => m.QuickAddForm), { ssr: false });

interface Expense {
  id: number;
  date: string;
  amount: number;
  currency: string;
  amountAud: number | null;
  category: string;
  subcategory: string | null;
  description: string | null;
  merchant: string | null;
  legId: number | null;
  source: string | null;
  loggedBy: string | null;
  isExcluded: number;
  cityId: string | null;
  cityName: string | null;
  countryId: string | null;
  countryName: string | null;
  assignmentStartDate: string | null;
  assignmentEndDate: string | null;
}

interface LegOption {
  id: number;
  cityName: string;
  countryName: string;
  startDate: string | null;
  endDate: string | null;
}

interface ExpenseEditForm {
  date: string;
  amount: string;
  currency: string;
  category: string;
  subcategory: string;
  description: string;
  merchant: string;
  legId: string;
}

interface TrackExpensePage {
  items: Expense[];
  totalCount: number;
  totalAud: number;
  expenseIds: number[];
  page: number;
  pageSize: number;
}

const UNASSIGNED_LEG_VALUE = 'unassigned';

function formatLegRange(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `From ${startDate}`;
  if (endDate) return `Until ${endDate}`;
  return 'Dates not set';
}

function displayText(value: string | null) {
  return value && value.trim() ? value : '-';
}

function formatSource(source: string | null) {
  if (source === 'wise_csv') return 'Wise CSV';
  if (source === 'manual') return 'Manual';
  return source || '-';
}

export interface TrackInitialData {
  expenses: Expense[];
  legs: LegOption[];
  totalCount: number;
  totalAud: number;
  expenseIds: number[];
}

// Module scope, so it resets on a full document load and persists across client-side navigations.
let hasMountedInThisDocument = false;

/**
 * Rendered with the unfiltered first page already loaded on the server, so the list is in the first
 * HTML rather than arriving after the bundle mounts. Measured before this change, the two /track
 * requests did not start until 188 ms and finished at 231 ms, against HTML that arrived at 11 ms.
 *
 * Only that first view is seeded. Every filter or page change still goes through the API, which is
 * the right split: the initial view is what every visit pays for, the rest are deliberate actions.
 */
export function TrackClient({ initialData, initialError = null }: { initialData: TrackInitialData; initialError?: string | null }) {
  const [expenses, setExpenses] = useState<Expense[]>(initialData.expenses);
  const [legs, setLegs] = useState<LegOption[]>(initialData.legs);
  const [filterCat, setFilterCat] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [tagExpenseId, setTagExpenseId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ExpenseEditForm | null>(null);
  const [loading, setLoading] = useState(initialData.expenses.length === 0 && initialData.totalCount > 0);
  // Pages are appended as the list scrolls; refreshes reload every page already shown.
  const loadedPagesRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableSentinelRef = useRef<HTMLDivElement | null>(null);
  const listSentinelRef = useRef<HTMLDivElement | null>(null);
  // Row actions are server-rendered; until hydration attaches their handlers a click would be
  // silently lost, so they stay disabled until then.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSummary, setQuickAddSummary] = useState<string | null>(null);
  const [expenseTotalCount, setExpenseTotalCount] = useState(initialData.totalCount);
  const [expenseTotalAud, setExpenseTotalAud] = useState(initialData.totalAud);
  const [filteredExpenseIds, setFilteredExpenseIds] = useState<number[]>(initialData.expenseIds);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [hasLoadedExpenses, setHasLoadedExpenses] = useState(!initialError);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const readSequence = useRef(0);

  // Mirrors the filters applied to the list, so the download matches what is on screen
  // rather than silently exporting every expense.
  const exportHref = useMemo(
    () =>
      buildExpenseExportHref({
        category: filterCat,
        source: filterSource,
        from: filterFrom,
        to: filterTo,
      }),
    [filterCat, filterSource, filterFrom, filterTo]
  );

  const pageUrl = useCallback((page: number) => {
    const params = new URLSearchParams();
    if (filterCat !== 'all') params.set('cat', filterCat);
    if (filterSource !== 'all') params.set('source', filterSource);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    params.set('view', 'track');
    params.set('page', String(page));
    params.set('pageSize', String(EXPENSE_PAGE_SIZE));
    return `/api/expenses?${params}`;
  }, [filterCat, filterSource, filterFrom, filterTo]);

  const readExpensePage = async (response: Response) => {
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || `Could not load expenses (HTTP ${response.status}).`);
    if (!Array.isArray(body?.data?.items)) throw new Error('The server returned unreadable expense data. Try again.');
    return body.data as TrackExpensePage;
  };

  /** Reloads every page currently shown (or the first `pageCount` pages) plus leg assignments. */
  const fetchData = useCallback(async (pageCount: number = loadedPagesRef.current) => {
    const read = ++readSequence.current;
    setLoading(true);
    setLoadError(null);
    try {
      const [itineraryRes, ...pageResponses] = await Promise.all([
        fetch('/api/itinerary?view=track'),
        ...Array.from({ length: Math.max(1, pageCount) }, (_, page) => fetch(pageUrl(page))),
      ]);

      const itineraryData = await itineraryRes.json().catch(() => null);
      const pages = await Promise.all(pageResponses.map(readExpensePage));
      if (!itineraryRes.ok) throw new Error(itineraryData?.error || `Could not load assignments (HTTP ${itineraryRes.status}).`);
      if (!Array.isArray(itineraryData?.data)) {
        throw new Error('The server returned unreadable expense data. Try again.');
      }
      if (read !== readSequence.current) return;

      const expenseData = pages[0];
      loadedPagesRef.current = pages.length;
      setExpenses(pages.flatMap((page) => page.items));
      setHasLoadedExpenses(true);
      setExpenseTotalCount(expenseData?.totalCount || 0);
      setExpenseTotalAud(expenseData?.totalAud || 0);
      setFilteredExpenseIds(expenseData?.expenseIds || []);
      setLegs(
        (itineraryData.data || []).map((leg: LegOption) => ({
          id: leg.id,
          cityName: leg.cityName,
          countryName: leg.countryName,
          startDate: leg.startDate,
          endDate: leg.endDate,
        }))
      );
    } catch (err) {
      if (read === readSequence.current) setLoadError(err instanceof Error ? err.message : 'Could not load expenses. Check your connection and try again.');
    } finally {
      if (read === readSequence.current) setLoading(false);
    }
  }, [pageUrl]);

  /** Appends the next page; a refresh started meanwhile wins and the appended page is dropped. */
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const read = readSequence.current;
    try {
      const page = await readExpensePage(await fetch(pageUrl(loadedPagesRef.current)));
      if (read !== readSequence.current) return;
      loadedPagesRef.current += 1;
      setExpenses((current) => {
        const seen = new Set(current.map((expense) => expense.id));
        return [...current, ...page.items.filter((expense) => !seen.has(expense.id))];
      });
      setExpenseTotalCount(page.totalCount || 0);
    } catch (err) {
      if (read === readSequence.current) setLoadError(err instanceof Error ? err.message : 'Could not load more expenses. Check your connection and try again.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [pageUrl, loading]);

  const hasMoreExpenses = hasLoadedExpenses && !loadError && expenses.length < expenseTotalCount;

  // Load the next page when the end of either list (desktop table box or phone card list) nears view.
  useEffect(() => {
    if (!hasMoreExpenses) return;
    const observers: IntersectionObserver[] = [];
    for (const [target, root] of [
      [tableSentinelRef.current, tableScrollRef.current],
      [listSentinelRef.current, null],
    ] as const) {
      if (!target) continue;
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      }, { root, rootMargin: '400px 0px' });
      observer.observe(target);
      observers.push(observer);
    }
    return () => observers.forEach((observer) => observer.disconnect());
  }, [hasMoreExpenses, loadMore, expenses.length]);

  const showsServerRenderedView =
    filterCat === 'all' && filterSource === 'all' && !filterFrom && !filterTo;

  useEffect(() => {
    /**
     * On a full page load the module is freshly evaluated, so the server-rendered rows are current
     * and refetching them would repeat a request that has already been paid for. A client-side
     * navigation back here can be served from Next's router cache, so that path always refetches.
     * Any filter or page change refetches regardless, since the server only rendered the default.
     */
    if (!hasMountedInThisDocument) {
      hasMountedInThisDocument = true;
      if (showsServerRenderedView && !initialError) return;
    }

    // A filter change (new fetchData identity) starts again from the first page.
    fetchData(1);
  }, [fetchData, showsServerRenderedView, initialError]);

  const mutateExpense = async (url: string, method: string, body?: Record<string, unknown>, onSuccess?: () => void) => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setMutationError(null);
    try {
      const response = await fetch(url, {
        method,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || `Could not update expenses (HTTP ${response.status}). Try again.`);
      if (!result?.data) throw new Error('The server returned an unreadable response. Reload before retrying.');
      onSuccess?.();
      await fetchData();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Could not update expenses. Check your connection and try again.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const handleToggleExclude = async (id: number) => {
    await mutateExpense(`/api/expenses/${id}/exclude`, 'PATCH');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this expense?')) return;
    await mutateExpense(`/api/expenses/${id}`, 'DELETE', undefined, () => {
      setSelectedIds(current => new Set(Array.from(current).filter(selectedId => selectedId !== id)));
    });
  };

  const handleEditSave = async () => {
    if (!editExpense || !editForm) return;

    const amount = Number(editForm.amount);
    if (!editForm.date || !Number.isFinite(amount) || amount <= 0 || !editForm.currency.trim() || !editForm.category) {
      setMutationError('Enter a date, a positive amount, currency and category.');
      return;
    }

    await mutateExpense(`/api/expenses/${editExpense.id}`, 'PUT', {
        date: editForm.date,
        amount,
        currency: editForm.currency.trim().toUpperCase(),
        category: editForm.category,
        subcategory: editForm.subcategory.trim() || null,
        description: editForm.description.trim() || null,
        merchant: editForm.merchant.trim() || null,
        legId: editForm.legId === UNASSIGNED_LEG_VALUE ? null : Number.parseInt(editForm.legId, 10),
    }, () => {
      setEditExpense(null);
      setEditForm(null);
    });
  };

  const openEdit = (exp: Expense) => {
    setMutationError(null);
    setEditExpense(exp);
    setEditForm({
      date: exp.date,
      amount: String(exp.amount),
      currency: exp.currency,
      category: exp.category,
      subcategory: exp.subcategory || '',
      description: exp.description || '',
      merchant: exp.merchant || '',
      legId: exp.legId != null ? String(exp.legId) : UNASSIGNED_LEG_VALUE,
    });
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleExpanded = (id: number) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  const handleBulkAction = async (action: string, extra?: Record<string, unknown>) => {
    await mutateExpense('/api/expenses/bulk', 'POST', { ids: Array.from(selectedIds), action, ...extra }, () => setSelectedIds(new Set()));
  };

  const handleDeleteAll = async () => {
    if (!confirm(`Delete all ${expenseTotalCount} expenses matching the current filters?`)) return;
    await mutateExpense('/api/expenses/bulk', 'POST', { ids: filteredExpenseIds, action: 'delete' }, () => setSelectedIds(new Set()));
  };

  const visibleExpenses = expenses;

  const categoryLabel = (value: string) => EXPENSE_CATEGORIES.find((category) => category.value === value)?.label ?? value;

  if (loading && expenses.length === 0 && legs.length === 0) {
    return (
      <PageLoadingState
        title="Loading expenses"
        description="Fetching transactions, itinerary assignments, and filterable spend history."
        cardCount={3}
        rowCount={6}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Receipt}
        title="Expenses"
        description="Manual and imported spending, assigned to the itinerary leg it counts against."
        actions={(
          <>
            <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Quick add</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Quick add</DialogTitle>
                  <DialogDescription>{quickAddSummary ?? 'Record an expense in a few taps.'}</DialogDescription>
                </DialogHeader>
                {quickAddOpen ? (
                  <QuickAddForm onActiveLegLoaded={setQuickAddSummary} onSaved={() => void fetchData()} />
                ) : null}
              </DialogContent>
            </Dialog>
            <Button variant="outline" asChild><Link href="/track/import"><Upload className="mr-2 h-4 w-4" />Import</Link></Button>
            {hasLoadedExpenses && !loading && !loadError && expenseTotalCount > 0 ? <Button variant="outline" asChild>
              <a href={exportHref} download>
                <Download className="mr-2 h-4 w-4" />Export
              </a>
            </Button> : <Button variant="outline" disabled><Download className="mr-2 h-4 w-4" />Export</Button>}
            <Button variant="outline" asChild><Link href="/track/tags"><Tags className="mr-2 h-4 w-4" />Tags</Link></Button>
            {expenseTotalCount > 0 && (
              <Button variant="ghost" className="text-destructive hover:bg-red-50 hover:text-destructive" disabled={!hydrated || saving || loading || !!loadError} onClick={handleDeleteAll}>
                <XCircle className="mr-2 h-4 w-4" />Delete All
              </Button>
            )}
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]">
        <StatTile label="Expenses" value={hasLoadedExpenses ? `${expenseTotalCount} expenses` : 'Expense count unavailable'} />
        <StatTile label="Total in AUD" value={hasLoadedExpenses ? `$${expenseTotalAud.toLocaleString('en-AU', { maximumFractionDigits: 0 })} AUD` : 'AUD total unavailable'} />
        <section className="col-span-2 rounded-2xl border bg-card px-4 py-3.5 text-xs leading-5 text-muted-foreground lg:col-span-1">
          City and country come from the assigned itinerary leg. Use edit to move flights, tickets, or pre-paid costs into the destination where you want them counted.
          Dashboard timelines will keep the original transaction date visible here, but report assigned spend inside the leg&apos;s date window.
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
        <Filter className="ml-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger aria-label="Filter category" className="h-8 w-[140px] text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EXPENSE_CATEGORIES.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger aria-label="Filter source" className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="wise_csv">Wise CSV</SelectItem>
          </SelectContent>
        </Select>
        <Input aria-label="From date" type="date" className="h-8 w-[140px] text-xs" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} placeholder="From" />
        <Input aria-label="To date" type="date" className="h-8 w-[140px] text-xs" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} placeholder="To" />
      </div>

      {!editExpense && mutationError && <p role="alert" className="text-sm text-destructive">{mutationError}</p>}
      {loadError && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{loadError}{hasLoadedExpenses ? ' Showing the last loaded results.' : ''}</p><Button size="sm" variant="outline" onClick={() => void fetchData()}>Retry loading expenses</Button></div>}

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 bg-info-soft px-3 py-2">
          <span className="text-sm font-semibold text-blue-800">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" disabled={!hydrated || saving || loading || !!loadError} onClick={() => handleBulkAction('exclude')}>Exclude</Button>
          <Button size="sm" variant="outline" disabled={!hydrated || saving || loading || !!loadError} onClick={() => handleBulkAction('include')}>Include</Button>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      <div className="space-y-3 lg:hidden">
        {expenses.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">{hasLoadedExpenses ? 'No expenses yet.' : 'Expenses unavailable. Retry loading expenses.'}</p>
        )}
        {visibleExpenses.map((expense) => (
          <Card key={expense.id} className={expense.isExcluded ? 'opacity-60' : ''}>
            <CardContent className="space-y-3 p-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`Select expense ${expense.id}`}
                  disabled={saving}
                  checked={selectedIds.has(expense.id)}
                  onChange={() => toggleSelect(expense.id)}
                  className="mt-1 h-4 w-4"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{expense.date}</span>
                    <Badge variant="outline">{categoryLabel(expense.category)}</Badge>
                    {expense.isExcluded ? <Badge variant="destructive">Excluded</Badge> : <Badge variant="secondary">Included</Badge>}
                    {expense.source === 'wise_csv' ? <Badge variant="secondary">Wise</Badge> : null}
                  </div>
                  <div className="text-sm font-medium">
                    {expense.amount.toFixed(2)} {expense.currency}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {expense.amountAud != null
                        ? `$${expense.amountAud.toFixed(2)} AUD`
                        : expense.currency === 'AUD'
                          ? `$${expense.amount.toFixed(2)} AUD`
                          : 'No AUD conversion'}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{expense.countryName || 'Unassigned'}</span>
                    <span className="text-muted-foreground"> {expense.cityName ? `• ${expense.cityName}` : ''}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {expense.countryName ? formatLegRange(expense.assignmentStartDate, expense.assignmentEndDate) : 'No itinerary leg'}
                  </div>
                  <div className="text-sm">{displayText(expense.description)}</div>
                  <div className="text-xs text-muted-foreground">
                    Merchant: {displayText(expense.merchant)} • Source: {formatSource(expense.source)}
                  </div>
                  {expense.subcategory && (
                    <div className="text-xs text-muted-foreground">Subcategory: {expense.subcategory}</div>
                  )}
                  {expense.loggedBy && (
                    <div className="text-xs text-muted-foreground">Logged by {expense.loggedBy}</div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-1">
                <Button aria-label={`${expense.isExcluded ? 'Include' : 'Exclude'} expense ${expense.id}`} disabled={!hydrated || saving || loading || !!loadError} variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleExclude(expense.id)}>
                  {expense.isExcluded ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button aria-label={`Edit expense ${expense.id}`} disabled={!hydrated || saving || loading || !!loadError} variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(expense)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button aria-label={`Manage tags for expense ${expense.id}`} disabled={!hydrated || saving || loading || !!loadError} variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTagExpenseId(expense.id)}>
                  <Tags className="h-4 w-4" />
                </Button>
                <Button aria-label={`Delete expense ${expense.id}`} disabled={!hydrated || saving || loading || !!loadError} variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(expense.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        <div ref={listSentinelRef} aria-hidden="true" />
      </div>

      {/* The whole list scrolls in one box; further pages load as its end comes into view. */}
      <div
        ref={tableScrollRef}
        data-testid="expense-scroll"
        className="hidden max-h-[calc(100vh-12rem)] min-h-[18rem] overflow-auto rounded-2xl border bg-card lg:block"
      >
        <table className="w-full table-fixed text-sm" data-testid="expense-table">
          <thead className="text-left text-xs text-slate-600">
            <tr className="border-b [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-secondary [&>th]:shadow-[0_1px_0_hsl(var(--border))]">
              <th className="w-10 px-3 py-2">
                <span className="sr-only">Select</span>
              </th>
              <th className="w-[8rem] px-3 py-2 font-medium">Date</th>
              {/* Location takes the spare width; its second line already says whether the
                  expense is assigned to a leg, so there is no separate Assignment column. */}
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="w-[10rem] px-3 py-2 font-medium">Category</th>
              <th className="w-[9rem] px-3 py-2 font-medium">Amount</th>
              <th className="w-[10rem] px-3 py-2 text-right font-medium">Actions</th>
              <th className="w-[4rem] px-3 py-2 text-right font-medium">More</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                  {hasLoadedExpenses ? 'No expenses yet.' : 'Expenses unavailable. Retry loading expenses.'}
                </td>
              </tr>
            )}
            {visibleExpenses.map((expense) => {
              const isExpanded = expandedIds.has(expense.id);

              return (
                <Fragment key={expense.id}>
                  <tr className={`border-b align-top transition-colors hover:bg-secondary/60 ${expense.isExcluded ? 'bg-muted/40 text-muted-foreground' : ''}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select expense ${expense.id}`}
                        disabled={saving}
                        checked={selectedIds.has(expense.id)}
                        onChange={() => toggleSelect(expense.id)}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{expense.date}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{expense.cityName ? `${expense.cityName}, ${expense.countryName}` : expense.countryName || 'Unassigned'}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {expense.countryName ? formatLegRange(expense.assignmentStartDate, expense.assignmentEndDate) : 'No itinerary leg'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline">{categoryLabel(expense.category)}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="font-medium">
                        {expense.amount.toFixed(2)} {expense.currency}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {expense.amountAud != null
                          ? `$${expense.amountAud.toFixed(2)} AUD`
                          : expense.currency === 'AUD'
                            ? `$${expense.amount.toFixed(2)} AUD`
                            : 'No AUD conversion'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button aria-label={`${expense.isExcluded ? 'Include' : 'Exclude'} expense ${expense.id}`} disabled={!hydrated || saving || loading || !!loadError} variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleExclude(expense.id)}>
                          {expense.isExcluded ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <Button aria-label={`Edit expense ${expense.id}`} disabled={!hydrated || saving || loading || !!loadError} variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(expense)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button aria-label={`Manage tags for expense ${expense.id}`} disabled={!hydrated || saving || loading || !!loadError} variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTagExpenseId(expense.id)}>
                          <Tags className="h-4 w-4" />
                        </Button>
                        <Button aria-label={`Delete expense ${expense.id}`} disabled={!hydrated || saving || loading || !!loadError} variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(expense.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end">
                        <Button aria-label={`${isExpanded ? 'Hide' : 'Show'} details for expense ${expense.id}`} aria-expanded={isExpanded} variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleExpanded(expense.id)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className={expense.isExcluded ? 'bg-muted/10 text-muted-foreground' : 'bg-muted/5'}>
                      <td colSpan={7} className="px-3 py-3">
                        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</div>
                            <div className="mt-1 text-sm">{displayText(expense.description)}</div>
                          </div>
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Merchant</div>
                            <div className="mt-1 text-sm">{displayText(expense.merchant)}</div>
                          </div>
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source</div>
                            <div className="mt-1 flex items-center gap-2 text-sm">
                              <span>{formatSource(expense.source)}</span>
                              {expense.source === 'wise_csv' ? <Badge variant="secondary">Wise</Badge> : null}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</div>
                            <div className="mt-1">
                              {expense.isExcluded ? (
                                <Badge variant="destructive">Excluded</Badge>
                              ) : (
                                <Badge variant="secondary">Included</Badge>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subcategory</div>
                            <div className="mt-1 text-sm">{displayText(expense.subcategory)}</div>
                          </div>
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Logged By</div>
                            <div className="mt-1 text-sm">{displayText(expense.loggedBy)}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <div ref={tableSentinelRef} aria-hidden="true" className="h-px" />
      </div>

      {hasLoadedExpenses && expenseTotalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm" role="status">
          <span className="text-muted-foreground">
            Showing {expenses.length} of {expenseTotalCount} expenses
            {hasMoreExpenses ? ' · scroll for more' : ''}
          </span>
          {hasMoreExpenses ? (
            // Fallback for keyboard users and environments without IntersectionObserver.
            <Button type="button" size="sm" variant="ghost" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          ) : null}
        </div>
      )}

      {tagExpenseId !== null && <ExpenseTagsDialog key={tagExpenseId} expenseId={tagExpenseId} onClose={() => setTagExpenseId(null)} />}
      <Dialog open={!!editExpense} onOpenChange={(open) => {
        if (!open && !saving) {
          setEditExpense(null);
          setEditForm(null);
        }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription className="sr-only">
              Change the date, amount, category or assigned itinerary leg for this expense.
            </DialogDescription></DialogHeader>
          {editForm && (
            <fieldset disabled={saving} className="space-y-3">
              {mutationError && <p role="alert" className="text-sm text-destructive">{mutationError}</p>}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="expense-edit-date" className="text-xs">Date</Label>
                  <Input
                    id="expense-edit-date"
                    type="date"
                    className="h-8 text-xs"
                    value={editForm.date}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, date: e.target.value } : prev)}
                  />
                </div>
                <div>
                  <Label htmlFor="expense-edit-amount" className="text-xs">Amount</Label>
                  <Input
                    id="expense-edit-amount"
                    type="number"
                    min="0.01"
                    step="any"
                    className="h-8 text-xs"
                    value={editForm.amount}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, amount: e.target.value } : prev)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="expense-edit-currency" className="text-xs">Currency</Label>
                  <Input
                    id="expense-edit-currency"
                    className="h-8 text-xs"
                    value={editForm.currency}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, currency: e.target.value.toUpperCase() } : prev)}
                  />
                </div>
                <div>
                  <Label htmlFor="expense-edit-category" className="text-xs">Category</Label>
                  <Select
                    value={editForm.category}
                    onValueChange={(value) => setEditForm((prev) => prev ? { ...prev, category: value } : prev)}
                  >
                    <SelectTrigger id="expense-edit-category" className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="expense-edit-assignment" className="text-xs">City / Country Assignment</Label>
                <Select
                  value={editForm.legId}
                  onValueChange={(value) => setEditForm((prev) => prev ? { ...prev, legId: value } : prev)}
                >
                  <SelectTrigger id="expense-edit-assignment" className="h-8 text-xs">
                    <SelectValue placeholder="Select itinerary leg" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_LEG_VALUE}>Unassigned</SelectItem>
                    {legs.map((leg) => (
                      <SelectItem
                        key={leg.id}
                        value={String(leg.id)}
                        textValue={`${leg.cityName}, ${leg.countryName}`}
                      >
                        <div className="flex flex-col">
                          <span>{leg.cityName}, {leg.countryName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatLegRange(leg.startDate, leg.endDate)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  This controls which city and country receive the spend on the dashboard. If the transaction date sits outside that leg,
                  dashboard timelines will clamp it into the leg&apos;s window while leaving the original transaction date unchanged here.
                </p>
              </div>
              <div>
                <Label htmlFor="expense-edit-description" className="text-xs">Description</Label>
                <Input
                  id="expense-edit-description"
                  className="h-8 text-xs"
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, description: e.target.value } : prev)}
                />
              </div>
              <div>
                <Label htmlFor="expense-edit-merchant" className="text-xs">Merchant</Label>
                <Input
                  id="expense-edit-merchant"
                  className="h-8 text-xs"
                  value={editForm.merchant}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, merchant: e.target.value } : prev)}
                />
              </div>
              <div>
                <Label htmlFor="expense-edit-subcategory" className="text-xs">Subcategory</Label>
                <Input
                  id="expense-edit-subcategory"
                  className="h-8 text-xs"
                  value={editForm.subcategory}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, subcategory: e.target.value } : prev)}
                />
              </div>
              <Button disabled={saving} onClick={handleEditSave} className="w-full">{saving ? 'Saving…' : 'Save Changes'}</Button>
            </fieldset>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
