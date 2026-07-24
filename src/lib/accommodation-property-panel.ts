import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  ACCOMMODATION_PANEL_MEASURES,
  type AccommodationPanelMeasure,
} from './accommodation-reference-window';
import { cityCostRegionSchema } from './city-cost-collection-batch';

export const ACCOMMODATION_HOTEL_PANEL_MEASURES = [
  'hotel_1star_room_2p',
  'hotel_2star_room_2p',
  'hotel_3star_room_2p',
  'hotel_4star_room_2p',
] as const;

export type AccommodationHotelPanelMeasure =
  (typeof ACCOMMODATION_HOTEL_PANEL_MEASURES)[number];

export const BARCELONA_REGISTRY_CATEGORY_TO_MEASURE = {
  '1 estrella': 'hotel_1star_room_2p',
  '2 estrelles': 'hotel_2star_room_2p',
  '3 estrelles': 'hotel_3star_room_2p',
  '4 estrelles': 'hotel_4star_room_2p',
} as const satisfies Record<string, AccommodationHotelPanelMeasure>;

const accommodationPanelMeasureSchema = z.enum(ACCOMMODATION_PANEL_MEASURES);
const accommodationHotelPanelMeasureSchema = z.enum(ACCOMMODATION_HOTEL_PANEL_MEASURES);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const sourceSchema = z.object({
  sourceId: z.string().min(1),
  publisher: z.string().min(1),
  datasetName: z.string().min(1),
  role: z.enum(['eligibility_and_classification', 'geolocation']),
  landingPageUrl: z.string().url(),
  dataUrl: z.string().url(),
  retrievedAt: z.string().datetime(),
  sourceLastUpdatedAt: z.string().datetime().nullable(),
  licenceName: z.string().min(1),
  licenceUrl: z.string().url(),
  rawRecordCount: z.number().int().nonnegative(),
  rawSha256: sha256Schema,
});

const centreSchema = z.object({
  method: z.literal(
    'componentwise_median_of_joined_active_1_to_4_star_hotel_coordinates'
  ),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  inputPropertyCount: z.number().int().positive(),
  searchRadiusKm: z.number().positive(),
});

const propertySchema = z.object({
  registrationId: z.string().regex(/^HB-\d{6}$/),
  name: z.string().min(1),
  registryStatus: z.literal('Alta'),
  registryType: z.literal('Hotels'),
  registryGroup: z.literal('Hotel'),
  registryModality: z.literal('Hotel'),
  registryCategory: z.enum(['1 estrella', '2 estrelles', '3 estrelles', '4 estrelles']),
  measure: accommodationHotelPanelMeasureSchema,
  address: z.object({
    roadType: z.string().nullable(),
    roadName: z.string().nullable(),
    streetNumber: z.string().nullable(),
    postalCode: z.string().nullable(),
    municipality: z.literal('Barcelona'),
  }),
  totalPlaces: z.number().int().nonnegative().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  distanceFromCentreKm: z.number().nonnegative().nullable(),
  disposition: z.enum([
    'primary',
    'reserve',
    'excluded_missing_official_geolocation',
    'excluded_outside_radius',
  ]),
  exclusionReason: z.string().min(1).nullable(),
  selectionHash: sha256Schema.nullable(),
  selectionRank: z.number().int().positive().nullable(),
  officialWebsiteUrl: z.string().url().nullable(),
  websiteVerificationStatus: z.literal('pending'),
});

const measurePanelSchema = z.object({
  measure: accommodationPanelMeasureSchema,
  status: z.enum([
    'frozen_pending_website_verification',
    'unavailable_no_unambiguous_registry_class',
  ]),
  eligibleInRadiusCount: z.number().int().nonnegative(),
  targetPrimaryCount: z.number().int().nonnegative(),
  primaryRegistrationIds: z.array(z.string().regex(/^HB-\d{6}$/)),
  reserveRegistrationIds: z.array(z.string().regex(/^HB-\d{6}$/)),
  notes: z.string().min(1),
});

const cityPanelSchema = z.object({
  panelId: z.string().min(1),
  city: z.literal('Barcelona'),
  country: z.literal('Spain'),
  region: cityCostRegionSchema,
  status: z.literal('sampling_frame_frozen_websites_pending'),
  samplingFrame: z.object({
    joinKey: z.literal(
      'catalonia_tourism_register.Número inscripció == barcelona_city_hotels.name embedded HB registration id'
    ),
    inclusionCriteria: z.array(z.string().min(1)).min(1),
    exclusionCriteria: z.array(z.string().min(1)).min(1),
    centre: centreSchema,
    sources: z.array(sourceSchema).length(2),
    counts: z.object({
      activeBarcelonaAccommodationRows: z.number().int().nonnegative(),
      activeBarcelonaHotelRows: z.number().int().nonnegative(),
      eligibleRegisterRows: z.number().int().nonnegative(),
      joinedOfficialGeolocationRows: z.number().int().nonnegative(),
      missingOfficialGeolocationRows: z.number().int().nonnegative(),
      outsideRadiusRows: z.number().int().nonnegative(),
      eligibleInRadiusRows: z.number().int().nonnegative(),
    }),
  }),
  measurePanels: z.array(measurePanelSchema).length(ACCOMMODATION_PANEL_MEASURES.length),
  properties: z.array(propertySchema).min(1),
});

export const accommodationPropertyPanelCollectionSchema = z
  .object({
    schemaVersion: z.literal('accommodation-property-panels-v1'),
    collectionId: z.string().min(1),
    scheduleId: z.string().min(1),
    lockedAt: z.string().datetime(),
    protocol: z.object({
      targetPanelPropertiesPerMeasure: z.number().int().positive(),
      searchRadiusKm: z.number().positive(),
      selectionAlgorithm: z.literal('sha256_ascending_v1'),
      selectionSeedTemplate: z.literal(
        '{scheduleId}<US>{city}<US>{country}<US>{measure}<US>official-register-panel-v1'
      ),
      selectionRule: z.string().min(1),
      replacementRule: z.string().min(1),
    }),
    cities: z.array(cityPanelSchema).min(1),
  })
  .superRefine((collection, context) => {
    const panelIds = new Set<string>();
    collection.cities.forEach((city, cityIndex) => {
      if (panelIds.has(city.panelId)) {
        context.addIssue({
          code: 'custom',
          path: ['cities', cityIndex, 'panelId'],
          message: `Duplicate panel id ${city.panelId}`,
        });
      }
      panelIds.add(city.panelId);

      if (city.samplingFrame.centre.searchRadiusKm !== collection.protocol.searchRadiusKm) {
        context.addIssue({
          code: 'custom',
          path: ['cities', cityIndex, 'samplingFrame', 'centre', 'searchRadiusKm'],
          message: 'City search radius must equal the collection protocol radius',
        });
      }

      const sourcesByRole = new Map(city.samplingFrame.sources.map((source) => [source.role, source]));
      if (sourcesByRole.size !== 2) {
        context.addIssue({
          code: 'custom',
          path: ['cities', cityIndex, 'samplingFrame', 'sources'],
          message: 'Exactly one classification source and one geolocation source are required',
        });
      }

      const propertiesById = new Map<string, (typeof city.properties)[number]>();
      city.properties.forEach((property, propertyIndex) => {
        if (propertiesById.has(property.registrationId)) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex, 'registrationId'],
            message: `Duplicate property ${property.registrationId}`,
          });
        }
        propertiesById.set(property.registrationId, property);

        const expectedMeasure = BARCELONA_REGISTRY_CATEGORY_TO_MEASURE[property.registryCategory];
        if (property.measure !== expectedMeasure) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex, 'measure'],
            message: `${property.registryCategory} must map to ${expectedMeasure}`,
          });
        }

        const isRanked = property.disposition === 'primary' || property.disposition === 'reserve';
        const hasCoordinates = property.latitude !== null && property.longitude !== null;
        if (
          isRanked !==
          (hasCoordinates &&
            property.distanceFromCentreKm !== null &&
            property.selectionHash !== null &&
            property.selectionRank !== null)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex],
            message: 'Ranked properties require coordinates, distance, selection hash, and rank',
          });
        }
        if (isRanked && property.distanceFromCentreKm! > collection.protocol.searchRadiusKm) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex, 'distanceFromCentreKm'],
            message: 'A ranked property cannot be outside the search radius',
          });
        }
        if (
          property.disposition === 'excluded_missing_official_geolocation' &&
          (hasCoordinates || property.exclusionReason === null)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex],
            message: 'Missing-geolocation exclusions require no coordinates and an exclusion reason',
          });
        }
        if (
          property.disposition === 'excluded_outside_radius' &&
          (!hasCoordinates ||
            property.distanceFromCentreKm === null ||
            property.distanceFromCentreKm <= collection.protocol.searchRadiusKm ||
            property.exclusionReason === null)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex],
            message: 'Outside-radius exclusions require coordinates, distance, and an exclusion reason',
          });
        }
      });

      const ranked = city.properties.filter(
        (property) => property.disposition === 'primary' || property.disposition === 'reserve'
      );
      const missing = city.properties.filter(
        (property) => property.disposition === 'excluded_missing_official_geolocation'
      );
      const outside = city.properties.filter(
        (property) => property.disposition === 'excluded_outside_radius'
      );
      const counts = city.samplingFrame.counts;
      if (
        counts.eligibleRegisterRows !== city.properties.length ||
        counts.joinedOfficialGeolocationRows !== ranked.length + outside.length ||
        counts.missingOfficialGeolocationRows !== missing.length ||
        counts.outsideRadiusRows !== outside.length ||
        counts.eligibleInRadiusRows !== ranked.length
      ) {
        context.addIssue({
          code: 'custom',
          path: ['cities', cityIndex, 'samplingFrame', 'counts'],
          message: 'Sampling-frame counts do not reconcile to the retained property rows',
        });
      }

      const measurePanelMap = new Map(
        city.measurePanels.map((measurePanel) => [measurePanel.measure, measurePanel])
      );
      if (measurePanelMap.size !== ACCOMMODATION_PANEL_MEASURES.length) {
        context.addIssue({
          code: 'custom',
          path: ['cities', cityIndex, 'measurePanels'],
          message: 'Each accommodation measure must appear exactly once',
        });
      }

      for (const measure of ACCOMMODATION_PANEL_MEASURES) {
        const measurePanel = measurePanelMap.get(measure);
        if (!measurePanel) continue;
        const candidates = ranked
          .filter((property) => property.measure === measure)
          .sort((left, right) => left.selectionRank! - right.selectionRank!);
        const expectedRanks = candidates.map((_, index) => index + 1);
        if (
          JSON.stringify(candidates.map((property) => property.selectionRank)) !==
          JSON.stringify(expectedRanks)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties'],
            message: `${measure} selection ranks must be contiguous from one`,
          });
        }

        if (ACCOMMODATION_HOTEL_PANEL_MEASURES.includes(measure as AccommodationHotelPanelMeasure)) {
          const expectedPrimaryCount = Math.min(
            collection.protocol.targetPanelPropertiesPerMeasure,
            candidates.length
          );
          const seed = accommodationPropertySelectionSeed({
            scheduleId: collection.scheduleId,
            city: city.city,
            country: city.country,
            measure,
          });
          const expectedOrder = [...candidates]
            .map((property) => ({
              registrationId: property.registrationId,
              selectionHash: accommodationPropertySelectionHash(seed, property.registrationId),
            }))
            .sort(
              (left, right) =>
                left.selectionHash.localeCompare(right.selectionHash) ||
                left.registrationId.localeCompare(right.registrationId)
            );
          if (
            JSON.stringify(candidates.map((property) => property.registrationId)) !==
              JSON.stringify(expectedOrder.map((property) => property.registrationId)) ||
            candidates.some(
              (property, index) =>
                property.selectionHash !== expectedOrder[index].selectionHash ||
                property.disposition !== (index < expectedPrimaryCount ? 'primary' : 'reserve')
            )
          ) {
            context.addIssue({
              code: 'custom',
              path: ['cities', cityIndex, 'properties'],
              message: `${measure} property order, hashes, or dispositions do not match sha256_ascending_v1`,
            });
          }
          const expectedPrimaryIds = candidates
            .slice(0, expectedPrimaryCount)
            .map((property) => property.registrationId);
          const expectedReserveIds = candidates
            .slice(expectedPrimaryCount)
            .map((property) => property.registrationId);
          if (
            measurePanel.status !== 'frozen_pending_website_verification' ||
            measurePanel.eligibleInRadiusCount !== candidates.length ||
            measurePanel.targetPrimaryCount !== expectedPrimaryCount ||
            JSON.stringify(measurePanel.primaryRegistrationIds) !== JSON.stringify(expectedPrimaryIds) ||
            JSON.stringify(measurePanel.reserveRegistrationIds) !== JSON.stringify(expectedReserveIds)
          ) {
            context.addIssue({
              code: 'custom',
              path: ['cities', cityIndex, 'measurePanels'],
              message: `${measure} panel ids or counts do not match the deterministic property ranking`,
            });
          }
        } else if (
          measurePanel.status !== 'unavailable_no_unambiguous_registry_class' ||
          measurePanel.eligibleInRadiusCount !== 0 ||
          measurePanel.targetPrimaryCount !== 0 ||
          measurePanel.primaryRegistrationIds.length !== 0 ||
          measurePanel.reserveRegistrationIds.length !== 0
        ) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'measurePanels'],
            message: `${measure} must remain explicitly unavailable in this hotel-only register frame`,
          });
        }
      }
    });
  });

export type AccommodationPropertyPanelCollection = z.infer<
  typeof accommodationPropertyPanelCollectionSchema
>;
export type AccommodationPanelProperty = AccommodationPropertyPanelCollection['cities'][number]['properties'][number];

export function accommodationPropertySelectionSeed(input: {
  scheduleId: string;
  city: string;
  country: string;
  measure: AccommodationPanelMeasure;
}) {
  return [input.scheduleId, input.city, input.country, input.measure, 'official-register-panel-v1'].join(
    '\u001f'
  );
}

export function accommodationPropertySelectionHash(seed: string, registrationId: string) {
  return createHash('sha256').update(`${seed}\u001f${registrationId}`, 'utf8').digest('hex');
}

export function rankAccommodationProperties<
  T extends { registrationId: string; measure: AccommodationHotelPanelMeasure },
>(
  properties: T[],
  input: { scheduleId: string; city: string; country: string; targetPrimaryCount: number }
) {
  const output = new Map<
    string,
    { selectionHash: string; selectionRank: number; disposition: 'primary' | 'reserve' }
  >();
  for (const measure of ACCOMMODATION_HOTEL_PANEL_MEASURES) {
    const seed = accommodationPropertySelectionSeed({ ...input, measure });
    properties
      .filter((property) => property.measure === measure)
      .map((property) => ({
        property,
        selectionHash: accommodationPropertySelectionHash(seed, property.registrationId),
      }))
      .sort(
        (left, right) =>
          left.selectionHash.localeCompare(right.selectionHash) ||
          left.property.registrationId.localeCompare(right.property.registrationId)
      )
      .forEach((item, index) => {
        output.set(item.property.registrationId, {
          selectionHash: item.selectionHash,
          selectionRank: index + 1,
          disposition: index < input.targetPrimaryCount ? 'primary' : 'reserve',
        });
      });
  }
  return output;
}

export function componentMedian(values: number[]) {
  if (values.length === 0) throw new Error('Cannot calculate a median without values');
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[midpoint]
    : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

export function haversineDistanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
) {
  const radians = Math.PI / 180;
  const deltaLatitude = (latitude2 - latitude1) * radians;
  const deltaLongitude = (longitude2 - longitude1) * radians;
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1 * radians) *
      Math.cos(latitude2 * radians) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function summarizeAccommodationPropertyPanels(
  collectionInput: AccommodationPropertyPanelCollection
) {
  const collection = accommodationPropertyPanelCollectionSchema.parse(collectionInput);
  const properties = collection.cities.flatMap((city) => city.properties);
  const panels = collection.cities.flatMap((city) => city.measurePanels);
  return {
    collectionId: collection.collectionId,
    cities: collection.cities.length,
    frozenHotelPanels: panels.filter(
      (panel) => panel.status === 'frozen_pending_website_verification'
    ).length,
    unavailableHostelPanels: panels.filter(
      (panel) => panel.status === 'unavailable_no_unambiguous_registry_class'
    ).length,
    eligibleRegisterProperties: properties.length,
    eligibleInRadiusProperties: properties.filter(
      (property) => property.disposition === 'primary' || property.disposition === 'reserve'
    ).length,
    primaryProperties: properties.filter((property) => property.disposition === 'primary').length,
    reserveProperties: properties.filter((property) => property.disposition === 'reserve').length,
    missingOfficialGeolocation: properties.filter(
      (property) => property.disposition === 'excluded_missing_official_geolocation'
    ).length,
    outsideRadius: properties.filter(
      (property) => property.disposition === 'excluded_outside_radius'
    ).length,
    websitesVerified: properties.filter(
      (property) => property.officialWebsiteUrl !== null
    ).length,
  };
}
