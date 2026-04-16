'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PageLoadingState } from '@/components/ui/loading-state';
import { ComparisonChart } from '@/components/itinerary/ComparisonChart';
import { ComparisonSummaryCards } from '@/components/itinerary/ComparisonSummaryCards';
import { PlannerSubNav } from '@/components/itinerary/PlannerSubNav';
import type { SavedPlanSummary } from '@/components/itinerary/SavedPlansList';
import type { PlanComparisonResult } from '@/lib/plan-comparison';

export default function ComparePlansPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idsParam = searchParams.get('ids');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonData, setComparisonData] = useState<PlanComparisonResult[] | null>(null);

  // Plan selector state (when no ids param)
  const [allPlans, setAllPlans] = useState<SavedPlanSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [plansLoading, setPlansLoading] = useState(false);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comparison data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch comparison data when ids are in the URL
  useEffect(() => {
    if (!idsParam) return;
    const planIds = idsParam.split(',').filter(Boolean);
    if (planIds.length < 1) return;
    fetchComparison(planIds);
  }, [idsParam, fetchComparison]);

  // Fetch all plans for the selector when no ids param
  useEffect(() => {
    if (idsParam) return;
    setPlansLoading(true);
    fetch('/api/saved-plans', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setAllPlans(data.data || []))
      .catch(() => setAllPlans([]))
      .finally(() => setPlansLoading(false));
  }, [idsParam]);

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

  // Derive subtitle and status text for the header
  const isSelector = !idsParam && !loading;
  const hasResults = !!comparisonData && comparisonData.length > 0;

  let subtitle = 'Compare cumulative planned spend across your saved plan snapshots.';
  let statusText = '';
  if (isSelector && allPlans.length > 0) {
    statusText = `${allPlans.length} saved plan${allPlans.length !== 1 ? 's' : ''} available. Select 2–5 to compare.`;
  } else if (hasResults) {
    statusText = `Comparing ${comparisonData.length} plan${comparisonData.length !== 1 ? 's' : ''}.`;
  }

  // Shared header — mirrors the planner page proportions
  const header = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Compare Plans</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
          {statusText && (
            <p className="text-xs text-muted-foreground mt-1">{statusText}</p>
          )}
        </div>
        {isSelector && allPlans.length > 0 && (
          <Button
            onClick={handleCompareSelected}
            disabled={selectedIds.size < 2}
          >
            Compare {selectedIds.size > 0 ? `(${selectedIds.size} selected)` : ''}
          </Button>
        )}
      </div>
      <PlannerSubNav />
    </div>
  );

  // Loading state
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

  // Plan selector mode (no ids in URL)
  if (isSelector) {
    return (
      <div className="space-y-6">
        {header}

        <div className="rounded-lg border bg-card p-4">
          {plansLoading ? (
            <p className="text-sm text-muted-foreground">Loading saved plans...</p>
          ) : allPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved plans yet. Save a plan from the planner to start comparing.
            </p>
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
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  // Comparison results
  if (!hasResults) {
    return (
      <div className="space-y-6">
        {header}
        <p className="text-sm text-muted-foreground">
          No comparison data available. The selected plans may not have valid date ranges.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <ComparisonSummaryCards plans={comparisonData} />
      <ComparisonChart plans={comparisonData} />
    </div>
  );
}
