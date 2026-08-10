import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import type { CityEstimateData } from '@/types';
import {
  deriveCityCostV5,
  V5_ANCHOR_NAMES,
  V5_TIER_NAMES,
  type CityCostEvidenceGrade,
  type CityCostInterval,
  type V5AnchorInput,
  type V5AnchorName,
  type V5AnchorStatus,
  type V5MaterializedTier,
  type V5TierName,
} from './city-cost-methodology-v5';

export type V6Grade = CityCostEvidenceGrade;

export interface V6AnchorInput extends V5AnchorInput {
  evidenceGrade: Exclude<V6Grade, 'definitional'>;
  intervalPct?: number;
  missingness?: Exclude<V5AnchorStatus, 'observed' | 'modelled' | 'imputed'>;
}

export type V6AnchorInputs = Partial<Record<V5AnchorName, V6AnchorInput>>;

export interface V6Tier extends V5MaterializedTier {
  evidenceGrade: V6Grade;
  interval: CityCostInterval;
}

export interface V6Materialization {
  schemaVersion: 'city-cost-materialization-v6';
  methodologyVersion: 'v6.0';
  city: string;
  country: string;
  region: string | null;
  costBand: V6CostBand | null;
  tiersAud: Record<V5TierName, V6Tier>;
  anchors: V6AnchorInputs;
  missingness: Partial<Record<V5AnchorName, Exclude<V5AnchorStatus, 'observed' | 'modelled' | 'imputed'>>>;
  priorBasis: string;
  complete: true;
  mappedEstimate: Partial<CityEstimateData>;
}

export type V6CostBand = 'low' | 'mid' | 'high';

export interface V6BandCuts {
  lowMax: number;
  midMax: number;
}

interface V6ShippedCoefficient {
  k: number;
  byBand?: Partial<Record<V6CostBand, number>>;
  multiplyBy?: number;
  grade: Exclude<V6Grade, 'definitional'>;
  intervalPct: number;
  provenance: string;
}

interface V6CoefficientsFile {
  shippedCoefficients: Record<string, V6ShippedCoefficient>;
  sourceCalibrationOffsets?: Record<string, V6SourceCalibrationOffset>;
}

export interface V6SourceCalibrationOffset {
  direction: 'Booking -> Expedia';
  groundTruthSource: string;
  productionSource: string;
  bookingToExpediaMultiplier: number;
  expediaToBookingMultiplier: number;
  grade: Exclude<V6Grade, 'C' | 'D' | 'definitional'>;
  intervalPct: number;
  fit: Record<string, unknown>;
}

export interface V6PriorRow {
  region: string;
  values: Partial<Record<V5AnchorName, number>>;
}

export interface V6Priors {
  byRegionBand: Record<string, Partial<Record<V5AnchorName, number>>>;
  byRegion: Record<string, Partial<Record<V5AnchorName, number>>>;
  global: Partial<Record<V5AnchorName, number>>;
  bandCuts: V6BandCuts;
}

interface V6CsvRow {
  region?: string;
  accom_shared_hostel_dorm?: string | number;
  accom_hostel_private_room?: string | number;
  accom_1_star?: string | number;
  accom_2_star?: string | number;
  accom_3_star?: string | number;
  accom_4_star?: string | number;
  food_street_food?: string | number;
  food_budget?: string | number;
  food_mid_range?: string | number;
  food_high_end?: string | number;
  drink_coffee?: string | number;
  drinks_none?: string | number;
  drinks_light?: string | number;
  drinks_moderate?: string | number;
  drinks_heavy?: string | number;
  activities_budget?: string | number;
  activities_mid_range?: string | number;
  activities_high_end?: string | number;
}

const GRADE_ORDER: V6Grade[] = ['A', 'B', 'C', 'D', 'definitional'];
const DEFAULT_INTERVAL_PCT: Record<V6Grade, number> = {
  A: 10,
  B: 20,
  C: 25,
  D: 45,
  definitional: 0,
};

const V6_TIER_WEIGHTS: Record<V5TierName, Partial<Record<V5AnchorName, number>>> = {
  accom_shared_hostel_dorm: { hostel_dorm_bed_1p: 2 },
  accom_hostel_private_room: { hostel_private_room_2p: 1 },
  accom_1_star: { hotel_1star_room_2p: 1 },
  accom_2_star: { hotel_2star_room_2p: 1 },
  accom_3_star: { hotel_3star_room_2p: 1 },
  accom_4_star: { hotel_4star_room_2p: 1 },
  food_street_food: { street_food_meal_1p: 6 },
  food_budget: { street_food_meal_1p: 4, inexpensive_restaurant_meal_1p: 2 },
  food_mid_range: {
    street_food_meal_1p: 2,
    inexpensive_restaurant_meal_1p: 2,
    midrange_restaurant_meal_2p: 1,
  },
  food_high_end: {
    inexpensive_restaurant_meal_1p: 2,
    midrange_restaurant_meal_2p: 1,
    premium_restaurant_meal_2p: 1,
  },
  drink_coffee: { cappuccino_1: 1 },
  drinks_none: { cappuccino_1: 2 },
  drinks_light: { cappuccino_1: 2, domestic_draft_beer_1: 2 },
  drinks_moderate: { cappuccino_1: 2, domestic_draft_beer_1: 4, cocktail_1: 2 },
  drinks_heavy: {
    cappuccino_1: 2,
    domestic_draft_beer_1: 6,
    cocktail_1: 4,
    wine_glass_1: 2,
  },
  activities_free: {},
  activities_budget: { paid_attraction_adult_1: 2 },
  activities_mid_range: { half_day_group_activity_adult_1: 2 },
  activities_high_end: { full_day_premium_activity_adult_1: 2 },
};

type V6AccommodationCoefficientKey =
  | 'accom_shared_hostel_dorm'
  | 'accom_hostel_private_room'
  | 'accom_1_star'
  | 'accom_2_star'
  | 'accom_4_star';

type V6GeneratedRatioCoefficientKey =
  | 'premium_restaurant_meal_2p'
  | 'street_food_meal_1p'
  | 'cocktail_1'
  | 'wine_glass_1';

let referenceCache: { coefficients: V6CoefficientsFile; bandCuts: V6BandCuts } | null = null;
let defaultPriorsCache: V6Priors | null = null;

function repoFile(relativePath: string) {
  const candidates = [
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), '..', relativePath),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`Expected v6 reference file was not found: ${candidates.join(', ')}`);
  return found;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(repoFile(relativePath), 'utf8')) as T;
}

export function loadV6ReferenceData() {
  if (!referenceCache) {
    const manifest = readJson<{ groundTruthPanel?: { bandCutsAud?: { lowMax: number; midMax: number } } }>(
      'data/reference/v6/validation-manifest-v6.json'
    );
    const bandCuts = manifest.groundTruthPanel?.bandCutsAud;
    if (!bandCuts || !Number.isFinite(bandCuts.lowMax) || !Number.isFinite(bandCuts.midMax)) {
      throw new Error('The v6 validation manifest does not contain valid accommodation band cuts.');
    }
    referenceCache = {
      coefficients: readJson<V6CoefficientsFile>('data/reference/v6/coefficients-v6.json'),
      bandCuts: { lowMax: bandCuts.lowMax, midMax: bandCuts.midMax },
    };
  }
  return referenceCache;
}

export function loadV6SourceCalibrationOffset(measure: V5AnchorName) {
  return loadV6ReferenceData().coefficients.sourceCalibrationOffsets?.[measure] ?? null;
}

function numeric(value: string | number | undefined) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function positiveOrNull(value: number | null) {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

function rowToAnchorValues(row: V6CsvRow): Partial<Record<V5AnchorName, number>> {
  const coffee = numeric(row.drink_coffee);
  const drinksLight = numeric(row.drinks_light);
  const drinksModerate = numeric(row.drinks_moderate);
  const drinksHeavy = numeric(row.drinks_heavy);
  const street = numeric(row.food_street_food);
  const inexpensive = positiveOrNull(
    numeric(row.food_budget) !== null && street !== null
      ? (numeric(row.food_budget)! - 4 * (street / 6)) / 2
      : null
  );
  const midrange = positiveOrNull(
    numeric(row.food_mid_range) !== null && street !== null && inexpensive !== null
      ? numeric(row.food_mid_range)! - 2 * (street / 6) - 2 * inexpensive
      : null
  );
  const premium = positiveOrNull(
    numeric(row.food_high_end) !== null && inexpensive !== null && midrange !== null
      ? numeric(row.food_high_end)! - 2 * inexpensive - midrange
      : null
  );
  const beer = positiveOrNull(
    drinksLight !== null && coffee !== null ? (drinksLight - 2 * coffee) / 2 : null
  );
  const cocktail = positiveOrNull(
    drinksModerate !== null && coffee !== null && beer !== null
      ? (drinksModerate - 2 * coffee - 4 * beer) / 2
      : null
  );
  const wine = positiveOrNull(
    drinksHeavy !== null && coffee !== null && beer !== null && cocktail !== null
      ? (drinksHeavy - 2 * coffee - 6 * beer - 4 * cocktail) / 2
      : null
  );

  const values: Partial<Record<V5AnchorName, number | null>> = {
    hostel_dorm_bed_1p: numeric(row.accom_shared_hostel_dorm) === null ? null : numeric(row.accom_shared_hostel_dorm)! / 2,
    hostel_private_room_2p: numeric(row.accom_hostel_private_room),
    hotel_1star_room_2p: numeric(row.accom_1_star),
    hotel_2star_room_2p: numeric(row.accom_2_star),
    hotel_3star_room_2p: numeric(row.accom_3_star),
    hotel_4star_room_2p: numeric(row.accom_4_star),
    street_food_meal_1p: street === null ? null : street / 6,
    inexpensive_restaurant_meal_1p: inexpensive,
    midrange_restaurant_meal_2p: midrange,
    premium_restaurant_meal_2p: premium,
    mcmeal_combo: inexpensive,
    cappuccino_1: coffee,
    domestic_draft_beer_1: beer,
    cocktail_1: cocktail,
    wine_glass_1: wine,
    paid_attraction_adult_1: numeric(row.activities_budget) === null ? null : numeric(row.activities_budget)! / 2,
    half_day_group_activity_adult_1: numeric(row.activities_mid_range) === null ? null : numeric(row.activities_mid_range)! / 2,
    full_day_premium_activity_adult_1: numeric(row.activities_high_end) === null ? null : numeric(row.activities_high_end)! / 2,
  };

  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
  ) as Partial<Record<V5AnchorName, number>>;
}

function addPriorValue(
  buckets: Map<string, Map<V5AnchorName, number[]>>,
  key: string,
  values: Partial<Record<V5AnchorName, number>>
) {
  const bucket = buckets.get(key) ?? new Map<V5AnchorName, number[]>();
  for (const [anchor, value] of Object.entries(values) as [V5AnchorName, number][]) {
    const valuesForAnchor = bucket.get(anchor) ?? [];
    valuesForAnchor.push(value);
    bucket.set(anchor, valuesForAnchor);
  }
  buckets.set(key, bucket);
}

function collapseBucket(bucket: Map<V5AnchorName, number[]> | undefined) {
  if (!bucket) return {};
  return Object.fromEntries(
    Array.from(bucket.entries())
      .map(([anchor, values]) => [anchor, median(values)])
      .filter(([, value]) => value !== null)
  ) as Partial<Record<V5AnchorName, number>>;
}

export function buildV6Priors(rows: V6PriorRow[], bandCuts: V6BandCuts = loadV6ReferenceData().bandCuts): V6Priors {
  const regionBandBuckets = new Map<string, Map<V5AnchorName, number[]>>();
  const regionBuckets = new Map<string, Map<V5AnchorName, number[]>>();
  const globalBucket = new Map<V5AnchorName, number[]>();

  for (const row of rows) {
    const region = normalizeV6Region(row.region) ?? 'unknown';
    const hotel3 = row.values.hotel_3star_room_2p;
    const band = hotel3 === undefined ? null : costBandForAmount(hotel3, bandCuts);
    addPriorValue(regionBuckets, region, row.values);
    if (band) addPriorValue(regionBandBuckets, `${region}|${band}`, row.values);
    for (const [anchor, value] of Object.entries(row.values) as [V5AnchorName, number][]) {
      const valuesForAnchor = globalBucket.get(anchor) ?? [];
      valuesForAnchor.push(value);
      globalBucket.set(anchor, valuesForAnchor);
    }
  }

  return {
    byRegionBand: Object.fromEntries(
      Array.from(regionBandBuckets.entries()).map(([key, bucket]) => [key, collapseBucket(bucket)])
    ),
    byRegion: Object.fromEntries(
      Array.from(regionBuckets.entries()).map(([key, bucket]) => [key, collapseBucket(bucket)])
    ),
    global: collapseBucket(globalBucket),
    bandCuts,
  };
}

export function loadV6Priors(): V6Priors {
  if (!defaultPriorsCache) {
    const csvText = fs.readFileSync(repoFile('data/reference/city_costs_app_aud.csv'), 'utf8');
    const parsed = Papa.parse<V6CsvRow>(csvText, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) throw new Error(`Failed to parse v6 prior CSV: ${parsed.errors[0].message}`);
    defaultPriorsCache = buildV6Priors(
      parsed.data.map((row) => ({ region: row.region ?? 'unknown', values: rowToAnchorValues(row) })),
      loadV6ReferenceData().bandCuts
    );
  }
  return defaultPriorsCache;
}

export function normalizeV6Region(region: string | null | undefined) {
  if (!region) return null;
  const normalized = region.trim().toLowerCase().replace(/[_-]+/g, ' ');
  const aliases: Record<string, string> = {
    'se asia': 'SEA',
    sea: 'SEA',
    'east asia': 'East Asia',
    'south asia': 'South Asia',
    'middle east': 'Middle East',
    africa: 'Africa',
    europe: 'Europe',
    'latin america': 'Latin America',
    'north america': 'North America',
    oceania: 'Oceania',
  };
  return aliases[normalized] ?? region.trim();
}

export function costBandForAmount(amount: number, bandCuts: V6BandCuts = loadV6ReferenceData().bandCuts): V6CostBand {
  if (amount <= bandCuts.lowMax) return 'low';
  if (amount <= bandCuts.midMax) return 'mid';
  return 'high';
}

function rounded(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function worstGrade(...grades: V6Grade[]): V6Grade {
  return grades.reduce((worst, grade) =>
    GRADE_ORDER.indexOf(grade) > GRADE_ORDER.indexOf(worst) ? grade : worst
  );
}

function gradeForStatus(status: V5AnchorStatus): Exclude<V6Grade, 'definitional'> {
  if (status === 'observed') return 'A';
  if (status === 'modelled') return 'C';
  return 'D';
}

function intervalFor(grade: V6Grade, amount: number, widthPct = DEFAULT_INTERVAL_PCT[grade]) {
  return {
    lowerAud: rounded(Math.max(0, amount * (1 - widthPct / 100))),
    upperAud: rounded(amount * (1 + widthPct / 100)),
    widthPct: rounded(widthPct),
  } satisfies CityCostInterval;
}

function priorValue(priors: V6Priors, region: string | null, band: V6CostBand | null, anchor: V5AnchorName) {
  const regionKey = region ?? 'unknown';
  return (
    (band ? priors.byRegionBand[`${regionKey}|${band}`]?.[anchor] : undefined) ??
    priors.byRegion[regionKey]?.[anchor] ??
    priors.global[anchor] ??
    null
  );
}

function makePriorInput(
  anchor: V5AnchorName,
  region: string | null,
  band: V6CostBand | null,
  priors: V6Priors,
  missingness: Exclude<V5AnchorStatus, 'observed' | 'modelled' | 'imputed'> = 'not_found'
): V6AnchorInput {
  const valueAud = priorValue(priors, region, band, anchor);
  if (valueAud === null) throw new Error(`No regional or global v6 prior exists for ${anchor}.`);
  return {
    valueAud,
    status: 'imputed',
    evidenceGrade: 'D',
    intervalPct: DEFAULT_INTERVAL_PCT.D,
    sourceIds: [`v6-prior:${region ?? 'global'}:${band ?? 'all'}`],
    modelVersions: ['city-cost-v6-regional-prior-v1'],
    imputedMeasures: [anchor],
    missingness,
  };
}

function copyInput(input: V6AnchorInput, fallbackGrade?: Exclude<V6Grade, 'definitional'>): V6AnchorInput {
  const status = input.status;
  return {
    ...input,
    evidenceGrade: input.evidenceGrade ?? fallbackGrade ?? gradeForStatus(status),
    intervalPct: input.intervalPct ?? DEFAULT_INTERVAL_PCT[input.evidenceGrade ?? fallbackGrade ?? gradeForStatus(status)],
  };
}

function getCoefficient(
  name: V6AccommodationCoefficientKey | V6GeneratedRatioCoefficientKey,
  coefficients: V6CoefficientsFile,
  costBand: V6CostBand | null = null
) {
  const coefficient = coefficients.shippedCoefficients[name];
  const bandCoefficient = costBand ? coefficient?.byBand?.[costBand] : undefined;
  if (!coefficient || !Number.isFinite(coefficient.k) || coefficient.k < 0 || (bandCoefficient !== undefined && (!Number.isFinite(bandCoefficient) || bandCoefficient < 0))) {
    throw new Error(`Missing valid v6 coefficient ${name}.`);
  }
  return bandCoefficient === undefined ? coefficient : { ...coefficient, k: bandCoefficient };
}

function applyAccommodationLadder(inputs: Record<V5AnchorName, V6AnchorInput>, coefficients: V6CoefficientsFile) {
  const anchor = inputs.hotel_3star_room_2p;
  const ladder: Array<{
    tier: V5TierName;
    anchorName: V5AnchorName;
    coefficientKey: V6AccommodationCoefficientKey;
  }> = [
    { tier: 'accom_shared_hostel_dorm', anchorName: 'hostel_dorm_bed_1p', coefficientKey: 'accom_shared_hostel_dorm' },
    { tier: 'accom_hostel_private_room', anchorName: 'hostel_private_room_2p', coefficientKey: 'accom_hostel_private_room' },
    { tier: 'accom_1_star', anchorName: 'hotel_1star_room_2p', coefficientKey: 'accom_1_star' },
    { tier: 'accom_2_star', anchorName: 'hotel_2star_room_2p', coefficientKey: 'accom_2_star' },
    { tier: 'accom_4_star', anchorName: 'hotel_4star_room_2p', coefficientKey: 'accom_4_star' },
  ];
  for (const item of ladder) {
    const coefficient = getCoefficient(item.coefficientKey, coefficients);
    inputs[item.anchorName] = {
      // The dorm coefficient's multiplyBy belongs to the product tier (two
      // beds), while this input is explicitly a one-person bed anchor.
      valueAud: rounded(anchor.valueAud! * coefficient.k),
      status: 'modelled',
      evidenceGrade: worstGrade(anchor.evidenceGrade, coefficient.grade) as Exclude<V6Grade, 'definitional'>,
      intervalPct: coefficient.intervalPct,
      sourceIds: [...(anchor.sourceIds ?? []), `v6-coefficient:${item.coefficientKey}`],
      modelVersions: [...(anchor.modelVersions ?? []), `city-cost-v6-${coefficient.provenance}`],
      imputedMeasures: ['hotel_3star_room_2p', ...(anchor.imputedMeasures ?? [])],
    };
  }
}

function applyGeneratedAnchorLadder(
  inputs: Record<V5AnchorName, V6AnchorInput>,
  originalAnchors: V6AnchorInputs,
  coefficients: V6CoefficientsFile,
  costBand: V6CostBand | null
) {
  const relations: Array<{
    target: V5AnchorName;
    source: V5AnchorName;
    coefficientKey: V6GeneratedRatioCoefficientKey;
  }> = [
    {
      target: 'premium_restaurant_meal_2p',
      source: 'midrange_restaurant_meal_2p',
      coefficientKey: 'premium_restaurant_meal_2p',
    },
    {
      target: 'street_food_meal_1p',
      source: 'inexpensive_restaurant_meal_1p',
      coefficientKey: 'street_food_meal_1p',
    },
    { target: 'cocktail_1', source: 'cappuccino_1', coefficientKey: 'cocktail_1' },
    { target: 'wine_glass_1', source: 'cappuccino_1', coefficientKey: 'wine_glass_1' },
  ];

  for (const relation of relations) {
    if (originalAnchors[relation.target]?.valueAud !== null && originalAnchors[relation.target]?.valueAud !== undefined) continue;
    const sourceInput = originalAnchors[relation.source];
    const source = inputs[relation.source];
    if (sourceInput?.valueAud === null || sourceInput?.valueAud === undefined || !source?.valueAud) continue;
    const coefficient = getCoefficient(relation.coefficientKey, coefficients, costBand);
    inputs[relation.target] = {
      valueAud: rounded(source.valueAud * coefficient.k),
      status: 'modelled',
      evidenceGrade: worstGrade(source.evidenceGrade, coefficient.grade) as Exclude<V6Grade, 'definitional'>,
      intervalPct: coefficient.intervalPct,
      sourceIds: [...(source.sourceIds ?? []), `v6-coefficient:${relation.coefficientKey}`],
      modelVersions: [...(source.modelVersions ?? []), `city-cost-v6-${coefficient.provenance}`],
      imputedMeasures: [relation.target, relation.source, ...(source.imputedMeasures ?? [])],
    };
  }
}

function buildCompleteInputs(input: {
  region: string | null;
  anchors: V6AnchorInputs;
  priors: V6Priors;
}) {
  const region = normalizeV6Region(input.region);
  const providedHotel3 = input.anchors.hotel_3star_room_2p;
  const initialBand = providedHotel3?.valueAud !== null && providedHotel3?.valueAud !== undefined
    ? costBandForAmount(providedHotel3.valueAud, input.priors.bandCuts)
    : null;
  const missingness: V6Materialization['missingness'] = {};
  const complete = {} as Record<V5AnchorName, V6AnchorInput>;

  for (const anchor of V5_ANCHOR_NAMES) {
    const provided = input.anchors[anchor];
    if (provided?.valueAud !== null && provided?.valueAud !== undefined) {
      complete[anchor] = copyInput(provided);
      continue;
    }
    const missingState = provided?.missingness ?? (provided?.status && provided.status !== 'observed' && provided.status !== 'modelled' && provided.status !== 'imputed'
      ? provided.status
      : 'not_found');
    missingness[anchor] = missingState;
    complete[anchor] = makePriorInput(anchor, region, initialBand, input.priors, missingState);
  }

  // v6 measures the 3-star level and deterministically derives all other hotel tiers.
  applyAccommodationLadder(complete, loadV6ReferenceData().coefficients);
  applyGeneratedAnchorLadder(complete, input.anchors, loadV6ReferenceData().coefficients, initialBand);
  return { complete, missingness, region, costBand: initialBand };
}

function intervalForTier(
  tierName: V5TierName,
  inputs: Record<V5AnchorName, V6AnchorInput>,
  amountAud: number,
  coefficientIntervalPct?: number
) {
  if (tierName === 'activities_free') return intervalFor('definitional', 0);
  const weights = V6_TIER_WEIGHTS[tierName];
  const total = amountAud || 1;
  const variance = Object.entries(weights).reduce((sum, [anchor, weight]) => {
    const value = inputs[anchor as V5AnchorName].valueAud!;
    const widthPct = inputs[anchor as V5AnchorName].intervalPct ?? DEFAULT_INTERVAL_PCT[inputs[anchor as V5AnchorName].evidenceGrade];
    return sum + Math.pow((weight! * value * widthPct) / 100, 2);
  }, 0);
  const widthPct = Math.sqrt(variance) / total * 100;
  const grade = Object.keys(weights).reduce<V6Grade>(
    (worst, anchor) => worstGrade(worst, inputs[anchor as V5AnchorName].evidenceGrade),
    'A'
  );
  return intervalFor(
    grade,
    amountAud,
    Math.max(widthPct, coefficientIntervalPct ?? 0, DEFAULT_INTERVAL_PCT[grade])
  );
}

function toV6Tier(
  tierName: V5TierName,
  baseTier: V5MaterializedTier,
  inputs: Record<V5AnchorName, V6AnchorInput>,
  coefficientIntervalPct?: number
): V6Tier {
  if (tierName === 'activities_free') {
    return {
      ...baseTier,
      evidenceGrade: 'definitional',
      interval: intervalFor('definitional', 0),
    };
  }
  const evidenceGrade = baseTier.parentAnchors.reduce<V6Grade>(
    (worst, anchor) => worstGrade(worst, inputs[anchor].evidenceGrade),
    'A'
  );
  return {
    ...baseTier,
    evidenceGrade,
    interval: intervalForTier(tierName, inputs, baseTier.amountAud!, coefficientIntervalPct),
  };
}

function mapTiersToEstimateData(tiers: Record<V5TierName, V6Tier>): Partial<CityEstimateData> {
  return {
    accomHostel: tiers.accom_shared_hostel_dorm.amountAud!,
    accomPrivateRoom: tiers.accom_hostel_private_room.amountAud!,
    accom1star: tiers.accom_1_star.amountAud!,
    accom2star: tiers.accom_2_star.amountAud!,
    accom3star: tiers.accom_3_star.amountAud!,
    accom4star: tiers.accom_4_star.amountAud!,
    foodStreet: tiers.food_street_food.amountAud!,
    foodBudget: tiers.food_budget.amountAud!,
    foodMid: tiers.food_mid_range.amountAud!,
    foodHigh: tiers.food_high_end.amountAud!,
    drinkCoffee: tiers.drink_coffee.amountAud!,
    drinkLocalBeer: rounded(tiers.drinks_light.amountAud! / 2 - tiers.drink_coffee.amountAud!),
    drinkWineGlass: rounded((tiers.drinks_heavy.amountAud! - 2 * tiers.drink_coffee.amountAud! - 6 * (tiers.drinks_light.amountAud! / 2 - tiers.drink_coffee.amountAud!) - 4 * ((tiers.drinks_moderate.amountAud! - 2 * tiers.drink_coffee.amountAud! - 4 * (tiers.drinks_light.amountAud! / 2 - tiers.drink_coffee.amountAud!)) / 2)) / 2),
    drinkCocktail: rounded((tiers.drinks_moderate.amountAud! - 2 * tiers.drink_coffee.amountAud! - 4 * (tiers.drinks_light.amountAud! / 2 - tiers.drink_coffee.amountAud!)) / 2),
    drinksNone: tiers.drinks_none.amountAud!,
    drinksLight: tiers.drinks_light.amountAud!,
    drinksModerate: tiers.drinks_moderate.amountAud!,
    drinksHeavy: tiers.drinks_heavy.amountAud!,
    activitiesFree: tiers.activities_free.amountAud!,
    activitiesBudget: tiers.activities_budget.amountAud!,
    activitiesMid: tiers.activities_mid_range.amountAud!,
    activitiesHigh: tiers.activities_high_end.amountAud!,
  };
}

export function materializeCityCostV6(input: {
  city: string;
  country: string;
  region?: string | null;
  anchors: V6AnchorInputs;
  priors?: V6Priors;
}): V6Materialization {
  const priors = input.priors ?? loadV6Priors();
  const completed = buildCompleteInputs({ region: input.region ?? null, anchors: input.anchors, priors });
  const v5Inputs = completed.complete as Record<V5AnchorName, V5AnchorInput>;
  const base = deriveCityCostV5(v5Inputs);
  const coefficients = loadV6ReferenceData().coefficients.shippedCoefficients;
  const tiersAud = Object.fromEntries(
    V5_TIER_NAMES.map((tierName) => {
      const coefficientIntervalPct =
        tierName === 'accom_shared_hostel_dorm'
          ? coefficients.accom_shared_hostel_dorm?.intervalPct
          : tierName === 'accom_hostel_private_room'
            ? coefficients.accom_hostel_private_room?.intervalPct
            : tierName === 'accom_1_star'
              ? coefficients.accom_1_star?.intervalPct
              : tierName === 'accom_2_star'
                ? coefficients.accom_2_star?.intervalPct
                : tierName === 'accom_4_star'
                  ? coefficients.accom_4_star?.intervalPct
                  : undefined;
      return [
        tierName,
        toV6Tier(tierName, base.tiersAud[tierName], completed.complete, coefficientIntervalPct),
      ];
    })
  ) as Record<V5TierName, V6Tier>;

  return {
    schemaVersion: 'city-cost-materialization-v6',
    methodologyVersion: 'v6.0',
    city: input.city,
    country: input.country,
    region: completed.region,
    costBand: completed.costBand,
    tiersAud,
    anchors: completed.complete,
    missingness: completed.missingness,
    priorBasis: 'data/reference/city_costs_app_aud.csv regional and accommodation-band medians; v6 band cuts from validation-manifest-v6.json',
    complete: true,
    mappedEstimate: mapTiersToEstimateData(tiersAud),
  };
}
