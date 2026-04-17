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

interface EstimateHistoryItem {
  id: number;
  cityId: string;
  cityName: string;
  countryName: string;
  estimatedAt: string;
  source: string | null;
  llmProvider: string | null;
  confidence: string | null;
  reasoning: string | null;
  inferredAudPerUsd: number | null;
  isActive: number | null;
}

type DatasetCity = City & {
  countryName: string;
  currencyCode: string;
  region?: string | null;
};

const DATASET_COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'accomHostel', label: 'Hostel' },
  { key: 'accomPrivateRoom', label: 'Private' },
  { key: 'accom1star', label: '1-Star' },
  { key: 'accom2star', label: '2-Star' },
  { key: 'accom3star', label: '3-Star' },
  { key: 'accom4star', label: '4-Star' },
  { key: 'foodStreet', label: 'Food Street' },
  { key: 'foodBudget', label: 'Food Budget' },
  { key: 'foodMid', label: 'Food Mid' },
  { key: 'foodHigh', label: 'Food High' },
  { key: 'drinksNone', label: 'Drinks None' },
  { key: 'drinksLight', label: 'Drinks Light' },
  { key: 'drinksModerate', label: 'Drinks Moderate' },
  { key: 'drinksHeavy', label: 'Drinks Heavy' },
  { key: 'activitiesFree', label: 'Activities Free' },
  { key: 'activitiesBudget', label: 'Activities Budget' },
  { key: 'activitiesMid', label: 'Activities Mid' },
  { key: 'activitiesHigh', label: 'Activities High' },
];

function fmtDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '-';
}

function fmtMoney(value: unknown) {
  return typeof value === 'number' ? value.toFixed(2) : '-';
}

function matchesCity(row: DatasetCity, query: string) {
  const haystack = [row.name, row.countryName, row.region, row.estimationSource, row.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export default function DatasetPage() {
  const didApplyQuerySelection = useRef(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCity, setSelectedCity] = useState<DatasetCity | null>(null);
  const [history, setHistory] = useState<EstimateHistoryItem[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCity, setNewCity] = useState({ id: '', name: '', countryId: '' });
  const [query, setQuery] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const syncCityQuery = useCallback((cityId: string | null) => {
    const nextUrl = new URL(window.location.href);
    if (cityId) {
      nextUrl.searchParams.set('cityId', cityId);
    } else {
      nextUrl.searchParams.delete('cityId');
    }
    window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [countriesResponse, estimatesResponse] = await Promise.all([
        fetch('/api/countries', { cache: 'no-store' }),
        fetch('/api/estimates', { cache: 'no-store' }),
      ]);

      const countriesData = await countriesResponse.json();
      const estimatesData = await estimatesResponse.json();
      const nextCountries = (countriesData.data || []).sort((a: Country, b: Country) => a.name.localeCompare(b.name));

      setCountries(nextCountries);
      setHistory(estimatesData.data?.history || []);
      setHistoryCount(estimatesData.data?.summary?.historyCount || 0);

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

  const sourceBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const city of allCities) {
      const key = city.estimationSource || 'unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
  }, [allCities]);

  const filteredCities = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return allCities;
    return allCities.filter((city) => matchesCity(city, normalized));
  }, [allCities, query]);

  const filteredHistory = useMemo(() => {
    const normalized = historyQuery.trim().toLowerCase();
    if (!normalized) return history;

    return history.filter((row) =>
      [row.cityName, row.countryName, row.source, row.llmProvider, row.reasoning]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [history, historyQuery]);

  const selectCityFromCountries = useCallback(
    (cityId: string | null, sourceCountries: Country[], updateQuery = true) => {
      if (!cityId) {
        setSelectedCity(null);
        setIsDirty(false);
        setSaveError(null);
        setSaveMessage(null);
        if (updateQuery) syncCityQuery(null);
        return;
      }

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
      if (updateQuery && city) syncCityQuery(city.id);
    },
    [syncCityQuery]
  );

  useEffect(() => {
    if (didApplyQuerySelection.current) return;
    const cityId = new URLSearchParams(window.location.search).get('cityId');
    if (countries.length === 0) return;
    didApplyQuerySelection.current = true;
    if (!cityId) return;
    selectCityFromCountries(cityId, countries, false);
  }, [countries, selectCityFromCountries]);

  const handleCostChange = (key: string, value: number | null) => {
    if (!selectedCity) return;
    setSelectedCity({ ...selectedCity, [key]: value });
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

    const cityId = newCity.id;
    await fetch('/api/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCity),
    });

    setAddDialogOpen(false);
    setNewCity({ id: '', name: '', countryId: '' });
    const nextCountries = await fetchData();
    selectCityFromCountries(cityId, nextCountries);
  };

  const handleDeleteCity = async (city: DatasetCity) => {
    const confirmed = window.confirm(
      `Delete ${city.name}, ${city.countryName}? This will also remove its generation history.`
    );
    if (!confirmed) return;

    setDeleteError(null);

    try {
      const response = await fetch(`/api/cities/${city.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        setDeleteError(data.error || 'Failed to delete city.');
        return;
      }

      const nextCountries = await fetchData();
      if (selectedCity?.id === city.id) {
        selectCityFromCountries(null, nextCountries);
      }
    } catch {
      setDeleteError('Failed to delete city.');
    }
  };

  if (loading && countries.length === 0) {
    return (
      <PageLoadingState
        title="Loading dataset"
        description="Fetching the planner-facing city cost dataset, editor state, and generation history."
        cardCount={3}
        rowCount={5}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Dataset</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Manage the planner-facing city cost dataset. All values are stored in AUD for two people,
            then scaled at runtime for traveller count. Methodology now lives on its own page, while
            dataset history stays here with the underlying rows.
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">City Cost Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select City</Label>
            <SearchableSelect
              value={selectedCity?.id || ''}
              onValueChange={(cityId) => selectCityFromCountries(cityId || null, countries)}
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
                    <div className="text-sm">{fmtDate(selectedCity.estimatedAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Transport</div>
                    <div className="text-sm">Manual only</div>
                  </div>
                  <div className="md:col-span-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Notes</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedCity.notes ||
                        'Base dataset row. Methodology and generation history live alongside the dataset pages.'}
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
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Select a city to edit its base values, regenerate costs, or review the stored metadata.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Current Dataset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Cities</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{allCities.length}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Countries</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{countries.length}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">History Records</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{historyCount}</CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataset-query">Search dataset</Label>
            <Input
              id="dataset-query"
              placeholder="Search city, country, region, source, or notes"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {sourceBreakdown.map((entry) => (
              <Badge key={entry.source} variant="outline">
                {entry.source}: {entry.count}
              </Badge>
            ))}
          </div>

          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}

          <div className="w-full overflow-x-auto rounded-md border">
            <table className="min-w-[1800px] text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="sticky left-0 z-30 min-w-[180px] bg-muted px-3 py-2 text-left font-medium shadow-[1px_0_0_0_hsl(var(--border))]">
                    City
                  </th>
                  <th className="sticky left-[180px] z-20 min-w-[160px] bg-muted px-3 py-2 text-left font-medium shadow-[1px_0_0_0_hsl(var(--border))]">
                    Country
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-left font-medium">Updated</th>
                  {DATASET_COLUMNS.map((column) => (
                    <th key={column.key} className="px-3 py-2 text-left font-medium">
                      {column.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left font-medium">Notes</th>
                  <th className="px-3 py-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCities.map((city) => (
                  <tr key={city.id} className="border-b align-top last:border-0">
                    <td className="sticky left-0 z-20 min-w-[180px] bg-background px-3 py-2 font-medium shadow-[1px_0_0_0_hsl(var(--border))]">
                      {city.name}
                    </td>
                    <td className="sticky left-[180px] z-10 min-w-[160px] bg-background px-3 py-2 shadow-[1px_0_0_0_hsl(var(--border))]">
                      <div>{city.countryName}</div>
                      {city.region ? <div className="text-xs text-muted-foreground">{city.region}</div> : null}
                    </td>
                    <td className="px-3 py-2">{city.estimationSource || '-'}</td>
                    <td className="px-3 py-2">{fmtDate(city.estimatedAt)}</td>
                    {DATASET_COLUMNS.map((column) => (
                      <td key={column.key} className="px-3 py-2">
                        {fmtMoney((city as Record<string, unknown>)[column.key])}
                      </td>
                    ))}
                    <td className="min-w-[16rem] px-3 py-2 text-xs text-muted-foreground">{city.notes || '-'}</td>
                    <td className="min-w-[12rem] px-3 py-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            selectCityFromCountries(city.id, countries);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteCity(city)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCities.length === 0 ? (
                  <tr>
                    <td colSpan={DATASET_COLUMNS.length + 6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No city rows match the current search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Generation History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Historical estimate rows are retained as an audit trail. Older pre-methodology records are not
            migrated or pruned automatically; the active city row remains the planner&apos;s canonical source of truth.
          </p>

          <div className="space-y-2">
            <Label htmlFor="dataset-history-query">Search history</Label>
            <Input
              id="dataset-history-query"
              placeholder="Search city, country, source, provider, or reasoning"
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
            />
          </div>

          <div className="w-full overflow-x-auto rounded-md border">
            <table className="min-w-[900px] text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">City</th>
                  <th className="px-3 py-2 text-left font-medium">Country</th>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-left font-medium">Provider</th>
                  <th className="px-3 py-2 text-left font-medium">AUD/USD</th>
                  <th className="px-3 py-2 text-left font-medium">Confidence</th>
                  <th className="px-3 py-2 text-left font-medium">Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((entry) => (
                  <tr key={entry.id} className="border-b align-top last:border-0">
                    <td className="px-3 py-2">{fmtDate(entry.estimatedAt)}</td>
                    <td className="px-3 py-2 font-medium">
                      {entry.cityName}
                      {entry.isActive ? <div className="text-xs text-muted-foreground">active</div> : null}
                    </td>
                    <td className="px-3 py-2">{entry.countryName}</td>
                    <td className="px-3 py-2">{entry.source || '-'}</td>
                    <td className="px-3 py-2">{entry.llmProvider || '-'}</td>
                    <td className="px-3 py-2">
                      {typeof entry.inferredAudPerUsd === 'number' ? entry.inferredAudPerUsd.toFixed(2) : '-'}
                    </td>
                    <td className="px-3 py-2">{entry.confidence || '-'}</td>
                    <td className="min-w-[24rem] px-3 py-2 text-xs text-muted-foreground">{entry.reasoning || '-'}</td>
                  </tr>
                ))}
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No generation history is stored yet for the current filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
