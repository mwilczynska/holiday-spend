'use client';

import { useInitialPageRefresh } from '@/lib/use-initial-page-refresh';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { InlineLoadingState, LoadingButtonLabel, PageLoadingState } from '@/components/ui/loading-state';
import { LegCard } from '@/components/itinerary/LegCard';
import { TripClimate } from '@/components/itinerary/TripClimate';
import { useTripClimate } from '@/lib/use-trip-climate';
import type { TemperatureUnit } from '@/lib/climate';
import { CostSummary } from '@/components/itinerary/CostSummary';
import type { NewCityCreatedPayload } from '@/components/itinerary/PlannerNewCityDialog';

import { ArrowUpDown, Download, Plus, Save, Upload } from 'lucide-react';
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
import { useProviderApiKeys } from '@/lib/use-provider-api-keys';
import { KNOWN_COUNTRIES, findKnownCountryMetadata, slugifyId } from '@/lib/country-metadata';
import { SavedPlansList, type SavedPlanSummary } from '@/components/itinerary/SavedPlansList';
import { SavePlanDialog } from '@/components/itinerary/SavePlanDialog';

// Both were mounted unconditionally and shipped in this route's first-load JS despite being
// closed on arrival. They now load on first open. The type import above stays static.
const PlannerNewCityDialog = dynamic(
  () => import('@/components/itinerary/PlannerNewCityDialog').then((m) => m.PlannerNewCityDialog),
  { ssr: false }
);
const BulkTransportEstimateDialog = dynamic(
  () =>
    import('@/components/itinerary/BulkTransportEstimateDialog').then(
      (m) => m.BulkTransportEstimateDialog
    ),
  { ssr: false }
);


const CITY_GENERATION_STORAGE_PREFIX = 'holiday-spend.city-generation';
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

async function readPlannerResponse(response: Response, label: string) {
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `Could not load ${label} (HTTP ${response.status}).`);
  if (!result || !Object.prototype.hasOwnProperty.call(result, 'data')) {
    throw new Error(`The server returned an unreadable ${label} response.`);
  }
  return result.data;
}

async function readPlannerList<T>(response: Response, label: string): Promise<T[]> {
  const data = await readPlannerResponse(response, label);
  if (!Array.isArray(data)) throw new Error(`The server returned an invalid ${label} list.`);
  return data;
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

export interface PlanInitialData {
  legs: Leg[]; cities: City[]; countries: Country[]; fixedCosts: FixedCost[];
  groupSize: number; savedPlans: SavedPlanSummary[];
  climate: Record<string, import('@/lib/climate').CityClimate | null>;
}

export function PlanClient({ initialData }: { initialData: PlanInitialData }) {
  const [legs, setLegs] = useState<Leg[]>(initialData.legs);
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>('C');
  const { climate, retry: retryClimate } = useTripClimate(legs.map(leg => leg.cityId), initialData.climate);
  const toggleTemperature = useCallback(() => setTemperatureUnit(unit => unit === 'C' ? 'F' : 'C'), []);
  const [cities, setCities] = useState<City[]>(initialData.cities);
  const [countries, setCountries] = useState<Country[]>(initialData.countries);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>(initialData.fixedCosts);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [savePlanDialogOpen, setSavePlanDialogOpen] = useState(false);
  const [bulkTransportEstimateOpen, setBulkTransportEstimateOpen] = useState(false);
  const [hasOpenedBulkTransport, setHasOpenedBulkTransport] = useState(false);
  const [importResolutionOpen, setImportResolutionOpen] = useState(false);
  const [plannerNewCityOpen, setPlannerNewCityOpen] = useState(false);
  const [hasOpenedPlannerNewCity, setHasOpenedPlannerNewCity] = useState(false);
  const [newLegCity, setNewLegCity] = useState('');
  const [newLegNights, setNewLegNights] = useState('7');
  const [addingLeg, setAddingLeg] = useState(false);
  const [addLegError, setAddLegError] = useState<string | null>(null);
  const addLegSubmitting = useRef(false);
  const parsedNewLegNights = Number(newLegNights);
  const newLegValid = !!newLegCity && Number.isSafeInteger(parsedNewLegNights) && parsedNewLegNights > 0;
  const [savedPlans, setSavedPlans] = useState<SavedPlanSummary[]>(initialData.savedPlans);
  const [savedPlansLoading, setSavedPlansLoading] = useState(false);
  const [savedPlansError, setSavedPlansError] = useState<string | null>(null);
  const savedPlansReadSequence = useRef(0);
  const [savingPlan, setSavingPlan] = useState(false);
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [orderSaving, setOrderSaving] = useState(false);
  const orderSubmitting = useRef(false);
  const [groupSize, setGroupSize] = useState(initialData.groupSize);
  const [pendingImportSnapshot, setPendingImportSnapshot] = useState<PlanSnapshot | null>(null);
  const [pendingImportSourceLabel, setPendingImportSourceLabel] = useState<string | null>(null);
  const [missingCityDrafts, setMissingCityDrafts] = useState<MissingCityResolutionDraft[]>([]);
  const [missingCityStrategy, setMissingCityStrategy] = useState<'placeholder' | 'generate'>('placeholder');
  const [importingSnapshot, setImportingSnapshot] = useState(false);
  const [importProvider, setImportProvider] = useState<ProviderOption>('openai');
  const [importModels, setImportModels] = useState<Record<ProviderOption, string>>(getDefaultCityGenerationModels());
  const [showImportApiKey, setShowImportApiKey] = useState(false);
  const [importReferenceDate, setImportReferenceDate] = useState('');
  const [importExtraContext, setImportExtraContext] = useState('');
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const plannerReadSequence = useRef(0);
  const importInputRef = useRef<HTMLInputElement>(null);
  const plannerHeaderRef = useRef<HTMLDivElement>(null);
  const [plannerHeaderHeight, setPlannerHeaderHeight] = useState(0);
  const {
    apiKeys: importApiKeys,
    saveApiKeys: saveImportApiKeys,
    setSaveApiKeys: setSaveImportApiKeys,
    updateApiKey: updateStoredImportApiKey,
    clearCurrentProviderApiKey: clearStoredCurrentImportApiKey,
    clearAllSavedApiKeys: clearStoredAllImportApiKeys,
    hasAnySavedApiKey: hasAnySavedImportApiKey,
  } = useProviderApiKeys();
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
    const sequence = ++plannerReadSequence.current;
    setPageLoading(true);
    try {
      const [legsRes, citiesRes, countriesRes, fixedRes, settingsRes] = await Promise.all([
        fetch('/api/itinerary', { cache: 'no-store' }),
        fetch('/api/cities?view=planner', { cache: 'no-store' }),
        fetch('/api/countries?includeCities=false', { cache: 'no-store' }),
        fetch('/api/fixed-costs', { cache: 'no-store' }),
        fetch('/api/planner/settings', { cache: 'no-store' }),
      ]);
      const [legs, cities, countries, fixedCosts, settings] = await Promise.all([
        readPlannerList<Leg>(legsRes, 'itinerary'),
        readPlannerList<City>(citiesRes, 'cities'),
        readPlannerList<Country>(countriesRes, 'countries'),
        readPlannerList<FixedCost>(fixedRes, 'fixed costs'),
        readPlannerResponse(settingsRes, 'traveller settings'),
      ]);
      if (!Number.isInteger(settings?.groupSize) || settings.groupSize < 1 || settings.groupSize > 5) {
        throw new Error('The server returned invalid traveller settings.');
      }
      if (sequence !== plannerReadSequence.current) return false;
      const countryMap = new Map(countries.map((country) => [country.id, country.name]));
      const sortedCountries = countries.sort((a, b) => a.name.localeCompare(b.name));
      const sortedCities = cities
          .map((city) => ({
            ...city,
            countryName: countryMap.get(city.countryId) || 'Unknown',
          }))
          .sort((a, b) => `${a.countryName}-${a.name}`.localeCompare(`${b.countryName}-${b.name}`));
      setLegs(legs);
      setCountries(sortedCountries);
      setCities(sortedCities);
      setFixedCosts(fixedCosts);
      setGroupSize(settings.groupSize);
      setPageError(null);
      return true;
    } catch (err) {
      if (sequence === plannerReadSequence.current) {
        setPageError(err instanceof Error ? err.message : 'Could not refresh the planner. Check your connection and retry.');
      }
      return false;
    } finally {
      if (sequence === plannerReadSequence.current) setPageLoading(false);
    }
  }, []);

  const fetchSavedPlans = useCallback(async () => {
    const sequence = ++savedPlansReadSequence.current;
    setSavedPlansLoading(true);
    try {
      const response = await fetch('/api/saved-plans', { cache: 'no-store' });
      const plans = await readPlannerList<SavedPlanSummary>(response, 'saved plans');
      if (sequence === savedPlansReadSequence.current) {
        setSavedPlans(plans);
        setSavedPlansError(null);
      }
    } catch (err) {
      if (sequence === savedPlansReadSequence.current) {
        setSavedPlansError(err instanceof Error ? err.message : 'Could not load saved plans. Check your connection and retry.');
      }
    } finally {
      if (sequence === savedPlansReadSequence.current) setSavedPlansLoading(false);
    }
  }, []);

  const refreshPage = useCallback(() => Promise.all([fetchData(), fetchSavedPlans()]),
    [fetchData, fetchSavedPlans]);
  useInitialPageRefresh('/plan', refreshPage, true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedProvider = window.localStorage.getItem(`${CITY_GENERATION_STORAGE_PREFIX}.provider`) as ProviderOption | null;
    const storedModels = window.localStorage.getItem(`${CITY_GENERATION_STORAGE_PREFIX}.models`);

    if (storedProvider && CITY_GENERATION_PROVIDER_OPTIONS.some((option) => option.value === storedProvider)) {
      setImportProvider(storedProvider);
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
    if (addLegSubmitting.current || !newLegValid) return;
    addLegSubmitting.current = true;
    setAddingLeg(true);
    setAddLegError(null);
    try {
      const response = await fetch('/api/itinerary/legs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityId: newLegCity, nights: parsedNewLegNights }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || `Failed to add leg (HTTP ${response.status}).`);
      if (!Number.isInteger(result?.data?.id)) throw new Error('The server returned an unreadable save result. Your leg could not be confirmed. Reload to check whether it saved before retrying.');
      setAddDialogOpen(false);
      setNewLegCity('');
      setNewLegNights('7');
      await fetchData().catch(() => {
        setSnapshotError('Leg added, but the planner could not refresh. Reload to see the saved leg.');
      });
    } catch (err) {
      setAddLegError(err instanceof Error ? err.message : 'Failed to add leg. Check your connection and retry.');
    } finally {
      setAddingLeg(false);
      addLegSubmitting.current = false;
    }
  };

  const handleCancelAddLeg = () => {
    if (addLegSubmitting.current) return;
    setAddDialogOpen(false);
    setNewLegCity('');
    setNewLegNights('7');
    setAddLegError(null);
  };

  const handlePlannerNewCityCreated = useCallback(async (payload: NewCityCreatedPayload) => {
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

  const handleUpdateLeg = useCallback(async (id: number, data: Record<string, unknown>) => {
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
  }, [legs, fetchData]);

  const handleDeleteLeg = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/itinerary/legs/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to delete leg.');
      }

      await fetchData();
      setSnapshotStatus('Leg deleted.');
      setSnapshotError(null);
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : 'Failed to delete leg.');
      setSnapshotStatus(null);
    }
  }, [fetchData]);

  const saveLegOrder = useCallback(async (legIds: number[]) => {
    if (orderSubmitting.current) return false;
    orderSubmitting.current = true;
    setOrderSaving(true);
    setSnapshotStatus(null);
    setSnapshotError(null);
    try {
      const response = await fetch('/api/itinerary/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legIds }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || `Could not save leg order (HTTP ${response.status}). Try again.`);
      if (result?.data?.reordered !== true) throw new Error('The server returned an unreadable response. Reload before retrying.');
      await fetchData();
      return true;
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : 'Could not save leg order. Check your connection and try again.');
      return false;
    } finally {
      orderSubmitting.current = false;
      setOrderSaving(false);
    }
  }, [fetchData]);

  const handleReorder = useCallback(async (legId: number, direction: -1 | 1) => {
    const fromIndex = legs.findIndex(leg => leg.id === legId);
    if (fromIndex < 0) return;
    const newLegs = [...legs];
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= newLegs.length) return;
    [newLegs[fromIndex], newLegs[toIndex]] = [newLegs[toIndex], newLegs[fromIndex]];

    await saveLegOrder(newLegs.map(l => l.id));
  }, [legs, saveLegOrder]);

  const handleSortByDate = async () => {
    const sortedIds = [...legs].sort(compareLegDates).map((l) => l.id);
    if (await saveLegOrder(sortedIds)) setSnapshotStatus('Legs sorted by date.');
  };

  const isAlreadySortedByDate = legs.length >= 2 &&
    [...legs].sort(compareLegDates).every((leg, i) => leg.id === legs[i].id);

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
    updateStoredImportApiKey(importProvider, value);
  };

  const clearCurrentImportApiKey = () => {
    clearStoredCurrentImportApiKey(importProvider);
    setShowImportApiKey(false);
  };

  const clearAllImportApiKeys = () => {
    clearStoredAllImportApiKeys();
    setShowImportApiKey(false);
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
    if (pageError || pageLoading) return;
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
      downloadSnapshot(snapshot, `holiday-spend-plan-${new Date().toISOString().slice(0, 10)}`);
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
  const activeImportModel = importModels[importProvider] || selectedImportProvider.defaultModel;
  const importModelValidation = validateCityGenerationModel(importProvider, activeImportModel);
  const importModelListId = `${CITY_GENERATION_STORAGE_PREFIX}.${importProvider}.models`;
  const importModelDiscovery = useProviderModelDiscovery({
    provider: importProvider,
    apiKey: activeImportApiKey,
    enabled: importResolutionOpen && missingCityStrategy === 'generate',
  });
  // Built once and shared by every leg card and the Add Leg dialog. Previously each card
  // built its own ~200-object array inline during render, which also gave SearchableSelect
  // a new `options` identity every time and so permanently defeated its internal useMemo,
  // re-sorting the list with localeCompare on each card on every render.
  useEffect(() => {
    if (bulkTransportEstimateOpen) setHasOpenedBulkTransport(true);
  }, [bulkTransportEstimateOpen]);

  useEffect(() => {
    if (plannerNewCityOpen) setHasOpenedPlannerNewCity(true);
  }, [plannerNewCityOpen]);

  // A fresh array each render defeated the dialog's own useMemo over these legs.
  const bulkTransportLegs = useMemo(
    () =>
      legs.map((leg) => ({
        id: leg.id,
        cityName: leg.cityName,
        countryName: leg.countryName,
        startDate: leg.startDate,
        intercityTransports: leg.intercityTransports,
      })),
    [legs]
  );

  const cityOptions = useMemo(
    () =>
      cities.map((city) => ({
        value: city.id,
        label: `${city.name}, ${city.countryName}`,
        description: city.countryName,
        keywords: `${city.name} ${city.countryName}`,
      })),
    [cities]
  );

  // Resolve each saved country once into its canonical id, rather than re-scanning the
  // whole list for all 245 known countries. `findKnownCountryMetadata` runs an NFKD
  // normalise plus four regex replaces per call, so the original shape cost ~4.5 ms and
  // ran on every render of this page - including every keystroke in any input on it.
  const canonicalCountryOptions = useMemo(() => {
    const existingCanonicalIds = new Set<string>();
    for (const country of countries) {
      const resolved =
        findKnownCountryMetadata(country.id) ?? findKnownCountryMetadata(country.name);
      if (resolved) existingCanonicalIds.add(resolved.id);
    }

    return KNOWN_COUNTRIES.map((country) => ({
      value: country.id,
      label: country.name,
      description: `${country.currencyCode} • ${getRegionLabel(country.region)}${existingCanonicalIds.has(country.id) ? ' • already in library' : ' • creates row on import'}`,
    }));
  }, [countries]);

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
            <DialogDescription className="sr-only">
              Choose how to handle cities in the imported plan that are not in the library yet.
            </DialogDescription>
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
                    try its configured key for the chosen provider; saving a browser key is opt-in.
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
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={saveImportApiKeys}
                        onChange={(event) => setSaveImportApiKeys(event.target.checked)}
                      />
                      Save API key in this browser
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
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSortByDate}
                  disabled={orderSaving || pageLoading || !!pageError || legs.length < 2 || isAlreadySortedByDate}
                  title={isAlreadySortedByDate ? 'Legs are already in date order' : 'Sort legs by start date'}
                >
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Sort by Date
                </Button>
                <Button type="button" variant="outline" disabled={pageLoading || !!pageError} onClick={() => setSavePlanDialogOpen(true)}>
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
                {hasOpenedBulkTransport ? (
                <BulkTransportEstimateDialog
                  open={bulkTransportEstimateOpen}
                  onOpenChange={setBulkTransportEstimateOpen}
                  legs={bulkTransportLegs}
                  onApplied={async (appliedCount) => {
                    await fetchData();
                    setSnapshotStatus(
                      `Applied estimated intercity transport to ${appliedCount} ${appliedCount === 1 ? 'leg' : 'legs'}.`
                    );
                    setSnapshotError(null);
                  }}
                />
                ) : null}
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
                {hasOpenedPlannerNewCity ? (
                  <PlannerNewCityDialog
                    open={plannerNewCityOpen}
                    onOpenChange={setPlannerNewCityOpen}
                    onCreated={handlePlannerNewCityCreated}
                  />
                ) : null}
                <Dialog open={addDialogOpen} onOpenChange={(open) => {
                  if (!addLegSubmitting.current) setAddDialogOpen(open);
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Leg
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Itinerary Leg</DialogTitle>
                      <DialogDescription className="sr-only">
                        Add a city to the trip and set how many nights you will stay.
                      </DialogDescription>
                    </DialogHeader>
                    <fieldset className="space-y-4" disabled={addingLeg}>
                      <div>
                        <Label>City</Label>
                        <SearchableSelect
                          value={newLegCity}
                          onValueChange={setNewLegCity}
                          placeholder="Select a city"
                          searchPlaceholder="Search cities..."
                          options={cityOptions}
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                          Can&apos;t find the city? Add it to the library and create the leg in one flow.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="add-leg-nights">Nights</Label>
                        <Input
                          id="add-leg-nights"
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={newLegNights}
                          onChange={(e) => setNewLegNights(e.target.value)}
                        />
                        {newLegNights !== '' && (!Number.isSafeInteger(parsedNewLegNights) || parsedNewLegNights < 1) ? (
                          <p className="mt-1 text-sm text-destructive">Enter a whole number of nights, at least 1.</p>
                        ) : null}
                      </div>
                    </fieldset>
                    {addLegError ? <p role="alert" className="text-sm text-destructive">{addLegError}</p> : null}
                    <DialogFooter className="gap-2 sm:justify-end">
                      <Button type="button" variant="ghost" onClick={handleCancelAddLeg} disabled={addingLeg}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={addingLeg}
                        onClick={() => {
                          setAddDialogOpen(false);
                          setNewLegCity('');
                          setNewLegNights('7');
                          setPlannerNewCityOpen(true);
                          setSnapshotStatus(null);
                          setSnapshotError(null);
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add City
                      </Button>
                      <Button
                        type="button"
                        onClick={handleAddLeg}
                        disabled={addingLeg || !newLegValid}
                      >
                        <LoadingButtonLabel idle="Add Leg" loading="Adding..." isLoading={addingLeg} />
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            {snapshotStatus || snapshotError ? (
              <div className="mt-3 text-sm">
                {snapshotStatus ? <span className="text-muted-foreground">{snapshotStatus}</span> : null}
                {snapshotError ? <span role="alert" className="text-destructive">{snapshotError}</span> : null}
              </div>
            ) : null}
            {pageError ? (
              <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-destructive">
                <span>{pageError} Showing the last loaded planner data; it may be out of date.</span>
                <Button type="button" size="sm" variant="outline" disabled={pageLoading} onClick={() => void fetchData()}>
                  <LoadingButtonLabel idle="Retry planner" loading="Retrying..." isLoading={pageLoading} />
                </Button>
              </div>
            ) : null}
            <div className="mt-3 text-xs text-muted-foreground">
              {pageError ? 'Last loaded plan' : 'Current plan'}: {groupSize} {groupSize === 1 ? 'traveller' : 'travellers'}, {currentPlanSummary.legCount} legs, {currentPlanSummary.totalNights} nights, ${currentPlanSummary.totalBudget.toLocaleString('en-AU', { maximumFractionDigits: 0 })} total.
            </div>
          </div>
        </div>
      </div>

        <div
          className="mx-auto max-w-6xl px-4 pb-6 lg:px-8"
          style={{ paddingTop: plannerContentTopPadding }}
        >
          {savedPlansError ? (
            <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm text-destructive">
              <span>{savedPlansError} Showing the last loaded saved plans; the list may be out of date.</span>
              <Button type="button" size="sm" variant="outline" disabled={savedPlansLoading} onClick={() => void fetchSavedPlans()}>Retry saved plans</Button>
            </div>
          ) : null}
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

          <TripClimate legs={legs} climate={climate} unit={temperatureUnit} onToggle={toggleTemperature} onRetry={retryClimate} />

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
                  climate={climate[leg.cityId]}
                  temperatureUnit={temperatureUnit}
                  onToggleTemperature={toggleTemperature}
                  onRetryClimate={retryClimate}
                  cities={cities}
                  cityOptions={cityOptions}
                  groupSize={groupSize}
                  onUpdate={handleUpdateLeg}
                  onDelete={handleDeleteLeg}
                  onMove={handleReorder}
                  orderSaving={orderSaving || pageLoading || !!pageError}
                  isFirst={i === 0}
                  isLast={i === legs.length - 1}
                  previousLeg={i > 0 ? legs[i - 1] : null}
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
