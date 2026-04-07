'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LegCard } from '@/components/itinerary/LegCard';
import { CostSummary } from '@/components/itinerary/CostSummary';
import { Plus } from 'lucide-react';

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
}

interface FixedCost {
  id: number;
  amountAud: number;
}

export default function PlanPage() {
  const [legs, setLegs] = useState<Leg[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newLegCity, setNewLegCity] = useState('');
  const [newLegNights, setNewLegNights] = useState('7');

  const fetchData = useCallback(async () => {
    const [legsRes, citiesRes, fixedRes] = await Promise.all([
      fetch('/api/itinerary'),
      fetch('/api/cities'),
      fetch('/api/fixed-costs'),
    ]);
    const legsData = await legsRes.json();
    const citiesData = await citiesRes.json();
    const fixedData = await fixedRes.json();
    setLegs(legsData.data || []);
    setCities(citiesData.data || []);
    setFixedCosts(fixedData.data || []);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    await fetch(`/api/itinerary/legs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Itinerary Planner</h1>
          <p className="text-sm text-muted-foreground">
            Build your trip leg by leg. Select tiers to estimate costs.
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
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
                <Select value={newLegCity} onValueChange={setNewLegCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a city" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          <div className="sticky top-4">
            <CostSummary legs={legs} fixedCostsTotal={fixedCostsTotal} />
          </div>
        </div>
      </div>

      {/* Mobile summary */}
      <div className="lg:hidden">
        <CostSummary legs={legs} fixedCostsTotal={fixedCostsTotal} />
      </div>
    </div>
  );
}
