'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoadingState } from '@/components/ui/loading-state';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { COST_FIELD_KEYS, CostEditor } from '@/components/cities/CostEditor';
import { resolveCityDrinkInputs } from '@/lib/city-drink-inputs';
import type { CityEstimateProvenance } from '@/lib/city-estimate-provenance';
import type { NewCityCreatedPayload } from '@/components/itinerary/PlannerNewCityDialog';

import { Plus } from 'lucide-react';
import {
  DATASET_PAGE_SIZE,
  getPageCount,
  getPageItems,
  HISTORY_PAGE_SIZE,
} from '@/lib/performance-bounds';

// Kept out of this route's first-load JS. The panel renders only for a selected city and
// the dialog only once opened, so neither needs to ship on arrival.
const CityGenerationPanel = dynamic(
  () => import('@/components/cities/CityGenerationPanel').then((m) => m.CityGenerationPanel),
  { ssr: false }
);
const PlannerNewCityDialog = dynamic(
  () => import('@/components/itinerary/PlannerNewCityDialog').then((m) => m.PlannerNewCityDialog),
  { ssr: false }
);


interface City {
  id: string;
  countryId: string;
  name: string;
  estimationSource: string | null;
  estimatedAt?: string | null;
  notes?: string | null;
  currentEstimateProvenance?: CityEstimateProvenance | null;
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
  llmModel: string | null;
  promptVersion: string | null;
  confidence: string | null;
  reasoning: string | null;
  inferredAudPerUsd: number | null;
  isActive: number | null;
  provenance?: CityEstimateProvenance | null;
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
  { key: 'drinkCoffee', label: 'Coffee / Unit' },
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

function fmtDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '-';
}

function fmtMoney(value: unknown) {
  return typeof value === 'number' ? value.toFixed(2) : '-';
}

function readAnchorValues(provenance: CityEstimateProvenance | null | undefined) {
  if (!provenance?.anchors || typeof provenance.anchors !== 'object') return {};
  const anchors = provenance.anchors as { values?: unknown; valuesAud?: unknown };
  const values = anchors.valuesAud ?? anchors.values;
  return values && typeof values === 'object' && !Array.isArray(values) ? (values as Record<string, unknown>) : {};
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
  const [hasOpenedAddDialog, setHasOpenedAddDialog] = useState(false);
  const [query, setQuery] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [datasetPage, setDatasetPage] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
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
        fetch('/api/estimates?view=dataset', { cache: 'no-store' }),
      ]);

      const countriesData = await countriesResponse.json();
      const estimatesData = await estimatesResponse.json();
      const estimateRows = (estimatesData.data?.rows || []) as Array<{
        cityId: string;
        currentEstimateProvenance?: CityEstimateProvenance | null;
      }>;
      const provenanceByCityId = new Map(
        estimateRows.map((row) => [row.cityId, row.currentEstimateProvenance ?? null])
      );
      const nextCountries = (countriesData.data || [])
        .map((country: Country) => ({
          ...country,
          cities: country.cities.map((city) => ({
            ...city,
            currentEstimateProvenance: provenanceByCityId.get(city.id) ?? null,
          })),
        }))
        .sort((a: Country, b: Country) => a.name.localeCompare(b.name));

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

  useEffect(() => {
    if (addDialogOpen) setHasOpenedAddDialog(true);
  }, [addDialogOpen]);

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

  const datasetPageCount = getPageCount(filteredCities.length, DATASET_PAGE_SIZE);
  const historyPageCount = getPageCount(filteredHistory.length, HISTORY_PAGE_SIZE);
  const visibleCities = getPageItems(filteredCities, datasetPage, DATASET_PAGE_SIZE);
  const visibleHistory = getPageItems(filteredHistory, historyPage, HISTORY_PAGE_SIZE);

  useEffect(() => {
    setDatasetPage((page) => Math.min(page, datasetPageCount - 1));
  }, [datasetPageCount]);

  useEffect(() => {
    setHistoryPage((page) => Math.min(page, historyPageCount - 1));
  }, [historyPageCount]);

  // The list responses carry only scalar provenance badges. Anchors, FX and the input
  // snapshot are fetched for one city at a time, which keeps ~396 KB of blobs out of the
  // initial /dataset load.
  const [selectedProvenance, setSelectedProvenance] = useState<CityEstimateProvenance | null>(null);

  useEffect(() => {
    const cityId = selectedCity?.id;
    if (!cityId) {
      setSelectedProvenance(null);
      return;
    }

    let cancelled = false;
    setSelectedProvenance(null);

    fetch(`/api/estimates?cityId=${encodeURIComponent(cityId)}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled) return;
        setSelectedProvenance(payload?.data?.currentEstimateProvenance ?? null);
      })
      .catch(() => {
        if (!cancelled) setSelectedProvenance(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCity?.id]);

  const selectedCityHistory = useMemo(() => {
    if (!selectedCity) return [];
    return history.filter((row) => row.cityId === selectedCity.id);
  }, [history, selectedCity]);

  const selectedCityActiveHistory = useMemo(
    () => selectedCityHistory.find((row) => row.isActive) ?? selectedCityHistory[0] ?? null,
    [selectedCityHistory]
  );

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
    const nextCity = { ...selectedCity, [key]: value };
    if (key === 'drinkCoffee' || key === 'drinksNone') {
      const drinkInputs = resolveCityDrinkInputs({
        drinkCoffee: key === 'drinkCoffee' ? value : undefined,
        drinksNone: key === 'drinksNone' ? value : undefined,
      });
      nextCity.drinkCoffee = drinkInputs.drinkCoffee;
      nextCity.drinksNone = drinkInputs.drinksNone;
    }
    setSelectedCity(nextCity);
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

  const handleDatasetNewCityCreated = async (payload: NewCityCreatedPayload) => {
    const nextCountries = await fetchData();
    selectCityFromCountries(payload.city.cityId, nextCountries);
    setSaveMessage(
      payload.city.reusedExistingCity
        ? 'Existing city selected.'
        : payload.city.generatedCity
          ? 'City added and costs generated.'
          : 'City added.'
    );
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
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setAddDialogOpen(true);
              setSaveError(null);
              setSaveMessage(null);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add City
          </Button>
          {hasOpenedAddDialog ? (
            <PlannerNewCityDialog
              mode="dataset"
              open={addDialogOpen}
              onOpenChange={(open) => {
                setAddDialogOpen(open);
                if (!open) setSaveError(null);
              }}
              onCreated={handleDatasetNewCityCreated}
            />
          ) : null}
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

                  {selectedProvenance ? (
                    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          Methodology {selectedProvenance.methodologyVersion}
                        </Badge>
                        {selectedProvenance.evidenceBasis ? (
                          <Badge variant="outline">{selectedProvenance.evidenceBasis}</Badge>
                        ) : null}
                        {selectedProvenance.reasoningEffort ? (
                          <Badge variant="outline">Thinking {selectedProvenance.reasoningEffort}</Badge>
                        ) : null}
                      </div>
                      <div className="grid gap-3 text-sm md:grid-cols-4">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Model</div>
                          <div>{selectedCityActiveHistory?.llmProvider || '-'} / {selectedCityActiveHistory?.llmModel || '-'}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Prompt</div>
                          <div>{selectedCityActiveHistory?.promptVersion || '-'}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Formula</div>
                          <div>{selectedProvenance.formulaVersion || 'Legacy v1'}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">FX snapshot</div>
                          <div>
                            {selectedProvenance.fx && typeof selectedProvenance.fx === 'object'
                              ? String((selectedProvenance.fx as { snapshotId?: unknown }).snapshotId || '-')
                              : selectedCityActiveHistory?.inferredAudPerUsd
                                ? `1 USD = ${selectedCityActiveHistory.inferredAudPerUsd.toFixed(2)} AUD`
                                : '-'}
                          </div>
                        </div>
                      </div>
                      <details>
                        <summary className="cursor-pointer text-sm font-medium">Stored anchor values</summary>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                          {Object.entries(readAnchorValues(selectedProvenance)).map(([key, value]) => (
                            <div key={key} className="rounded border bg-background px-2 py-1">
                              <div className="text-xs text-muted-foreground">{key}</div>
                              <div className="text-sm">{fmtMoney(value)}</div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  ) : null}

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
                            {entry.provenance?.methodologyVersion ? (
                              <Badge variant="outline">{entry.provenance.methodologyVersion}</Badge>
                            ) : null}
                            {entry.provenance?.reasoningEffort ? (
                              <Badge variant="outline">Thinking {entry.provenance.reasoningEffort}</Badge>
                            ) : null}
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
              onChange={(event) => {
                setQuery(event.target.value);
                setDatasetPage(0);
              }}
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
            <table data-testid="dataset-city-table" className="min-w-[1800px] text-sm">
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
                {visibleCities.map((city) => (
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
          {filteredCities.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                Showing {datasetPage * DATASET_PAGE_SIZE + 1}–{Math.min((datasetPage + 1) * DATASET_PAGE_SIZE, filteredCities.length)} of {filteredCities.length} cities
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={datasetPage === 0}
                  onClick={() => setDatasetPage((page) => Math.max(0, page - 1))}
                >
                  Previous
                </Button>
                <span className="self-center text-xs text-muted-foreground">
                  Page {datasetPage + 1} of {datasetPageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={datasetPage >= datasetPageCount - 1}
                  onClick={() => setDatasetPage((page) => Math.min(datasetPageCount - 1, page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
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
              onChange={(event) => {
                setHistoryQuery(event.target.value);
                setHistoryPage(0);
              }}
            />
          </div>

          <div className="w-full overflow-x-auto rounded-md border">
            <table data-testid="dataset-history-table" className="min-w-[900px] text-sm">
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
                {visibleHistory.map((entry) => (
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
          {filteredHistory.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                Showing {historyPage * HISTORY_PAGE_SIZE + 1}–{Math.min((historyPage + 1) * HISTORY_PAGE_SIZE, filteredHistory.length)} of {filteredHistory.length} history records
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={historyPage === 0}
                  onClick={() => setHistoryPage((page) => Math.max(0, page - 1))}
                >
                  Previous
                </Button>
                <span className="self-center text-xs text-muted-foreground">
                  Page {historyPage + 1} of {historyPageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={historyPage >= historyPageCount - 1}
                  onClick={() => setHistoryPage((page) => Math.min(historyPageCount - 1, page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
