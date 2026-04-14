export const COUNTRY_CURRENCY_CODES: Record<string, string> = {
  Argentina: 'ARS',
  Australia: 'AUD',
  Austria: 'EUR',
  Brazil: 'BRL',
  Bulgaria: 'BGN',
  Cambodia: 'USD',
  Canada: 'CAD',
  Chile: 'CLP',
  China: 'CNY',
  Colombia: 'COP',
  Croatia: 'EUR',
  Cuba: 'CUP',
  'Czech Republic': 'CZK',
  Denmark: 'DKK',
  Egypt: 'EGP',
  Ecuador: 'USD',
  Finland: 'EUR',
  France: 'EUR',
  Georgia: 'GEL',
  Germany: 'EUR',
  Greece: 'EUR',
  'Hong Kong': 'HKD',
  Hungary: 'HUF',
  Iceland: 'ISK',
  India: 'INR',
  Indonesia: 'IDR',
  Israel: 'ILS',
  Italy: 'EUR',
  Japan: 'JPY',
  Jordan: 'JOD',
  Kenya: 'KES',
  Laos: 'LAK',
  Malaysia: 'MYR',
  Mexico: 'MXN',
  Morocco: 'MAD',
  Myanmar: 'MMK',
  Nepal: 'NPR',
  Netherlands: 'EUR',
  'New Zealand': 'NZD',
  Peru: 'PEN',
  Philippines: 'PHP',
  Poland: 'PLN',
  Portugal: 'EUR',
  Romania: 'RON',
  Serbia: 'RSD',
  Singapore: 'SGD',
  'South Africa': 'ZAR',
  'South Korea': 'KRW',
  Spain: 'EUR',
  'Sri Lanka': 'LKR',
  Sweden: 'SEK',
  Taiwan: 'TWD',
  Tanzania: 'TZS',
  Thailand: 'THB',
  Turkey: 'TRY',
  UAE: 'AED',
  'United Kingdom': 'GBP',
  'United States': 'USD',
  Vietnam: 'VND',
};

export const COUNTRY_REGIONS: Record<string, string> = {
  Argentina: 'latin_america',
  Australia: 'oceania',
  Austria: 'europe',
  Brazil: 'latin_america',
  Bulgaria: 'europe',
  Cambodia: 'se_asia',
  Canada: 'north_america',
  Chile: 'latin_america',
  China: 'east_asia',
  Colombia: 'latin_america',
  Croatia: 'europe',
  Cuba: 'latin_america',
  'Czech Republic': 'europe',
  Denmark: 'europe',
  Egypt: 'middle_east',
  Ecuador: 'latin_america',
  Finland: 'europe',
  France: 'europe',
  Georgia: 'europe',
  Germany: 'europe',
  Greece: 'europe',
  'Hong Kong': 'east_asia',
  Hungary: 'europe',
  Iceland: 'europe',
  India: 'south_asia',
  Indonesia: 'se_asia',
  Israel: 'middle_east',
  Italy: 'europe',
  Japan: 'east_asia',
  Jordan: 'middle_east',
  Kenya: 'africa',
  Laos: 'se_asia',
  Malaysia: 'se_asia',
  Mexico: 'north_america',
  Morocco: 'africa',
  Myanmar: 'se_asia',
  Nepal: 'south_asia',
  Netherlands: 'europe',
  'New Zealand': 'oceania',
  Peru: 'latin_america',
  Philippines: 'se_asia',
  Poland: 'europe',
  Portugal: 'europe',
  Romania: 'europe',
  Serbia: 'europe',
  Singapore: 'se_asia',
  'South Africa': 'africa',
  'South Korea': 'east_asia',
  Spain: 'europe',
  'Sri Lanka': 'south_asia',
  Sweden: 'europe',
  Taiwan: 'east_asia',
  Tanzania: 'africa',
  Thailand: 'se_asia',
  Turkey: 'middle_east',
  UAE: 'middle_east',
  'United Kingdom': 'europe',
  'United States': 'north_america',
  Vietnam: 'se_asia',
};

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

export function getCountryCurrencyCode(countryName: string): string {
  const currencyCode = findKnownCountryCurrencyCode(countryName);
  if (!currencyCode) {
    throw new Error(`Missing currency code mapping for country: ${countryName}`);
  }

  return currencyCode;
}

export function findKnownCountryCurrencyCode(countryName: string | null | undefined): string | null {
  if (!countryName) return null;

  const trimmed = countryName.trim();
  if (!trimmed) return null;

  const exact = COUNTRY_CURRENCY_CODES[trimmed];
  if (exact) return exact;

  const normalizedLookup = slugifyId(trimmed);
  const matchedEntry = Object.entries(COUNTRY_CURRENCY_CODES).find(
    ([knownCountryName]) => slugifyId(knownCountryName) === normalizedLookup
  );

  return matchedEntry?.[1] ?? null;
}

export function findKnownCountryRegion(countryName: string | null | undefined): string | null {
  if (!countryName) return null;

  const trimmed = countryName.trim();
  if (!trimmed) return null;

  const exact = COUNTRY_REGIONS[trimmed];
  if (exact) return exact;

  const normalizedLookup = slugifyId(trimmed);
  const matchedEntry = Object.entries(COUNTRY_REGIONS).find(
    ([knownCountryName]) => slugifyId(knownCountryName) === normalizedLookup
  );

  return matchedEntry?.[1] ?? null;
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
