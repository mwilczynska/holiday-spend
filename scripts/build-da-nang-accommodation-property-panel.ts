import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  classifyDaNangGeocodingAttempt,
  parseDaNangGeocodingJsonl,
  type DaNangGeocodingAttempt,
} from '../src/lib/da-nang-accommodation-geocoding';
import {
  ACCOMMODATION_HOTEL_PANEL_MEASURES,
  ACCOMMODATION_MIN_QUOTES_PER_SEASON,
  HOTEL_STAR_TO_MEASURE,
  accommodationPropertyPanelCollectionSchema,
  componentMedian,
  haversineDistanceKm,
  rankAccommodationProperties,
  summarizeAccommodationPropertyPanels,
  upsertAccommodationCityPanel,
  type AccommodationCityPanel,
  type AccommodationPanelProperty,
  type AccommodationPropertyPanelCollection,
} from '../src/lib/accommodation-property-panel';
import {
  ACCOMMODATION_PANEL_MEASURES,
  type AccommodationPanelMeasure,
} from '../src/lib/accommodation-reference-window';
import {
  vietnamAccommodationRegisterCaptureSchema,
  type VietnamAccommodationRegisterCapture,
} from '../src/lib/vietnam-accommodation-register';

const REGISTER_SHA256 = '1067ba95e95487413831b8f49efbb9d7761d10d7f63de1395e49a173de7524c6';
const GEOCODING_SHA256 = '36c615b66a1a2588d5d31e4bb6268a9b0b3dcc165edcbebc4475b6e5f839684c';
const LOCKED_AT = '2026-07-24T15:14:14.318Z';
const SCHEDULE_ID = 'accommodation-reference-2026-2027-v1';
const TARGET_PRIMARY_COUNT = 12;
const SEARCH_RADIUS_KM = 5;
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'data/reference/accommodation_property_panels_2026_2027.json'
);

type SourceRecord = VietnamAccommodationRegisterCapture['strata'][number]['records'][number] & {
  stars: 1 | 2 | 3 | 4;
};
type AcceptedAttempt = {
  attempt: DaNangGeocodingAttempt;
  classification: Extract<
    ReturnType<typeof classifyDaNangGeocodingAttempt>,
    { status: 'poi_name_match' | 'exact_house_address' }
  >;
};

function parseArgs() {
  const registerIndex = process.argv.indexOf('--register-snapshot');
  const geocodingIndex = process.argv.indexOf('--geocoding-checkpoint');
  if (
    registerIndex === -1 ||
    !process.argv[registerIndex + 1] ||
    geocodingIndex === -1 ||
    !process.argv[geocodingIndex + 1]
  ) {
    throw new Error(
      'Usage: tsx scripts/build-da-nang-accommodation-property-panel.ts --register-snapshot <snapshot.json> --geocoding-checkpoint <checkpoint.jsonl> [--write]'
    );
  }
  return {
    registerPath: path.resolve(process.argv[registerIndex + 1]),
    geocodingPath: path.resolve(process.argv[geocodingIndex + 1]),
    write: process.argv.includes('--write'),
  };
}

function sha256(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function round(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function localityParts(address: string) {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  return {
    locality: parts.length >= 2 ? parts[parts.length - 2] : null,
    municipality: parts.at(-1) ?? null,
  };
}

function measureFor(stars: number) {
  return HOTEL_STAR_TO_MEASURE[String(stars) as keyof typeof HOTEL_STAR_TO_MEASURE];
}

function acceptedIdentity(input: AcceptedAttempt) {
  const { osm_type: osmType, osm_id: osmId } = input.classification.result;
  if (!osmType || osmId === undefined) {
    throw new Error(`Accepted geocode for ${input.attempt.sourcePropertyId} lacks a stable OSM identity`);
  }
  return `${osmType}:${osmId}`;
}

function buildCityPanel(
  registerBuffer: Buffer,
  geocodingBuffer: Buffer
): AccommodationCityPanel {
  if (sha256(registerBuffer) !== REGISTER_SHA256 || sha256(geocodingBuffer) !== GEOCODING_SHA256) {
    throw new Error('Da Nang source artifacts do not match the frozen 24 July checkpoints');
  }
  const register = vietnamAccommodationRegisterCaptureSchema.parse(
    JSON.parse(registerBuffer.toString('utf8'))
  );
  const geocoding = parseDaNangGeocodingJsonl(geocodingBuffer.toString('utf8'));
  if (
    register.totalRecordCount !== 423 ||
    geocoding.attempts.length !== geocoding.manifest.queryCohortRecordCount ||
    geocoding.manifest.deferredAdministrativeReview.length !== 124
  ) {
    throw new Error('Da Nang source-universe or geocoding checkpoint counts drifted');
  }

  const sourceRecords: SourceRecord[] = register.strata.flatMap((stratum) =>
    stratum.records.map((record) => ({ ...record, stars: stratum.stars }))
  );
  const sourceById = new Map(sourceRecords.map((record) => [record.sourcePropertyId, record]));
  const attemptById = new Map(
    geocoding.attempts.map((attempt) => [attempt.sourcePropertyId, attempt])
  );
  const accepted = geocoding.attempts
    .map((attempt) => ({ attempt, classification: classifyDaNangGeocodingAttempt(attempt) }))
    .filter(
      (input): input is AcceptedAttempt =>
        input.classification.status === 'poi_name_match' ||
        input.classification.status === 'exact_house_address'
    );
  const acceptedGroups = new Map<string, AcceptedAttempt[]>();
  for (const input of accepted) {
    const key = acceptedIdentity(input);
    const group = acceptedGroups.get(key) ?? [];
    group.push(input);
    acceptedGroups.set(key, group);
  }
  for (const [key, group] of Array.from(acceptedGroups.entries())) {
    if (new Set(group.map((item) => item.attempt.stars)).size !== 1) {
      throw new Error(`OSM identity ${key} maps to conflicting official star classes`);
    }
  }

  const physicalGroups = Array.from(acceptedGroups.entries()).map(([identity, group]) => {
    const ordered = [...group].sort(
      (left, right) =>
        Number(right.classification.status === 'poi_name_match') -
          Number(left.classification.status === 'poi_name_match') ||
        Number(left.attempt.sourcePropertyId) - Number(right.attempt.sourcePropertyId)
    );
    return { identity, group: ordered, representative: ordered[0] };
  });
  if (accepted.length !== 52 || physicalGroups.length !== 50) {
    throw new Error('Da Nang accepted-geocode or physical-deduplication counts drifted');
  }
  const centreLatitude = componentMedian(
    physicalGroups.map(({ representative }) => Number(representative.classification.result.lat))
  );
  const centreLongitude = componentMedian(
    physicalGroups.map(({ representative }) => Number(representative.classification.result.lon))
  );

  const acceptedSourceIds = new Set(
    physicalGroups.flatMap(({ group }) => group.map(({ attempt }) => attempt.sourcePropertyId))
  );
  const geolocatedProperties: AccommodationPanelProperty[] = physicalGroups.map(
    ({ identity, group, representative }) => {
      const sourceIds = group
        .map(({ attempt }) => attempt.sourcePropertyId)
        .sort((left, right) => Number(left) - Number(right));
      const source = sourceById.get(representative.attempt.sourcePropertyId)!;
      const result = representative.classification.result;
      const latitude = Number(result.lat);
      const longitude = Number(result.lon);
      const distanceFromCentreKm = haversineDistanceKm(
        centreLatitude,
        centreLongitude,
        latitude,
        longitude
      );
      const { locality, municipality } = localityParts(source.address!);
      return {
        propertyId: `vnat-osm:VN:${identity}`,
        sourcePropertyId: sourceIds.join('+'),
        name: source.name,
        sourceStatus:
          group.length === 1
            ? `Government-managed register record; ${representative.classification.status}`
            : `${group.length} same-star register records collapsed to one OSM physical property; ${representative.classification.status}`,
        sourcePropertyType: 'Hotel',
        sourcePropertySubtype: `OpenStreetMap ${identity}`,
        sourceClassification: {
          scheme: 'Viet Nam National Authority of Tourism accommodation classification',
          value: `${source.stars} star`,
        },
        eligibleMeasures: [measureFor(source.stars)],
        address: {
          addressLine1: source.address,
          postalCode: null,
          locality,
          municipality,
        },
        capacity: null,
        latitude: round(latitude, 8),
        longitude: round(longitude, 8),
        distanceFromCentreKm: round(distanceFromCentreKm, 6),
        geographicDisposition:
          distanceFromCentreKm <= SEARCH_RADIUS_KM
            ? 'eligible_in_radius'
            : 'excluded_outside_radius',
        exclusionReason:
          distanceFromCentreKm <= SEARCH_RADIUS_KM
            ? null
            : `Accepted geocoding coordinates are more than ${SEARCH_RADIUS_KM} km from the frozen sampling-frame centre.`,
        officialWebsiteUrl: null,
        websiteVerificationStatus: 'pending',
      };
    }
  );

  const deferredIds = new Set(
    geocoding.manifest.deferredAdministrativeReview.map((record) => record.sourcePropertyId)
  );
  const missingProperties: AccommodationPanelProperty[] = sourceRecords
    .filter((record) => !acceptedSourceIds.has(record.sourcePropertyId))
    .map((record) => {
      const attempt = attemptById.get(record.sourcePropertyId);
      const classification = attempt ? classifyDaNangGeocodingAttempt(attempt) : null;
      const { locality, municipality } = localityParts(record.address!);
      const reason = deferredIds.has(record.sourcePropertyId)
        ? 'Official address identifies former Quang Nam or a remote merged ward. The record remains outside ranking until an administrative-boundary review proves its relationship to the central 5 km circle.'
        : classification?.status === 'coarse_or_ambiguous'
          ? 'The cached geocoder returned only coarse, conflicting, or otherwise ambiguous candidates; no property coordinate is accepted.'
          : 'The bounded primary and address-only geocoding queries returned no candidate; no property coordinate is accepted.';
      return {
        propertyId: `vnat:VN:${record.sourcePropertyId}`,
        sourcePropertyId: record.sourcePropertyId,
        name: record.name,
        sourceStatus: 'Government-managed register record; accepted geolocation unavailable',
        sourcePropertyType: 'Hotel',
        sourcePropertySubtype: null,
        sourceClassification: {
          scheme: 'Viet Nam National Authority of Tourism accommodation classification',
          value: `${record.stars} star`,
        },
        eligibleMeasures: [measureFor(record.stars)],
        address: {
          addressLine1: record.address,
          postalCode: null,
          locality,
          municipality,
        },
        capacity: null,
        latitude: null,
        longitude: null,
        distanceFromCentreKm: null,
        geographicDisposition: 'excluded_missing_official_geolocation',
        exclusionReason: reason,
        officialWebsiteUrl: null,
        websiteVerificationStatus: 'pending',
      };
    });

  const properties = [...geolocatedProperties, ...missingProperties];
  const measureOrder = new Map(
    ACCOMMODATION_PANEL_MEASURES.map((measure, index) => [measure, index])
  );
  properties.sort(
    (left, right) =>
      (measureOrder.get(left.eligibleMeasures[0]) ?? Number.MAX_SAFE_INTEGER) -
        (measureOrder.get(right.eligibleMeasures[0]) ?? Number.MAX_SAFE_INTEGER) ||
      (left.distanceFromCentreKm ?? Number.MAX_SAFE_INTEGER) -
        (right.distanceFromCentreKm ?? Number.MAX_SAFE_INTEGER) ||
      left.propertyId.localeCompare(right.propertyId)
  );
  const inRadius = geolocatedProperties.filter(
    (property) => property.geographicDisposition === 'eligible_in_radius'
  );
  const ranking = rankAccommodationProperties(inRadius, {
    scheduleId: SCHEDULE_ID,
    city: 'Da Nang',
    country: 'Vietnam',
    targetPrimaryCount: TARGET_PRIMARY_COUNT,
  });
  const measurePanels = ACCOMMODATION_PANEL_MEASURES.map((measure) => {
    if (!ACCOMMODATION_HOTEL_PANEL_MEASURES.includes(measure as never)) {
      return {
        measure,
        status: 'unavailable_no_unambiguous_registry_class' as const,
        eligibleInRadiusCount: 0,
        targetPrimaryCount: 0,
        rankedProperties: [],
        notes:
          'The official capture is filtered to nationally classified hotels and does not provide an unambiguous youth-hostel dorm/private inventory class.',
      };
    }
    const rankedProperties = ranking.get(measure) ?? [];
    const belowMinimum = rankedProperties.length < ACCOMMODATION_MIN_QUOTES_PER_SEASON;
    return {
      measure,
      status: belowMinimum
        ? ('frozen_below_quote_minimum' as const)
        : ('frozen_pending_website_verification' as const),
      eligibleInRadiusCount: rankedProperties.length,
      targetPrimaryCount: Math.min(TARGET_PRIMARY_COUNT, rankedProperties.length),
      rankedProperties,
      notes: belowMinimum
        ? `Only ${rankedProperties.length} accepted in-radius properties remain, below the five-quote minimum.`
        : `The accepted in-radius properties are ranked without price, brand, capacity, or website visibility. ${rankedProperties.length < TARGET_PRIMARY_COUNT ? `Only ${rankedProperties.length} properties have accepted coordinates, so the frozen primary panel is below the 12-property target but remains above the five-quote minimum.` : 'Official websites and public booking paths remain pending verification.'}`,
    };
  });

  const classCounts = Object.fromEntries(
    [1, 2, 3, 4].flatMap((stars) => {
      const measure = measureFor(stars);
      return [
        [`register${stars}StarRecords`, sourceRecords.filter((record) => record.stars === stars).length],
        [`accepted${stars}StarPhysicalProperties`, geolocatedProperties.filter((property) => property.eligibleMeasures.includes(measure)).length],
        [`inRadius${stars}StarPhysicalProperties`, inRadius.filter((property) => property.eligibleMeasures.includes(measure)).length],
      ];
    })
  );
  if (
    properties.length !== 421 ||
    geolocatedProperties.length !== 50 ||
    missingProperties.length !== 371 ||
    inRadius.length !== 49 ||
    geolocatedProperties.length - inRadius.length !== 1 ||
    classCounts.inRadius1StarPhysicalProperties !== 10 ||
    classCounts.inRadius2StarPhysicalProperties !== 8 ||
    classCounts.inRadius3StarPhysicalProperties !== 12 ||
    classCounts.inRadius4StarPhysicalProperties !== 19
  ) {
    throw new Error('Da Nang physical-property, geolocation, or radius counts drifted');
  }

  return {
    panelId: 'da-nang-accommodation-property-panel-2026-07-24-v1',
    city: 'Da Nang',
    country: 'Vietnam',
    region: 'SEA',
    status: 'sampling_frame_frozen_websites_pending',
    samplingFrame: {
      frameKind: 'official_register_join',
      joinKey:
        'Official stable property id is retained in each cached geocoding attempt; same-star records resolving to the same stable OSM identity are collapsed to one physical property.',
      inclusionCriteria: [
        'Official province filter is 48,49, accommodation type is Hotel, provenance is government-managed, and star class is exactly 1, 2, 3, or 4.',
        'A coordinate is accepted only for a name-matched lodging POI or an exact house-number plus road match in Da Nang.',
        'Same-star official records resolving to the same stable OSM object are collapsed before centre calculation and ranking.',
        `Accepted physical properties within ${SEARCH_RADIUS_KM} km of the component-wise median accepted-property centre are eligible for their official star measure.`,
      ],
      exclusionCriteria: [
        'Do not accept road, neighbourhood, district, or otherwise coarse centroids as property coordinates.',
        'Retain former Quang Nam and remote merged-ward records outside ranking until administrative-boundary evidence resolves them.',
        `Retain but mark accepted property coordinates beyond ${SEARCH_RADIUS_KM} km as outside-radius exclusions.`,
        'Do not use price, brand, capacity, geocoder result order, or website visibility in selection ranking.',
      ],
      centre: {
        method:
          'componentwise_median_of_50_deduplicated_name_matched_poi_or_exact_house_address_coordinates',
        latitude: round(centreLatitude, 8),
        longitude: round(centreLongitude, 8),
        inputPropertyCount: physicalGroups.length,
        searchRadiusKm: SEARCH_RADIUS_KM,
      },
      sources: [
        {
          sourceId: 'vnat-accommodation-register-da-nang-2026-07-24',
          publisher: 'Viet Nam National Authority of Tourism',
          datasetName: 'Vietnam tourism accommodation database, filtered Da Nang government-managed hotels',
          role: 'eligibility_and_classification',
          landingPageUrl: register.sourceUrl,
          dataUrl: register.sourceUrl,
          requestBody: JSON.stringify(register.filters),
          retrievedAt: register.capturedAt,
          sourceLastUpdatedAt: null,
          licenceName: 'No explicit licence shown; factual government-managed directory use with attribution',
          licenceUrl: null,
          rawRecordCount: register.totalRecordCount,
          rawByteCount: registerBuffer.length,
          rawSha256: REGISTER_SHA256,
        },
        {
          sourceId: 'osm-nominatim-da-nang-address-geocoding-2026-07-24',
          publisher: 'OpenStreetMap contributors / OpenStreetMap Foundation Nominatim service',
          datasetName: 'Cached one-time Da Nang hotel geocoding responses',
          role: 'geolocation',
          landingPageUrl: 'https://nominatim.org/',
          dataUrl: geocoding.manifest.serviceUrl,
          requestBody: JSON.stringify(geocoding.manifest.queryContract),
          retrievedAt: LOCKED_AT,
          sourceLastUpdatedAt: null,
          licenceName: 'Open Data Commons Open Database License (ODbL) 1.0',
          licenceUrl: 'https://www.openstreetmap.org/copyright',
          rawRecordCount: geocoding.attempts.length,
          rawByteCount: geocodingBuffer.length,
          rawSha256: GEOCODING_SHA256,
        },
      ],
      counts: {
        sourceRecordCount: register.totalRecordCount,
        sourceLodgingRecordCount: register.totalRecordCount,
        eligiblePropertyCount: properties.length,
        candidatePropertyCount: 0,
        geolocatedEligiblePropertyCount: geolocatedProperties.length,
        missingOfficialGeolocationCount: missingProperties.length,
        outsideRadiusCount: geolocatedProperties.length - inRadius.length,
        eligibleInRadiusCount: inRadius.length,
        sourceSpecificCounts: {
          registerFilteredRecords: register.totalRecordCount,
          geocodingQueryCohort: geocoding.manifest.queryCohortRecordCount,
          deferredAdministrativeBoundaryReview:
            geocoding.manifest.deferredAdministrativeReview.length,
          cachedGeocodingRequests: geocoding.attempts.reduce(
            (sum, attempt) => sum + attempt.requests.length,
            0
          ),
          nameMatchedLodgingPoiRecords: accepted.filter(
            (item) => item.classification.status === 'poi_name_match'
          ).length,
          exactHouseAddressRecords: accepted.filter(
            (item) => item.classification.status === 'exact_house_address'
          ).length,
          acceptedCoordinateRecordsBeforeDeduplication: accepted.length,
          acceptedPhysicalPropertiesAfterDeduplication: geolocatedProperties.length,
          duplicatePhysicalIdentityGroups: physicalGroups.filter(({ group }) => group.length > 1).length,
          acceptedPhysicalPropertiesOutsideRadius: geolocatedProperties.length - inRadius.length,
          ...classCounts,
        },
      },
    },
    measurePanels,
    properties,
  };
}

function mergeCollection(
  city: AccommodationCityPanel
): AccommodationPropertyPanelCollection {
  const collection = accommodationPropertyPanelCollectionSchema.parse(
    JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'))
  );
  return upsertAccommodationCityPanel(collection, city, LOCKED_AT);
}

function main() {
  const args = parseArgs();
  const city = buildCityPanel(
    fs.readFileSync(args.registerPath),
    fs.readFileSync(args.geocodingPath)
  );
  const collection = mergeCollection(city);
  const summary = summarizeAccommodationPropertyPanels(collection);
  if (args.write) {
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
    console.log(`Updated ${path.relative(process.cwd(), OUTPUT_PATH)}`);
  } else {
    console.log('Dry run only; pass --write to update the panel collection');
  }
  console.log(JSON.stringify(summary, null, 2));
}

main();
