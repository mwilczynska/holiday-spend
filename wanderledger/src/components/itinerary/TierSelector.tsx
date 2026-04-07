'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { InfoPopover } from './InfoPopover';
import type { TierOption } from '@/types';

interface TierSelectorProps {
  label: string;
  value: string;
  options: TierOption<string>[];
  onChange: (value: string) => void;
  costPerDay?: number | null;
  helperText?: string;
}

export function TierSelector({ label, value, options, onChange, costPerDay, helperText }: TierSelectorProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {helperText && (
          <InfoPopover
            title={label}
            summary={helperText}
            items={options.map((option) => ({
              label: option.label,
              description: option.description,
            }))}
          />
        )}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              textValue={opt.label}
              className="items-start py-2"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-medium">{opt.label}</div>
                <div className="text-[11px] leading-4 text-muted-foreground">
                  {opt.description}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {costPerDay !== null && costPerDay !== undefined && (
        <p className="text-xs text-muted-foreground">${costPerDay.toFixed(0)}/day</p>
      )}
    </div>
  );
}
