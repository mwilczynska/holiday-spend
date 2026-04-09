'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { LegCard } from '@/components/itinerary/LegCard';
import { CostSummary } from '@/components/itinerary/CostSummary';
import { Download, FolderOpen, Plus, Save, Upload } from 'lucide-react';
import type { IntercityTransportItem } from '@/types';
import type { PlanSnapshot } from '@/lib/plan-snapshot';

const PLAN_SNAPSHOT_STORAGE_KEY = 'wanderledger-plan-snapshots';

interface Leg {
  id: number;
  cityId: string;
  cityName: string;
  countryName: string;
  countryId: string;
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
  splitPct: number;
  sortOrder: number | null;
  notes: string | null;
  status: string;
  dailyCost: number;
  legTotal: number;
}

interface City {
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
  drinksLight: number | null;
  drinksModerate: number | null;
  drinksHeavy: number | null;
  activitiesFree: number | null;
  activitiesBudget: number | null;
  activitiesMid: number | null;
  activitiesHigh: number | null;
  transportLocal: number | null;
}

interface Country {
  id: string;
  name: string;
}

interface FixedCost {
  id: number;
  description?: string;
  amountAud: number;
  category?: string | null;
  countryId?: string | null;
  date?: string | null;
  isPaid?: number;
  notes?: string | null;
}

interface SavedPlanSnapshot {
  id: string;
  name: string;
  savedAt: string;
  summary: {
    legCount: number;
    totalNights: number;
    totalBudget: number;
    fixedCostCount: number;
  };
  snapshot: PlanSnapshot;
}

function compareLegDates(a: Leg, b: Leg) {
  const aPrimaryDate = a.startDate || a.endDate;
  const bPrimaryDate = b.startDate || b.endDate;

  if (aPrimaryDate && bPrimaryDate && aPrimaryDate !== bPrimaryDate) {
    return aPrimaryDate.localeCompare(bPrimaryDate);
  }

  if (aPrimaryDate && !bPrimaryDate) return -1;
  if (!aPrimaryDate && bPrimaryDate) return 1;

  const aSecondaryDate = a.endDate || a.startDate;
  const bSecondaryDate = b.endDate || b.startDate;

  if (aSecondaryDate && bSecondaryDate && aSecondaryDate !== bSecondaryDate) {
    return aSecondaryDate.localeCompare(bSecondaryDate);
  }

  return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
}

export default function PlanPage() {
  const [legs, setLegs] = useState<Leg[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [savedPlansOpen, setSavedPlansOpen] = useState(false);
  const [newLegCity, setNewLegCity] = useState('');
  const [newLegNights, setNewLegNights] = useState('7');
  const [savedSnapshots, setSavedSnapshots] = useState<SavedPlanSnapshot[]>([]);
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [groupSize, setGroupSize] = useState(2);
  const importInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    const [legsRes, citiesRes, countriesRes, fixedRes] = await Promise.all([
      fetch('/api/itinerary', { cache: 'no-store' }),
      fetch('/api/cities', { cache: 'no-store' }),
      fetch('/api/countries', { cache: 'no-store' }),
      fetch('/api/fixed-costs', { cache: 'no-store' }),
    ]);
    const legsData = await legsRes.json();
    const citiesData = await citiesRes.json();
    const countriesData = await countriesRes.json();
    const fixedData = await fixedRes.json();
    const countries = (countriesData.data || []) as Country[];
    const countryMap = new Map(countries.map((country) => [country.id, country.name]));

    setLegs(legsData.data || []);
    setCities(
      ((citiesData.data || []) as Array<City>)
        .map((city) => ({
          ...city,
          countryName: countryMap.get(city.countryId) || 'Unknown',
        }))
        .sort((a, b) => `${a.countryName}-${a.name}`.localeCompare(`${b.countryName}-${b.name}`))
    );
    setFixedCosts(fixedData.data || []);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    async function loadPlannerSettings() {
      const response = await fetch('/api/planner/settings', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data.data?.groupSize) {
        setGroupSize(data.data.groupSize);
      }
    }
    loadPlannerSettings();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(PLAN_SNAPSHOT_STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as SavedPlanSnapshot[];
      setSavedSnapshots(parsed);
    } catch {
      setSavedSnapshots([]);
    }
  }, []);

  const persistSavedSnapshots = useCallback((nextSnapshots: SavedPlanSnapshot[]) => {
    setSavedSnapshots(nextSnapshots);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PLAN_SNAPSHOT_STORAGE_KEY, JSON.stringify(nextSnapshots));
    }
  }, []);

  const handleAddLeg = async () => {
    const parsedNights = Number.parseInt(newLegNights, 10);
    if (!newLegCity || !Number.isInteger(parsedNights) || parsedNights < 1) return;

    await fetch('/api/itinerary/legs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cityId: newLegCity,
        nights: parsedNights,
      }),
    });
    setAddDialogOpen(false);
    setNewLegCity('');
    setNewLegNights('7');
    fetchData();
  };

  const handleUpdateLeg = async (id: number, data: Record<string, unknown>) => {
    const response = await fetch(`/api/itinerary/legs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(data, 'status')) {
      const sortedLegIds = [...legs]
        .map((leg) => (leg.id === id ? { ...leg, ...data } : leg))
        .sort(compareLegDates)
        .map((leg) => leg.id);

      await fetch('/api/itinerary/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legIds: sortedLegIds }),
      });
    }

    fetchData();
  };

  const handleDeleteLeg = async (id: number) => {
    await fetch(`/api/itinerary/legs/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleReorder = async (fromIndex: number, direction: number) => {
    const newLegs = [...legs];
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= newLegs.length) return;
    [newLegs[fromIndex], newLegs[toIndex]] = [newLegs[toIndex], newLegs[fromIndex]];

    await fetch('/api/itinerary/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ legIds: newLegs.map(l => l.id) }),
    });
    fetchData();
  };

  const fixedCostsTotal = fixedCosts.reduce((sum, fc) => sum + fc.amountAud, 0);
  const currentPlanSummary = {
    legCount: legs.length,
    totalNights: legs.reduce((sum, leg) => sum + leg.nights, 0),
    totalBudget: legs.reduce((sum, leg) => sum + leg.legTotal, 0) + fixedCostsTotal,
    fixedCostCount: fixedCosts.length,
  };

  const fetchCurrentSnapshot = useCallback(async () => {
    const response = await fetch('/api/itinerary/snapshot', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch current plan snapshot.');
    }
    return data.data as PlanSnapshot;
  }, []);

  const downloadSnapshot = useCallback((snapshot: PlanSnapshot, filenameBase: string) => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filenameBase}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const importSnapshot = useCallback(async (snapshot: PlanSnapshot) => {
    const response = await fetch('/api/itinerary/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to import plan snapshot.');
    }
    await fetchData();
  }, [fetchData]);

  const handleSaveSnapshot = async () => {
    const name = window.prompt('Snapshot name', `Plan ${new Date().toISOString().slice(0, 10)}`)?.trim();
    if (!name) return;

    try {
      const snapshot = await fetchCurrentSnapshot();
      const nextSnapshot: SavedPlanSnapshot = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        savedAt: new Date().toISOString(),
        summary: currentPlanSummary,
        snapshot: {
          ...snapshot,
          name,
          exportedAt: new Date().toISOString(),
        },
      };
      persistSavedSnapshots([nextSnapshot, ...savedSnapshots]);
      setSnapshotError(null);
      setSnapshotStatus(`Saved snapshot "${name}".`);
    } catch (err) {
      setSnapshotStatus(null);
      setSnapshotError(err instanceof Error ? err.message : 'Failed to save snapshot.');
    }
  };

  const handleExportCurrentPlan = async () => {
    try {
      const snapshot = await fetchCurrentSnapshot();
      downloadSnapshot(snapshot, `wanderledger-plan-${new Date().toISOString().slice(0, 10)}`);
      setSnapshotError(null);
      setSnapshotStatus('Exported current plan.');
    } catch (err) {
      setSnapshotStatus(null);
      setSnapshotError(err instanceof Error ? err.message : 'Failed to export current plan.');
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const snapshot = JSON.parse(await file.text()) as PlanSnapshot;
      await importSnapshot(snapshot);
      setSnapshotError(null);
      setSnapshotStatus(`Imported "${file.name}".`);
    } catch (err) {
      setSnapshotStatus(null);
      setSnapshotError(err instanceof Error ? err.message : 'Failed to import snapshot.');
    } finally {
      event.target.value = '';
    }
  };

  const handleLoadSavedSnapshot = async (savedSnapshot: SavedPlanSnapshot) => {
    try {
      await importSnapshot(savedSnapshot.snapshot);
      setSavedPlansOpen(false);
      setSnapshotError(null);
      setSnapshotStatus(`Loaded snapshot "${savedSnapshot.name}".`);
    } catch (err) {
      setSnapshotStatus(null);
      setSnapshotError(err instanceof Error ? err.message : 'Failed to load saved snapshot.');
    }
  };

  const handleDeleteSavedSnapshot = (id: string) => {
    persistSavedSnapshots(savedSnapshots.filter((snapshot) => snapshot.id !== id));
  };

  const handleGroupSizeChange = async (value: string) => {
    const nextGroupSize = Number.parseInt(value, 10);
    setGroupSize(nextGroupSize);
    try {
      const response = await fetch('/api/planner/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupSize: nextGroupSize }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update traveller count.');
      }
      setSnapshotError(null);
      setSnapshotStatus(`Traveller count set to ${data.data.groupSize}.`);
      await fetchData();
    } catch (err) {
      setSnapshotStatus(null);
      setSnapshotError(err instanceof Error ? err.message : 'Failed to update traveller count.');
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="sticky top-0 z-30 -mx-4 -mt-4 border-b bg-background/95 px-4 py-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Itinerary Planner</h1>
            <p className="text-sm text-muted-foreground">
              Build your trip leg by leg. City costs are stored for 2 people and scaled here for your selected traveller count.
            </p>
            <p className="text-xs text-muted-foreground">
              Split % is your share of each leg total. For example, 50 means you pay half and 100 means you pay the full amount.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="min-w-[160px]">
              <Label className="mb-1 block text-xs text-muted-foreground">Travellers</Label>
              <Select value={String(groupSize)} onValueChange={handleGroupSizeChange}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      {count} {count === 1 ? 'traveller' : 'travellers'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Dialog open={savedPlansOpen} onOpenChange={setSavedPlansOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Saved Plans
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Saved Plan Snapshots</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {savedSnapshots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No saved snapshots yet.</p>
                  ) : (
                    savedSnapshots.map((snapshot) => (
                      <div key={snapshot.id} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{snapshot.name}</div>
                            <div className="text-xs text-muted-foreground">{snapshot.savedAt.slice(0, 16).replace('T', ' ')}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {snapshot.summary.legCount} legs, {snapshot.summary.totalNights} nights, ${snapshot.summary.totalBudget.toLocaleString('en-AU', { maximumFractionDigits: 0 })} total
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => downloadSnapshot(snapshot.snapshot, snapshot.name.replace(/\s+/g, '-').toLowerCase())}>
                              <Download className="mr-1 h-3.5 w-3.5" />
                              Export
                            </Button>
                            <Button type="button" size="sm" onClick={() => handleLoadSavedSnapshot(snapshot)}>
                              Load
                            </Button>
                            <Button type="button" size="sm" variant="destructive" onClick={() => handleDeleteSavedSnapshot(snapshot.id)}>
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button type="button" variant="outline" onClick={handleSaveSnapshot}>
              <Save className="mr-2 h-4 w-4" />
              Save Snapshot
            </Button>
            <Button type="button" variant="outline" onClick={handleExportCurrentPlan}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button type="button" variant="outline" onClick={() => importInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Leg
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Itinerary Leg</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>City</Label>
                    <SearchableSelect
                      value={newLegCity}
                      onValueChange={setNewLegCity}
                      placeholder="Select a city"
                      searchPlaceholder="Search cities..."
                      options={cities.map((city) => ({
                        value: city.id,
                        label: `${city.name}, ${city.countryName}`,
                        description: city.countryName,
                        keywords: `${city.name} ${city.countryName}`,
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Nights</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={newLegNights}
                      onChange={(e) => setNewLegNights(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleAddLeg}
                    disabled={!newLegCity || !Number.isInteger(Number.parseInt(newLegNights, 10)) || Number.parseInt(newLegNights, 10) < 1}
                    className="w-full"
                  >
                    Add Leg
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        {snapshotStatus || snapshotError ? (
          <div className="mt-3 text-sm">
            {snapshotStatus ? <span className="text-muted-foreground">{snapshotStatus}</span> : null}
            {snapshotError ? <span className="text-destructive">{snapshotError}</span> : null}
          </div>
        ) : null}
        <div className="mt-3 text-xs text-muted-foreground">
          Current plan: {groupSize} {groupSize === 1 ? 'traveller' : 'travellers'}, {currentPlanSummary.legCount} legs, {currentPlanSummary.totalNights} nights, ${currentPlanSummary.totalBudget.toLocaleString('en-AU', { maximumFractionDigits: 0 })} total.
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        {/* Legs list */}
        <div className="space-y-3">
          {legs.length === 0 && (
            <p className="text-muted-foreground text-center py-12">
              No legs yet. Add your first destination to start planning.
            </p>
          )}
          {legs.map((leg, i) => (
            <LegCard
              key={leg.id}
              leg={leg}
              cities={cities}
              groupSize={groupSize}
              onUpdate={handleUpdateLeg}
              onDelete={handleDeleteLeg}
              onMoveUp={() => handleReorder(i, -1)}
              onMoveDown={() => handleReorder(i, 1)}
              isFirst={i === 0}
              isLast={i === legs.length - 1}
            />
          ))}
        </div>

        {/* Summary sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-0">
            <CostSummary legs={legs} fixedCostsTotal={fixedCostsTotal} groupSize={groupSize} />
          </div>
        </div>
      </div>

      {/* Mobile summary */}
      <div className="lg:hidden">
        <CostSummary legs={legs} fixedCostsTotal={fixedCostsTotal} groupSize={groupSize} />
      </div>
    </div>
  );
}
