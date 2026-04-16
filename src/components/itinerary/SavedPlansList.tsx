'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Download, Trash2 } from 'lucide-react';

export interface SavedPlanSummary {
  id: string;
  name: string;
  groupSize: number;
  legCount: number;
  totalNights: number;
  totalBudget: number;
  fixedCostCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface SavedPlansListProps {
  plans: SavedPlanSummary[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  isLoading: boolean;
}

export function SavedPlansList({ plans, onLoad, onDelete, onExport, isLoading }: SavedPlansListProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 5) {
        next.add(id);
      }
      return next;
    });
  };

  const handleCompare = () => {
    if (compareIds.size < 2) return;
    router.push(`/plan/compare?ids=${Array.from(compareIds).join(',')}`);
  };

  if (plans.length === 0 && !isLoading) return null;

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span>Saved Plans ({plans.length})</span>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="border-t px-4 pb-3">
          {compareIds.size >= 2 && (
            <div className="flex items-center justify-between py-2 border-b mb-2">
              <span className="text-xs text-muted-foreground">
                {compareIds.size} plans selected for comparison
              </span>
              <Button size="sm" onClick={handleCompare}>
                Compare Selected
              </Button>
            </div>
          )}

          <div className="max-h-[280px] overflow-y-auto space-y-2 pt-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-2">Loading saved plans...</p>
            ) : (
              plans.map((plan) => (
                <div key={plan.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={compareIds.has(plan.id)}
                        onChange={() => toggleCompare(plan.id)}
                        className="mt-1 h-4 w-4 shrink-0"
                        title="Select for comparison"
                      />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{plan.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {plan.createdAt ? plan.createdAt.slice(0, 16).replace('T', ' ') : ''}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {plan.legCount} legs, {plan.totalNights} nights, $
                          {plan.totalBudget.toLocaleString('en-AU', { maximumFractionDigits: 0 })} total
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      <Button type="button" size="sm" onClick={() => onLoad(plan.id)}>
                        Load
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => onExport(plan.id)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="sm" variant="destructive" onClick={() => onDelete(plan.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
