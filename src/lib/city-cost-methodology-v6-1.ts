import fs from 'fs';
import path from 'path';
import type { CityEstimateData } from '@/types';
import {
  costBandForAmount,
  loadV6ReferenceData,
  normalizeV6Region,
  type V6AnchorInput,
  type V6CostBand,
  type V6Grade,
  type V6Priors,
} from './city-cost-methodology-v6';
import type {
  V61AnchorInputs,
  V61SourceMeasure,
} from './city-cost-v6-1-collection';
import {
  V5_TIER_NAMES,
  type V5EvidenceBasis,
  type V5TierName,
} from './city-cost-methodology-v5';

type V61Tier = {
  amountAud: number;
  formula: string;
  parentAnchors: string[];
  missingAnchors: string[];
  evidenceBasis: V5EvidenceBasis;
  imputedMeasures: string[];
  sourceIds: string[];
  modelVersions: string[];
  evidenceGrade: V6Grade;
  interval: {
    lowerAud: number;
    upperAud: number;
    widthPct: number;
  };
};

export interface V61Materialization {
  schemaVersion: 'city-cost-materialization-v6.1';
  methodologyVersion: 'v6.1';
  city: string;
  country: string;
  region: string | null;
  costBand: V6CostBand | null;
  tiersAud: Record<V5TierName, V61Tier>;
  anchors: Record<string, V6AnchorInput>;
  missingness: Partial<Record<string, string>>;
  priorBasis: string;
  complete: true;
  mappedEstimate: Partial<CityEstimateData>;
}

let v61PriorsCache: V6Priors | null = null;

function v61RepoFile(relativePath: string) {
  const candidates = [
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), '..', relativePath),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`Expected v6.1 reference file was not found: ${candidates.join(', ')}`);
  return found;
}

export function loadV61Priors() {
  if (!v61PriorsCache) {
    v61PriorsCache = JSON.parse(fs.readFileSync(v61RepoFile('data/reference/v6/priors-v6-1.json'), 'utf8')) as V6Priors;
  }
  return v61PriorsCache;
}

const ACCOMMODATION_LADDER = [
  { tier: 'accom_shared_hostel_dorm', coefficient: 'accom_shared_hostel_dorm' },
  { tier: 'accom_hostel_private_room', coefficient: 'accom_hostel_private_room' },
  { tier: 'accom_1_star', coefficient: 'accom_1_star' },
  { tier: 'accom_2_star', coefficient: 'accom_2_star' },
  { tier: 'accom_4_star', coefficient: 'accom_4_star' },
] as const;

const FOOD_MEASURES = [
  'byt_food_budget_per_person_day',
  'byt_food_mid_per_person_day',
  'byt_food_high_per_person_day',
] as const satisfies readonly V61SourceMeasure[];

const ACTIVITY_MEASURES = [
  'byt_activities_budget_per_person_day',
  'byt_activities_mid_per_person_day',
  'byt_activities_high_per_person_day',
] as const satisfies readonly V61SourceMeasure[];

const DRINK_MEASURES = ['cappuccino_1', 'domestic_draft_beer_1'] as const satisfies readonly V61SourceMeasure[];

type ShippedCoefficient = {
  k: number;
  grade: Exclude<V6Grade, 'definitional'>;
  intervalPct: number;
  provenance: string;
};

function rounded(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function intervalFor(amountAud: number, widthPct: number) {
  return {
    lowerAud: rounded(Math.max(0, amountAud * (1 - widthPct / 100))),
    upperAud: rounded(amountAud * (1 + widthPct / 100)),
    widthPct: rounded(widthPct),
  };
}

function gradeRank(grade: V6Grade) {
  return { definitional: 0, A: 1, B: 2, C: 3, D: 4 }[grade];
}

function worstGrade(...grades: V6Grade[]) {
  return grades.reduce((worst, grade) => gradeRank(grade) > gradeRank(worst) ? grade : worst, 'A' as V6Grade);
}

function usableSource(input: V6AnchorInput | undefined): input is V6AnchorInput & { valueAud: number; status: 'observed' } {
  return input?.status === 'observed' && input.valueAud !== null && input.valueAud !== undefined;
}

function valueOf(input: V6AnchorInput) {
  if (input.valueAud === null || input.valueAud === undefined) throw new Error('A materialization input is missing its numeric value.');
  return input.valueAud;
}

function coefficient(name: string): ShippedCoefficient {
  const shipped = loadV6ReferenceData().coefficients.shippedCoefficients as Record<string, ShippedCoefficient>;
  const result = shipped[name];
  if (!result || !Number.isFinite(result.k) || !Number.isFinite(result.intervalPct)) {
    throw new Error(`Missing generated v6 coefficient: ${name}`);
  }
  return result;
}

function tierPriorValue(priors: V6Priors, region: string | null, band: V6CostBand | null, tier: V5TierName) {
  const regionKey = region ?? 'unknown';
  return (
    (band ? priors.tierValuesByRegionBand?.[`${regionKey}|${band}`]?.[tier] : undefined) ??
    priors.tierValuesByRegion?.[regionKey]?.[tier] ??
    priors.tierValuesGlobal?.[tier] ??
    null
  );
}

function fallbackTier(
  tier: V5TierName,
  priors: V6Priors,
  region: string | null,
  band: V6CostBand | null,
  missingAnchors: string[]
): V61Tier {
  const amountAud = tierPriorValue(priors, region, band, tier);
  if (amountAud === null || !Number.isFinite(amountAud) || amountAud < 0) {
    throw new Error(`No v6.1 direct, regional or global tier prior exists for ${tier}.`);
  }
  return {
    amountAud: rounded(amountAud),
    formula: `v6.1 ${tier} tier prior`,
    parentAnchors: [],
    missingAnchors,
    evidenceBasis: 'imputed',
    imputedMeasures: missingAnchors,
    sourceIds: [`v6.1-tier-prior:${region ?? 'global'}:${band ?? 'all'}:${tier}`],
    modelVersions: ['city-cost-v6-1-tier-prior-v1'],
    evidenceGrade: 'D',
    interval: intervalFor(amountAud, 45),
  };
}

function derivedTier(input: {
  tier: V5TierName;
  amountAud: number;
  formula: string;
  parents: string[];
  inputs: Record<string, V6AnchorInput>;
  relationGrade?: V6Grade;
  relationIntervalPct?: number;
  evidenceBasis?: V5EvidenceBasis;
}): V61Tier {
  const parentInputs = input.parents.map((parent) => input.inputs[parent]);
  const grades = parentInputs.map((parent) => parent?.evidenceGrade ?? 'D');
  const evidenceGrade = worstGrade(...grades, input.relationGrade ?? 'A');
  const intervalPct = Math.max(
    input.relationIntervalPct ?? 0,
    ...parentInputs.map((parent) => parent?.intervalPct ?? (parent?.evidenceGrade === 'B' ? 35 : parent?.evidenceGrade === 'D' ? 45 : 10))
  );
  const sourceIds = Array.from(new Set(parentInputs.flatMap((parent) => parent?.sourceIds ?? [])));
  const modelVersions = Array.from(new Set(parentInputs.flatMap((parent) => parent?.modelVersions ?? [])));
  const imputedMeasures = Array.from(new Set([
    ...input.parents.filter((parent) => input.inputs[parent]?.status === 'imputed'),
    ...parentInputs.flatMap((parent) => parent?.imputedMeasures ?? []),
  ]));
  return {
    amountAud: rounded(input.amountAud),
    formula: input.formula,
    parentAnchors: input.parents,
    missingAnchors: [],
    evidenceBasis: input.evidenceBasis ?? (evidenceGrade === 'D' ? 'imputed' : 'derived'),
    imputedMeasures,
    sourceIds,
    modelVersions,
    evidenceGrade,
    interval: intervalFor(input.amountAud, intervalPct),
  };
}

function sourceVectorComplete(inputs: V61AnchorInputs, measures: readonly V61SourceMeasure[]) {
  return measures.every((measure) => usableSource(inputs[measure]));
}

function fallbackCategory(
  tiers: Partial<Record<V5TierName, V61Tier>>,
  names: readonly V5TierName[],
  priors: V6Priors,
  region: string | null,
  band: V6CostBand | null,
  missingAnchors: string[]
) {
  for (const tier of names) tiers[tier] = fallbackTier(tier, priors, region, band, missingAnchors);
}

function mapTiersToEstimateData(tiers: Record<V5TierName, V61Tier>): Partial<CityEstimateData> {
  const coffee = tiers.drink_coffee.amountAud;
  const beer = rounded((tiers.drinks_light.amountAud - 2 * coffee) / 2);
  const cocktail = rounded((tiers.drinks_moderate.amountAud - 2 * coffee - 4 * beer) / 2);
  return {
    accomHostel: tiers.accom_shared_hostel_dorm.amountAud,
    accomPrivateRoom: tiers.accom_hostel_private_room.amountAud,
    accom1star: tiers.accom_1_star.amountAud,
    accom2star: tiers.accom_2_star.amountAud,
    accom3star: tiers.accom_3_star.amountAud,
    accom4star: tiers.accom_4_star.amountAud,
    foodStreet: tiers.food_street_food.amountAud,
    foodBudget: tiers.food_budget.amountAud,
    foodMid: tiers.food_mid_range.amountAud,
    foodHigh: tiers.food_high_end.amountAud,
    drinkCoffee: coffee,
    drinkLocalBeer: beer,
    drinkCocktail: cocktail,
    drinksNone: tiers.drinks_none.amountAud,
    drinksLight: tiers.drinks_light.amountAud,
    drinksModerate: tiers.drinks_moderate.amountAud,
    drinksHeavy: tiers.drinks_heavy.amountAud,
    activitiesFree: tiers.activities_free.amountAud,
    activitiesBudget: tiers.activities_budget.amountAud,
    activitiesMid: tiers.activities_mid_range.amountAud,
    activitiesHigh: tiers.activities_high_end.amountAud,
  };
}

export function materializeCityCostV61(input: {
  city: string;
  country: string;
  region?: string | null;
  anchors: V61AnchorInputs;
  priors?: V6Priors;
}): V61Materialization {
  const priors = input.priors ?? loadV61Priors();
  const region = normalizeV6Region(input.region);
  const missingness: Partial<Record<string, string>> = {};
  const anchors: Record<string, V6AnchorInput> = Object.fromEntries(
    Object.entries(input.anchors).map(([name, value]) => [name, { ...value }])
  );

  let hotel3 = input.anchors.hotel_3star_room_2p;
  if (!usableSource(hotel3)) {
    if (hotel3?.status && hotel3.status !== 'observed') missingness.hotel_3star_room_2p = hotel3.missingness ?? hotel3.status;
    const fallback = fallbackTier('accom_3_star', priors, region, null, ['hotel_3star_room_2p']);
    hotel3 = {
      valueAud: fallback.amountAud,
      status: 'imputed',
      evidenceGrade: 'D',
      intervalPct: 45,
      sourceIds: fallback.sourceIds,
      modelVersions: fallback.modelVersions,
      imputedMeasures: ['hotel_3star_room_2p'],
    };
    anchors.hotel_3star_room_2p = hotel3;
  } else {
    anchors.hotel_3star_room_2p = hotel3;
  }

  const hotel3Value = valueOf(hotel3);
  const costBand = costBandForAmount(hotel3Value, priors.bandCuts);
  const tiers = {} as Partial<Record<V5TierName, V61Tier>>;
  const accommodationInput = hotel3;
  const accommodationAnchorIds = accommodationInput.sourceIds ?? [];
  const accommodationVersions = accommodationInput.modelVersions ?? [];
  const accommodationBaseGrade = accommodationInput.evidenceGrade;
  tiers.accom_3_star = {
    amountAud: rounded(hotel3Value),
    formula: 'hotel_3star_room_2p',
    parentAnchors: ['hotel_3star_room_2p'],
    missingAnchors: [],
    evidenceBasis: hotel3.status === 'imputed' ? 'imputed' : 'observed',
    imputedMeasures: hotel3.imputedMeasures ?? [],
    sourceIds: accommodationAnchorIds,
    modelVersions: accommodationVersions,
    evidenceGrade: accommodationBaseGrade,
    interval: intervalFor(hotel3Value, hotel3.intervalPct ?? (accommodationBaseGrade === 'B' ? 41 : 45)),
  };
  const coefficients = loadV6ReferenceData().coefficients.shippedCoefficients as Record<string, ShippedCoefficient>;
  for (const item of ACCOMMODATION_LADDER) {
    const relation = coefficients[item.coefficient];
    if (!relation) throw new Error(`Missing generated v6 accommodation coefficient: ${item.coefficient}`);
    const tier = item.tier as V5TierName;
    tiers[tier] = derivedTier({
      tier,
      amountAud: hotel3Value * relation.k * (item.coefficient === 'accom_shared_hostel_dorm' ? 2 : 1),
      formula: item.coefficient === 'accom_shared_hostel_dorm'
        ? `2 * ${relation.k} * hotel_3star_room_2p`
        : `${relation.k} * hotel_3star_room_2p`,
      parents: ['hotel_3star_room_2p'],
      inputs: { hotel_3star_room_2p: accommodationInput },
      relationGrade: relation.grade,
      relationIntervalPct: relation.intervalPct,
      evidenceBasis: accommodationBaseGrade === 'D' ? 'imputed' : 'modelled',
    });
    tiers[tier]!.sourceIds = [...accommodationAnchorIds, `v6-coefficient:${item.coefficient}`];
    tiers[tier]!.modelVersions = [...accommodationVersions, `city-cost-v6-${relation.provenance}`];
  }

  const foodTiers: V5TierName[] = ['food_street_food', 'food_budget', 'food_mid_range', 'food_high_end'];
  if (sourceVectorComplete(input.anchors, FOOD_MEASURES)) {
    const budgetInput = input.anchors.byt_food_budget_per_person_day!;
    const midInput = input.anchors.byt_food_mid_per_person_day!;
    const highInput = input.anchors.byt_food_high_per_person_day!;
    const budget = derivedTier({
      tier: 'food_budget',
      amountAud: valueOf(budgetInput) * 2,
      formula: '2 * byt_food_budget_per_person_day',
      parents: ['byt_food_budget_per_person_day'],
      inputs: input.anchors,
      relationGrade: 'A',
      relationIntervalPct: 35,
      evidenceBasis: 'observed',
    });
    tiers.food_budget = budget;
    tiers.food_mid_range = derivedTier({
      tier: 'food_mid_range',
      amountAud: valueOf(midInput) * 2,
      formula: '2 * byt_food_mid_per_person_day',
      parents: ['byt_food_mid_per_person_day'],
      inputs: input.anchors,
      relationGrade: 'A',
      relationIntervalPct: 35,
      evidenceBasis: 'observed',
    });
    tiers.food_high_end = derivedTier({
      tier: 'food_high_end',
      amountAud: valueOf(highInput) * 2,
      formula: '2 * byt_food_high_per_person_day',
      parents: ['byt_food_high_per_person_day'],
      inputs: input.anchors,
      relationGrade: 'A',
      relationIntervalPct: 35,
      evidenceBasis: 'observed',
    });
    const streetRelation = coefficient('street_food_meal_1p');
    const streetK = (6 * streetRelation.k) / (4 * streetRelation.k + 2);
    tiers.food_street_food = derivedTier({
      tier: 'food_street_food',
      amountAud: budget.amountAud * streetK,
      formula: `(6 * ${streetRelation.k}) / (4 * ${streetRelation.k} + 2) * food_budget`,
      parents: ['byt_food_budget_per_person_day'],
      inputs: input.anchors,
      relationGrade: 'D',
      relationIntervalPct: 45,
      evidenceBasis: 'modelled',
    });
    tiers.food_street_food!.sourceIds = [...budget.sourceIds, 'v6.1-compatibility:street-food-budget'];
    tiers.food_street_food!.modelVersions = [...budget.modelVersions, 'city-cost-v6-1-street-budget-compatibility-v1'];
    tiers.food_street_food!.imputedMeasures = ['food_street_food', ...budget.imputedMeasures];
  } else {
    const missing = FOOD_MEASURES.filter((measure) => !usableSource(input.anchors[measure]));
    missing.forEach((measure) => { missingness[measure] = input.anchors[measure]?.missingness ?? input.anchors[measure]?.status ?? 'not_found'; });
    fallbackCategory(tiers, foodTiers, priors, region, costBand, [...missing]);
  }

  if (sourceVectorComplete(input.anchors, DRINK_MEASURES)) {
    const coffee = input.anchors.cappuccino_1!;
    const beer = input.anchors.domestic_draft_beer_1!;
    const cocktailRelation = coefficient('cocktail_1');
    anchors.cocktail_1 = {
      valueAud: rounded(valueOf(coffee) * cocktailRelation.k),
      status: 'modelled',
      evidenceGrade: cocktailRelation.grade,
      intervalPct: cocktailRelation.intervalPct,
      sourceIds: [...(coffee.sourceIds ?? []), 'v6-coefficient:cocktail_1'],
      modelVersions: [...(coffee.modelVersions ?? []), `city-cost-v6-${cocktailRelation.provenance}`],
      imputedMeasures: ['cocktail_1', 'cappuccino_1'],
    };
    const drinkInputs = { ...input.anchors, cocktail_1: anchors.cocktail_1 };
    const coffeeValue = valueOf(coffee);
    const beerValue = valueOf(beer);
    const cocktailValue = valueOf(anchors.cocktail_1);
    tiers.drink_coffee = derivedTier({ tier: 'drink_coffee', amountAud: coffeeValue, formula: 'cappuccino_1', parents: ['cappuccino_1'], inputs: drinkInputs, evidenceBasis: 'observed' });
    tiers.drinks_none = derivedTier({ tier: 'drinks_none', amountAud: coffeeValue * 2, formula: '2 * cappuccino_1', parents: ['cappuccino_1'], inputs: drinkInputs, evidenceBasis: 'derived' });
    tiers.drinks_light = derivedTier({ tier: 'drinks_light', amountAud: coffeeValue * 2 + beerValue * 2, formula: '2 * cappuccino_1 + 2 * domestic_draft_beer_1', parents: ['cappuccino_1', 'domestic_draft_beer_1'], inputs: drinkInputs, evidenceBasis: 'derived' });
    tiers.drinks_moderate = derivedTier({ tier: 'drinks_moderate', amountAud: coffeeValue * 2 + beerValue * 4 + cocktailValue * 2, formula: '2 * cappuccino_1 + 4 * domestic_draft_beer_1 + 2 * cocktail_1', parents: ['cappuccino_1', 'domestic_draft_beer_1', 'cocktail_1'], inputs: drinkInputs, relationGrade: 'C', relationIntervalPct: cocktailRelation.intervalPct, evidenceBasis: 'derived' });
    tiers.drinks_heavy = derivedTier({ tier: 'drinks_heavy', amountAud: coffeeValue * 2 + beerValue * 6 + cocktailValue * 4, formula: '2 * cappuccino_1 + 6 * domestic_draft_beer_1 + 4 * cocktail_1', parents: ['cappuccino_1', 'domestic_draft_beer_1', 'cocktail_1'], inputs: drinkInputs, relationGrade: 'C', relationIntervalPct: cocktailRelation.intervalPct, evidenceBasis: 'derived' });
  } else {
    const missing = DRINK_MEASURES.filter((measure) => !usableSource(input.anchors[measure]));
    missing.forEach((measure) => { missingness[measure] = input.anchors[measure]?.missingness ?? input.anchors[measure]?.status ?? 'not_found'; });
    fallbackCategory(tiers, ['drink_coffee', 'drinks_none', 'drinks_light', 'drinks_moderate', 'drinks_heavy'], priors, region, costBand, [...missing]);
  }

  if (sourceVectorComplete(input.anchors, ACTIVITY_MEASURES)) {
    const budget = input.anchors.byt_activities_budget_per_person_day!;
    const mid = input.anchors.byt_activities_mid_per_person_day!;
    const high = input.anchors.byt_activities_high_per_person_day!;
    tiers.activities_free = {
      amountAud: 0,
      formula: '0 by definition',
      parentAnchors: [],
      missingAnchors: [],
      evidenceBasis: 'definitional',
      imputedMeasures: [],
      sourceIds: [],
      modelVersions: ['city-cost-v6-1-definition-v1'],
      evidenceGrade: 'definitional',
      interval: intervalFor(0, 0),
    };
    tiers.activities_budget = derivedTier({ tier: 'activities_budget', amountAud: valueOf(budget) * 2, formula: '2 * byt_activities_budget_per_person_day', parents: ['byt_activities_budget_per_person_day'], inputs: input.anchors, relationGrade: 'A', relationIntervalPct: 35, evidenceBasis: 'observed' });
    tiers.activities_mid_range = derivedTier({ tier: 'activities_mid_range', amountAud: valueOf(mid) * 2, formula: '2 * byt_activities_mid_per_person_day', parents: ['byt_activities_mid_per_person_day'], inputs: input.anchors, relationGrade: 'A', relationIntervalPct: 35, evidenceBasis: 'observed' });
    tiers.activities_high_end = derivedTier({ tier: 'activities_high_end', amountAud: valueOf(high) * 2, formula: '2 * byt_activities_high_per_person_day', parents: ['byt_activities_high_per_person_day'], inputs: input.anchors, relationGrade: 'A', relationIntervalPct: 35, evidenceBasis: 'observed' });
  } else {
    const missing = ACTIVITY_MEASURES.filter((measure) => !usableSource(input.anchors[measure]));
    missing.forEach((measure) => { missingness[measure] = input.anchors[measure]?.missingness ?? input.anchors[measure]?.status ?? 'not_found'; });
    tiers.activities_free = {
      amountAud: 0,
      formula: '0 by definition',
      parentAnchors: [],
      missingAnchors: [],
      evidenceBasis: 'definitional',
      imputedMeasures: [],
      sourceIds: [],
      modelVersions: ['city-cost-v6-1-definition-v1'],
      evidenceGrade: 'definitional',
      interval: intervalFor(0, 0),
    };
    fallbackCategory(tiers, ['activities_budget', 'activities_mid_range', 'activities_high_end'], priors, region, costBand, [...missing]);
  }

  const tiersAud = Object.fromEntries(V5_TIER_NAMES.map((tier) => [tier, tiers[tier]!])) as Record<V5TierName, V61Tier>;
  return {
    schemaVersion: 'city-cost-materialization-v6.1',
    methodologyVersion: 'v6.1',
    city: input.city,
    country: input.country,
    region,
    costBand,
    tiersAud,
    anchors,
    missingness,
    priorBasis: 'v6.1 direct source tier vectors with regional then global category-tier fallback; no shipping CSV inversion',
    complete: true,
    mappedEstimate: mapTiersToEstimateData(tiersAud),
  };
}
