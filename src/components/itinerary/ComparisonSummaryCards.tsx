'use client';

import { Card, CardContent } from '@/components/ui/card';
import { PLAN_COLORS } from '@/lib/comparison-colors';
import type { PlanComparisonResult } from '@/lib/plan-comparison';
import { cn } from '@/lib/utils';

interface ComparisonSummaryCardsProps {
  plans: PlanComparisonResult[];
}

function formatAud(value: number) {
  return `$${value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

function getCardWidthClass(planCount: number) {
  if (planCount <= 2) {
    return 'min-w-[320px] sm:min-w-[360px] xl:min-w-[420px]';
  }
  if (planCount === 3) {
    return 'min-w-[300px] sm:min-w-[340px] xl:min-w-[380px]';
  }
  return 'min-w-[280px] sm:min-w-[320px] xl:min-w-[340px]';
}

export function ComparisonSummaryCards({ plans }: ComparisonSummaryCardsProps) {
  const cardWidthClass = getCardWidthClass(plans.length);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-2 [scrollbar-width:thin]">
        <div className="flex gap-4 pr-1">
        {plans.map((plan, index) => (
          <Card key={plan.id} className={cn('shrink-0', cardWidthClass)}>
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
      </div>
      <p className="text-xs text-muted-foreground">
        Comparison totals are recomputed from the saved plan inputs using the current city dataset and the same canonical planned-allocation model as the chart.
      </p>
    </div>
  );
}
