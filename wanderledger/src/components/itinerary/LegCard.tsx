'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TierSelector } from './TierSelector';
import { ACCOM_TIERS, FOOD_TIERS, DRINKS_TIERS, ACTIVITIES_TIERS } from '@/types';
import { PLANNER_UI_LOGIC } from '@/lib/planner-ui-logic';
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react';

interface LegCardProps {
  leg: {
    id: number;
    cityId: string;
    cityName: string;
    countryName: string;
    startDate: string | null;
    endDate: string | null;
    nights: number;
    accomTier: string;
    foodTier: string;
    drinksTier: string;
    activitiesTier: string;
    accomOverride: number | null;
    foodOverride: number | null;
    drinksOverride: number | null;
    activitiesOverride: number | null;
    transportOverride: number | null;
    intercityTransportCost: number;
    intercityTransportNote: string | null;
    splitPct: number;
    notes: string | null;
    status: string;
    dailyCost: number;
    legTotal: number;
  };
  onUpdate: (id: number, data: Record<string, unknown>) => void;
  onDelete: (id: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
};

export function LegCard({
  leg,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: LegCardProps) {
  const [showOverrides, setShowOverrides] = useState(false);

  const handleTierChange = (field: string, value: string) => {
    onUpdate(leg.id, { [field]: value });
  };

  const handleFieldChange = (field: string, value: unknown) => {
    onUpdate(leg.id, { [field]: value });
  };

  return (
    <Card className="relative">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className="flex flex-col gap-0.5 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onMoveUp}
              disabled={isFirst}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onMoveDown}
              disabled={isLast}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
          <div className="hidden lg:block cursor-grab">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{leg.cityName}</h3>
              <span className="text-sm text-muted-foreground">{leg.countryName}</span>
              <Badge variant="outline" className={STATUS_COLORS[leg.status] || ''}>
                {leg.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span>{leg.nights} nights</span>
              {leg.startDate && <span>{leg.startDate} — {leg.endDate}</span>}
              <span className="font-medium text-foreground">
                ${leg.dailyCost.toFixed(0)}/day
              </span>
              <span className="font-bold text-foreground">
                ${leg.legTotal.toLocaleString('en-AU', { maximumFractionDigits: 0 })} total
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(leg.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Dates & Nights */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div>
            <Label className="text-xs">Start</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={leg.startDate || ''}
              onChange={(e) => handleFieldChange('startDate', e.target.value || null)}
            />
          </div>
          <div>
            <Label className="text-xs">End</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={leg.endDate || ''}
              onChange={(e) => handleFieldChange('endDate', e.target.value || null)}
            />
          </div>
          <div>
            <Label className="text-xs">Nights</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              min={1}
              value={leg.nights}
              onChange={(e) => handleFieldChange('nights', parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        {/* Tier Selectors */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
          <TierSelector
            label="Accommodation"
            value={leg.accomTier}
            options={ACCOM_TIERS}
            onChange={(v) => handleTierChange('accomTier', v)}
            helperText={PLANNER_UI_LOGIC.accommodation}
          />
          <TierSelector
            label="Food"
            value={leg.foodTier}
            options={FOOD_TIERS}
            onChange={(v) => handleTierChange('foodTier', v)}
            helperText={PLANNER_UI_LOGIC.food}
          />
          <TierSelector
            label="Drinks"
            value={leg.drinksTier}
            options={DRINKS_TIERS}
            onChange={(v) => handleTierChange('drinksTier', v)}
            helperText={PLANNER_UI_LOGIC.drinks}
          />
          <TierSelector
            label="Activities"
            value={leg.activitiesTier}
            options={ACTIVITIES_TIERS}
            onChange={(v) => handleTierChange('activitiesTier', v)}
            helperText={PLANNER_UI_LOGIC.activities}
          />
        </div>

        {/* Transport + Split */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
          <div>
            <Label className="text-xs">Intercity Transport ($)</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              value={leg.intercityTransportCost || 0}
              onChange={(e) => handleFieldChange('intercityTransportCost', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs">Transport Note</Label>
            <Input
              className="h-8 text-xs"
              value={leg.intercityTransportNote || ''}
              onChange={(e) => handleFieldChange('intercityTransportNote', e.target.value || null)}
              placeholder="e.g. VietJet HAN→SGN"
            />
          </div>
          <div>
            <Label className="text-xs">Split %</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              min={0}
              max={100}
              value={leg.splitPct}
              onChange={(e) => handleFieldChange('splitPct', parseFloat(e.target.value) || 50)}
            />
          </div>
        </div>

        {/* Overrides (collapsed) */}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-xs text-muted-foreground"
          onClick={() => setShowOverrides(!showOverrides)}
        >
          {showOverrides ? 'Hide' : 'Show'} cost overrides
        </Button>

        {showOverrides && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mt-2">
            {[
              { field: 'accomOverride', label: 'Accom $/night' },
              { field: 'foodOverride', label: 'Food $/day' },
              { field: 'drinksOverride', label: 'Drinks $/day' },
              { field: 'activitiesOverride', label: 'Activities $/day' },
              { field: 'transportOverride', label: 'Transport $/day' },
            ].map(({ field, label }) => (
              <div key={field}>
                <Label className="text-xs">{label}</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  placeholder="Auto"
                  value={(leg as Record<string, unknown>)[field] as string || ''}
                  onChange={(e) => handleFieldChange(field, e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Status selector */}
        <div className="flex gap-2 mt-3">
          {['planned', 'active', 'completed'].map((s) => (
            <Button
              key={s}
              variant={leg.status === s ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-xs capitalize"
              onClick={() => handleFieldChange('status', s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
