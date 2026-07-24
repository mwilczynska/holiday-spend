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

export const HOTEL_STAR_TO_MEASURE = {
  '1': 'hotel_1star_room_2p',
  '2': 'hotel_2star_room_2p',
  '3': 'hotel_3star_room_2p',
  '4': 'hotel_4star_room_2p',
} as const satisfies Record<string, AccommodationHotelPanelMeasure>;

export const ACCOMMODATION_MIN_QUOTES_PER_SEASON = 5;

const accommodationPanelMeasureSchema = z.enum(ACCOMMODATION_PANEL_MEASURES);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const sourceSchema = z.object({
  sourceId: z.string().min(1),
  publisher: z.string().min(1),
  datasetName: z.string().min(1),
  role: z.enum([
    'eligibility_and_classification',
    'geolocation',
    'eligibility_classification_and_geolocation',
    'candidate_universe',
    'inventory_and_geolocation',
  ]),
  landingPageUrl: z.string().url(),
  dataUrl: z.string().url(),
  requestBody: z.string().min(1).nullable(),
  retrievedAt: z.string().datetime(),
  sourceLastUpdatedAt: z.string().datetime().nullable(),
  licenceName: z.string().min(1),
  licenceUrl: z.string().url().nullable(),
  rawRecordCount: z.number().int().nonnegative(),
  rawByteCount: z.number().int().positive(),
  rawSha256: sha256Schema,
});

const centreSchema = z.object({
  method: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  inputPropertyCount: z.number().int().positive(),
  searchRadiusKm: z.number().positive(),
});

const propertySchema = z.object({
  propertyId: z.string().min(1),
  sourcePropertyId: z.string().min(1),
  name: z.string().min(1),
  sourceStatus: z.string().min(1),
  sourcePropertyType: z.string().min(1),
  sourcePropertySubtype: z.string().min(1).nullable(),
  sourceClassification: z.object({
    scheme: z.string().min(1),
    value: z.string().min(1),
  }),
  eligibleMeasures: z.array(accommodationPanelMeasureSchema),
  address: z.object({
    addressLine1: z.string().min(1).nullable(),
    postalCode: z.string().min(1).nullable(),
    locality: z.string().min(1).nullable(),
    municipality: z.string().min(1).nullable(),
  }),
  capacity: z.number().int().nonnegative().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  distanceFromCentreKm: z.number().nonnegative().nullable(),
  geographicDisposition: z.enum([
    'eligible_in_radius',
    'excluded_missing_official_geolocation',
    'excluded_outside_radius',
    'pending_inventory_verification',
    'pending_inventory_and_geolocation',
  ]),
  exclusionReason: z.string().min(1).nullable(),
  officialWebsiteUrl: z.string().url().nullable(),
  websiteVerificationStatus: z.enum([
    'pending',
    'source_listed_unverified',
    'verified',
  ]),
});

const rankedPropertySchema = z.object({
  propertyId: z.string().min(1),
  selectionHash: sha256Schema,
  selectionRank: z.number().int().positive(),
  disposition: z.enum(['primary', 'reserve']),
});

const measurePanelSchema = z.object({
  measure: accommodationPanelMeasureSchema,
  status: z.enum([
    'frozen_pending_website_verification',
    'frozen_below_quote_minimum',
    'candidate_universe_pending_inventory_verification',
    'unavailable_no_eligible_properties',
    'unavailable_no_unambiguous_registry_class',
  ]),
  eligibleInRadiusCount: z.number().int().nonnegative(),
  targetPrimaryCount: z.number().int().nonnegative(),
  rankedProperties: z.array(rankedPropertySchema),
  notes: z.string().min(1),
});

const cityPanelSchema = z.object({
  panelId: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  region: cityCostRegionSchema,
  status: z.literal('sampling_frame_frozen_websites_pending'),
  samplingFrame: z.object({
    frameKind: z.enum(['official_register_join', 'official_classification_directory']),
    joinKey: z.string().min(1).nullable(),
    inclusionCriteria: z.array(z.string().min(1)).min(1),
    exclusionCriteria: z.array(z.string().min(1)).min(1),
    centre: centreSchema,
    sources: z.array(sourceSchema).min(1),
    counts: z.object({
      sourceRecordCount: z.number().int().nonnegative(),
      sourceLodgingRecordCount: z.number().int().nonnegative(),
      eligiblePropertyCount: z.number().int().nonnegative(),
      candidatePropertyCount: z.number().int().nonnegative(),
      geolocatedEligiblePropertyCount: z.number().int().nonnegative(),
      missingOfficialGeolocationCount: z.number().int().nonnegative(),
      outsideRadiusCount: z.number().int().nonnegative(),
      eligibleInRadiusCount: z.number().int().nonnegative(),
      sourceSpecificCounts: z.record(z.string().min(1), z.number().int().nonnegative()),
    }),
  }),
  measurePanels: z.array(measurePanelSchema).length(ACCOMMODATION_PANEL_MEASURES.length),
  properties: z.array(propertySchema).min(1),
});

export const accommodationPropertyPanelCollectionSchema = z
  .object({
    schemaVersion: z.literal('accommodation-property-panels-v2'),
    collectionId: z.string().min(1),
    scheduleId: z.string().min(1),
    lockedAt: z.string().datetime(),
    protocol: z.object({
      targetPanelPropertiesPerMeasure: z.number().int().positive(),
      minimumAcceptedQuotesPerSeason: z.number().int().positive(),
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
    if (collection.protocol.minimumAcceptedQuotesPerSeason !== ACCOMMODATION_MIN_QUOTES_PER_SEASON) {
      context.addIssue({
        code: 'custom',
        path: ['protocol', 'minimumAcceptedQuotesPerSeason'],
        message: `The frozen methodology requires ${ACCOMMODATION_MIN_QUOTES_PER_SEASON} accepted quotes per season`,
      });
    }

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

      const sourceIds = new Set<string>();
      city.samplingFrame.sources.forEach((source, sourceIndex) => {
        if (sourceIds.has(source.sourceId)) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'samplingFrame', 'sources', sourceIndex, 'sourceId'],
            message: `Duplicate source id ${source.sourceId}`,
          });
        }
        sourceIds.add(source.sourceId);
      });
      const sourceRoles = new Set(city.samplingFrame.sources.map((source) => source.role));
      const sourceCoverageIsComplete =
        sourceRoles.has('eligibility_classification_and_geolocation') ||
        (sourceRoles.has('eligibility_and_classification') && sourceRoles.has('geolocation'));
      if (!sourceCoverageIsComplete) {
        context.addIssue({
          code: 'custom',
          path: ['cities', cityIndex, 'samplingFrame', 'sources'],
          message: 'A frozen frame requires classification plus geolocation evidence',
        });
      }

      const propertiesById = new Map<string, (typeof city.properties)[number]>();
      city.properties.forEach((property, propertyIndex) => {
        if (propertiesById.has(property.propertyId)) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex, 'propertyId'],
            message: `Duplicate property ${property.propertyId}`,
          });
        }
        propertiesById.set(property.propertyId, property);

        if (new Set(property.eligibleMeasures).size !== property.eligibleMeasures.length) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex, 'eligibleMeasures'],
            message: 'A property cannot repeat an eligible measure',
          });
        }

        const hasCoordinates = property.latitude !== null && property.longitude !== null;
        if (
          property.geographicDisposition === 'eligible_in_radius' &&
          (!hasCoordinates ||
            property.distanceFromCentreKm === null ||
            property.distanceFromCentreKm > collection.protocol.searchRadiusKm ||
            property.exclusionReason !== null ||
            property.eligibleMeasures.length === 0)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex],
            message: 'In-radius properties require coordinates, at least one measure, and no exclusion',
          });
        }
        if (
          property.geographicDisposition === 'excluded_outside_radius' &&
          (!hasCoordinates ||
            property.distanceFromCentreKm === null ||
            property.distanceFromCentreKm <= collection.protocol.searchRadiusKm ||
            property.exclusionReason === null ||
            property.eligibleMeasures.length === 0)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex],
            message: 'Outside-radius exclusions require coordinates, measures, and an exclusion reason',
          });
        }
        if (
          property.geographicDisposition === 'excluded_missing_official_geolocation' &&
          (hasCoordinates ||
            property.distanceFromCentreKm !== null ||
            property.exclusionReason === null ||
            property.eligibleMeasures.length === 0)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex],
            message: 'Missing-geolocation exclusions require measures, no coordinates, and a reason',
          });
        }
        if (
          property.geographicDisposition === 'pending_inventory_verification' &&
          (!hasCoordinates ||
            property.distanceFromCentreKm === null ||
            property.distanceFromCentreKm > collection.protocol.searchRadiusKm ||
            property.exclusionReason === null ||
            property.eligibleMeasures.length !== 0 ||
            property.officialWebsiteUrl === null)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex],
            message:
              'Inventory-pending candidates require in-radius coordinates, a reason, a listed website, and no inferred measures',
          });
        }
        if (
          property.geographicDisposition === 'pending_inventory_and_geolocation' &&
          (hasCoordinates ||
            property.distanceFromCentreKm !== null ||
            property.exclusionReason !== null ||
            property.eligibleMeasures.length !== 0 ||
            property.officialWebsiteUrl === null)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex],
            message: 'Pending candidates require a source-listed website but no inferred measures or coordinates',
          });
        }
        if (
          property.websiteVerificationStatus === 'pending' &&
          property.officialWebsiteUrl !== null
        ) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex, 'officialWebsiteUrl'],
            message: 'A listed website must be marked source-listed or verified',
          });
        }
        if (
          property.websiteVerificationStatus !== 'pending' &&
          property.officialWebsiteUrl === null
        ) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'properties', propertyIndex, 'officialWebsiteUrl'],
            message: 'Website evidence status requires a URL',
          });
        }
      });

      const eligibleProperties = city.properties.filter(
        (property) => property.eligibleMeasures.length > 0
      );
      const candidateProperties = city.properties.filter(
        (property) =>
          property.geographicDisposition === 'pending_inventory_verification' ||
          property.geographicDisposition === 'pending_inventory_and_geolocation'
      );
      const geolocatedEligible = eligibleProperties.filter(
        (property) => property.latitude !== null && property.longitude !== null
      );
      const missing = city.properties.filter(
        (property) => property.geographicDisposition === 'excluded_missing_official_geolocation'
      );
      const outside = city.properties.filter(
        (property) => property.geographicDisposition === 'excluded_outside_radius'
      );
      const inRadius = city.properties.filter(
        (property) => property.geographicDisposition === 'eligible_in_radius'
      );
      const counts = city.samplingFrame.counts;
      if (
        counts.sourceRecordCount < counts.sourceLodgingRecordCount ||
        counts.sourceLodgingRecordCount < city.properties.length ||
        counts.eligiblePropertyCount !== eligibleProperties.length ||
        counts.candidatePropertyCount !== candidateProperties.length ||
        counts.geolocatedEligiblePropertyCount !== geolocatedEligible.length ||
        counts.missingOfficialGeolocationCount !== missing.length ||
        counts.outsideRadiusCount !== outside.length ||
        counts.eligibleInRadiusCount !== inRadius.length
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
        const candidates = inRadius.filter((property) =>
          property.eligibleMeasures.includes(measure)
        );
        const seed = accommodationPropertySelectionSeed({
          scheduleId: collection.scheduleId,
          city: city.city,
          country: city.country,
          measure,
        });
        const expectedOrder = candidates
          .map((property) => ({
            propertyId: property.propertyId,
            selectionHash: accommodationPropertySelectionHash(seed, property.propertyId),
          }))
          .sort(
            (left, right) =>
              left.selectionHash.localeCompare(right.selectionHash) ||
              left.propertyId.localeCompare(right.propertyId)
          );
        const expectedPrimaryCount = Math.min(
          collection.protocol.targetPanelPropertiesPerMeasure,
          expectedOrder.length
        );
        const expectedRanked = expectedOrder.map((property, index) => ({
          ...property,
          selectionRank: index + 1,
          disposition: index < expectedPrimaryCount ? ('primary' as const) : ('reserve' as const),
        }));

        if (
          measurePanel.eligibleInRadiusCount !== candidates.length ||
          measurePanel.targetPrimaryCount !== expectedPrimaryCount ||
          JSON.stringify(measurePanel.rankedProperties) !== JSON.stringify(expectedRanked)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['cities', cityIndex, 'measurePanels'],
            message: `${measure} counts or ranking do not match sha256_ascending_v1`,
          });
        }

        if (candidates.length > 0) {
          const expectedStatus =
            candidates.length < collection.protocol.minimumAcceptedQuotesPerSeason
              ? 'frozen_below_quote_minimum'
              : 'frozen_pending_website_verification';
          if (measurePanel.status !== expectedStatus) {
            context.addIssue({
              code: 'custom',
              path: ['cities', cityIndex, 'measurePanels'],
              message: `${measure} status must reflect the frozen quote minimum`,
            });
          }
        } else {
          const zeroCandidateStatuses = [
            'candidate_universe_pending_inventory_verification',
            'unavailable_no_eligible_properties',
            'unavailable_no_unambiguous_registry_class',
          ];
          if (!zeroCandidateStatuses.includes(measurePanel.status)) {
            context.addIssue({
              code: 'custom',
              path: ['cities', cityIndex, 'measurePanels'],
              message: `${measure} has no ranked candidates and must state why`,
            });
          }
          if (
            measurePanel.status === 'candidate_universe_pending_inventory_verification' &&
            candidateProperties.length === 0
          ) {
            context.addIssue({
              code: 'custom',
              path: ['cities', cityIndex, 'measurePanels'],
              message: `${measure} claims a pending universe but has no retained candidates`,
            });
          }
        }

        for (const rankedProperty of measurePanel.rankedProperties) {
          if (!propertiesById.has(rankedProperty.propertyId)) {
            context.addIssue({
              code: 'custom',
              path: ['cities', cityIndex, 'measurePanels'],
              message: `${measure} references missing property ${rankedProperty.propertyId}`,
            });
          }
        }
      }
    });
  });

export type AccommodationPropertyPanelCollection = z.infer<
  typeof accommodationPropertyPanelCollectionSchema
>;
export type AccommodationCityPanel = AccommodationPropertyPanelCollection['cities'][number];
export type AccommodationPanelProperty = AccommodationCityPanel['properties'][number];

export function upsertAccommodationCityPanel(
  collection: AccommodationPropertyPanelCollection,
  city: AccommodationCityPanel,
  lockedAt: string
) {
  const cities = collection.cities
    .filter(
      (candidate) => !(candidate.city === city.city && candidate.country === city.country)
    )
    .concat(city)
    .sort(
      (left, right) =>
        left.city.localeCompare(right.city) || left.country.localeCompare(right.country)
    );
  return accommodationPropertyPanelCollectionSchema.parse({
    ...collection,
    lockedAt:
      collection.lockedAt.localeCompare(lockedAt) >= 0 ? collection.lockedAt : lockedAt,
    cities,
  });
}

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

export function accommodationPropertySelectionHash(seed: string, propertyId: string) {
  return createHash('sha256').update(`${seed}\u001f${propertyId}`, 'utf8').digest('hex');
}

export function rankAccommodationProperties<
  T extends { propertyId: string; eligibleMeasures: AccommodationPanelMeasure[] },
>(
  properties: T[],
  input: { scheduleId: string; city: string; country: string; targetPrimaryCount: number }
) {
  const output = new Map<
    AccommodationPanelMeasure,
    Array<{
      propertyId: string;
      selectionHash: string;
      selectionRank: number;
      disposition: 'primary' | 'reserve';
    }>
  >();
  for (const measure of ACCOMMODATION_PANEL_MEASURES) {
    const seed = accommodationPropertySelectionSeed({ ...input, measure });
    const ranked = properties
      .filter((property) => property.eligibleMeasures.includes(measure))
      .map((property) => ({
        propertyId: property.propertyId,
        selectionHash: accommodationPropertySelectionHash(seed, property.propertyId),
      }))
      .sort(
        (left, right) =>
          left.selectionHash.localeCompare(right.selectionHash) ||
          left.propertyId.localeCompare(right.propertyId)
      )
      .map((property, index) => ({
        ...property,
        selectionRank: index + 1,
        disposition: index < input.targetPrimaryCount ? ('primary' as const) : ('reserve' as const),
      }));
    output.set(measure, ranked);
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
  const ranked = panels.flatMap((panel) => panel.rankedProperties);
  return {
    collectionId: collection.collectionId,
    cities: collection.cities.length,
    frozenHotelPanels: panels.filter(
      (panel) =>
        ACCOMMODATION_HOTEL_PANEL_MEASURES.includes(
          panel.measure as AccommodationHotelPanelMeasure
        ) && panel.status.startsWith('frozen_')
    ).length,
    frozenHostelPanels: panels.filter(
      (panel) =>
        !ACCOMMODATION_HOTEL_PANEL_MEASURES.includes(
          panel.measure as AccommodationHotelPanelMeasure
        ) && panel.status.startsWith('frozen_')
    ).length,
    belowQuoteMinimumPanels: panels.filter(
      (panel) => panel.status === 'frozen_below_quote_minimum'
    ).length,
    unavailableHotelPanels: panels.filter(
      (panel) =>
        ACCOMMODATION_HOTEL_PANEL_MEASURES.includes(
          panel.measure as AccommodationHotelPanelMeasure
        ) && panel.status.startsWith('unavailable_')
    ).length,
    candidateHostelPanels: panels.filter(
      (panel) => panel.status === 'candidate_universe_pending_inventory_verification'
    ).length,
    unavailableHostelPanels: panels.filter(
      (panel) =>
        !ACCOMMODATION_HOTEL_PANEL_MEASURES.includes(
          panel.measure as AccommodationHotelPanelMeasure
        ) && panel.status.startsWith('unavailable_')
    ).length,
    eligibleSourceProperties: properties.filter(
      (property) => property.eligibleMeasures.length > 0
    ).length,
    candidateProperties: properties.filter(
      (property) =>
        property.geographicDisposition === 'pending_inventory_verification' ||
        property.geographicDisposition === 'pending_inventory_and_geolocation'
    ).length,
    eligibleInRadiusProperties: properties.filter(
      (property) => property.geographicDisposition === 'eligible_in_radius'
    ).length,
    primaryProperties: ranked.filter((property) => property.disposition === 'primary').length,
    reserveProperties: ranked.filter((property) => property.disposition === 'reserve').length,
    missingOfficialGeolocation: properties.filter(
      (property) => property.geographicDisposition === 'excluded_missing_official_geolocation'
    ).length,
    outsideRadius: properties.filter(
      (property) => property.geographicDisposition === 'excluded_outside_radius'
    ).length,
    websitesSourceListed: properties.filter(
      (property) => property.websiteVerificationStatus === 'source_listed_unverified'
    ).length,
    websitesVerified: properties.filter(
      (property) => property.websiteVerificationStatus === 'verified'
    ).length,
  };
}
