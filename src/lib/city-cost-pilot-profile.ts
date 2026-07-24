export const PILOT_TIER_NAMES = [
  'accom_shared_hostel_dorm', 'accom_hostel_private_room', 'accom_1_star', 'accom_2_star',
  'accom_3_star', 'accom_4_star', 'food_street_food', 'food_budget', 'food_mid_range',
  'food_high_end', 'drink_coffee', 'drinks_none', 'drinks_light', 'drinks_moderate',
  'drinks_heavy', 'activities_free', 'activities_budget', 'activities_mid_range',
  'activities_high_end',
] as const;

export type PilotProfileEnrichmentCity = {
  city: string;
  country: string;
  region: string;
  citySize: { status: string; band: string };
  tourismIntensity: { status: string; band: string; researchOutcome?: string };
  publicSourceDensity: { band: string };
};

export type PilotProfileMaterializedCity = {
  city: string;
  country: string;
  tiersAud: Record<string, { amountAud: number | null }>;
  complete: boolean;
};

type StratumRow = {
  stratum: string;
  cityCount: number;
  representedCityCount: number;
  materializedTierCells: number;
  requiredTierCells: number;
  coveragePct: number;
};

function key(city: string, country: string) {
  return `${city}\u0000${country}`;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function summarizeStrata(
  cities: PilotProfileEnrichmentCity[],
  materialized: Map<string, PilotProfileMaterializedCity>,
  stratum: (city: PilotProfileEnrichmentCity) => string
): StratumRow[] {
  const groups = new Map<string, PilotProfileEnrichmentCity[]>();
  for (const city of cities) {
    const name = stratum(city);
    groups.set(name, [...(groups.get(name) ?? []), city]);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, members]) => {
    const rows = members.map((city) => materialized.get(key(city.city, city.country))).filter(Boolean) as PilotProfileMaterializedCity[];
    const cells = rows.reduce((sum, row) => sum + PILOT_TIER_NAMES.filter((tier) => row.tiersAud[tier]?.amountAud != null).length, 0);
    const required = members.length * PILOT_TIER_NAMES.length;
    return {
      stratum: name,
      cityCount: members.length,
      representedCityCount: rows.length,
      materializedTierCells: cells,
      requiredTierCells: required,
      coveragePct: round((cells / required) * 100),
    };
  });
}

export function buildCityCostPilotProfile(
  enrichment: { enrichmentId: string; cities: PilotProfileEnrichmentCity[] },
  dataset: {
    calculatorVersion: string;
    dataCutoff: string;
    qualitySummary: Record<string, number>;
    cities: PilotProfileMaterializedCity[];
  }
) {
  const pilotKeys = new Set(enrichment.cities.map((city) => key(city.city, city.country)));
  const unexpected = dataset.cities.filter((city) => !pilotKeys.has(key(city.city, city.country)));
  const pilotMaterializedCities = dataset.cities.filter((city) => pilotKeys.has(key(city.city, city.country)));
  const materialized = new Map(pilotMaterializedCities.map((city) => [key(city.city, city.country), city]));
  const tierCoverage = Object.fromEntries(PILOT_TIER_NAMES.map((tier) => {
    const count = enrichment.cities.filter((city) => materialized.get(key(city.city, city.country))?.tiersAud[tier]?.amountAud != null).length;
    return [tier, { materializedCityCount: count, missingCityCount: enrichment.cities.length - count, coveragePct: round((count / enrichment.cities.length) * 100) }];
  }));
  const materializedTierCells = Object.values(tierCoverage).reduce((sum, row) => sum + row.materializedCityCount, 0);
  const requiredTierCells = enrichment.cities.length * PILOT_TIER_NAMES.length;
  const measuredCitySize = enrichment.cities.filter((city) => city.citySize.status === 'measured_from_public_source').length;
  const measuredTourism = enrichment.cities.filter((city) => city.tourismIntensity.status === 'measured_from_public_sources').length;
  const screenedRejectedTourism = enrichment.cities.filter((city) => city.tourismIntensity.researchOutcome === 'screened_no_compatible_value').length;
  const unscreenedTourism = enrichment.cities.filter((city) => city.tourismIntensity.researchOutcome === 'not_yet_screened').length;
  const measuredBoth = enrichment.cities.filter((city) => city.citySize.status === 'measured_from_public_source' && city.tourismIntensity.status === 'measured_from_public_sources').length;
  const completeCities = enrichment.cities.filter((city) => materialized.get(key(city.city, city.country))?.complete).length;

  return {
    schemaVersion: 'city-cost-pilot-profile-v2',
    enrichmentId: enrichment.enrichmentId,
    calculatorVersion: dataset.calculatorVersion,
    dataCutoff: dataset.dataCutoff,
    pilotCityCount: enrichment.cities.length,
    representedCityCount: pilotMaterializedCities.length,
    zeroMaterializedCityCount: enrichment.cities.length - pilotMaterializedCities.length,
    excludedNonPilotCities: unexpected.map((city) => ({ city: city.city, country: city.country })),
    materializedTierCells,
    requiredTierCells,
    materializedTierCoveragePct: round((materializedTierCells / requiredTierCells) * 100),
    completeCityCount: completeCities,
    tierCoverage,
    strata: {
      region: summarizeStrata(enrichment.cities, materialized, (city) => city.region),
      citySize: summarizeStrata(enrichment.cities, materialized, (city) => `${city.citySize.status}:${city.citySize.band}`),
      tourismIntensity: summarizeStrata(enrichment.cities, materialized, (city) =>
        city.tourismIntensity.status === 'measured_from_public_sources'
          ? `${city.tourismIntensity.status}:${city.tourismIntensity.band}`
          : `${city.tourismIntensity.status}:${city.tourismIntensity.band}:${city.tourismIntensity.researchOutcome ?? 'outcome_missing'}`
      ),
      sourceDensity: summarizeStrata(enrichment.cities, materialized, (city) => city.publicSourceDensity.band),
    },
    qualitySummary: dataset.qualitySummary,
    modelReadiness: {
      status: 'insufficient_for_fallback_model_selection',
      measuredCitySizeCount: measuredCitySize,
      measuredTourismIntensityCount: measuredTourism,
      screenedRejectedTourismIntensityCount: screenedRejectedTourism,
      unscreenedTourismIntensityCount: unscreenedTourism,
      measuredBothPredictorsCount: measuredBoth,
      completeTargetCityCount: completeCities,
      reasons: [
        'No pilot city has all 19 tier targets materialized.',
        'Accommodation has no eligible annualized tier values yet.',
        'Tourism intensity remains unmeasured for most pilot cities.',
        'Cross-channel disagreement cannot be estimated until overlapping independent source channels are collected.',
      ],
    },
  };
}
