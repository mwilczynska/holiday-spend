'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoadingState } from '@/components/ui/loading-state';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { COST_FIELD_KEYS, CostEditor } from '@/components/cities/CostEditor';
import { CityGenerationPanel } from '@/components/cities/CityGenerationPanel';
import { Plus } from 'lucide-react';

interface City {
  id: string;
  countryId: string;
  name: string;
  estimationSource: string | null;
  estimatedAt?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

interface Country {
  id: string;
  name: string;
  currencyCode: string;
  region?: string | null;
  cities: City[];
}

function fmtDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '-';
}

export default function CitiesPage() {
  const didApplyQuerySelection = useRef(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCity, setSelectedCity] = useState<(City & { countryName: string; currencyCode: string; region?: string | null }) | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCity, setNewCity] = useState({ id: '', name: '', countryId: '' });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/countries', { cache: 'no-store' });
      const data = await response.json();
      const nextCountries = (data.data || []).sort((a: Country, b: Country) => a.name.localeCompare(b.name));
      setCountries(nextCountries);
      return nextCountries as Country[];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allCities = useMemo(
    () =>
      countries
        .flatMap((country) =>
          country.cities.map((city) => ({
            ...city,
            countryName: country.name,
            currencyCode: country.currencyCode,
            region: country.region,
          }))
        )
        .sort((a, b) => a.name.localeCompare(b.name) || a.countryName.localeCompare(b.countryName)),
    [countries]
  );

  const selectCityFromCountries = useCallback((cityId: string, sourceCountries: Country[]) => {
    const city = sourceCountries
      .flatMap((country) =>
        country.cities.map((entry) => ({
          ...entry,
          countryName: country.name,
          currencyCode: country.currencyCode,
          region: country.region,
        }))
      )
      .find((entry) => entry.id === cityId);

    setSelectedCity(city || null);
    setIsDirty(false);
    setSaveError(null);
    setSaveMessage(null);
  }, []);

  useEffect(() => {
    if (didApplyQuerySelection.current) return;
    const cityId = new URLSearchParams(window.location.search).get('cityId');
    if (countries.length === 0) return;
    didApplyQuerySelection.current = true;
    if (!cityId) return;
    selectCityFromCountries(cityId, countries);
  }, [countries, selectCityFromCountries]);

  const handleCostChange = (key: string, value: number | null) => {
    if (!selectedCity) return;
    const updated = { ...selectedCity, [key]: value };
    setSelectedCity(updated);
    setIsDirty(true);
    setSaveError(null);
    setSaveMessage(null);
  };

  const handleSaveCity = async () => {
    if (!selectedCity) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const payload = Object.fromEntries(
        COST_FIELD_KEYS.map((key) => [key, (selectedCity as Record<string, number | null>)[key] ?? null])
      );

      const response = await fetch(`/api/cities/${selectedCity.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setSaveError(data.error || 'Failed to save city.');
        return;
      }

      const nextCountries = await fetchData();
      selectCityFromCountries(selectedCity.id, nextCountries);
      setSaveMessage('City saved.');
    } catch {
      setSaveError('Failed to save city.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCity = async () => {
    if (!newCity.id || !newCity.name || !newCity.countryId) return;
    await fetch('/api/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCity),
    });
    setAddDialogOpen(false);
    setNewCity({ id: '', name: '', countryId: '' });
    const nextCountries = await fetchData();
    selectCityFromCountries(newCity.id, nextCountries);
  };

  if (loading && countries.length === 0) {
    return (
      <PageLoadingState
        title="Loading city cost library"
        description="Fetching countries, cities, and the current planner dataset."
        cardCount={3}
        rowCount={5}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">City Cost Library</h1>
          <p className="text-sm text-muted-foreground">
            Manage the planner-facing base dataset. All values are AUD for two people. Local transport
            stays manual in plan mode.
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add City
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add City</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Country</Label>
                <SearchableSelect
                  value={newCity.countryId}
                  onValueChange={(value) => setNewCity((current) => ({ ...current, countryId: value }))}
                  placeholder="Select country"
                  searchPlaceholder="Search countries..."
                  options={countries.map((country) => ({
                    value: country.id,
                    label: country.name,
                  }))}
                />
              </div>
              <div>
                <Label>City ID</Label>
                <Input
                  value={newCity.id}
                  onChange={(event) => setNewCity((current) => ({ ...current, id: event.target.value }))}
                  placeholder="e.g. mexico-city"
                />
              </div>
              <div>
                <Label>City Name</Label>
                <Input
                  value={newCity.name}
                  onChange={(event) => setNewCity((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Mexico City"
                />
              </div>
              <Button onClick={handleAddCity} className="w-full">
                Add City
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        <Label>Select City</Label>
        <SearchableSelect
          value={selectedCity?.id || ''}
          onValueChange={(cityId) => {
            const city = allCities.find((entry) => entry.id === cityId);
            setSelectedCity(city || null);
          }}
          placeholder="Search for a city"
          searchPlaceholder="Type a city or country..."
          options={allCities.map((city) => ({
            value: city.id,
            label: `${city.name}, ${city.countryName}`,
            description: city.estimationSource ? `Source: ${city.estimationSource}` : city.countryName,
            keywords: `${city.name} ${city.countryName} ${city.region || ''} ${city.estimationSource || ''}`,
          }))}
        />
      </div>

      {selectedCity ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <span>{selectedCity.name}</span>
                <Badge variant="secondary">{selectedCity.countryName}</Badge>
                {selectedCity.estimationSource ? (
                  <Badge variant="outline">{selectedCity.estimationSource}</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Region</div>
                <div className="text-sm">{selectedCity.region || '-'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Currency</div>
                <div className="text-sm">{selectedCity.currencyCode}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Updated</div>
                <div className="text-sm">{fmtDate((selectedCity as { estimatedAt?: string | null }).estimatedAt)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Transport</div>
                <div className="text-sm">Manual only</div>
              </div>
              <div className="md:col-span-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Notes</div>
                <div className="text-sm text-muted-foreground">
                  {(selectedCity as { notes?: string | null }).notes ||
                    'Base dataset row. Methodology and generation history live on the Estimate Methodology page.'}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Base Cost Values</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CityGenerationPanel
                cityId={selectedCity.id}
                cityName={selectedCity.name}
                countryName={selectedCity.countryName}
                onGenerated={async () => {
                  const nextCountries = await fetchData();
                  selectCityFromCountries(selectedCity.id, nextCountries);
                  setSaveMessage('City updated from generated values.');
                }}
              />
              <p className="text-sm text-muted-foreground">
                These are the canonical planner costs stored on the city row. You can generate fresh
                methodology-driven values above, then fine-tune any fields manually here if needed.
              </p>
              <CostEditor
                values={selectedCity as unknown as Record<string, number | null>}
                onChange={handleCostChange}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={handleSaveCity} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save City'}
                </Button>
                {isDirty ? <span className="text-sm text-muted-foreground">Unsaved changes</span> : null}
                {saveMessage ? <span className="text-sm text-muted-foreground">{saveMessage}</span> : null}
                {saveError ? <span className="text-sm text-destructive">{saveError}</span> : null}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
