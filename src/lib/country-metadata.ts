import countryMetadataRows from './data/country-metadata.generated.json';

export const APP_REGION_VALUES = [
  'latin_america',
  'north_america',
  'europe',
  'east_asia',
  'se_asia',
  'south_asia',
  'middle_east',
  'africa',
  'oceania',
] as const;

export type AppRegion = (typeof APP_REGION_VALUES)[number];

export type CountryMetadata = {
  id: string;
  name: string;
  aliases: string[];
  currencyCode: string;
  region: AppRegion;
  iso2: string;
  iso3: string;
  source: string;
};

const REGION_LABELS: Record<string, string> = {
  SEA: 'se_asia',
  'East Asia': 'east_asia',
  'South Asia': 'south_asia',
  'Middle East': 'middle_east',
  Africa: 'africa',
  Europe: 'europe',
  'Latin America': 'latin_america',
  'North America': 'north_america',
  Oceania: 'oceania',
};

function isAppRegion(value: string): value is AppRegion {
  return APP_REGION_VALUES.includes(value as AppRegion);
}

function normalizeCountryMetadataRows(rows: typeof countryMetadataRows): CountryMetadata[] {
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();
  const byIso2 = new Map<string, string>();
  const byIso3 = new Map<string, string>();

  return rows.map((row) => {
    if (!isAppRegion(row.region)) {
      throw new Error(`Invalid app region "${row.region}" in canonical country metadata for ${row.name}.`);
    }

    if (byId.has(row.id)) {
      throw new Error(`Duplicate country metadata id "${row.id}" for ${row.name} and ${byId.get(row.id)}.`);
    }
    if (byName.has(row.name)) {
      throw new Error(`Duplicate country metadata name "${row.name}".`);
    }
    if (byIso2.has(row.iso2)) {
      throw new Error(`Duplicate country metadata iso2 "${row.iso2}" for ${row.name} and ${byIso2.get(row.iso2)}.`);
    }
    if (byIso3.has(row.iso3)) {
      throw new Error(`Duplicate country metadata iso3 "${row.iso3}" for ${row.name} and ${byIso3.get(row.iso3)}.`);
    }

    byId.set(row.id, row.name);
    byName.set(row.name, row.name);
    byIso2.set(row.iso2, row.name);
    byIso3.set(row.iso3, row.name);

    return {
      id: row.id,
      name: row.name,
      aliases: [...row.aliases],
      currencyCode: row.currencyCode,
      region: row.region,
      iso2: row.iso2,
      iso3: row.iso3,
      source: row.source,
    };
  });
}

function registerLookupKey(lookup: Map<string, CountryMetadata>, rawKey: string, row: CountryMetadata) {
  const key = slugifyId(rawKey);
  if (!key) return;

  const existing = lookup.get(key);
  if (existing && existing.id !== row.id) {
    throw new Error(`Ambiguous country metadata lookup key "${rawKey}" for ${existing.name} and ${row.name}.`);
  }

  lookup.set(key, row);
}

const COUNTRY_METADATA = normalizeCountryMetadataRows(countryMetadataRows);

const COUNTRY_METADATA_BY_ID = new Map(COUNTRY_METADATA.map((row) => [row.id, row] as const));

const COUNTRY_METADATA_LOOKUP = (() => {
  const lookup = new Map<string, CountryMetadata>();

  for (const row of COUNTRY_METADATA) {
    registerLookupKey(lookup, row.id, row);
    registerLookupKey(lookup, row.name, row);
    registerLookupKey(lookup, row.iso2, row);
    registerLookupKey(lookup, row.iso3, row);

    for (const alias of row.aliases) {
      registerLookupKey(lookup, alias, row);
    }
  }

  return lookup;
})();

export const COUNTRY_CURRENCY_CODES: Record<string, string> = Object.fromEntries(
  COUNTRY_METADATA.map((row) => [row.name, row.currencyCode])
);

export const COUNTRY_REGIONS: Record<string, string> = Object.fromEntries(
  COUNTRY_METADATA.map((row) => [row.name, row.region])
);

export function getCountryCurrencyCode(countryName: string): string {
  const currencyCode = findKnownCountryCurrencyCode(countryName);
  if (!currencyCode) {
    throw new Error(`Missing currency code mapping for country: ${countryName}`);
  }

  return currencyCode;
}

export function findKnownCountryMetadata(input: string | null | undefined): CountryMetadata | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  return COUNTRY_METADATA_LOOKUP.get(slugifyId(trimmed)) ?? null;
}

export function findKnownCountryById(id: string | null | undefined): CountryMetadata | null {
  if (!id) return null;

  const trimmed = id.trim();
  if (!trimmed) return null;

  return COUNTRY_METADATA_BY_ID.get(slugifyId(trimmed)) ?? null;
}

export function findKnownCountryCurrencyCode(countryName: string | null | undefined): string | null {
  return findKnownCountryMetadata(countryName)?.currencyCode ?? null;
}

export function findKnownCountryRegion(countryName: string | null | undefined): string | null {
  return findKnownCountryMetadata(countryName)?.region ?? null;
}

export function normalizeRegionLabel(regionLabel: string | null | undefined): string | null {
  if (!regionLabel) return null;
  return REGION_LABELS[regionLabel] ?? slugifyId(regionLabel);
}

export function slugifyId(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}
