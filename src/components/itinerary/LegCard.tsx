'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { TierSelector } from './TierSelector';
import { LegClimate } from './LegClimate';
import { MiscellaneousExpenses } from './MiscellaneousExpenses';
import type { CityClimate, TemperatureUnit } from '@/lib/climate';
import { ACCOM_TIERS, FOOD_TIERS, DRINKS_TIERS, ACTIVITIES_TIERS } from '@/types';
import type { IntercityTransportItem, MiscellaneousExpenseItem } from '@/types';
import { useQueuedDraftSave } from '@/lib/use-queued-draft-save';
import {
  getAccommodationCostForTier,
  getActivitiesCostForTier,
  getDrinksCostForTier,
  getFoodCostForTier,
  getDailyCost,
  getLegTotalFromTransports,
} from '@/lib/cost-calculator';
import { PLANNER_UI_LOGIC } from '@/lib/planner-ui-logic';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { CityPhoto, photoCredit } from '@/components/dashboard/CityPhoto';
import type { CityImageView } from '@/lib/city-image-view';
import { cn } from '@/lib/utils';

// Load transport estimation only when its dialog is opened.
const TransportEstimateDialog = dynamic(
  () => import('./TransportEstimateDialog').then((m) => m.TransportEstimateDialog),
  { ssr: false }
);


interface LegCardProps {
  climate?: CityClimate | null;
  temperatureUnit: TemperatureUnit;
  onToggleTemperature: () => void;
  onRetryClimate: () => void;
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
    cityImage?: CityImageView | null;
    intercityTransportCost: number;
    intercityTransportNote: string | null;
    intercityTransports: IntercityTransportItem[];
    miscellaneousExpenses: MiscellaneousExpenseItem[];
    notes: string | null;
    status: string;
    dailyCost: number;
    legTotal: number;
  };
  /**
   * Built once by the planner and shared across every card. Passing a stable array keeps
   * SearchableSelect's internal useMemo effective; building it inline per card gave it a
   * new identity on every render and re-sorted ~200 options for each card each time.
   */
  cityOptions: SearchableSelectOption[];
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
  onUpdate: (id: number, data: Record<string, unknown>) => Promise<void>;
  onDirtyChange: (id: number, dirty: boolean) => void;
  onDiscard: () => void;
  onDelete: (id: number) => void;
  onMove: (id: number, direction: -1 | 1) => void;
  orderSaving?: boolean;
  /** Whether the editing body is shown. Cards with unsaved, saving or failed edits stay open regardless. */
  expanded: boolean;
  onToggleExpanded: (id: number) => void;
  isFirst: boolean;
  isLast: boolean;
  previousLeg: {
    id: number;
    cityName: string;
    countryName: string;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
  active: 'bg-info-soft text-blue-700 hover:bg-info-soft',
  completed: 'bg-success-soft text-success hover:bg-success-soft',
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'Upcoming',
  active: 'In progress',
  completed: 'Completed',
};

function formatLegDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

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

// endDate is the check-out day, so endDate - startDate (in days) = nights
function nightsBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export const LegCard = memo(function LegCard({
  leg: savedLeg,
  cities,
  cityOptions,
  groupSize,
  onUpdate,
  onDirtyChange,
  onDiscard,
  onDelete,
  onMove,
  orderSaving = false,
  expanded,
  onToggleExpanded,
  isFirst,
  isLast,
  previousLeg,
  climate,
  temperatureUnit,
  onToggleTemperature,
  onRetryClimate,
}: LegCardProps) {
  const [miscellaneousError, setMiscellaneousError] = useState<string | null>(null);
  const [miscellaneousReset, setMiscellaneousReset] = useState(0);
  const miscellaneousErrorRef = useRef(miscellaneousError);
  miscellaneousErrorRef.current = miscellaneousError;
  const { state: editState, queue: editQueue } = useQueuedDraftSave(
    patch => onUpdate(savedLeg.id, patch),
    dirty => onDirtyChange(savedLeg.id, dirty || miscellaneousErrorRef.current != null),
  );
  useEffect(() => {
    onDirtyChange(savedLeg.id, miscellaneousError != null || editState.saving || Object.keys(editState.patch).length > 0);
  }, [miscellaneousError, editState.saving, editState.patch, onDirtyChange, savedLeg.id]);
  const hasDraft = Object.keys(editState.patch).length > 0;
  // A collapsed card must never hide an unsaved draft or its Retry/Discard controls.
  const mustStayOpen = hasDraft || editState.saving || editState.error != null || miscellaneousError != null;
  const isOpen = expanded || mustStayOpen;
  const bodyId = `leg-${savedLeg.id}-body`;
  const leg = { ...savedLeg, ...editState.patch } as typeof savedLeg;
  const draftCity = cities.find(city => city.id === leg.cityId);
  if (hasDraft && draftCity) {
    leg.cityName = draftCity.name;
    leg.countryName = draftCity.countryName;
    leg.dailyCost = getDailyCost(draftCity, leg.accomTier as import('@/types').AccomTier,
      leg.foodTier as import('@/types').FoodTier, leg.drinksTier as import('@/types').DrinksTier,
      leg.activitiesTier as import('@/types').ActivitiesTier, leg, groupSize);
    leg.legTotal = getLegTotalFromTransports(leg.dailyCost, leg.nights, leg.intercityTransports, leg.miscellaneousExpenses);
  }
  // A draft that changes the city shows that city's drawn scene until the save returns its photo.
  const photo = savedLeg.cityImage && savedLeg.cityImage.cityId === leg.cityId ? savedLeg.cityImage : null;
  const submitEdit = (patch: Record<string, unknown>) => {
    void editQueue.submit(patch).catch(() => undefined);
  };
  const [showOverrides, setShowOverrides] = useState(false);
  const [transportEstimateOpen, setTransportEstimateOpen] = useState(false);
  // Latches on first open so the dialog is not mounted for cards the user never touches,
  // while still surviving a close/reopen without losing in-dialog state.
  const [hasOpenedTransportEstimate, setHasOpenedTransportEstimate] = useState(false);

  useEffect(() => {
    if (transportEstimateOpen) setHasOpenedTransportEstimate(true);
  }, [transportEstimateOpen]);
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
      const canReusePreviousCostInput = previousDraft != null && (
        (previousDraft.id != null && transport.id != null && previousDraft.id === transport.id) ||
        (transport.cost === 0 && previousDraft.id == null)
      );

      return {
        ...transport,
        draftKey: previousDraft?.draftKey ?? createDraftKey(),
        costInput: canReusePreviousCostInput ? previousDraft.costInput : String(transport.cost ?? 0),
      };
    }), [createDraftKey]);

  const [transportDrafts, setTransportDrafts] = useState<TransportDraft[]>(() =>
    buildTransportDrafts(leg.intercityTransports || [])
  );
  const transportDraftsRef = useRef(transportDrafts);
  transportDraftsRef.current = transportDrafts;

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
    submitEdit({ [field]: value });
  };

  const handleFieldChange = (field: string, value: unknown) => {
    submitEdit({ [field]: value });
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string | null) => {
    if (!value) {
      handleFieldChange(field, null);
      return;
    }

    if (field === 'startDate') {
      if (leg.endDate && leg.endDate > value) {
        // Both dates set and valid — derive nights from the chosen span
        submitEdit({ startDate: value, nights: nightsBetween(value, leg.endDate) });
      } else {
        // No end date yet, or new start is on/after existing end — project forward using current nights
        submitEdit({ startDate: value, endDate: shiftIsoDate(value, leg.nights) });
      }
      return;
    }

    // field === 'endDate'
    if (leg.startDate && value > leg.startDate) {
      // Both dates set and valid — derive nights from the chosen span
      submitEdit({ endDate: value, nights: nightsBetween(leg.startDate, value) });
    } else {
      // No start date yet, or new end is on/before existing start — project backward using current nights
      submitEdit({ endDate: value, startDate: shiftIsoDate(value, -leg.nights) });
    }
  };

  const handleNightsChange = (value: number) => {
    const nextNights = Number.isInteger(value) && value > 0 ? value : 1;

    if (leg.startDate) {
      // endDate = check-out = startDate + nights
      submitEdit({ nights: nextNights, endDate: shiftIsoDate(leg.startDate, nextNights) });
      return;
    }

    if (leg.endDate) {
      // startDate = check-in = endDate - nights
      submitEdit({ nights: nextNights, startDate: shiftIsoDate(leg.endDate, -nextNights) });
      return;
    }

    submitEdit({ nights: nextNights });
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
    transportDraftsRef.current = nextDrafts;
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
    persistIntercityTransports(transportDraftsRef.current);
  };

  const removeIntercityTransport = (index: number) => {
    const nextDrafts = transportDrafts.filter((_, transportIndex) => transportIndex !== index);
    setTransportDrafts(nextDrafts);
    transportDraftsRef.current = nextDrafts;
    persistIntercityTransports(nextDrafts);
  };

  return (
    <Card
      data-testid="planner-leg-card"
      data-leg-id={leg.id}
      className={cn('relative', isOpen && 'border-blue-200 shadow-[0_4px_14px_rgba(15,27,51,0.06)]')}
    >
      <CardContent className={cn('p-2.5 sm:p-3', isOpen && 'sm:p-3.5')}>
        {/* Pointer convenience: clicking anywhere on the summary row toggles the card. The chevron
            button remains the keyboard and screen-reader control, so this div needs no role. */}
        <div
          className={cn('-m-1 flex flex-wrap items-center gap-3 rounded-xl p-1 sm:flex-nowrap', !mustStayOpen && 'cursor-pointer')}
          onClick={(event) => {
            if (mustStayOpen) return;
            if ((event.target as HTMLElement).closest('button, a, input, select, textarea, [role="combobox"]')) return;
            onToggleExpanded(leg.id);
          }}
        >
          <span className={cn('shrink-0 overflow-hidden rounded-[10px]', isOpen ? 'h-[76px] w-[104px]' : 'h-16 w-[88px]')}>
            <CityPhoto name={leg.cityName} image={photo} size="small" credit="tooltip" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className={cn('font-extrabold', isOpen ? 'text-lg' : 'text-base')}>{leg.cityName}</h3>
              <span className="text-sm text-muted-foreground">{leg.countryName}</span>
              <Badge className={cn('rounded-full border-transparent px-2.5 font-bold capitalize', STATUS_COLORS[leg.status] || '')}>
                {STATUS_LABELS[leg.status] ?? leg.status}
              </Badge>
            </div>
            <p className="mt-1 flex flex-wrap gap-x-1.5 text-[13px] text-muted-foreground">
              {leg.startDate ? (
                <span>{formatLegDate(leg.startDate)} – {leg.endDate ? formatLegDate(leg.endDate) : '?'} ·</span>
              ) : null}
              <span>{leg.nights} {leg.nights === 1 ? 'night' : 'nights'} ·</span>
              <span>${leg.dailyCost.toFixed(0)}/day</span>
              <span aria-hidden="true">·</span>
              <span className="font-bold text-foreground">
                ${leg.legTotal.toLocaleString('en-AU', { maximumFractionDigits: 0 })} total
              </span>
            </p>
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600"
              onClick={() => onMove(leg.id, -1)}
              aria-label={`Move ${leg.cityName} leg up`}
              title="Move up"
              disabled={isFirst || orderSaving}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600"
              onClick={() => onMove(leg.id, 1)}
              aria-label={`Move ${leg.cityName} leg down`}
              title="Move down"
              disabled={isLast || orderSaving}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600 hover:text-destructive"
              aria-label={'Delete ' + leg.cityName + ' leg'}
              title="Delete leg"
              onClick={() => onDelete(leg.id)}
              disabled={orderSaving || editState.saving || hasDraft}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-slate-700"
              aria-expanded={isOpen}
              aria-controls={bodyId}
              aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${leg.cityName}`}
              title={mustStayOpen ? 'Open while it has unsaved changes' : undefined}
              disabled={mustStayOpen}
              onClick={() => onToggleExpanded(leg.id)}
            >
              {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {editState.saving || hasDraft || miscellaneousError ? (
          <div className="mt-2 rounded-md border p-2 text-sm" role={editState.error || miscellaneousError ? 'alert' : 'status'}>
            <p className={editState.error || miscellaneousError ? 'text-destructive' : 'text-muted-foreground'}>
              {miscellaneousError || editState.error || (editState.saving ? 'Saving leg changes...' : 'Unsaved leg changes.')}
            </p>
            <p className="text-xs text-muted-foreground">This card previews your changes. Trip totals use saved values until the save succeeds.</p>
            {editState.error || miscellaneousError ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={editState.saving || miscellaneousError != null} onClick={() => void editQueue.retry().catch(() => undefined)}>Retry leg save</Button>
                <Button type="button" size="sm" variant="ghost" disabled={editState.saving} onClick={() => {
                  editQueue.discard();
                  setMiscellaneousError(null);
                  setMiscellaneousReset(value => value + 1);
                  editingTransportKeyRef.current = null;
                  setTransportDrafts(buildTransportDrafts(savedLeg.intercityTransports || []));
                  onDiscard();
                }}>Discard leg changes</Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Hidden rather than unmounted when collapsed, so field drafts and transport rows survive. */}
        <div id={bodyId} hidden={!isOpen} className="mt-3 rounded-xl border border-slate-100 p-3 sm:p-4">
        <LegClimate leg={leg} climate={climate} unit={temperatureUnit} onToggle={onToggleTemperature} onRetry={onRetryClimate} />

        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-1">
            <Label className="text-xs">Location</Label>
            <SearchableSelect
              value={leg.cityId}
              onValueChange={(value) => handleFieldChange('cityId', value)}
              placeholder="Select a city"
              searchPlaceholder="Search cities..."
              className="h-8 text-xs"
              options={cityOptions}
            />
          </div>
          <div>
            <Label htmlFor={`leg-${leg.id}-start`} className="text-xs">Start</Label>
            <Input
              id={`leg-${leg.id}-start`}
              type="date"
              className="h-8 text-xs"
              value={leg.startDate || ''}
              onChange={(e) => handleDateChange('startDate', e.target.value || null)}
            />
          </div>
          <div>
            <Label htmlFor={`leg-${leg.id}-end`} className="text-xs">End</Label>
            <Input
              id={`leg-${leg.id}-end`}
              type="date"
              className="h-8 text-xs"
              value={leg.endDate || ''}
              onChange={(e) => handleDateChange('endDate', e.target.value || null)}
            />
          </div>
          <div>
            <Label htmlFor={`leg-${leg.id}-nights`} className="text-xs">Nights</Label>
            <Input
              id={`leg-${leg.id}-nights`}
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
          <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <Label className="text-xs">Intercity Transport</Label>
              <p className="text-xs text-muted-foreground">
                Add the one-off between-city moves you want included in this leg total.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setTransportEstimateOpen(true)}
                disabled={orderSaving || hasDraft || miscellaneousError != null || editState.saving || previousLeg == null || !leg.startDate}
              >
                Estimate transport
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={addIntercityTransport}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add transport
              </Button>
            </div>
          </div>
          {previousLeg == null ? (
            <p className="text-xs text-muted-foreground">
              Add a previous leg before estimating intercity transport.
            </p>
          ) : null}
          {previousLeg != null && !leg.startDate ? (
            <p className="text-xs text-muted-foreground">
              Set this leg&apos;s start date before estimating transport from {previousLeg.cityName}.
            </p>
          ) : null}
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

        <MiscellaneousExpenses key={miscellaneousReset} legId={leg.id} expenses={leg.miscellaneousExpenses ?? []}
          onChange={expenses => handleFieldChange('miscellaneousExpenses', expenses)}
          onValidationError={setMiscellaneousError} />

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
                <Label htmlFor={`leg-${leg.id}-${field}`} className="text-xs">{label}</Label>
                <Input
                  id={`leg-${leg.id}-${field}`}
                  type="number"
                  className="h-8 text-xs"
                  placeholder="Auto"
                  value={((leg as Record<string, unknown>)[field] as number | null) ?? ''}
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
        {photo ? (
          <p className="mt-3 text-[11px] text-muted-foreground" data-testid="leg-photo-credit">
            <a href={photo.descriptionUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
              {photoCredit(photo)}
            </a>
          </p>
        ) : null}
        </div>

        {hasOpenedTransportEstimate ? (
        <TransportEstimateDialog
          open={transportEstimateOpen}
          onOpenChange={setTransportEstimateOpen}
          legId={leg.id}
          previousLeg={previousLeg}
          currentLeg={{
            cityName: leg.cityName,
            countryName: leg.countryName,
            startDate: leg.startDate,
          }}
          existingTransports={leg.intercityTransports}
          onApplyTransports={async (transports) => {
            await editQueue.submit({ intercityTransports: transports });
          }}
        />
        ) : null}
      </CardContent>
    </Card>
  );
});
