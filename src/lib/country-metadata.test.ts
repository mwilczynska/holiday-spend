import { describe, expect, it } from 'vitest';
import {
  APP_REGION_VALUES,
  CountryMetadataResolutionError,
  KNOWN_COUNTRIES,
  findExistingCountryForCanonical,
  findKnownCountryById,
  findKnownCountryMetadata,
  resolveCountryCreationDefaults,
  slugifyId,
} from '@/lib/country-metadata';

describe('canonical country metadata', () => {
  it('has unique ids, names, lookup keys, and valid required fields', () => {
    const ids = new Set<string>();
    const names = new Set<string>();
    const lookupKeys = new Map<string, string>();
    const validRegions = new Set(APP_REGION_VALUES);

    for (const country of KNOWN_COUNTRIES) {
      expect(country.id).toBeTruthy();
      expect(country.name).toBeTruthy();
      expect(country.currencyCode).toMatch(/^[A-Z]{3}$/);
      expect(validRegions.has(country.region)).toBe(true);

      expect(ids.has(country.id)).toBe(false);
      expect(names.has(country.name)).toBe(false);
      ids.add(country.id);
      names.add(country.name);

      const keys = [country.id, country.name, country.iso2, country.iso3, ...country.aliases];
      for (const key of keys) {
        const normalizedKey = slugifyId(key);
        expect(normalizedKey).toBeTruthy();

        const existing = lookupKeys.get(normalizedKey);
        if (existing) {
          expect(existing).toBe(country.id);
          continue;
        }

        lookupKeys.set(normalizedKey, country.id);
      }
    }

    expect(KNOWN_COUNTRIES.length).toBeGreaterThan(200);
  });

  it('resolves canonical countries by alias, iso code, and canonical id', () => {
    expect(findKnownCountryMetadata('UK')?.id).toBe('united-kingdom');
    expect(findKnownCountryMetadata('usa')?.id).toBe('united-states');
    expect(findKnownCountryMetadata('Czechia')?.id).toBe('czech-republic');
    expect(findKnownCountryMetadata('AE')?.id).toBe('united-arab-emirates');
    expect(findKnownCountryById('united-arab-emirates')?.name).toBe('United Arab Emirates');
  });

  it('returns canonical insert defaults from aliases and ids', () => {
    expect(resolveCountryCreationDefaults({ name: 'UAE' })).toEqual({
      canonical: expect.objectContaining({
        id: 'united-arab-emirates',
        name: 'United Arab Emirates',
        currencyCode: 'AED',
        region: 'middle_east',
      }),
      dbInsert: {
        id: 'united-arab-emirates',
        name: 'United Arab Emirates',
        currencyCode: 'AED',
        region: 'middle_east',
      },
    });

    expect(resolveCountryCreationDefaults({ id: 'GB' })?.dbInsert).toEqual({
      id: 'united-kingdom',
      name: 'United Kingdom',
      currencyCode: 'GBP',
      region: 'europe',
    });
  });

  it('returns null for unknown countries and throws on conflicting canonical matches', () => {
    expect(resolveCountryCreationDefaults({ name: 'Atlantis' })).toBeNull();

    expect(() =>
      resolveCountryCreationDefaults({
        id: 'united-kingdom',
        name: 'United States',
      })
    ).toThrow(CountryMetadataResolutionError);
  });

  it('reuses legacy-equivalent country rows instead of forcing duplicate canonical inserts', () => {
    const existing = findExistingCountryForCanonical(
      [
        {
          id: 'uae',
          name: 'United Arab Emirates',
        },
      ],
      { id: 'united-arab-emirates' }
    );

    expect(existing?.canonical.id).toBe('united-arab-emirates');
    expect(existing?.existing).toEqual({
      id: 'uae',
      name: 'United Arab Emirates',
    });
    expect(existing?.dbInsert).toEqual({
      id: 'united-arab-emirates',
      name: 'United Arab Emirates',
      currencyCode: 'AED',
      region: 'middle_east',
    });
  });
});
