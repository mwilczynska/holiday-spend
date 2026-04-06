'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface TierOption {
  value: string;
  label: string;
}

interface TierSelectorProps {
  label: string;
  value: string;
  options: TierOption[];
  onChange: (value: string) => void;
  costPerDay?: number | null;
}

export function TierSelector({ label, value, options, onChange, costPerDay }: TierSelectorProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
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
