'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight } from 'lucide-react';
import { PageLoadingState } from '@/components/ui/loading-state';
import { readPageResponse } from '@/lib/read-page-response';
import { comparisonPlanIdsSchema, comparisonSavedPlansSchema, comparisonResultsSchema } from '@/lib/comparison-read-contract';

import { ComparisonSummaryCards } from '@/components/itinerary/ComparisonSummaryCards';
import type { SavedPlanSummary } from '@/components/itinerary/SavedPlansList';
import type { PlanComparisonResult } from '@/lib/plan-comparison';

function ChartPlaceholder({ height }: { height: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-md bg-muted/40"
      style={{ height }}
      aria-hidden="true"
    />
  );
}

const ComparisonChart = dynamic(
  () => import('@/components/itinerary/ComparisonChart').then((m) => m.ComparisonChart),
  { ssr: false, loading: () => <ChartPlaceholder height={400} /> }
);
const ComparisonCountryChart = dynamic(
  () => import('@/components/itinerary/ComparisonCountryChart').then((m) => m.ComparisonCountryChart),
  { ssr: false, loading: () => <ChartPlaceholder height={360} /> }
);
const ComparisonCategoryChart = dynamic(
  () => import('@/components/itinerary/ComparisonCategoryChart').then((m) => m.ComparisonCategoryChart),
  { ssr: false, loading: () => <ChartPlaceholder height={360} /> }
);


const COMPARE_IDS_STORAGE_KEY = 'holiday-spend.compare-ids';

export default function ComparePlansPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idsParam = searchParams.get('ids');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonData, setComparisonData] = useState<PlanComparisonResult[] | null>(null);
  const comparisonSequence = useRef(0);
  const comparisonRequest = useRef<string[]>([]);

  // Plan selector state
  const [allPlans, setAllPlans] = useState<SavedPlanSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [hasLoadedPlans, setHasLoadedPlans] = useState(false);
  const plansSequence = useRef(0);
  // Track whether we're in selector mode explicitly (for "Change Plans")
  const [selectorMode, setSelectorMode] = useState(false);

  // Header height measurement for fixed header offset
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    if (!headerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderHeight(entry.contentRect.height);
      }
    });
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  const fetchComparison = useCallback(async (planIds: string[]) => {
    const sequence = ++comparisonSequence.current;
    comparisonRequest.current = planIds;
    setSelectedIds(new Set(planIds));
    setLoading(true);
    setError(null);
    try {
      if (!comparisonPlanIdsSchema.safeParse(planIds).success) throw new Error('Select between 1 and 5 unique saved plans.');
      const response = await fetch('/api/saved-plans/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planIds }),
      });
      const data = await readPageResponse(response, 'comparison data');
      const parsed = comparisonResultsSchema.safeParse(data);
      if (!parsed.success || parsed.data.plans.length !== planIds.length
        || parsed.data.plans.some((plan, index) => plan.id !== planIds[index])) {
        throw new Error('The server returned incomplete or invalid comparison data. Refresh the plan list or retry.');
      }
      if (sequence !== comparisonSequence.current) return;
      setComparisonData(parsed.data.plans);
      setSelectorMode(false);
      // Persist last-compared IDs to sessionStorage
      try {
        sessionStorage.setItem(COMPARE_IDS_STORAGE_KEY, planIds.join(','));
      } catch { /* sessionStorage unavailable */ }
    } catch (err) {
      if (sequence === comparisonSequence.current) setError(err instanceof Error ? err.message : 'Failed to load comparison data.');
    } finally {
      if (sequence === comparisonSequence.current) setLoading(false);
    }
  }, []);

  // On mount: determine whether to load from URL, sessionStorage, or show selector
  useEffect(() => {
    if (idsParam) {
      const planIds = idsParam.split(',').filter(Boolean);
      if (planIds.length >= 1) {
        fetchComparison(planIds);
        return () => { comparisonSequence.current += 1; };
      }
    }
    // No ids in URL — try sessionStorage
    try {
      const stored = sessionStorage.getItem(COMPARE_IDS_STORAGE_KEY);
      if (stored) {
        const planIds = stored.split(',').filter(Boolean);
        if (planIds.length >= 2) {
          // Auto-load last comparison
          router.replace(`/plan/compare?ids=${planIds.join(',')}`);
          return () => { comparisonSequence.current += 1; };
        }
      }
    } catch { /* sessionStorage unavailable */ }
    // Fall through to selector
    setSelectorMode(true);
    return () => { comparisonSequence.current += 1; };
  }, [idsParam, fetchComparison, router]);

  const fetchPlans = useCallback(async () => {
    const sequence = ++plansSequence.current;
    setPlansLoading(true);
    try {
      const data = await readPageResponse(await fetch('/api/saved-plans', { cache: 'no-store' }), 'saved plans');
      const parsed = comparisonSavedPlansSchema.safeParse(data);
      if (!parsed.success) throw new Error('The server returned invalid saved plans.');
      if (sequence !== plansSequence.current) return;
      setAllPlans(parsed.data);
      setHasLoadedPlans(true);
      setPlansError(null);
      const available = new Set(parsed.data.map(plan => plan.id));
      setSelectedIds(current => new Set(Array.from(current).filter(id => available.has(id))));
    } catch (err) {
      if (sequence === plansSequence.current) setPlansError(err instanceof Error ? err.message : 'Could not load saved plans. Check your connection and retry.');
    } finally {
      if (sequence === plansSequence.current) setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectorMode) return;
    void fetchPlans();
    return () => { plansSequence.current += 1; };
  }, [selectorMode, fetchPlans]);

  const togglePlanSelection = (id: string) => {
    if (loading || plansLoading || plansError) return;
    setError(null);
    comparisonRequest.current = [];
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 5) {
        next.add(id);
      }
      return next;
    });
  };

  const handleCompareSelected = () => {
    if (selectedIds.size < 2 || loading || plansLoading || plansError) return;
    const planIds = Array.from(selectedIds);
    if (idsParam === planIds.join(',')) void fetchComparison(planIds);
    else router.push(`/plan/compare?ids=${planIds.join(',')}`);
  };

  const handleChangePlans = () => {
    // Pre-select the currently compared plan IDs
    setSelectedIds(new Set(comparisonRequest.current.length ? comparisonRequest.current : comparisonData?.map(p => p.id)));
    setError(null);
    setSelectorMode(true);
  };

  // Derive header state
  const hasResults = !!comparisonData && comparisonData.length > 0;
  const showSelector = selectorMode;
  const comparedPlanCount = comparisonData?.length ?? 0;
  const shouldStackAnalyticsSections = comparedPlanCount >= 4;

  let statusText = '';
  if (showSelector && !hasLoadedPlans && plansError) {
    statusText = 'Saved plan count unavailable.';
  } else if (showSelector && allPlans.length > 0) {
    statusText = `${allPlans.length} saved plan snapshot${allPlans.length !== 1 ? 's' : ''} available. Select 2\u20135 to compare.`;
  } else if (hasResults && !selectorMode) {
    statusText = `Comparing ${comparisonData.length} plan${comparisonData.length !== 1 ? 's' : ''}.`;
  }

  const contentTopPadding = headerHeight > 0 ? Math.max(headerHeight - 40, 100) : 120;

  // Loading state (no header — full-page skeleton)
  if (loading && !comparisonData && !selectorMode) {
    return (
      <PageLoadingState
        title="Comparing plans"
        description="Computing planned costs for each saved plan."
        cardCount={2}
        rowCount={3}
      />
    );
  }

  return (
    <div className="-mx-4 -mt-4 lg:-mx-8 lg:-mt-8">
      {/* Fixed header */}
      <div className="fixed inset-x-0 top-0 z-30 border-b bg-background shadow-sm lg:left-64">
        <div ref={headerRef} className="mx-auto max-w-[1440px] px-4 py-4 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Compare Plans</h1>
              <p className="text-sm text-muted-foreground">
                Compare saved plan snapshots with one canonical planned-cost calculation.
              </p>
              {statusText && (
                <p className="text-xs text-muted-foreground mt-1">{statusText}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {showSelector && allPlans.length > 0 && (
                <Button
                  onClick={handleCompareSelected}
                  disabled={selectedIds.size < 2 || loading || plansLoading || Boolean(plansError)}
                >
                  Compare {selectedIds.size > 0 ? `(${selectedIds.size} selected)` : ''}
                </Button>
              )}
              {(hasResults || error) && !selectorMode && (
                <Button variant="outline" disabled={loading} onClick={handleChangePlans}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Change Plans
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div
        className="mx-auto max-w-[1440px] px-4 pb-8 lg:px-8"
        style={{ paddingTop: contentTopPadding }}
      >
        {loading ? <p role="status" className="mb-4 text-sm text-muted-foreground">Loading comparison...</p> : null}
        {error ? (
          <div role="alert" className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground">{hasResults && !selectorMode ? 'Showing the previous comparison; it may be out of date.' : 'Comparison unavailable. Your selected plans are retained.'}</p>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => void fetchComparison(comparisonRequest.current)}>Retry comparison</Button>
          </div>
        ) : null}
        {/* Selector mode */}
        {showSelector && (
          <div className="rounded-lg border bg-card p-4">
            {plansError ? <div role="alert" className="mb-4 space-y-2 text-sm text-destructive">
              <p>{plansError}</p>
              <p>{hasLoadedPlans ? 'Showing the last loaded saved plans; they may be out of date.' : 'Saved plans unavailable.'}</p>
              <Button size="sm" variant="outline" disabled={plansLoading} onClick={() => void fetchPlans()}>Retry saved plans</Button>
            </div> : null}
            {plansLoading ? <p role="status" className="mb-3 text-sm text-muted-foreground">Loading saved plans...</p> : null}
            {!hasLoadedPlans ? (!plansLoading && !plansError ? <p>Saved plans unavailable.</p> : null) : allPlans.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No saved plans yet. Build your itinerary on the Plan page and save
                  at least two snapshots to compare them side by side.
                </p>
                <Button variant="outline" size="sm" onClick={() => router.push('/plan')}>
                  Go to Planner
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {allPlans.map((plan) => (
                  <label
                    key={plan.id}
                    className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      disabled={loading || plansLoading || Boolean(plansError)}
                      checked={selectedIds.has(plan.id)}
                      onChange={() => togglePlanSelection(plan.id)}
                      className="h-4 w-4"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{plan.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {plan.legCount} legs, {plan.totalNights} nights, $
                        {plan.totalBudget.toLocaleString('en-AU', { maximumFractionDigits: 0 })} total
                      </div>
                      <div className="text-[11px] text-muted-foreground/80">
                        Saved snapshot metadata. Loaded comparison totals are recomputed from current city rates.
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Comparison results */}
        {hasResults && !selectorMode && (
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold">Plan Overview</h2>
                <p className="text-sm text-muted-foreground">
                  Wider summary cards keep each plan readable even as you compare more snapshots.
                </p>
              </div>
              <ComparisonSummaryCards plans={comparisonData} />
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold">Spend Over Time</h2>
                <p className="text-sm text-muted-foreground">
                  The cumulative line chart remains the hero view for spotting where plans diverge.
                </p>
              </div>
              <ComparisonChart plans={comparisonData} />
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold">Plan Breakdown</h2>
                <p className="text-sm text-muted-foreground">
                  Country and category views adapt to the number of plans so the inline compare page stays readable.
                </p>
              </div>

              <div className={shouldStackAnalyticsSections ? 'space-y-6' : 'grid gap-6 xl:grid-cols-2 xl:items-start'}>
                <div className="min-w-0">
                  <ComparisonCountryChart plans={comparisonData} />
                </div>
                <div className="min-w-0">
                  <ComparisonCategoryChart plans={comparisonData} />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Empty results */}
        {!hasResults && !showSelector && !error && !loading && (
          <p className="text-sm text-muted-foreground">
            No comparison data available. The selected plans may not have valid date ranges.
          </p>
        )}
      </div>
    </div>
  );
}
