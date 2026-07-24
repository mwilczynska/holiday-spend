import { describe, expect, it } from 'vitest';
import {
  deduplicateHotelstarsCompanies,
  hotelstarsCompanySchema,
} from './hotelstars-directory';

function company(input: {
  id: string;
  name?: string;
  category?: string;
  city?: string;
  latitude: number;
  longitude: number;
}) {
  return hotelstarsCompanySchema.parse({
    id: input.id,
    hotelName: input.name ?? 'Hotel Example',
    street: 'Main Street',
    streetNumber: '10',
    zip: '10000',
    city: input.city ?? 'Test City',
    catalogName: 'Hotel',
    hotelCategory: input.category ?? '3',
    superior: false,
    garni: null,
    countryCode: 'TS',
    website: 'example.test',
    location: { lat: input.latitude, lon: input.longitude },
  });
}

describe('Hotelstars physical-property deduplication', () => {
  it('merges duplicate identities without using source order', () => {
    const rows = [
      company({ id: '200', latitude: 50.0001, longitude: 14.0001 }),
      company({ id: '100', latitude: 50, longitude: 14 }),
    ];
    const first = deduplicateHotelstarsCompanies(rows, {
      countryCode: 'TS',
      coordinateToleranceKm: 0.25,
    });
    const reversed = deduplicateHotelstarsCompanies([...rows].reverse(), {
      countryCode: 'TS',
      coordinateToleranceKm: 0.25,
    });
    expect(first).toEqual(reversed);
    expect(first).toMatchObject({
      rawRecordCount: 2,
      physicalPropertyCount: 1,
      duplicateIdentityGroupCount: 1,
      coordinateConflictGroupCount: 0,
    });
    expect(first.properties[0]).toMatchObject({
      propertyId: 'hotelstars-union:TS:100',
      sourcePropertyIds: ['100', '200'],
      sourceRecordCount: 2,
      coordinatesConsistent: true,
      latitude: 50.00005,
      longitude: 14.00005,
    });
  });

  it('does not choose between materially conflicting official coordinates', () => {
    const result = deduplicateHotelstarsCompanies(
      [
        company({ id: '100', latitude: 50, longitude: 14 }),
        company({ id: '200', latitude: 51, longitude: 15 }),
      ],
      { countryCode: 'TS', coordinateToleranceKm: 0.25 }
    );
    expect(result.coordinateConflictGroupCount).toBe(1);
    expect(result.properties[0]).toMatchObject({
      latitude: null,
      longitude: null,
      coordinatesConsistent: false,
    });
  });

  it('fails closed when duplicate identities disagree on classification', () => {
    expect(() =>
      deduplicateHotelstarsCompanies(
        [
          company({ id: '100', category: '3', latitude: 50, longitude: 14 }),
          company({ id: '200', category: '4', latitude: 50, longitude: 14 }),
        ],
        { countryCode: 'TS', coordinateToleranceKm: 0.25 }
      )
    ).toThrow(/identity conflict/);
  });
});
