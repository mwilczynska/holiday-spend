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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COST_FIELD_KEYS, CostEditor } from '@/components/cities/CostEditor';
import { CityGenerationPanel } from '@/components/cities/CityGenerationPanel';
import { findKnownCountryCurrencyCode, findKnownCountryRegion, slugifyId } from '@/lib/country-metadata';
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

const REGION_OPTIONS = [
  { value: 'latin_america', label: 'Latin America' },
  { value: 'north_america', label: 'North America' },
  { value: 'europe', label: 'Europe' },
  { value: 'east_asia', label: 'East Asia' },
  { value: 'se_asia', label: 'Southeast Asia' },
  { value: 'south_asia', label: 'South Asia' },
  { value: 'middle_east', label: 'Middle East' },
  { value: 'africa', label: 'Africa' },
  { value: 'oceania', label: 'Oceania' },
] as const;

function getRegionLabel(regionValue: string | null | undefined) {
  if (!regionValue) return '-';
  return REGION_OPTIONS.find((option) => option.value === regionValue)?.label || regionValue;
}

function looksSimilarBySlug(left: string, right: string) {
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

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
  const [addCountryDialogOpen, setAddCountryDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [reopenAddCityAfterCountry, setReopenAddCityAfterCountry] = useState(false);
  const [newCountry, setNewCountry] = useState({ id: '', name: '', currencyCode: '', region: '' });
  const [newCity, setNewCity] = useState({ id: '', name: '', countryId: '' });
  const [query, setQuery] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addingCountry, setAddingCountry] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addCountryError, setAddCountryError] = useState<string | null>(null);
  const [addCityError, setAddCityError] = useState<string | null>(null);
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

  const selectedCityHistory = useMemo(() => {
    if (!selectedCity) return [];
    return history.filter((row) => row.cityId === selectedCity.id);
  }, [history, selectedCity]);

  const selectedCityActiveHistory = useMemo(
    () => selectedCityHistory.find((row) => row.isActive) ?? selectedCityHistory[0] ?? null,
    [selectedCityHistory]
  );

  const suggestedCountryId = useMemo(() => slugifyId(newCountry.name), [newCountry.name]);
  const suggestedCountryCurrencyCode = useMemo(
    () => findKnownCountryCurrencyCode(newCountry.name) || '',
    [newCountry.name]
  );
  const suggestedCountryRegion = useMemo(
    () => findKnownCountryRegion(newCountry.name) || '',
    [newCountry.name]
  );
  const effectiveCountryId = newCountry.id.trim() ? slugifyId(newCountry.id) : suggestedCountryId;
  const effectiveCountryCurrencyCode = newCountry.currencyCode.trim().toUpperCase() || suggestedCountryCurrencyCode;
  const effectiveCountryRegion = newCountry.region.trim() || suggestedCountryRegion;
  const countryConflict = useMemo(() => {
    if (!newCountry.name.trim() && !effectiveCountryId) return null;
    const normalizedName = slugifyId(newCountry.name);
    return (
      countries.find((country) => country.id === effectiveCountryId) ||
      countries.find((country) => normalizedName && slugifyId(country.name) === normalizedName) ||
      null
    );
  }, [countries, effectiveCountryId, newCountry.name]);

  const effectiveCityId = useMemo(
    () => (newCity.id.trim() ? slugifyId(newCity.id) : slugifyId(newCity.name)),
    [newCity.id, newCity.name]
  );
  const cityIdConflict = useMemo(
    () => allCities.find((city) => effectiveCityId && city.id === effectiveCityId) ?? null,
    [allCities, effectiveCityId]
  );
  const exactCityNameConflict = useMemo(() => {
    const normalizedName = slugifyId(newCity.name);
    if (!newCity.countryId || !normalizedName) return null;
    return (
      allCities.find(
        (city) => city.countryId === newCity.countryId && slugifyId(city.name) === normalizedName
      ) ?? null
    );
  }, [allCities, newCity.countryId, newCity.name]);
  const similarCityMatches = useMemo(() => {
    const normalizedName = slugifyId(newCity.name);
    if (!normalizedName) return [];

    return allCities
      .filter((city) => {
        const citySlug = slugifyId(city.name);
        if (!looksSimilarBySlug(citySlug, normalizedName)) return false;
        if (cityIdConflict && city.id === cityIdConflict.id) return true;
        return true;
      })
      .slice(0, 5);
  }, [allCities, cityIdConflict, newCity.name]);

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
    if (!newCity.name.trim() || !newCity.countryId || !effectiveCityId || cityIdConflict || exactCityNameConflict) return;

    setAddCityError(null);

    try {
      const response = await fetch('/api/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newCity.id.trim() || undefined,
          name: newCity.name.trim(),
          countryId: newCity.countryId,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setAddCityError(data.error || 'Failed to add city.');
        return;
      }

      setAddDialogOpen(false);
      setNewCity({ id: '', name: '', countryId: '' });
      const nextCountries = await fetchData();
      selectCityFromCountries(data.data?.id || effectiveCityId, nextCountries);
    } catch {
      setAddCityError('Failed to add city.');
    }
  };

  const handleAddCountry = async () => {
    if (!newCountry.name.trim() || !effectiveCountryId || !effectiveCountryCurrencyCode || countryConflict) return;

    setAddingCountry(true);
    setAddCountryError(null);

    try {
      const response = await fetch('/api/countries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newCountry.id.trim() || undefined,
          name: newCountry.name.trim(),
          currencyCode: newCountry.currencyCode.trim() || undefined,
          region: newCountry.region.trim() || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setAddCountryError(data.error || 'Failed to add country.');
        return;
      }

      const nextCountries = await fetchData();
      setNewCountry({ id: '', name: '', currencyCode: '', region: '' });
      setNewCity((current) => ({ ...current, countryId: data.data.id }));
      setAddCountryDialogOpen(false);
      setAddCountryError(null);

      if (reopenAddCityAfterCountry) {
        setReopenAddCityAfterCountry(false);
        setAddDialogOpen(true);
      }

      if (!selectedCity && nextCountries.length > 0) {
        setSaveMessage(`Country "${data.data.name}" created.`);
      }
    } catch {
      setAddCountryError('Failed to add country.');
    } finally {
      setAddingCountry(false);
    }
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
        <div className="flex flex-wrap gap-2">
          <Dialog
            open={addCountryDialogOpen}
            onOpenChange={(open) => {
              setAddCountryDialogOpen(open);
              if (!open) {
                setAddCountryError(null);
                setReopenAddCityAfterCountry(false);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Country
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Country</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Country Name</Label>
                  <Input
                    value={newCountry.name}
                    onChange={(event) => setNewCountry((current) => ({ ...current, name: event.target.value }))}
                    placeholder="e.g. Uzbekistan"
                  />
                </div>
                <div>
                  <Label>Country ID</Label>
                  <Input
                    value={newCountry.id}
                    onChange={(event) => setNewCountry((current) => ({ ...current, id: event.target.value }))}
                    placeholder={suggestedCountryId || 'Leave blank to infer from country name'}
                  />
                </div>
                <div>
                  <Label>Currency Code</Label>
                  <Input
                    value={newCountry.currencyCode}
                    onChange={(event) =>
                      setNewCountry((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))
                    }
                    placeholder={suggestedCountryCurrencyCode || 'e.g. UZS'}
                    maxLength={3}
                  />
                </div>
                <div>
                  <Label>Region</Label>
                  <Select
                    value={newCountry.region || '__auto__'}
                    onValueChange={(value) =>
                      setNewCountry((current) => ({ ...current, region: value === '__auto__' ? '' : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Leave blank to use the inferred region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__auto__">Auto / leave blank</SelectItem>
                      {REGION_OPTIONS.map((region) => (
                        <SelectItem key={region.value} value={region.value}>
                          {region.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                  <p>
                    Inferred defaults: id <span className="font-medium text-foreground">{effectiveCountryId || '-'}</span>,
                    currency <span className="font-medium text-foreground">{effectiveCountryCurrencyCode || 'manual required'}</span>,
                    region <span className="font-medium text-foreground">{getRegionLabel(effectiveCountryRegion)}</span>.
                  </p>
                </div>

                {countryConflict ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {`Country "${countryConflict.name}" already exists with id "${countryConflict.id}". Reuse it instead of creating a duplicate.`}
                  </div>
                ) : null}

                {addCountryError ? <p className="text-sm text-destructive">{addCountryError}</p> : null}

                <Button
                  onClick={handleAddCountry}
                  className="w-full"
                  disabled={!newCountry.name.trim() || !effectiveCountryId || !effectiveCountryCurrencyCode || !!countryConflict || addingCountry}
                >
                  {addingCountry ? 'Creating Country...' : 'Create Country'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog
            open={addDialogOpen}
            onOpenChange={(open) => {
              setAddDialogOpen(open);
              if (!open) setAddCityError(null);
            }}
          >
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
                <div className="space-y-2">
                  <SearchableSelect
                    value={newCity.countryId}
                    onValueChange={(value) => setNewCity((current) => ({ ...current, countryId: value }))}
                    placeholder="Select country"
                    searchPlaceholder="Search countries..."
                    options={countries.map((country) => ({
                      value: country.id,
                      label: country.name,
                      description: `${country.currencyCode}${country.region ? ` - ${getRegionLabel(country.region)}` : ''}`,
                    }))}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Need a country first? Create it here, then come back to finish the city row.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAddDialogOpen(false);
                        setAddCountryDialogOpen(true);
                        setReopenAddCityAfterCountry(true);
                        setAddCountryError(null);
                      }}
                    >
                      Create Country
                    </Button>
                  </div>
                </div>
              </div>
              <div>
                <Label>City ID</Label>
                <Input
                  value={newCity.id}
                  onChange={(event) => setNewCity((current) => ({ ...current, id: event.target.value }))}
                  placeholder={effectiveCityId || 'Leave blank to infer from city name'}
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
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                <p>
                  Effective city id: <span className="font-medium text-foreground">{effectiveCityId || '-'}</span>
                </p>
                {cityIdConflict ? (
                  <p className="mt-1 text-amber-700">
                    {`City id conflict: "${cityIdConflict.name}, ${cityIdConflict.countryName}" already uses this id.`}
                  </p>
                ) : null}
                {exactCityNameConflict ? (
                  <p className="mt-1 text-amber-700">
                    {`"${exactCityNameConflict.name}, ${exactCityNameConflict.countryName}" already exists in this country.`}
                  </p>
                ) : null}
                {!cityIdConflict && !exactCityNameConflict && similarCityMatches.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-amber-700">Similar existing city rows:</p>
                    {similarCityMatches.map((city) => (
                      <p key={`${city.id}-${city.countryId}`} className="text-xs text-amber-700">
                        {city.name}, {city.countryName} ({city.id})
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
              {addCityError ? <p className="text-sm text-destructive">{addCityError}</p> : null}
              <Button
                onClick={handleAddCity}
                className="w-full"
                disabled={!newCity.name.trim() || !newCity.countryId || !effectiveCityId || !!cityIdConflict || !!exactCityNameConflict}
              >
                Add City
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
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
                    <div className="text-sm">{getRegionLabel(selectedCity.region)}</div>
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
                  <CardTitle className="text-base">Estimate Provenance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-5">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Row Source</div>
                      <div className="text-sm">{selectedCity.estimationSource || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Active Provider</div>
                      <div className="text-sm">{selectedCityActiveHistory?.llmProvider || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Confidence</div>
                      <div className="text-sm">{selectedCityActiveHistory?.confidence || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">AUD/USD</div>
                      <div className="text-sm">
                        {typeof selectedCityActiveHistory?.inferredAudPerUsd === 'number'
                          ? selectedCityActiveHistory.inferredAudPerUsd.toFixed(2)
                          : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">History Rows</div>
                      <div className="text-sm">{selectedCityHistory.length}</div>
                    </div>
                  </div>

                  {selectedCityHistory.length > 0 ? (
                    <div className="space-y-3 rounded-md border p-3">
                      {selectedCityHistory.slice(0, 4).map((entry) => (
                        <div key={entry.id} className="space-y-1 border-b pb-3 last:border-0 last:pb-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={entry.isActive ? 'default' : 'outline'}>
                              {entry.isActive ? 'Active' : 'History'}
                            </Badge>
                            <Badge variant="outline">{fmtDate(entry.estimatedAt)}</Badge>
                            {entry.source ? <Badge variant="outline">{entry.source}</Badge> : null}
                            {entry.llmProvider ? <Badge variant="outline">{entry.llmProvider}</Badge> : null}
                            {entry.confidence ? <Badge variant="outline">{entry.confidence}</Badge> : null}
                            {typeof entry.inferredAudPerUsd === 'number' ? (
                              <Badge variant="outline">1 USD = {entry.inferredAudPerUsd.toFixed(2)} AUD</Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">{entry.reasoning || 'No reasoning stored.'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No estimate history rows are stored for this city yet. The current row is acting as the canonical
                      planner dataset entry.
                    </div>
                  )}
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
