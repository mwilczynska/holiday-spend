'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight } from 'lucide-react';
import { PageLoadingState } from '@/components/ui/loading-state';
import { ComparisonChart } from '@/components/itinerary/ComparisonChart';
import { ComparisonSummaryCards } from '@/components/itinerary/ComparisonSummaryCards';
import type { SavedPlanSummary } from '@/components/itinerary/SavedPlansList';
import type { PlanComparisonResult } from '@/lib/plan-comparison';

const COMPARE_IDS_STORAGE_KEY = 'wanderledger.compare-ids';

export default function ComparePlansPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idsParam = searchParams.get('ids');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonData, setComparisonData] = useState<PlanComparisonResult[] | null>(null);

  // Plan selector state
  const [allPlans, setAllPlans] = useState<SavedPlanSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [plansLoading, setPlansLoading] = useState(false);
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
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/saved-plans/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planIds }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load comparison data.');
      }
      setComparisonData(data.data.plans);
      setSelectorMode(false);
      // Persist last-compared IDs to sessionStorage
      try {
        sessionStorage.setItem(COMPARE_IDS_STORAGE_KEY, planIds.join(','));
      } catch { /* sessionStorage unavailable */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comparison data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: determine whether to load from URL, sessionStorage, or show selector
  useEffect(() => {
    if (idsParam) {
      const planIds = idsParam.split(',').filter(Boolean);
      if (planIds.length >= 1) {
        fetchComparison(planIds);
        return;
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
          return;
        }
      }
    } catch { /* sessionStorage unavailable */ }
    // Fall through to selector
    setSelectorMode(true);
  }, [idsParam, fetchComparison, router]);

  // Fetch plans list when in selector mode
  useEffect(() => {
    if (!selectorMode) return;
    setPlansLoading(true);
    fetch('/api/saved-plans', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setAllPlans(data.data || []))
      .catch(() => setAllPlans([]))
      .finally(() => setPlansLoading(false));
  }, [selectorMode]);

  const togglePlanSelection = (id: string) => {
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
    if (selectedIds.size < 2) return;
    router.push(`/plan/compare?ids=${Array.from(selectedIds).join(',')}`);
  };

  const handleChangePlans = () => {
    // Pre-select the currently compared plan IDs
    if (comparisonData) {
      setSelectedIds(new Set(comparisonData.map((p) => p.id)));
    }
    setSelectorMode(true);
  };

  // Derive header state
  const hasResults = !!comparisonData && comparisonData.length > 0;
  const showSelector = selectorMode && !loading;
  const comparedPlanCount = comparisonData?.length ?? 0;
  const shouldStackAnalyticsSections = comparedPlanCount >= 4;

  let statusText = '';
  if (showSelector && allPlans.length > 0) {
    statusText = `${allPlans.length} saved plan snapshot${allPlans.length !== 1 ? 's' : ''} available. Select 2\u20135 to compare.`;
  } else if (hasResults && !selectorMode) {
    statusText = `Comparing ${comparisonData.length} plan${comparisonData.length !== 1 ? 's' : ''}.`;
  }

  const contentTopPadding = headerHeight > 0 ? Math.max(headerHeight - 40, 100) : 120;

  // Loading state (no header — full-page skeleton)
  if (loading) {
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
                  disabled={selectedIds.size < 2}
                >
                  Compare {selectedIds.size > 0 ? `(${selectedIds.size} selected)` : ''}
                </Button>
              )}
              {hasResults && !selectorMode && (
                <Button variant="outline" onClick={handleChangePlans}>
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
        {/* Selector mode */}
        {showSelector && (
          <div className="rounded-lg border bg-card p-4">
            {plansLoading ? (
              <p className="text-sm text-muted-foreground">Loading saved plans...</p>
            ) : allPlans.length === 0 ? (
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

        {/* Error state */}
        {error && !showSelector && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
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

            <section className="space-y-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold">More Compare Analytics</h2>
                <p className="text-sm text-muted-foreground">
                  The next charts in this branch will add planned spend by country and planned spend by category.
                  {shouldStackAnalyticsSections
                    ? ' With four or more plans, those cards will stack vertically to preserve readability.'
                    : ' With two or three plans, those cards will sit side by side on desktop.'}
                </p>
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
