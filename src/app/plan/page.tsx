'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { InlineLoadingState, LoadingButtonLabel, PageLoadingState } from '@/components/ui/loading-state';
import { LegCard } from '@/components/itinerary/LegCard';
import { CostSummary } from '@/components/itinerary/CostSummary';
import { PlannerNewCityDialog } from '@/components/itinerary/PlannerNewCityDialog';
import { BulkTransportEstimateDialog } from '@/components/itinerary/BulkTransportEstimateDialog';
import { Download, Plus, Save, Upload } from 'lucide-react';
import type { IntercityTransportItem } from '@/types';
import type { PlanSnapshot } from '@/lib/plan-snapshot';
import {
  CITY_GENERATION_PROVIDER_OPTIONS,
  getDefaultCityGenerationModels,
  migrateStoredCityGenerationModels,
  validateCityGenerationModel,
  type CityGenerationProvider,
} from '@/lib/city-generation-config';
import { useProviderModelDiscovery } from '@/lib/use-provider-model-discovery';
import { KNOWN_COUNTRIES, findKnownCountryMetadata, slugifyId } from '@/lib/country-metadata';
import { SavedPlansList, type SavedPlanSummary } from '@/components/itinerary/SavedPlansList';
import { SavePlanDialog } from '@/components/itinerary/SavePlanDialog';

const CITY_GENERATION_STORAGE_PREFIX = 'wanderledger.city-generation';
type ProviderOption = CityGenerationProvider;

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
}

interface Country {
  id: string;
  name: string;
  currencyCode: string;
  region?: string | null;
}

interface SnapshotMissingCity {
  cityId: string;
  cityName: string | null;
  countryId: string | null;
  countryName: string | null;
  legCount: number;
}

interface MissingCityResolutionDraft {
  cityId: string;
  cityName: string;
  countryId: string;
  legCount: number;
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

function getRegionLabel(regionValue: string) {
  return REGION_OPTIONS.find((region) => region.value === regionValue)?.label || regionValue;
}

function getSelectedCountryPreview(canonicalCountryId: string, countries: Country[]) {
  const canonicalCountry = findKnownCountryMetadata(canonicalCountryId);
  if (!canonicalCountry) return null;

  const existingCountry =
    countries.find((country) => {
      const resolved = findKnownCountryMetadata(country.id) ?? findKnownCountryMetadata(country.name);
      return resolved?.id === canonicalCountry.id;
    }) ?? null;

  return {
    canonicalCountry,
    existingCountry,
  };
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

function guessCityNameFromId(cityId: string) {
  return cityId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function countMissingTransportLegs(legs: Leg[]) {
  return legs.reduce((count, leg, index) => {
    if (index === 0) return count;
    if (!leg.startDate) return count;
    if ((leg.intercityTransports || []).length > 0) return count;
    return count + 1;
  }, 0);
}

function countEstimatableTransportLegs(legs: Leg[]) {
  return legs.reduce((count, leg, index) => {
    if (index === 0) return count;
    if (!leg.startDate) return count;
    return count + 1;
  }, 0);
}

export default function PlanPage() {
  const [legs, setLegs] = useState<Leg[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [savePlanDialogOpen, setSavePlanDialogOpen] = useState(false);
  const [bulkTransportEstimateOpen, setBulkTransportEstimateOpen] = useState(false);
  const [importResolutionOpen, setImportResolutionOpen] = useState(false);
  const [plannerNewCityOpen, setPlannerNewCityOpen] = useState(false);
  const [newLegCity, setNewLegCity] = useState('');
  const [newLegNights, setNewLegNights] = useState('7');
  const [savedPlans, setSavedPlans] = useState<SavedPlanSummary[]>([]);
  const [savedPlansLoading, setSavedPlansLoading] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [groupSize, setGroupSize] = useState(2);
  const [pendingImportSnapshot, setPendingImportSnapshot] = useState<PlanSnapshot | null>(null);
  const [pendingImportSourceLabel, setPendingImportSourceLabel] = useState<string | null>(null);
  const [missingCityDrafts, setMissingCityDrafts] = useState<MissingCityResolutionDraft[]>([]);
  const [missingCityStrategy, setMissingCityStrategy] = useState<'placeholder' | 'generate'>('placeholder');
  const [importingSnapshot, setImportingSnapshot] = useState(false);
  const [importProvider, setImportProvider] = useState<ProviderOption>('openai');
  const [importApiKeys, setImportApiKeys] = useState<Record<ProviderOption, string>>({
    openai: '',
    anthropic: '',
    gemini: '',
  });
  const [importModels, setImportModels] = useState<Record<ProviderOption, string>>(getDefaultCityGenerationModels());
  const [showImportApiKey, setShowImportApiKey] = useState(false);
  const [importReferenceDate, setImportReferenceDate] = useState('');
  const [importExtraContext, setImportExtraContext] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);
  const plannerHeaderRef = useRef<HTMLDivElement>(null);
  const [plannerHeaderHeight, setPlannerHeaderHeight] = useState(0);
  const plannerContentTopPadding = plannerHeaderHeight > 0 ? Math.max(plannerHeaderHeight - 56, 128) : 144;
  const plannerSidebarTopOffset = plannerHeaderHeight > 0 ? Math.max(plannerHeaderHeight + 10, 120) : 200;

  useEffect(() => {
    const header = plannerHeaderRef.current;
    if (!header) return;

    const updateHeight = () => {
      setPlannerHeaderHeight(header.getBoundingClientRect().height);
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(header);
    window.addEventListener('resize', updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  const fetchData = useCallback(async () => {
    setPageLoading(true);
    try {
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
      setCountries(countries.sort((a, b) => a.name.localeCompare(b.name)));
      setCities(
        ((citiesData.data || []) as Array<City>)
          .map((city) => ({
            ...city,
            countryName: countryMap.get(city.countryId) || 'Unknown',
          }))
          .sort((a, b) => `${a.countryName}-${a.name}`.localeCompare(`${b.countryName}-${b.name}`))
      );
      setFixedCosts(fixedData.data || []);
    } finally {
      setPageLoading(false);
    }
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

  const fetchSavedPlans = useCallback(async () => {
    setSavedPlansLoading(true);
    try {
      const response = await fetch('/api/saved-plans', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setSavedPlans(data.data || []);
      }
    } catch {
      // Silently fail — saved plans are non-critical.
    } finally {
      setSavedPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedPlans();
  }, [fetchSavedPlans]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedProvider = window.localStorage.getItem(`${CITY_GENERATION_STORAGE_PREFIX}.provider`) as ProviderOption | null;
    const storedKeys = window.localStorage.getItem(`${CITY_GENERATION_STORAGE_PREFIX}.apiKeys`);
    const storedModels = window.localStorage.getItem(`${CITY_GENERATION_STORAGE_PREFIX}.models`);

    if (storedProvider && CITY_GENERATION_PROVIDER_OPTIONS.some((option) => option.value === storedProvider)) {
      setImportProvider(storedProvider);
    }

    if (storedKeys) {
      try {
        const parsed = JSON.parse(storedKeys) as Partial<Record<ProviderOption, string>>;
        setImportApiKeys({
          openai: parsed.openai || '',
          anthropic: parsed.anthropic || '',
          gemini: parsed.gemini || '',
        });
      } catch {
        // Ignore malformed browser storage and keep defaults.
      }
    }

    if (storedModels) {
      try {
        const parsed = JSON.parse(storedModels) as Partial<Record<ProviderOption, string>>;
        const nextModels = migrateStoredCityGenerationModels(parsed);
        setImportModels(nextModels);
        window.localStorage.setItem(`${CITY_GENERATION_STORAGE_PREFIX}.models`, JSON.stringify(nextModels));
      } catch {
        // Ignore malformed browser storage and keep defaults.
      }
    }
  }, [countries]);


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

  const handlePlannerNewCityCreated = useCallback(async (payload: {
    city: {
      cityName: string;
      countryName: string;
      createdCountry: boolean;
      createdCity: boolean;
      generatedCity: boolean;
      reusedExistingCity: boolean;
    };
    requested: {
      cityName: string;
      countryName: string;
      nights: number;
    };
  }) => {
    await fetchData();
    setAddDialogOpen(false);
    setNewLegCity('');
    setNewLegNights('7');

    const cityResult = payload.city;
    const suffixParts = [];
    if (cityResult?.reusedExistingCity) suffixParts.push('existing city reused');
    if (cityResult?.createdCountry) suffixParts.push('country created');
    if (cityResult?.createdCity) suffixParts.push('city created');
    if (cityResult?.generatedCity) suffixParts.push('city costs generated');

    setSnapshotStatus(
      `Added leg for "${cityResult?.cityName || payload.requested.cityName}, ${cityResult?.countryName || payload.requested.countryName}".${suffixParts.length > 0 ? ` ${suffixParts.join(', ')}.` : ''}`
    );
    setSnapshotError(null);
  }, [fetchData]);

  const handleUpdateLeg = async (id: number, data: Record<string, unknown>) => {
    setLegs((currentLegs) =>
      currentLegs.map((leg) => (leg.id === id ? { ...leg, ...data } : leg))
    );

    const response = await fetch(`/api/itinerary/legs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      fetchData();
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
  const missingTransportLegCount = countMissingTransportLegs(legs);
  const estimatableTransportLegCount = countEstimatableTransportLegs(legs);
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

  const updateImportProvider = (nextProvider: ProviderOption) => {
    setImportProvider(nextProvider);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${CITY_GENERATION_STORAGE_PREFIX}.provider`, nextProvider);
    }
  };

  const updateImportApiKey = (value: string) => {
    const nextKeys = {
      ...importApiKeys,
      [importProvider]: value,
    };
    setImportApiKeys(nextKeys);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${CITY_GENERATION_STORAGE_PREFIX}.apiKeys`, JSON.stringify(nextKeys));
    }
  };

  const clearCurrentImportApiKey = () => {
    updateImportApiKey('');
    setShowImportApiKey(false);
  };

  const clearAllImportApiKeys = () => {
    const nextKeys = {
      openai: '',
      anthropic: '',
      gemini: '',
    };
    setImportApiKeys(nextKeys);
    setShowImportApiKey(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${CITY_GENERATION_STORAGE_PREFIX}.apiKeys`, JSON.stringify(nextKeys));
    }
  };

  const updateImportModel = (value: string) => {
    const nextModels = {
      ...importModels,
      [importProvider]: value,
    };
    setImportModels(nextModels);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${CITY_GENERATION_STORAGE_PREFIX}.models`, JSON.stringify(nextModels));
    }
  };

  const resetPendingImportState = useCallback(() => {
    setImportResolutionOpen(false);
    setPendingImportSnapshot(null);
    setPendingImportSourceLabel(null);
    setMissingCityDrafts([]);
    setMissingCityStrategy('placeholder');
    setImportReferenceDate('');
    setImportExtraContext('');
  }, []);

  const importSnapshot = useCallback(async (
    snapshot: PlanSnapshot,
    options?: {
      sourceLabel?: string;
      missingCityStrategy?: 'placeholder' | 'generate';
      missingCityResolutions?: MissingCityResolutionDraft[];
    }
  ) => {
    const effectiveImportModel = validateCityGenerationModel(importProvider, importModels[importProvider]).effectiveModel;
    const body = options?.missingCityResolutions
      ? {
          snapshot,
          missingCityStrategy: options.missingCityStrategy ?? 'placeholder',
          missingCityResolutions: options.missingCityResolutions.map((resolution) => {
            const canonicalCountry = findKnownCountryMetadata(resolution.countryId);
            const countryName = canonicalCountry?.name || '';
            const countryId = canonicalCountry?.id || '';
            return {
              cityId: resolution.cityId,
              cityName: resolution.cityName.trim(),
              countryId,
              countryName,
            };
          }),
          generationConfig:
            options.missingCityStrategy === 'generate'
              ? {
                  provider: importProvider,
                  apiKey: importApiKeys[importProvider] || undefined,
                  model: effectiveImportModel || undefined,
                  referenceDate: importReferenceDate || undefined,
                  extraContext: importExtraContext || undefined,
                }
              : undefined,
        }
      : snapshot;

    const response = await fetch('/api/itinerary/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      if (Array.isArray(data.missingCities)) {
        throw Object.assign(new Error(data.error || 'Resolve all missing cities before importing.'), {
          missingCities: data.missingCities as SnapshotMissingCity[],
        });
      }
      throw new Error(data.error || 'Failed to import plan snapshot.');
    }

    await fetchData();

    const importResult = data.data as {
      createdCountries?: string[];
      createdCities?: string[];
      generatedCities?: string[];
    };
    const sourceLabel = options?.sourceLabel || 'snapshot';
    const createdCountryCount = importResult.createdCountries?.length ?? 0;
    const createdCount = importResult.createdCities?.length ?? 0;
    const generatedCount = importResult.generatedCities?.length ?? 0;
    const suffixParts = [];
    if (createdCountryCount > 0) suffixParts.push(`${createdCountryCount} countries created`);
    if (createdCount > 0) suffixParts.push(`${createdCount} cities created`);
    if (generatedCount > 0) suffixParts.push(`${generatedCount} cities generated`);
    setSnapshotStatus(
      `Imported "${sourceLabel}".${suffixParts.length > 0 ? ` ${suffixParts.join(', ')}.` : ''}`
    );
    setSnapshotError(null);
  }, [
    fetchData,
    importApiKeys,
    importExtraContext,
    importModels,
    importProvider,
    importReferenceDate,
  ]);

  const preflightSnapshotImport = useCallback(async (snapshot: PlanSnapshot) => {
    const response = await fetch('/api/itinerary/snapshot/preflight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to inspect plan snapshot.');
    }
    return data.data as {
      missingCities: SnapshotMissingCity[];
      readyToImport: boolean;
    };
  }, []);

  const queueMissingCityResolution = useCallback((
    snapshot: PlanSnapshot,
    sourceLabel: string,
    missingCities: SnapshotMissingCity[]
  ) => {
    setPendingImportSnapshot(snapshot);
    setPendingImportSourceLabel(sourceLabel);
    setMissingCityDrafts(
      missingCities.map((missingCity) => {
        const canonicalCountry =
          findKnownCountryMetadata(missingCity.countryId) ??
          findKnownCountryMetadata(missingCity.countryName) ??
          null;

        return {
          cityId: missingCity.cityId,
          cityName: missingCity.cityName || guessCityNameFromId(missingCity.cityId),
          countryId: canonicalCountry?.id || '',
          legCount: missingCity.legCount,
        };
      })
    );
    setMissingCityStrategy('placeholder');
    setSnapshotStatus(null);
    setSnapshotError(`"${sourceLabel}" needs missing cities resolved before import can continue.`);
    setImportResolutionOpen(true);
  }, []);

  const startSnapshotImport = useCallback(async (snapshot: PlanSnapshot, sourceLabel: string) => {
    const preflight = await preflightSnapshotImport(snapshot);
    if (preflight.missingCities.length > 0) {
      queueMissingCityResolution(snapshot, sourceLabel, preflight.missingCities);
      return;
    }

    await importSnapshot(snapshot, { sourceLabel });
  }, [importSnapshot, preflightSnapshotImport, queueMissingCityResolution]);

  const handleSaveSnapshot = async (name: string) => {
    setSavingPlan(true);
    try {
      const snapshot = await fetchCurrentSnapshot();
      const response = await fetch('/api/saved-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          snapshot: { ...snapshot, name, exportedAt: new Date().toISOString() },
          summary: currentPlanSummary,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save plan.');
      }
      setSnapshotError(null);
      setSnapshotStatus(`Saved plan "${name}".`);
      setSavePlanDialogOpen(false);
      await fetchSavedPlans();
    } catch (err) {
      setSnapshotStatus(null);
      setSnapshotError(err instanceof Error ? err.message : 'Failed to save plan.');
    } finally {
      setSavingPlan(false);
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
      await startSnapshotImport(snapshot, file.name);
    } catch (err) {
      setSnapshotStatus(null);
      setSnapshotError(err instanceof Error ? err.message : 'Failed to import snapshot.');
    } finally {
      event.target.value = '';
    }
  };

  const handleLoadSavedPlan = async (planId: string) => {
    try {
      const response = await fetch(`/api/saved-plans/${planId}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch saved plan.');
      }
      await startSnapshotImport(data.data.snapshot, data.data.name);
    } catch (err) {
      setSnapshotStatus(null);
      setSnapshotError(err instanceof Error ? err.message : 'Failed to load saved plan.');
    }
  };

  const handleConfirmMissingCityImport = async () => {
    if (!pendingImportSnapshot || !pendingImportSourceLabel) return;

    const hasMissingFields = missingCityDrafts.some((draft) => {
      if (!draft.cityId.trim()) return true;
      if (!draft.cityName.trim()) return true;
      return !findKnownCountryMetadata(draft.countryId);
    });
    if (hasMissingFields) {
      setSnapshotStatus(null);
      setSnapshotError(
        'For every missing city, enter a city ID, city name, and choose a country from the canonical dataset.'
      );
      return;
    }

    try {
      setImportingSnapshot(true);
      const snapshotToImport = pendingImportSnapshot;
      const sourceLabel = pendingImportSourceLabel;
      if (!snapshotToImport || !sourceLabel) {
        throw new Error('The pending snapshot import is incomplete.');
      }

      await importSnapshot(snapshotToImport, {
        sourceLabel,
        missingCityStrategy,
        missingCityResolutions: missingCityDrafts,
      });
      resetPendingImportState();
    } catch (err) {
      setSnapshotStatus(null);
      setSnapshotError(err instanceof Error ? err.message : 'Failed to import snapshot.');
    } finally {
      setImportingSnapshot(false);
    }
  };

  const handleDeleteSavedPlan = async (planId: string) => {
    try {
      const response = await fetch(`/api/saved-plans/${planId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete plan.');
      }
      setSnapshotError(null);
      setSnapshotStatus('Plan deleted.');
      await fetchSavedPlans();
    } catch (err) {
      setSnapshotStatus(null);
      setSnapshotError(err instanceof Error ? err.message : 'Failed to delete plan.');
    }
  };

  const handleExportSavedPlan = async (planId: string) => {
    try {
      const response = await fetch(`/api/saved-plans/${planId}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch saved plan.');
      }
      downloadSnapshot(data.data.snapshot, data.data.name.replace(/\s+/g, '-').toLowerCase());
    } catch (err) {
      setSnapshotStatus(null);
      setSnapshotError(err instanceof Error ? err.message : 'Failed to export saved plan.');
    }
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

  const selectedImportProvider =
    CITY_GENERATION_PROVIDER_OPTIONS.find((option) => option.value === importProvider) ?? CITY_GENERATION_PROVIDER_OPTIONS[0];
  const activeImportApiKey = importApiKeys[importProvider] || '';
  const hasAnySavedImportApiKey = Object.values(importApiKeys).some((value) => value.trim().length > 0);
  const activeImportModel = importModels[importProvider] || selectedImportProvider.defaultModel;
  const importModelValidation = validateCityGenerationModel(importProvider, activeImportModel);
  const importModelListId = `${CITY_GENERATION_STORAGE_PREFIX}.${importProvider}.models`;
  const importModelDiscovery = useProviderModelDiscovery({
    provider: importProvider,
    apiKey: activeImportApiKey,
    enabled: importResolutionOpen && missingCityStrategy === 'generate',
  });
  const canonicalCountryOptions = KNOWN_COUNTRIES.map((country) => {
    const preview = getSelectedCountryPreview(country.id, countries);
    return {
      value: country.id,
      label: country.name,
      description: `${country.currencyCode} • ${getRegionLabel(country.region)}${preview?.existingCountry ? ' • already in library' : ' • creates row on import'}`,
    };
  });

  if (pageLoading && legs.length === 0 && cities.length === 0 && countries.length === 0) {
    return (
      <PageLoadingState
        title="Loading itinerary planner"
        description="Syncing your legs, cities, countries, and fixed costs."
        cardCount={3}
        rowCount={5}
      />
    );
  }

  return (
    <div className="space-y-6">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      <Dialog
        open={importResolutionOpen}
        onOpenChange={(open) => {
          if (!open && !importingSnapshot) {
            resetPendingImportState();
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Resolve Missing Cities Before Import</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                {pendingImportSourceLabel
                  ? `"${pendingImportSourceLabel}" references cities that are not yet in your library.`
                  : 'This snapshot references cities that are not yet in your library.'}
              </p>
              <p>
                Complete the city name and choose the canonical country for each missing city below. If that country
                is not yet in your library, the import will create the country row automatically from the repo-owned
                dataset before it creates the city. Then choose whether to create placeholders only, or generate full
                city costs before the itinerary import runs.
              </p>
            </div>

            <div className="space-y-3">
              {missingCityDrafts.map((draft, index) => (
                <div key={draft.cityId} className="space-y-3 rounded-md border p-3">
                  <div className="grid gap-3 md:grid-cols-[160px_1fr_1fr]">
                    <div>
                      <Label className="text-xs">City ID</Label>
                      <Input
                        className="h-9 text-sm"
                        value={draft.cityId}
                        readOnly
                        placeholder="e.g. quito"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {`Used in ${draft.legCount} ${draft.legCount === 1 ? 'leg' : 'legs'}.`}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">City Name</Label>
                      <Input
                        className="h-9 text-sm"
                        value={draft.cityName}
                        onChange={(event) =>
                          setMissingCityDrafts((current) =>
                            current.map((item, itemIndex) => {
                              if (itemIndex !== index) return item;
                              const nextCityName = event.target.value;
                              const previousAutoCityId = item.cityName ? slugifyId(item.cityName) : '';
                              return {
                                ...item,
                                cityName: nextCityName,
                                cityId: (!item.cityId || item.cityId === previousAutoCityId)
                                  ? slugifyId(nextCityName)
                                  : item.cityId,
                              };
                            })
                          )
                        }
                        placeholder="e.g. Kunming"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Country</Label>
                      <SearchableSelect
                        value={draft.countryId}
                        onValueChange={(value) =>
                          setMissingCityDrafts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    countryId: value,
                                  }
                                : item
                            )
                          )
                        }
                        placeholder="Choose canonical country"
                        searchPlaceholder="Search canonical countries..."
                        emptyText="No canonical country matches."
                        options={canonicalCountryOptions}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pick from the canonical dataset. The import reuses any matching library row or creates the
                        country automatically if it does not exist yet.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-md bg-muted/40 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Country Preview</div>
                    <div className="space-y-2 rounded-md border bg-background p-3 text-xs text-muted-foreground">
                      {draft.countryId ? (
                        (() => {
                          const preview = getSelectedCountryPreview(draft.countryId, countries);
                          if (!preview) {
                            return <p>Select a valid country from the canonical dataset.</p>;
                          }

                          return (
                            <>
                              <div>
                                Canonical ID:{' '}
                                <span className="font-medium text-foreground">{preview.canonicalCountry.id}</span>
                              </div>
                              <div>
                                Currency:{' '}
                                <span className="font-medium text-foreground">{preview.canonicalCountry.currencyCode}</span>
                              </div>
                              <div>
                                Region:{' '}
                                <span className="font-medium text-foreground">
                                  {getRegionLabel(preview.canonicalCountry.region)}
                                </span>
                              </div>
                              <div>
                                Library row:{' '}
                                <span className="font-medium text-foreground">
                                  {preview.existingCountry
                                    ? `${preview.existingCountry.name} (${preview.existingCountry.id})`
                                    : 'Will be created automatically during import'}
                                </span>
                              </div>
                            </>
                          );
                        })()
                      ) : (
                        <p>Select a country from the canonical dataset and the app will preview the canonical metadata.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Missing City Handling</Label>
                <Select
                  value={missingCityStrategy}
                  onValueChange={(value) => setMissingCityStrategy(value as 'placeholder' | 'generate')}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="placeholder">Create placeholders only</SelectItem>
                    <SelectItem value="generate">Generate city costs now</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {missingCityStrategy === 'placeholder'
                    ? 'Fastest option. The import creates the city rows now and you can fill in budget data later.'
                    : 'Uses one provider, model, and API key setup for every missing city in this import. Cities are generated sequentially before the itinerary is imported.'}
                </p>
              </div>
            </div>

            {missingCityStrategy === 'generate' ? (
              <div className="space-y-4 rounded-md border p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Generation Settings For This Import</p>
                  <p className="text-xs text-muted-foreground">
                    These settings apply to every missing city in this file. If you leave the API key blank, the server will
                    try its configured key for the chosen provider.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Provider</Label>
                    <Select value={importProvider} onValueChange={(value) => updateImportProvider(value as ProviderOption)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CITY_GENERATION_PROVIDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{selectedImportProvider.help}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{selectedImportProvider.label} API Key</Label>
                      <Input
                        className="h-9 text-sm"
                        placeholder="Optional. Leave blank to use a server-side key if configured."
                        type={showImportApiKey ? 'text' : 'password'}
                        value={activeImportApiKey}
                        onChange={(event) => updateImportApiKey(event.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={showImportApiKey}
                        onChange={(event) => setShowImportApiKey(event.target.checked)}
                      />
                      Show API key
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearCurrentImportApiKey}
                        disabled={!activeImportApiKey}
                      >
                        Clear This Key
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearAllImportApiKeys}
                        disabled={!hasAnySavedImportApiKey}
                      >
                        Clear All Saved Keys
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Clears browser-stored keys only. Server-side env keys are unchanged.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Model</Label>
                    <Input
                      className="h-9 text-sm"
                      list={importModelListId}
                      placeholder={selectedImportProvider.defaultModel}
                      value={activeImportModel}
                      onChange={(event) => updateImportModel(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <datalist id={importModelListId}>
                      {importModelDiscovery.result.effectiveModels.map((model) => (
                        <option key={model} value={model} />
                      ))}
                    </datalist>
                    <p className="text-xs text-muted-foreground">{importModelDiscovery.statusMessage}</p>
                    {importModelDiscovery.exampleSummary ? (
                      <p className="text-xs text-muted-foreground">
                        Example models: {importModelDiscovery.exampleSummary}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {selectedImportProvider.knownModels.map((model) => (
                        <Button
                          key={model}
                          type="button"
                          variant={importModelValidation.effectiveModel === model ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => updateImportModel(model)}
                        >
                          {model === selectedImportProvider.defaultModel ? `${model} (default)` : model}
                        </Button>
                      ))}
                      <Button type="button" variant="ghost" size="sm" onClick={() => void importModelDiscovery.refresh()} disabled={importModelDiscovery.loading || importModelDiscovery.refreshing || importingSnapshot}>
                        <LoadingButtonLabel idle="Refresh models" loading="Refreshing..." isLoading={importModelDiscovery.refreshing} />
                      </Button>
                    </div>
                    {importModelDiscovery.result.warning ? (
                      <p className="text-xs text-amber-600">{importModelDiscovery.result.warning}</p>
                    ) : null}
                    {importModelDiscovery.error ? (
                      <p className="text-xs text-amber-600">{importModelDiscovery.error}</p>
                    ) : null}
                    <p className={`text-xs ${importModelValidation.tone === 'warning' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {importModelValidation.message}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Reference Date Or Season</Label>
                    <Input
                      className="h-9 text-sm"
                      placeholder="e.g. April 2026 shoulder season"
                      value={importReferenceDate}
                      onChange={(event) => setImportReferenceDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">Extra Context</Label>
                    <Textarea
                      className="min-h-20 text-sm"
                      placeholder="Optional notes such as neighborhoods, trip style, or caveats that should apply to all missing cities in this import."
                      value={importExtraContext}
                      onChange={(event) => setImportExtraContext(event.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {importingSnapshot ? (
              <InlineLoadingState
                title={
                  missingCityStrategy === 'generate'
                    ? 'Generating city costs before import'
                    : 'Creating missing cities before import'
                }
                detail={
                  missingCityStrategy === 'generate'
                    ? 'This can take a short while because cities are generated sequentially and saved back into the planner dataset.'
                    : 'The planner is creating any missing countries and cities, then continuing with your request.'
                }
              />
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetPendingImportState} disabled={importingSnapshot}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmMissingCityImport} disabled={importingSnapshot}>
                <LoadingButtonLabel
                  isLoading={importingSnapshot}
                  loading={
                    missingCityStrategy === 'generate'
                      ? 'Generating cities and importing...'
                      : 'Creating cities and importing...'
                  }
                  idle={
                    missingCityStrategy === 'generate'
                      ? 'Generate Cities And Import'
                      : 'Create Cities And Import'
                  }
                />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="-mx-4 -mt-4 lg:-mx-8 lg:-mt-8">
        <div className="fixed inset-x-0 top-0 z-30 border-b bg-background shadow-sm lg:left-64">
          <div ref={plannerHeaderRef} className="mx-auto max-w-6xl px-4 py-4 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Itinerary Planner</h1>
                <p className="text-sm text-muted-foreground">
                  Build your trip leg by leg. City costs are stored for 2 people and scaled here for your selected traveller count.
                </p>
                <p className="text-xs text-muted-foreground">
                  Traveller count is shared with Settings and the dashboard.
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
                <SavePlanDialog
                  open={savePlanDialogOpen}
                  onOpenChange={setSavePlanDialogOpen}
                  onSave={handleSaveSnapshot}
                  isSaving={savingPlan}
                />
                <Button type="button" variant="outline" onClick={() => setSavePlanDialogOpen(true)}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Plan
                </Button>
                <Button type="button" variant="outline" onClick={handleExportCurrentPlan}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <Button type="button" variant="outline" onClick={() => importInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Button>
                <BulkTransportEstimateDialog
                  open={bulkTransportEstimateOpen}
                  onOpenChange={setBulkTransportEstimateOpen}
                  legs={legs.map((leg) => ({
                    id: leg.id,
                    cityName: leg.cityName,
                    countryName: leg.countryName,
                    startDate: leg.startDate,
                    intercityTransports: leg.intercityTransports,
                  }))}
                  onApplied={async (appliedCount) => {
                    await fetchData();
                    setSnapshotStatus(
                      `Applied estimated intercity transport to ${appliedCount} ${appliedCount === 1 ? 'leg' : 'legs'}.`
                    );
                    setSnapshotError(null);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setBulkTransportEstimateOpen(true);
                    setSnapshotStatus(null);
                    setSnapshotError(null);
                  }}
                  disabled={estimatableTransportLegCount === 0}
                >
                  Estimate Intercity Transport
                  {estimatableTransportLegCount > 0
                    ? missingTransportLegCount > 0
                      ? ` (${missingTransportLegCount} missing)`
                      : ` (${estimatableTransportLegCount} eligible)`
                    : ''}
                </Button>
                <PlannerNewCityDialog
                  open={plannerNewCityOpen}
                  onOpenChange={setPlannerNewCityOpen}
                  onCreated={handlePlannerNewCityCreated}
                />
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
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            Can&apos;t find the city? Create it here and add the leg in one flow.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAddDialogOpen(false);
                              setPlannerNewCityOpen(true);
                              setSnapshotStatus(null);
                              setSnapshotError(null);
                            }}
                          >
                            New City
                          </Button>
                        </div>
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
        </div>
      </div>

        <div
          className="mx-auto max-w-6xl px-4 pb-6 lg:px-8"
          style={{ paddingTop: plannerContentTopPadding }}
        >
          {savedPlans.length > 0 && (
            <div className="mb-4">
              <SavedPlansList
                plans={savedPlans}
                onLoad={handleLoadSavedPlan}
                onDelete={handleDeleteSavedPlan}
                onExport={handleExportSavedPlan}
                isLoading={savedPlansLoading}
              />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
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
                  previousLeg={i > 0 ? {
                    id: legs[i - 1].id,
                    cityName: legs[i - 1].cityName,
                    countryName: legs[i - 1].countryName,
                  } : null}
                />
              ))}
            </div>

        {/* Summary sidebar */}
            <div className="hidden lg:block">
              <div
                className="sticky self-start"
                style={{ top: plannerSidebarTopOffset }}
              >
                <CostSummary legs={legs} fixedCostsTotal={fixedCostsTotal} groupSize={groupSize} />
              </div>
            </div>
          </div>
        </div>

      {/* Mobile summary */}
      <div className="-mx-4 lg:-mx-8">
        <div className="mx-auto max-w-6xl px-4 pb-6 lg:hidden lg:px-8">
          <CostSummary legs={legs} fixedCostsTotal={fixedCostsTotal} groupSize={groupSize} />
        </div>
      </div>
    </div>
  );
}
