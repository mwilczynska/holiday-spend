'use client';

import { CurrencySelector } from '@/components/currency/CurrencySelector';
import { useCurrency } from '@/components/currency/CurrencyProvider';

import { useInitialPageRefresh } from '@/lib/use-initial-page-refresh';
import { useState, useEffect, useCallback, useId, useLayoutEffect, useMemo, useRef } from 'react';
import { reuseUnchangedById } from '@/lib/reuse-unchanged';
import { PlannerLockContext } from '@/components/itinerary/planner-lock';
import {
  createNewLegDraft,
  DEFAULT_NEW_LEG_NIGHTS,
  newLegDraftError,
  nextLegStartDate,
  updateNewLegDraft,
  type NewLegDraft,
} from '@/lib/new-leg-draft';
import { MAX_LEG_NIGHTS } from '@/lib/itinerary-validation';
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
import { CountrySummaryCard, TripSummaryCard } from '@/components/itinerary/CostSummary';
import { TripBanner } from '@/components/itinerary/TripBanner';
import type { CityImageView } from '@/lib/city-image-view';
import type { NewCityCreatedPayload } from '@/components/itinerary/PlannerNewCityDialog';
import { cn } from '@/lib/utils';

import { ArrowUpDown, ChevronsDownUp, ChevronsUpDown, Download, Map as MapIcon, MoreHorizontal, Plus, Route, Save, Upload, Users } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { IntercityTransportItem, MiscellaneousExpenseItem } from '@/types';
import { getMiscellaneousExpenseTotal, miscellaneousExpensesSchema } from '@/lib/miscellaneous-expenses';
import { getDailyCost, getLegTotal } from '@/lib/cost-calculator';
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
  miscellaneousExpenses: MiscellaneousExpenseItem[];
  sortOrder: number | null;
  notes: string | null;
  status: string;
  dailyCost: number;
  legTotal: number;
  cityImage?: CityImageView | null;
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
  const { format } = useCurrency();
  const importApiKeyInputId = useId();
  const [legs, setLegs] = useState<Leg[]>(initialData.legs);
  // Legs start collapsed except the one in progress. A leg that appears after load (added here or
  // through the new-city flow) opens automatically; a whole imported plan does not.
  const [expandedLegIds, setExpandedLegIds] = useState<Set<number>>(
    () => new Set(initialData.legs.filter((leg) => leg.status === 'active').map((leg) => leg.id))
  );
  const knownLegIds = useRef<Set<number>>(new Set(initialData.legs.map((leg) => leg.id)));
  useEffect(() => {
    const appeared = legs.filter((leg) => !knownLegIds.current.has(leg.id)).map((leg) => leg.id);
    knownLegIds.current = new Set(legs.map((leg) => leg.id));
    if (appeared.length === 0 || appeared.length > 2) return;
    setExpandedLegIds((current) => {
      const next = new Set(current);
      appeared.forEach((id) => next.add(id));
      return next;
    });
  }, [legs]);
  const toggleLegExpanded = useCallback((id: number) => {
    setExpandedLegIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const allLegsExpanded = legs.length > 0 && legs.every((leg) => expandedLegIds.has(leg.id));
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
  const nextLegDraftId = useRef(1);
  const [newLegDrafts, setNewLegDrafts] = useState<NewLegDraft[]>(
    () => [createNewLegDraft(0, nextLegStartDate(initialData.legs.at(-1)?.endDate))]
  );
  const [initialNewCity, setInitialNewCity] = useState<{ cityName: string; nights: string; startDate?: string }>();
  const [addingLeg, setAddingLeg] = useState(false);
  const [addLegError, setAddLegError] = useState<string | null>(null);
  const [addLegStatus, setAddLegStatus] = useState<string | null>(null);
  const addLegSubmitting = useRef(false);
  const newLegValid = newLegDrafts.every(draft => draft.cityId && newLegDraftError(draft) == null);
  const setNewLegDraftField = (id: number, field: 'cityId' | 'startDate' | 'endDate' | 'nights', value: string) => {
    setNewLegDrafts(current => current.map(draft => draft.id === id ? updateNewLegDraft(draft, field, value) : draft));
  };
  // A fresh form starts where the itinerary currently ends.
  const resetNewLegDrafts = () => setNewLegDrafts([
    createNewLegDraft(nextLegDraftId.current++, nextLegStartDate(legsRef.current.at(-1)?.endDate)),
  ]);
  const openNewCity = (cityName = '', nights = String(DEFAULT_NEW_LEG_NIGHTS), startDate?: string) => {
    setInitialNewCity(cityName ? { cityName, nights, startDate } : undefined);
    setAddDialogOpen(false);
    setPlannerNewCityOpen(true);
    setSnapshotStatus(null);
    setSnapshotError(null);
  };
  const [savedPlans, setSavedPlans] = useState<SavedPlanSummary[]>(initialData.savedPlans);
  const [savedPlansLoading, setSavedPlansLoading] = useState(false);
  const [savedPlansError, setSavedPlansError] = useState<string | null>(null);
  const savedPlansReadSequence = useRef(0);
  const [savingPlan, setSavingPlan] = useState(false);
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [orderSaving, setOrderSaving] = useState(false);
  const orderSubmitting = useRef(false);
  const [dirtyLegIds, setDirtyLegIds] = useState<Set<number>>(() => new Set());
  const hasUnsavedLegEdits = dirtyLegIds.size > 0;
  const handleLegDirtyChange = useCallback((id: number, dirty: boolean) => {
    setDirtyLegIds(current => {
      if (current.has(id) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  const [groupSize, setGroupSize] = useState(initialData.groupSize);
  // Current values for callbacks passed to every leg card. Depending on the state itself gave those callbacks a new
  // identity on every save, which rerendered all cards.
  const legsRef = useRef(legs);
  const citiesRef = useRef(cities);
  const groupSizeRef = useRef(groupSize);
  useLayoutEffect(() => {
    legsRef.current = legs;
    citiesRef.current = cities;
    groupSizeRef.current = groupSize;
  }, [legs, cities, groupSize]);
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
  // The fixed header overlays the page, so the content is pushed down by the header's height less
  // the distance the content already starts from the top (page padding), plus a 16px gap. That
  // distance was hard-coded as 56px, the desktop value; on a phone it is 40px, so a 128px floor
  // stood in and left a gap once the mobile header became compact.
  const plannerContentRef = useRef<HTMLDivElement>(null);
  const [plannerContentOffset, setPlannerContentOffset] = useState(56);
  const plannerContentTopPadding = plannerHeaderHeight > 0 ? Math.max(plannerHeaderHeight - plannerContentOffset + 16, 0) : 144;

  useEffect(() => {
    const header = plannerHeaderRef.current;
    if (!header) return;

    const updateHeight = () => {
      setPlannerHeaderHeight(header.getBoundingClientRect().height);
      const content = plannerContentRef.current;
      if (content) setPlannerContentOffset(Math.round(content.getBoundingClientRect().top + window.scrollY));
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
      setLegs((current) => reuseUnchangedById(current, legs));
      setCountries(sortedCountries);
      setCities((current) => reuseUnchangedById(current, sortedCities));
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

  // After a leg save only the itinerary can have changed, so re-read just that rather than all cities, countries,
  // fixed costs and settings. It shares the full refresh's sequence, so neither can overwrite a newer result, and it
  // clears the loading flag a superseded full refresh would otherwise leave set.
  const refreshLegs = useCallback(async () => {
    const sequence = ++plannerReadSequence.current;
    try {
      const response = await fetch('/api/itinerary', { cache: 'no-store' });
      const nextLegs = await readPlannerList<Leg>(response, 'itinerary');
      if (sequence !== plannerReadSequence.current) return false;
      setLegs((current) => reuseUnchangedById(current, nextLegs));
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
    setAddLegStatus(null);
    let completed = 0;
    try {
      for (const draft of newLegDrafts) {
        const response = await fetch('/api/itinerary/legs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityId: draft.cityId, nights: Number(draft.nights), startDate: draft.startDate, endDate: draft.endDate }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error || `Failed to add leg (HTTP ${response.status}).`);
        if (!Number.isSafeInteger(result?.data?.id) || result.data.id <= 0 || result.data.cityId !== draft.cityId || result.data.nights !== Number(draft.nights) || result.data.startDate !== draft.startDate) throw new Error('The server returned an unreadable save result. Your leg could not be confirmed. Reload to check whether it saved before retrying.');
        completed++;
        setNewLegDrafts(current => current.filter(item => item.id !== draft.id));
      }
      setAddDialogOpen(false);
      resetNewLegDrafts();
    } catch (err) {
      setAddLegError(err instanceof Error ? err.message : 'Failed to add leg. Check your connection and retry.');
    } finally {
      if (completed > 0) {
        const message = `${completed} ${completed === 1 ? 'leg' : 'legs'} added. Confirmed additions will not be submitted again.`;
        setAddLegStatus(message);
        setSnapshotStatus(message);
        await fetchData();
      }
      setAddingLeg(false);
      addLegSubmitting.current = false;
    }
  };

  const handleCancelAddLeg = () => {
    if (addLegSubmitting.current) return;
    setAddDialogOpen(false);
    resetNewLegDrafts();
    setAddLegError(null);
    setAddLegStatus(null);
  };

  const handlePlannerNewCityCreated = useCallback(async (payloads: NewCityCreatedPayload[]) => {
    await fetchData();

    const payload = payloads[payloads.length - 1];
    const cityResult = payload.city;
    const suffixParts = [];
    if (cityResult?.reusedExistingCity) suffixParts.push('existing city reused');
    if (cityResult?.createdCountry) suffixParts.push('country created');
    if (cityResult?.createdCity) suffixParts.push('city created');
    if (cityResult?.generatedCity) suffixParts.push('city costs generated');

    setSnapshotStatus(
      payloads.length > 1 ? `Added ${payloads.length} city legs.` : `Added leg for "${cityResult?.cityName || payload.requested.cityName}, ${cityResult?.countryName || payload.requested.countryName}".${suffixParts.length > 0 ? ` ${suffixParts.join(', ')}.` : ''}`
    );
    setSnapshotError(null);
  }, [fetchData]);

  const handleUpdateLeg = useCallback(async (id: number, data: Record<string, unknown>) => {
    const response = await fetch(`/api/itinerary/legs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || `Could not save this leg (HTTP ${response.status}).`);
    if (result?.data?.id !== id) throw new Error('The server returned an unreadable save result. Reload to check whether the leg saved before retrying.');
    if (Object.prototype.hasOwnProperty.call(data, 'miscellaneousExpenses')) {
      const confirmed = miscellaneousExpensesSchema.safeParse(result.data.miscellaneousExpenses);
      const requested = miscellaneousExpensesSchema.safeParse(data.miscellaneousExpenses);
      if (!confirmed.success || !requested.success || JSON.stringify(confirmed.data) !== JSON.stringify(requested.data)) {
        throw new Error('The server did not confirm the miscellaneous expenses. Reload to check whether they saved before retrying.');
      }
    }
    const applyConfirmedUpdate = (leg: Leg) => {
      if (leg.id !== id) return leg;
      const next = { ...leg, ...data, ...result.data } as Leg;
      const city = citiesRef.current.find(item => item.id === next.cityId);
      if (city) {
        next.cityName = city.name;
        next.countryName = city.countryName;
        next.countryId = city.countryId;
        next.dailyCost = getDailyCost(city, next.accomTier as import('@/types').AccomTier,
          next.foodTier as import('@/types').FoodTier, next.drinksTier as import('@/types').DrinksTier,
          next.activitiesTier as import('@/types').ActivitiesTier, next, groupSizeRef.current);
        next.legTotal = getLegTotal(next.dailyCost, next.nights, next.intercityTransportCost)
          + getMiscellaneousExpenseTotal(next.miscellaneousExpenses);
      }
      return next;
    };
    setLegs(current => current.map(applyConfirmedUpdate));

    if (Object.prototype.hasOwnProperty.call(data, 'status')) {
      const sortedLegIds = [...legsRef.current]
        .map(applyConfirmedUpdate)
        .sort(compareLegDates)
        .map((leg) => leg.id);

      try {
        const orderResponse = await fetch('/api/itinerary/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ legIds: sortedLegIds }),
        });
        const orderResult = await orderResponse.json().catch(() => null);
        if (!orderResponse.ok) throw new Error(orderResult?.error || `HTTP ${orderResponse.status}`);
        if (orderResult?.data?.reordered !== true) throw new Error('Unreadable ordering response');
      } catch (err) {
        throw new Error(`Leg saved, but automatic date ordering failed: ${err instanceof Error ? err.message : 'Check your connection.'} Retry to save the order.`);
      }
    }

    await refreshLegs();
  }, [refreshLegs]);

  const handleDiscardLegEdits = useCallback(() => { void refreshLegs(); }, [refreshLegs]);

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
    const fromIndex = legsRef.current.findIndex(leg => leg.id === legId);
    if (fromIndex < 0) return;
    const newLegs = [...legsRef.current];
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= newLegs.length) return;
    [newLegs[fromIndex], newLegs[toIndex]] = [newLegs[toIndex], newLegs[fromIndex]];

    await saveLegOrder(newLegs.map(l => l.id));
  }, [saveLegOrder]);

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
    if (pageError || pageLoading || hasUnsavedLegEdits) return;
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
    if (hasUnsavedLegEdits) {
      setSnapshotError('Retry or discard your unsaved leg edits before loading a saved plan.');
      return;
    }
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

  // Shared by the header buttons and the phone-width More menu.
  const sortByDateDisabled = hasUnsavedLegEdits || orderSaving || pageLoading || !!pageError || legs.length < 2 || isAlreadySortedByDate;
  const savePlanDisabled = hasUnsavedLegEdits || pageLoading || !!pageError;
  const bulkTransportDisabled = hasUnsavedLegEdits || pageLoading || !!pageError || estimatableTransportLegCount === 0;
  const bulkTransportLabel = `Estimate Intercity Transport${
    estimatableTransportLegCount > 0
      ? missingTransportLegCount > 0
        ? ` (${missingTransportLegCount} missing)`
        : ` (${estimatableTransportLegCount} eligible)`
      : ''
  }`;
  const openBulkTransport = () => {
    setBulkTransportEstimateOpen(true);
    setSnapshotStatus(null);
    setSnapshotError(null);
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
                <Select data-analytics="plan-client.set-missing-city-strategy"
                  value={missingCityStrategy}
                  onValueChange={(value) => setMissingCityStrategy(value as 'placeholder' | 'generate')}
                >
                  <SelectTrigger data-analytics="plan-client.select-trigger" className="h-9 text-sm">
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
                    <Select data-analytics="plan-client.select" value={importProvider} onValueChange={(value) => updateImportProvider(value as ProviderOption)}>
                      <SelectTrigger data-analytics="plan-client.select-trigger.2" className="h-9 text-sm">
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
                      <Label htmlFor={importApiKeyInputId} className="text-xs">{selectedImportProvider.label} API Key</Label>
                      <Input
                        id={importApiKeyInputId}
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
                      <Button data-analytics="plan-client.clear-current-import-api-key"
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearCurrentImportApiKey}
                        disabled={!activeImportApiKey}
                      >
                        Clear This Key
                      </Button>
                      <Button data-analytics="plan-client.clear-all-import-api-keys"
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
                        <Button data-analytics="plan-client.button"
                          key={model}
                          type="button"
                          variant={importModelValidation.effectiveModel === model ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => updateImportModel(model)}
                        >
                          {model === selectedImportProvider.defaultModel ? `${model} (default)` : model}
                        </Button>
                      ))}
                      <Button data-analytics="plan-client.import-model-discovery" type="button" variant="ghost" size="sm" onClick={() => void importModelDiscovery.refresh()} disabled={importModelDiscovery.loading || importModelDiscovery.refreshing || importingSnapshot}>
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
              <Button data-analytics="plan-client.reset-pending-import-state" type="button" variant="outline" onClick={resetPendingImportState} disabled={importingSnapshot}>
                Cancel
              </Button>
              <Button data-analytics="plan-client.handle-confirm-missing-city-import" type="button" onClick={handleConfirmMissingCityImport} disabled={importingSnapshot}>
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

      <div ref={plannerContentRef} className="-mx-4 -mt-4 lg:-mx-8 lg:-mt-8">
        <div className="fixed inset-x-0 top-0 z-30 border-b bg-background/95 backdrop-blur lg:left-60">
          {/* The header stays pinned, so on a phone it keeps to two rows: the descriptions are hidden
              and the less frequent actions move into a More menu. Before this it covered 373px of
              an 812px screen. */}
          <div ref={plannerHeaderRef} className="mx-auto max-w-7xl px-4 py-3 sm:py-4 lg:px-8">
            <div className="flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="max-w-xl">
                <div className="flex items-center gap-2.5">
                  <MapIcon className="h-5 w-5 text-brand-teal sm:h-6 sm:w-6" aria-hidden="true" />
                  <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Itinerary Planner</h1>
                </div>
                <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                  Build your trip leg by leg. City costs are stored for 2 people and scaled here for your selected traveller count.
                </p>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Traveller count is shared with Settings and the dashboard.
                </p>
              </div>
              <div className="flex items-center gap-2 sm:flex-wrap sm:justify-end">
                <div className="min-w-0 flex-1 sm:min-w-[170px] sm:flex-none">
                  <Select data-analytics="plan-client.handle-group-size-change" value={String(groupSize)} onValueChange={handleGroupSizeChange}>
                    <SelectTrigger data-analytics="plan-client.travellers" aria-label="Travellers" className="h-10 gap-2 font-semibold" disabled={hasUnsavedLegEdits || pageLoading}>
                      <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {/* Explicit text: Radix renders an empty value until the options mount in the browser. */}
                      <SelectValue>{groupSize} {groupSize === 1 ? 'traveller' : 'travellers'}</SelectValue>
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
                <CurrencySelector disabled={hasUnsavedLegEdits || pageLoading} />
                <SavePlanDialog
                  open={savePlanDialogOpen}
                  onOpenChange={setSavePlanDialogOpen}
                  onSave={handleSaveSnapshot}
                  isSaving={savingPlan}
                />
                <Button data-analytics="plan-client.handle-sort-by-date"
                  type="button"
                  variant="outline"
                  className="hidden sm:inline-flex"
                  onClick={handleSortByDate}
                  disabled={sortByDateDisabled}
                  title={isAlreadySortedByDate ? 'Legs are already in date order' : 'Sort legs by start date'}
                >
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Sort by Date
                </Button>
                <Button data-analytics="plan-client.set-save-plan-dialog-open" type="button" variant="outline" className="hidden sm:inline-flex" disabled={savePlanDisabled} onClick={() => setSavePlanDialogOpen(true)}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Plan
                </Button>
                <Button data-analytics="plan-client.handle-export-current-plan" type="button" variant="outline" className="hidden sm:inline-flex" disabled={hasUnsavedLegEdits} onClick={handleExportCurrentPlan}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <Button data-analytics="plan-client.import-input-ref" type="button" variant="outline" className="hidden sm:inline-flex" disabled={hasUnsavedLegEdits} onClick={() => importInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button data-analytics="plan-client.more-plan-actions" type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 sm:hidden" aria-label="More plan actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem data-analytics="plan-client.handle-sort-by-date.2" className="py-2" disabled={sortByDateDisabled} onClick={handleSortByDate}>
                      <ArrowUpDown /> {isAlreadySortedByDate ? 'Already in date order' : 'Sort by Date'}
                    </DropdownMenuItem>
                    <DropdownMenuItem data-analytics="plan-client.set-save-plan-dialog-open.2" className="py-2" disabled={savePlanDisabled} onClick={() => setSavePlanDialogOpen(true)}>
                      <Save /> Save Plan
                    </DropdownMenuItem>
                    <DropdownMenuItem data-analytics="plan-client.handle-export-current-plan.2" className="py-2" disabled={hasUnsavedLegEdits} onClick={handleExportCurrentPlan}>
                      <Download /> Export
                    </DropdownMenuItem>
                    <DropdownMenuItem data-analytics="plan-client.import-input-ref.2" className="py-2" disabled={hasUnsavedLegEdits} onClick={() => importInputRef.current?.click()}>
                      <Upload /> Import
                    </DropdownMenuItem>
                    <DropdownMenuItem data-analytics="plan-client.open-bulk-transport" className="py-2" disabled={bulkTransportDisabled} onClick={openBulkTransport}>
                      <Route /> {bulkTransportLabel}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                <Button data-analytics="plan-client.open-bulk-transport.2"
                  type="button"
                  variant="outline"
                  className="hidden sm:inline-flex"
                  onClick={openBulkTransport}
                  disabled={bulkTransportDisabled}
                >
                  {bulkTransportLabel}
                </Button>
                {hasOpenedPlannerNewCity ? (
                  <PlannerNewCityDialog
                    open={plannerNewCityOpen}
                    onOpenChange={setPlannerNewCityOpen}
                    onCreated={handlePlannerNewCityCreated}
                    defaultStartDate={nextLegStartDate(legs.at(-1)?.endDate)}
                    initialCity={initialNewCity}
                  />
                ) : null}
                <Dialog open={addDialogOpen} onOpenChange={(open) => {
                  if (addLegSubmitting.current) return;
                  // An untouched form restarts at the trip's current end; a partly filled one keeps its input.
                  if (open && newLegDrafts.every(draft => !draft.cityId)) resetNewLegDrafts();
                  setAddDialogOpen(open);
                }}>
                  <DialogTrigger data-analytics="plan-client.dialog-trigger" asChild>
                    <Button data-analytics="plan-client.button.2" className="h-10 w-10 shrink-0 px-0 sm:w-auto sm:px-4">
                      <Plus className="h-4 w-4 sm:mr-2" />
                      <span className="sr-only sm:not-sr-only">Add Leg</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add Itinerary Leg</DialogTitle>
                      <DialogDescription className="sr-only">
                        Add a city to the trip with its dates and number of nights.
                      </DialogDescription>
                    </DialogHeader>
                    <fieldset className="space-y-4" disabled={addingLeg}>
                      {newLegDrafts.map((draft, index) => (
                        <div key={draft.id} className="space-y-3 rounded-md border p-3">
                          {newLegDrafts.length > 1 ? <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">City {index + 1}</span>
                            <Button data-analytics="plan-client.set-new-leg-drafts" type="button" variant="ghost" size="sm" aria-label={`Remove city ${index + 1}`} onClick={() => setNewLegDrafts(current => current.filter(item => item.id !== draft.id))}>Remove</Button>
                          </div> : null}
                          <div>
                            <Label>City</Label>
                            <SearchableSelect
                              value={draft.cityId}
                              onValueChange={cityId => setNewLegDraftField(draft.id, 'cityId', cityId)}
                              placeholder="Select a city"
                              searchPlaceholder="Search cities..."
                              options={cityOptions}
                              onCreateOption={search => openNewCity(search, draft.nights, draft.startDate)}
                            />
                            <p className="mt-2 text-xs text-muted-foreground">
                              Can&apos;t find the city? Add it to the library and create the leg in one flow.
                            </p>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                              <Label htmlFor={`add-leg-start-${draft.id}`}>Start date</Label>
                              <Input
                                id={`add-leg-start-${draft.id}`}
                                type="date"
                                min="2000-01-01"
                                max="2100-12-31"
                                value={draft.startDate}
                                onChange={(e) => setNewLegDraftField(draft.id, 'startDate', e.target.value)}
                                aria-describedby={newLegDraftError(draft) ? `add-leg-dates-error-${draft.id}` : undefined}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`add-leg-end-${draft.id}`}>End date</Label>
                              <Input
                                id={`add-leg-end-${draft.id}`}
                                type="date"
                                min="2000-01-01"
                                max="2100-12-31"
                                value={draft.endDate}
                                onChange={(e) => setNewLegDraftField(draft.id, 'endDate', e.target.value)}
                                aria-describedby={newLegDraftError(draft) ? `add-leg-dates-error-${draft.id}` : undefined}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`add-leg-nights-${draft.id}`}>Nights</Label>
                              <Input
                                id={`add-leg-nights-${draft.id}`}
                                type="number"
                                min={1}
                                max={MAX_LEG_NIGHTS}
                                step={1}
                                inputMode="numeric"
                                value={draft.nights}
                                onChange={(e) => setNewLegDraftField(draft.id, 'nights', e.target.value)}
                                aria-describedby={newLegDraftError(draft) ? `add-leg-dates-error-${draft.id}` : undefined}
                              />
                            </div>
                          </div>
                          {newLegDraftError(draft) ? (
                            <p id={`add-leg-dates-error-${draft.id}`} className="text-sm text-destructive">{newLegDraftError(draft)}</p>
                          ) : null}
                        </div>
                      ))}
                      <Button data-analytics="plan-client.set-new-leg-drafts.2" type="button" variant="outline" onClick={() => setNewLegDrafts(current => [
                        ...current,
                        createNewLegDraft(nextLegDraftId.current++, nextLegStartDate(current.at(-1)?.endDate ?? legsRef.current.at(-1)?.endDate)),
                      ])}>Add another leg</Button>
                    </fieldset>
                    {addLegError ? <p role="alert" className="text-sm text-destructive">{addLegError}</p> : null}
                    {addLegStatus ? <p role="status" className="text-sm text-muted-foreground">{addLegStatus}</p> : null}
                    <DialogFooter className="gap-2 sm:justify-end">
                      <Button data-analytics="plan-client.handle-cancel-add-leg" type="button" variant="ghost" onClick={handleCancelAddLeg} disabled={addingLeg}>
                        Cancel
                      </Button>
                      <Button data-analytics="plan-client.open-new-city"
                        type="button"
                        variant="outline"
                        disabled={addingLeg}
                        onClick={() => openNewCity()}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Generate New City
                      </Button>
                      <Button data-analytics="plan-client.handle-add-leg"
                        type="button"
                        onClick={handleAddLeg}
                        disabled={addingLeg || !newLegValid}
                      >
                        <LoadingButtonLabel idle={newLegDrafts.length > 1 ? `Add ${newLegDrafts.length} Legs` : 'Add Leg'} loading="Adding..." isLoading={addingLeg} />
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
                <Button data-analytics="plan-client.button.3" type="button" size="sm" variant="outline" disabled={pageLoading} onClick={() => void fetchData()}>
                  <LoadingButtonLabel idle="Retry planner" loading="Retrying..." isLoading={pageLoading} />
                </Button>
              </div>
            ) : null}
            {hasUnsavedLegEdits ? (
              <p role="status" className="mt-3 text-sm text-amber-700">Unsaved leg edits. Trip totals reflect saved data. Retry or discard failed changes before saving, exporting or replacing the plan.</p>
            ) : null}
            <div className="mt-2 text-xs text-muted-foreground sm:mt-3">
              {pageError ? 'Last loaded plan' : 'Current plan'}: {groupSize} {groupSize === 1 ? 'traveller' : 'travellers'}, {currentPlanSummary.legCount} legs, {currentPlanSummary.totalNights} nights, {format(currentPlanSummary.totalBudget)} total.
            </div>
          </div>
        </div>
      </div>

        {/* On a phone the legs come straight after the banner: the summaries and climate move below them with
            CSS order (the top grid becomes display: contents so its banner and cards can be ordered on their own).
            From 640px up the layout and order are unchanged. */}
        <div
          className="flex flex-col gap-4 pb-6 sm:block sm:space-y-4"
          style={{ paddingTop: plannerContentTopPadding }}
        >
          <div className="grid gap-3.5 max-sm:contents lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)] 2xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)_minmax(260px,0.8fr)]">
            <TripBanner legs={legs} />
            <div className="max-sm:order-2 sm:contents">
              <TripSummaryCard legs={legs} fixedCostsTotal={fixedCostsTotal} groupSize={groupSize} />
            </div>
            <div className="max-sm:order-2 lg:col-span-2 2xl:col-span-1">
              <CountrySummaryCard legs={legs} />
            </div>
          </div>

          {savedPlansError ? (
            <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm text-destructive max-sm:order-2">
              <span>{savedPlansError} Showing the last loaded saved plans; the list may be out of date.</span>
              <Button data-analytics="plan-client.button.4" type="button" size="sm" variant="outline" disabled={savedPlansLoading} onClick={() => void fetchSavedPlans()}>Retry saved plans</Button>
            </div>
          ) : null}
          {savedPlans.length > 0 && (
            <div className="mb-4 max-sm:order-2">
              <SavedPlansList
                plans={savedPlans}
                onLoad={handleLoadSavedPlan}
                onDelete={handleDeleteSavedPlan}
                onExport={handleExportSavedPlan}
                isLoading={savedPlansLoading}
              />
            </div>
          )}

          <div className="max-sm:order-2">
            <TripClimate legs={legs} climate={climate} unit={temperatureUnit} onToggle={toggleTemperature} onRetry={retryClimate} />
          </div>

          <section aria-label="Itinerary legs" className="max-sm:order-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold">Legs</h2>
              {legs.length > 0 ? (
                <Button data-analytics="plan-client.set-expanded-leg-ids"
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedLegIds(allLegsExpanded ? new Set() : new Set(legs.map((leg) => leg.id)))}
                >
                  {allLegsExpanded
                    ? <ChevronsDownUp className="mr-2 h-4 w-4" aria-hidden="true" />
                    : <ChevronsUpDown className="mr-2 h-4 w-4" aria-hidden="true" />}
                  {allLegsExpanded ? 'Collapse all' : 'Expand all'}
                </Button>
              ) : null}
            </div>
            {legs.length === 0 && (
              <p className="text-muted-foreground text-center py-12">
                No legs yet. Add your first destination to start planning.
              </p>
            )}
            <PlannerLockContext.Provider value={hasUnsavedLegEdits || orderSaving || pageLoading || !!pageError}>
            <ol className="list-none">
              {legs.map((leg, i) => (
                <li key={leg.id} className="flex gap-3 sm:gap-3.5">
                  <div className="flex w-8 shrink-0 flex-col items-center" aria-hidden="true">
                    <span className={cn('w-0.5', i === 0 ? 'h-[27px] bg-transparent' : 'h-[27px] bg-blue-200')} />
                    <span
                      className={cn(
                        'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold',
                        leg.status === 'active' && 'bg-brand-blue text-white',
                        leg.status === 'completed' && 'bg-blue-100 text-blue-700',
                        leg.status !== 'active' && leg.status !== 'completed' && 'border-2 border-brand-blue bg-card text-blue-700'
                      )}
                    >
                      {i + 1}
                    </span>
                    {i < legs.length - 1 ? <span className="w-0.5 flex-1 bg-blue-200" /> : null}
                  </div>
                  <div className="min-w-0 flex-1 pb-3">
                    <LegCard
                      leg={leg}
                      climate={climate[leg.cityId]}
                      temperatureUnit={temperatureUnit}
                      onToggleTemperature={toggleTemperature}
                      onRetryClimate={retryClimate}
                      cities={cities}
                      cityOptions={cityOptions}
                      groupSize={groupSize}
                      onUpdate={handleUpdateLeg}
                      onDirtyChange={handleLegDirtyChange}
                      onDiscard={handleDiscardLegEdits}
                      onDelete={handleDeleteLeg}
                      onMove={handleReorder}
                      expanded={expandedLegIds.has(leg.id)}
                      onToggleExpanded={toggleLegExpanded}
                      isFirst={i === 0}
                      isLast={i === legs.length - 1}
                      previousLeg={i > 0 ? legs[i - 1] : null}
                    />
                  </div>
                </li>
              ))}
            </ol>
            </PlannerLockContext.Provider>
          </section>
        </div>
    </div>
  );
}
