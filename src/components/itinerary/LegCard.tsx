'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { TierSelector } from './TierSelector';
import { ACCOM_TIERS, FOOD_TIERS, DRINKS_TIERS, ACTIVITIES_TIERS } from '@/types';
import type { IntercityTransportItem } from '@/types';
import {
  getAccommodationCostForTier,
  getActivitiesCostForTier,
  getDrinksCostForTier,
  getFoodCostForTier,
} from '@/lib/cost-calculator';
import { PLANNER_UI_LOGIC } from '@/lib/planner-ui-logic';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';

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
    intercityTransports: IntercityTransportItem[];
    notes: string | null;
    status: string;
    dailyCost: number;
    legTotal: number;
  };
  cities: Array<{
    id: string;
    name: string;
    countryId: string;
    countryName: string;
    accomHostel: number | null;
    accomPrivateRoom: number | null;
    accom1star: number | null;
    accom2star: number | null;
    accom3star: number | null;
    accom4star: number | null;
    foodStreet: number | null;
    foodBudget: number | null;
    foodMid: number | null;
    foodHigh: number | null;
    drinkCoffee: number | null;
    drinksNone: number | null;
    drinksLight: number | null;
    drinksModerate: number | null;
    drinksHeavy: number | null;
    activitiesFree: number | null;
    activitiesBudget: number | null;
    activitiesMid: number | null;
    activitiesHigh: number | null;
    transportLocal: number | null;
  }>;
  groupSize: number;
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

type TransportDraft = IntercityTransportItem & {
  draftKey: string;
  costInput: string;
};

function formatCategoryCost(value: number | null | undefined, unit: 'day' | 'night') {
  if (value == null) return 'Unavailable';
  return `$${value.toFixed(0)}/${unit}`;
}

function parseTransportCost(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number.parseFloat(trimmed.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTransportPayload(drafts: TransportDraft[]): IntercityTransportItem[] {
  return drafts.map((draft, index) => {
    const { costInput, draftKey, ...payloadDraft } = draft;
    void draftKey;
    return {
      ...payloadDraft,
      cost: parseTransportCost(costInput),
      sortOrder: index,
    };
  });
}

function shiftIsoDate(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().split('T')[0];
}

export function LegCard({
  leg,
  cities,
  groupSize,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: LegCardProps) {
  const [showOverrides, setShowOverrides] = useState(false);
  const draftKeyCounterRef = useRef(0);
  const editingTransportKeyRef = useRef<string | null>(null);

  const createDraftKey = useCallback(() => {
    draftKeyCounterRef.current += 1;
    return `leg-${leg.id}-transport-${draftKeyCounterRef.current}`;
  }, [leg.id]);

  const buildTransportDrafts = useCallback((
    transports: IntercityTransportItem[],
    previousDrafts: TransportDraft[] = []
  ): TransportDraft[] =>
    transports.map((transport, index) => {
      const previousDraft =
        previousDrafts.find((draft) => draft.id != null && draft.id === transport.id) ??
        previousDrafts[index];

      return {
        ...transport,
        draftKey: previousDraft?.draftKey ?? createDraftKey(),
        costInput: previousDraft?.id === transport.id
          ? previousDraft.costInput
          : transport.cost === 0 && previousDraft?.id == null
          ? previousDraft.costInput
          : String(transport.cost ?? 0),
      };
    }), [createDraftKey]);

  const [transportDrafts, setTransportDrafts] = useState<TransportDraft[]>(() =>
    buildTransportDrafts(leg.intercityTransports || [])
  );

  useEffect(() => {
    if (editingTransportKeyRef.current) {
      return;
    }
    setTransportDrafts((current) => buildTransportDrafts(leg.intercityTransports || [], current));
  }, [buildTransportDrafts, leg.id, leg.intercityTransports]);

  const selectedCity = cities.find((city) => city.id === leg.cityId);
  const accommodationDetailMap = selectedCity
    ? {
        hostel: formatCategoryCost(getAccommodationCostForTier(selectedCity, 'hostel', groupSize), 'night'),
        privateRoom: formatCategoryCost(getAccommodationCostForTier(selectedCity, 'privateRoom', groupSize), 'night'),
        '1star': formatCategoryCost(getAccommodationCostForTier(selectedCity, '1star', groupSize), 'night'),
        '2star': formatCategoryCost(getAccommodationCostForTier(selectedCity, '2star', groupSize), 'night'),
        '3star': formatCategoryCost(getAccommodationCostForTier(selectedCity, '3star', groupSize), 'night'),
        '4star': formatCategoryCost(getAccommodationCostForTier(selectedCity, '4star', groupSize), 'night'),
      }
    : undefined;
  const foodDetailMap = selectedCity
    ? {
        street: formatCategoryCost(getFoodCostForTier(selectedCity, 'street', groupSize), 'day'),
        budget: formatCategoryCost(getFoodCostForTier(selectedCity, 'budget', groupSize), 'day'),
        mid: formatCategoryCost(getFoodCostForTier(selectedCity, 'mid', groupSize), 'day'),
        high: formatCategoryCost(getFoodCostForTier(selectedCity, 'high', groupSize), 'day'),
      }
    : undefined;
  const drinksDetailMap = selectedCity
    ? {
        none: formatCategoryCost(getDrinksCostForTier(selectedCity, 'none', groupSize), 'day'),
        light: formatCategoryCost(getDrinksCostForTier(selectedCity, 'light', groupSize), 'day'),
        moderate: formatCategoryCost(getDrinksCostForTier(selectedCity, 'moderate', groupSize), 'day'),
        heavy: formatCategoryCost(getDrinksCostForTier(selectedCity, 'heavy', groupSize), 'day'),
      }
    : undefined;
  const activitiesDetailMap = selectedCity
    ? {
        free: formatCategoryCost(getActivitiesCostForTier(selectedCity, 'free', groupSize), 'day'),
        budget: formatCategoryCost(getActivitiesCostForTier(selectedCity, 'budget', groupSize), 'day'),
        mid: formatCategoryCost(getActivitiesCostForTier(selectedCity, 'mid', groupSize), 'day'),
        high: formatCategoryCost(getActivitiesCostForTier(selectedCity, 'high', groupSize), 'day'),
      }
    : undefined;

  const handleTierChange = (field: string, value: string) => {
    onUpdate(leg.id, { [field]: value });
  };

  const handleFieldChange = (field: string, value: unknown) => {
    onUpdate(leg.id, { [field]: value });
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string | null) => {
    if (!value) {
      handleFieldChange(field, null);
      return;
    }

    if (field === 'startDate') {
      onUpdate(leg.id, {
        startDate: value,
        endDate: leg.nights > 0 ? shiftIsoDate(value, leg.nights - 1) : value,
      });
      return;
    }

    onUpdate(leg.id, {
      endDate: value,
      startDate: leg.nights > 0 ? shiftIsoDate(value, -(leg.nights - 1)) : value,
    });
  };

  const handleNightsChange = (value: number) => {
    const nextNights = Number.isInteger(value) && value > 0 ? value : 1;

    if (leg.startDate) {
      onUpdate(leg.id, {
        nights: nextNights,
        endDate: shiftIsoDate(leg.startDate, nextNights - 1),
      });
      return;
    }

    if (leg.endDate) {
      onUpdate(leg.id, {
        nights: nextNights,
        startDate: shiftIsoDate(leg.endDate, -(nextNights - 1)),
      });
      return;
    }

    onUpdate(leg.id, { nights: nextNights });
  };

  const persistIntercityTransports = (drafts: TransportDraft[]) => {
    handleFieldChange('intercityTransports', toTransportPayload(drafts));
  };

  const addIntercityTransport = () => {
    const nextDrafts = [
      ...transportDrafts,
      {
        draftKey: createDraftKey(),
        mode: null,
        note: null,
        cost: 0,
        costInput: '',
        sortOrder: transportDrafts.length,
      },
    ];
    setTransportDrafts(nextDrafts);
    persistIntercityTransports(nextDrafts);
  };

  const updateIntercityTransportDraft = (index: number, patch: Partial<TransportDraft>) => {
    setTransportDrafts((current) =>
      current.map((transport, transportIndex) =>
        transportIndex === index ? { ...transport, ...patch } : transport
      )
    );
  };

  const commitIntercityTransports = () => {
    editingTransportKeyRef.current = null;
    setTransportDrafts((current) => {
      persistIntercityTransports(current);
      return current;
    });
  };

  const removeIntercityTransport = (index: number) => {
    const nextDrafts = transportDrafts.filter((_, transportIndex) => transportIndex !== index);
    setTransportDrafts(nextDrafts);
    persistIntercityTransports(nextDrafts);
  };

  return (
    <Card className="relative">
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <div className="flex flex-col gap-0.5">
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
          <div className="hidden cursor-grab pt-1 lg:block">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{leg.cityName}</h3>
              <span className="text-sm text-muted-foreground">{leg.countryName}</span>
              <Badge variant="outline" className={STATUS_COLORS[leg.status] || ''}>
                {leg.status}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
              <span>{leg.nights} nights</span>
              {leg.startDate && <span>{leg.startDate} - {leg.endDate}</span>}
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

        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-1">
            <Label className="text-xs">Location</Label>
            <SearchableSelect
              value={leg.cityId}
              onValueChange={(value) => handleFieldChange('cityId', value)}
              placeholder="Select a city"
              searchPlaceholder="Search cities..."
              className="h-8 text-xs"
              options={cities.map((city) => ({
                value: city.id,
                label: `${city.name}, ${city.countryName}`,
                description: city.countryName,
                keywords: `${city.name} ${city.countryName}`,
              }))}
            />
          </div>
          <div>
            <Label className="text-xs">Start</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={leg.startDate || ''}
              onChange={(e) => handleDateChange('startDate', e.target.value || null)}
            />
          </div>
          <div>
            <Label className="text-xs">End</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={leg.endDate || ''}
              onChange={(e) => handleDateChange('endDate', e.target.value || null)}
            />
          </div>
          <div>
            <Label className="text-xs">Nights</Label>
            <Input
              type="number"
              className="h-8 text-xs"
              min={1}
              value={leg.nights}
              onChange={(e) => handleNightsChange(parseInt(e.target.value, 10) || 1)}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <TierSelector
            label="Accommodation"
            value={leg.accomTier}
            options={ACCOM_TIERS}
            onChange={(v) => handleTierChange('accomTier', v)}
            helperText={PLANNER_UI_LOGIC.accommodation}
            itemDetailMap={accommodationDetailMap}
          />
          <TierSelector
            label="Food"
            value={leg.foodTier}
            options={FOOD_TIERS}
            onChange={(v) => handleTierChange('foodTier', v)}
            helperText={PLANNER_UI_LOGIC.food}
            itemDetailMap={foodDetailMap}
          />
          <TierSelector
            label="Drinks"
            value={leg.drinksTier}
            options={DRINKS_TIERS}
            onChange={(v) => handleTierChange('drinksTier', v)}
            helperText={PLANNER_UI_LOGIC.drinks}
            itemDetailMap={drinksDetailMap}
          />
          <TierSelector
            label="Activities"
            value={leg.activitiesTier}
            options={ACTIVITIES_TIERS}
            onChange={(v) => handleTierChange('activitiesTier', v)}
            helperText={PLANNER_UI_LOGIC.activities}
            itemDetailMap={activitiesDetailMap}
          />
        </div>

        <div className="mt-3 space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label className="text-xs">Intercity Transport</Label>
              <p className="text-xs text-muted-foreground">
                Add the one-off between-city moves you want included in this leg total.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={addIntercityTransport}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add transport
            </Button>
          </div>
          {transportDrafts.length > 0 ? (
            <div className="space-y-2">
              {transportDrafts.map((transport, index) => (
                <div
                  key={transport.draftKey}
                  className="grid gap-2 rounded-md border p-2 lg:grid-cols-[140px_1fr_120px_40px]"
                >
                  <div>
                    <Label className="text-xs">Mode</Label>
                    <Input
                      className="h-8 text-xs"
                      value={transport.mode || ''}
                      onChange={(e) => updateIntercityTransportDraft(index, { mode: e.target.value || null })}
                      onFocus={() => {
                        editingTransportKeyRef.current = transport.draftKey;
                      }}
                      onBlur={commitIntercityTransports}
                      placeholder="Flight"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Note</Label>
                    <Input
                      className="h-8 text-xs"
                      value={transport.note || ''}
                      onChange={(e) => updateIntercityTransportDraft(index, { note: e.target.value || null })}
                      onFocus={() => {
                        editingTransportKeyRef.current = transport.draftKey;
                      }}
                      onBlur={commitIntercityTransports}
                      placeholder="e.g. VietJet HAN-SGN"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cost ($)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-8 text-xs"
                      value={transport.costInput}
                      onChange={(e) => updateIntercityTransportDraft(index, { costInput: e.target.value })}
                      onFocus={() => {
                        editingTransportKeyRef.current = transport.draftKey;
                      }}
                      onBlur={commitIntercityTransports}
                      placeholder="Cost"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeIntercityTransport(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No intercity transport rows added for this leg.</p>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-xs text-muted-foreground"
          onClick={() => setShowOverrides(!showOverrides)}
        >
          {showOverrides ? 'Hide' : 'Show'} cost overrides
        </Button>

        {showOverrides && (
          <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
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

        <div className="mt-3 flex gap-2">
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
