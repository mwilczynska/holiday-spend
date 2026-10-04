'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MiscellaneousExpenseItem } from '@/types';
import { miscellaneousExpensesSchema } from '@/lib/miscellaneous-expenses';

type Draft = { key: number; description: string; costInput: string };

function toPayload(drafts: Draft[]) {
  return miscellaneousExpensesSchema.safeParse(drafts.map(draft => ({
    description: draft.description || null,
    cost: draft.costInput.trim() === '' ? 0 : Number(draft.costInput),
  })));
}

export function MiscellaneousExpenses({ legId, expenses, onChange, onValidationError }: {
  legId: number;
  expenses: MiscellaneousExpenseItem[];
  onChange: (expenses: MiscellaneousExpenseItem[]) => void;
  onValidationError: (error: string | null) => void;
}) {
  const nextKey = useRef(0);
  const buildDrafts = (items: MiscellaneousExpenseItem[]) => items.map(item => ({
    key: nextKey.current++, description: item.description ?? '', costInput: String(item.cost),
  }));
  const [drafts, setDrafts] = useState<Draft[]>(() => buildDrafts(expenses));
  const parsed = toPayload(drafts);
  const invalid = !parsed.success;

  useEffect(() => {
    onValidationError(invalid ? 'Enter a finite, nonnegative miscellaneous cost and a description of at most 500 characters.' : null);
  }, [invalid, onValidationError]);

  useEffect(() => {
    setDrafts(current => {
      const currentPayload = toPayload(current);
      // Keep the raw text while editing and retain invalid drafts across unrelated refreshes.
      if (!currentPayload.success || JSON.stringify(currentPayload.data) === JSON.stringify(expenses)) return current;
      return buildDrafts(expenses);
    });
  }, [expenses]);

  function change(next: Draft[]) {
    setDrafts(next);
    const payload = toPayload(next);
    if (payload.success) onChange(payload.data);
  }

  return (
    <div className="mt-3 space-y-2 rounded-md border p-3" data-testid="miscellaneous-expenses">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-medium">Miscellaneous expenses</p>
          <p className="text-xs text-muted-foreground">One-off AUD costs for this leg and the whole group.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => change([
          ...drafts, { key: nextKey.current++, description: '', costInput: '' },
        ])}>
          <Plus className="mr-1 h-3.5 w-3.5" />Add miscellaneous expense
        </Button>
      </div>
      {drafts.map((draft, index) => {
        const prefix = `leg-${legId}-misc-${draft.key}`;
        const cost = draft.costInput.trim() === '' ? 0 : Number(draft.costInput);
        const invalidCost = !Number.isFinite(cost) || cost < 0;
        return (
          <div key={draft.key} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[minmax(0,1fr)_120px_40px]">
            <div>
              <Label htmlFor={`${prefix}-description`} className="text-xs">Description</Label>
              <Input id={`${prefix}-description`} className="h-8 text-xs" value={draft.description}
                aria-invalid={draft.description.length > 500}
                onChange={event => change(drafts.map((item, i) => i === index ? { ...item, description: event.target.value } : item))}
                placeholder="e.g. Laundry or luggage storage" />
            </div>
            <div>
              <Label htmlFor={`${prefix}-cost`} className="text-xs">Cost (AUD)</Label>
              <Input id={`${prefix}-cost`} type="text" inputMode="decimal" className="h-8 text-xs"
                value={draft.costInput} aria-invalid={invalidCost}
                aria-describedby={invalidCost ? `${prefix}-error` : undefined}
                onChange={event => change(drafts.map((item, i) => i === index ? { ...item, costInput: event.target.value } : item))}
                placeholder="0.00" />
              {invalidCost ? <p id={`${prefix}-error`} className="text-xs text-destructive">Enter zero or a positive amount.</p> : null}
            </div>
            <div className="flex items-end">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label={`Remove miscellaneous expense ${index + 1}`}
                onClick={() => change(drafts.filter((_, i) => i !== index))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
