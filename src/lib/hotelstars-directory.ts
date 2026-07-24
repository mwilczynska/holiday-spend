import { z } from 'zod';
import { componentMedian, haversineDistanceKm } from './accommodation-property-panel';

export const hotelstarsCompanySchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  hotelName: z.string().min(1),
  street: z.string(),
  streetNumber: z.string(),
  zip: z.string(),
  city: z.string(),
  catalogName: z.string().min(1),
  hotelCategory: z.union([z.string(), z.number()]).transform(String),
  superior: z.boolean().nullable().transform(Boolean),
  garni: z.boolean().nullable().transform(Boolean),
  countryCode: z.string().length(2),
  website: z.string(),
  location: z.object({
    lat: z.union([z.string(), z.number()]).transform(Number),
    lon: z.union([z.string(), z.number()]).transform(Number),
  }),
});

export const hotelstarsResponseSchema = z.object({
  companies: z.array(hotelstarsCompanySchema),
});

export type HotelstarsCompany = z.infer<typeof hotelstarsCompanySchema>;

export type HotelstarsPhysicalProperty = {
  propertyId: string;
  sourcePropertyIds: string[];
  representative: HotelstarsCompany;
  sourceRecordCount: number;
  latitude: number | null;
  longitude: number | null;
  maximumCoordinateSpreadKm: number | null;
  coordinatesConsistent: boolean;
};

function normalizeIdentityPart(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

export function hotelstarsPhysicalIdentity(company: HotelstarsCompany) {
  return [company.hotelName, company.street, company.streetNumber, company.zip]
    .map(normalizeIdentityPart)
    .join('\u001f');
}

function compareSourceIds(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isSafeInteger(leftNumber) && Number.isSafeInteger(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
}

function maximumCoordinateSpreadKm(companies: HotelstarsCompany[]) {
  let maximum = 0;
  for (let leftIndex = 0; leftIndex < companies.length; leftIndex += 1) {
    const left = companies[leftIndex].location;
    if (
      !Number.isFinite(left.lat) ||
      !Number.isFinite(left.lon) ||
      left.lat < -90 ||
      left.lat > 90 ||
      left.lon < -180 ||
      left.lon > 180
    ) {
      return null;
    }
    for (let rightIndex = leftIndex + 1; rightIndex < companies.length; rightIndex += 1) {
      const right = companies[rightIndex].location;
      if (
        !Number.isFinite(right.lat) ||
        !Number.isFinite(right.lon) ||
        right.lat < -90 ||
        right.lat > 90 ||
        right.lon < -180 ||
        right.lon > 180
      ) {
        return null;
      }
      maximum = Math.max(
        maximum,
        haversineDistanceKm(left.lat, left.lon, right.lat, right.lon)
      );
    }
  }
  return maximum;
}

/**
 * Collapses duplicate Hotelstars rows into physical properties without using price.
 * Identity is the normalized name + street + number + postcode tuple. A group is
 * rejected if the duplicate rows disagree on class or city. Coordinates are merged
 * with a component-wise median only when their maximum pairwise spread is within the
 * supplied tolerance; wider conflicts remain visibly ungeolocated.
 */
export function deduplicateHotelstarsCompanies(
  companies: HotelstarsCompany[],
  input: { countryCode: string; coordinateToleranceKm: number }
) {
  const wrongCountry = companies.find((company) => company.countryCode !== input.countryCode);
  if (wrongCountry) {
    throw new Error(
      `Hotelstars row ${wrongCountry.id} has country ${wrongCountry.countryCode}; expected ${input.countryCode}`
    );
  }

  const grouped = new Map<string, HotelstarsCompany[]>();
  for (const company of companies) {
    const identity = hotelstarsPhysicalIdentity(company);
    grouped.set(identity, [...(grouped.get(identity) ?? []), company]);
  }

  let duplicateIdentityGroupCount = 0;
  let coordinateConflictGroupCount = 0;
  const properties: HotelstarsPhysicalProperty[] = [];
  for (const group of Array.from(grouped.values())) {
    const ordered = [...group].sort((left, right) => compareSourceIds(left.id, right.id));
    if (ordered.length > 1) duplicateIdentityGroupCount += 1;

    const categories = new Set(ordered.map((company) => company.hotelCategory));
    const cities = new Set(ordered.map((company) => normalizeIdentityPart(company.city)));
    if (categories.size !== 1 || cities.size !== 1) {
      throw new Error(
        `Hotelstars physical identity conflict for ${ordered[0].hotelName}: ids ${ordered
          .map((company) => company.id)
          .join(', ')}`
      );
    }

    const maximumSpread = maximumCoordinateSpreadKm(ordered);
    const coordinatesConsistent =
      maximumSpread !== null && maximumSpread <= input.coordinateToleranceKm;
    if (!coordinatesConsistent) coordinateConflictGroupCount += 1;

    properties.push({
      propertyId: `hotelstars-union:${input.countryCode}:${ordered[0].id}`,
      sourcePropertyIds: ordered.map((company) => company.id),
      representative: ordered[0],
      sourceRecordCount: ordered.length,
      latitude: coordinatesConsistent
        ? componentMedian(ordered.map((company) => company.location.lat))
        : null,
      longitude: coordinatesConsistent
        ? componentMedian(ordered.map((company) => company.location.lon))
        : null,
      maximumCoordinateSpreadKm: maximumSpread,
      coordinatesConsistent,
    });
  }

  properties.sort((left, right) => left.propertyId.localeCompare(right.propertyId));
  return {
    properties,
    rawRecordCount: companies.length,
    physicalPropertyCount: properties.length,
    duplicateIdentityGroupCount,
    coordinateConflictGroupCount,
  };
}
