'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { PlanComparisonResult } from '@/lib/plan-comparison';

const PLAN_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

interface ComparisonSummaryCardsProps {
  plans: PlanComparisonResult[];
}

function formatAud(value: number) {
  return `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

export function ComparisonSummaryCards({ plans }: ComparisonSummaryCardsProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {plans.map((plan, index) => (
          <Card key={plan.id}>
            <CardContent className="pt-4 pb-4">
              <div className="mb-3 flex items-center gap-2">
                <div
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: PLAN_COLORS[index % PLAN_COLORS.length] }}
                />
                <h3 className="truncate text-sm font-medium" title={plan.name}>{plan.name}</h3>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Planned Total</span>
                  <span className="font-medium">{formatAud(plan.summary.totalBudget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nights</span>
                  <span className="font-medium">{plan.summary.totalNights}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg $/day</span>
                  <span className="font-medium">{formatAud(plan.summary.avgDailySpend)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Legs</span>
                  <span className="font-medium">{plan.summary.legCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fixed Costs</span>
                  <span className="font-medium">{formatAud(plan.summary.fixedCostTotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Travellers</span>
                  <span>{plan.groupSize}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Comparison totals are recomputed from the saved plan inputs using the current city dataset and the same canonical planned-allocation model as the chart.
      </p>
    </div>
  );
}
