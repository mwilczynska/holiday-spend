import fs from 'node:fs/promises';
import path from 'node:path';
import countries from 'world-countries';

const APP_REGION_VALUES = [
  'latin_america',
  'north_america',
  'europe',
  'east_asia',
  'se_asia',
  'south_asia',
  'middle_east',
  'africa',
  'oceania',
];

const ROOT = process.cwd();
const overridesPath = path.join(ROOT, 'src', 'lib', 'data', 'country-metadata.overrides.json');
const outputPath = path.join(ROOT, 'src', 'lib', 'data', 'country-metadata.generated.json');

function slugifyId(value) {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

function toAsciiText(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickCanonicalName(values) {
  for (const value of values) {
    if (!value || typeof value !== 'string') continue;
    const normalized = toAsciiText(value);
    if (normalized) return normalized;
  }

  throw new Error('Could not determine an ASCII-safe canonical country name.');
}

function toAppRegion(region, subregion) {
  if (region === 'Europe') return 'europe';
  if (region === 'Africa') return 'africa';
  if (region === 'Oceania') return 'oceania';
  if (region === 'Americas') {
    return subregion === 'North America' ? 'north_america' : 'latin_america';
  }
  if (region === 'Asia') {
    if (subregion === 'South-Eastern Asia') return 'se_asia';
    if (subregion === 'Eastern Asia') return 'east_asia';
    if (subregion === 'Southern Asia') return 'south_asia';
    if (subregion === 'Western Asia' || subregion === 'Central Asia') return 'middle_east';
  }

  throw new Error(`Unsupported region mapping for ${region} / ${subregion ?? '<none>'}`);
}

function pickCurrencyCode(country, overrideCurrencyCode) {
  if (overrideCurrencyCode) return overrideCurrencyCode;

  const currencyCodes = Object.keys(country.currencies ?? {});
  if (currencyCodes.length === 0) {
    throw new Error(`No currency code available for ${country.name.common} (${country.cca3})`);
  }

  return currencyCodes[0];
}

function normalizeAliases(values, canonicalName) {
  const seen = new Set([slugifyId(canonicalName)]);
  const aliases = [];

  for (const value of values) {
    if (!value || typeof value !== 'string') continue;
    const trimmed = toAsciiText(value);
    if (!trimmed) continue;

    const lookupKey = slugifyId(trimmed);
    if (!lookupKey || seen.has(lookupKey)) continue;

    seen.add(lookupKey);
    aliases.push(trimmed);
  }

  aliases.sort((left, right) => left.localeCompare(right));
  return aliases;
}

function assertUnique(rows, key) {
  const seen = new Map();
  for (const row of rows) {
    const value = row[key];
    if (seen.has(value)) {
      throw new Error(`Duplicate ${key}: ${value} (${seen.get(value)} and ${row.iso3})`);
    }
    seen.set(value, row.iso3);
  }
}

async function main() {
  const overridesJson = await fs.readFile(overridesPath, 'utf8');
  const overrides = JSON.parse(overridesJson);
  const excludedIso3 = new Set(overrides.excludedIso3 ?? []);
  const overridesByIso3 = overrides.overridesByIso3 ?? {};

  const rows = countries
    .filter((country) => country.region !== 'Antarctic' && !excludedIso3.has(country.cca3))
    .map((country) => {
      const countryOverride = overridesByIso3[country.cca3] ?? {};
      const name = pickCanonicalName([
        countryOverride.name,
        country.name.common,
        country.name.official,
        ...(country.altSpellings ?? []),
      ]);
      const id = countryOverride.id ?? slugifyId(name);
      const region = countryOverride.region ?? toAppRegion(country.region, country.subregion);
      const currencyCode = pickCurrencyCode(country, countryOverride.currencyCode);

      if (!APP_REGION_VALUES.includes(region)) {
        throw new Error(`Invalid app region "${region}" for ${name} (${country.cca3})`);
      }

      const aliases = normalizeAliases(
        [
          country.name.common,
          country.name.official,
          ...(country.altSpellings ?? []),
          ...(countryOverride.aliases ?? []),
        ],
        name
      );

      return {
        id,
        name,
        aliases,
        currencyCode,
        region,
        iso2: country.cca2,
        iso3: country.cca3,
        source: 'generated',
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  assertUnique(rows, 'id');
  assertUnique(rows, 'name');
  assertUnique(rows, 'iso2');
  assertUnique(rows, 'iso3');

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');

  console.log(`Generated ${rows.length} country metadata rows at ${path.relative(ROOT, outputPath)}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
