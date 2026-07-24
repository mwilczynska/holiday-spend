import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import {
  ACCOMMODATION_HOTEL_PANEL_MEASURES,
  BARCELONA_REGISTRY_CATEGORY_TO_MEASURE,
  accommodationPropertyPanelCollectionSchema,
  componentMedian,
  haversineDistanceKm,
  rankAccommodationProperties,
  summarizeAccommodationPropertyPanels,
  upsertAccommodationCityPanel,
  type AccommodationPanelProperty,
  type AccommodationPropertyPanelCollection,
} from '../src/lib/accommodation-property-panel';
import { ACCOMMODATION_PANEL_MEASURES } from '../src/lib/accommodation-reference-window';

const REGISTER_SHA256 = '06c2f4dadbfc28f156c98c29479af75e78cd111922875bd36157a87ce2e8a2b2';
const CKAN_SHA256 = 'f25726a8d06b177042e8e841bd4b1b88055faa0dbe49952878df5789b603520d';
const REGISTER_RETRIEVED_AT = '2026-07-24T06:45:17.000Z';
const CKAN_RETRIEVED_AT = '2026-07-24T06:50:00.000Z';
const LOCKED_AT = '2026-07-24T06:53:00.000Z';
const SCHEDULE_ID = 'accommodation-reference-2026-2027-v1';
const TARGET_PRIMARY_COUNT = 12;
const SEARCH_RADIUS_KM = 5;
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'data/reference/accommodation_property_panels_2026_2027.json'
);
const CKAN_DATA_URL =
  'https://opendata-ajuntament.barcelona.cat/data/api/action/datastore_search?resource_id=9bccce1b-0b9d-4cc6-94a7-459cb99450de&limit=1000';

type CataloniaRegisterRow = {
  'Tipus establiment': string;
  'Número inscripció': string;
  Rètol: string;
  Estat: string;
  'Tipus de via': string;
  'Nom de la via': string;
  Número: string;
  'Codi Postal': string;
  Municipi: string;
  Grup: string;
  Modalitat: string;
  Categoria: keyof typeof BARCELONA_REGISTRY_CATEGORY_TO_MEASURE | string;
  'Total places': string;
};

type BarcelonaGeoRecord = {
  name: string;
  geo_epgs_4326_lat: string | null;
  geo_epgs_4326_lon: string | null;
};

type CkanResponse = {
  success: boolean;
  result: {
    total: number;
    records: BarcelonaGeoRecord[];
  };
};

function parseArgs() {
  const registerIndex = process.argv.indexOf('--register-csv');
  const geolocationIndex = process.argv.indexOf('--geolocation-json');
  if (
    registerIndex === -1 ||
    !process.argv[registerIndex + 1] ||
    geolocationIndex === -1 ||
    !process.argv[geolocationIndex + 1]
  ) {
    throw new Error(
      'Usage: tsx scripts/build-barcelona-accommodation-property-panel.ts --register-csv <downloaded CSV> --geolocation-json <downloaded JSON> [--write]'
    );
  }
  return {
    registerPath: path.resolve(process.argv[registerIndex + 1]),
    geolocationPath: path.resolve(process.argv[geolocationIndex + 1]),
    write: process.argv.includes('--write'),
  };
}

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex');
}

function nullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function nullableInteger(value: string | null | undefined) {
  const trimmed = nullable(value);
  if (trimmed === null) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function round(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function isRegistryCategory(
  value: string
): value is keyof typeof BARCELONA_REGISTRY_CATEGORY_TO_MEASURE {
  return value in BARCELONA_REGISTRY_CATEGORY_TO_MEASURE;
}

function parseBarcelonaGeolocation(geolocationBuffer: Buffer) {
  const rawSha256 = sha256(geolocationBuffer);
  if (rawSha256 !== CKAN_SHA256) {
    throw new Error(
      `Barcelona geolocation checksum mismatch: expected ${CKAN_SHA256}, received ${rawSha256}. Freeze a new source version instead of overwriting this panel.`
    );
  }
  const parsed = JSON.parse(geolocationBuffer.toString('utf8')) as CkanResponse;
  if (!parsed.success || parsed.result.records.length !== parsed.result.total) {
    throw new Error(
      `Expected a complete CKAN response, received ${parsed.result.records.length} of ${parsed.result.total}`
    );
  }
  return {
    parsed,
    rawSha256,
    rawByteCount: geolocationBuffer.length,
  };
}

function buildCollection(registerPath: string, geolocationPath: string) {
  const registerBuffer = fs.readFileSync(registerPath);
  const registerHash = sha256(registerBuffer);
  if (registerHash !== REGISTER_SHA256) {
    throw new Error(
      `Register checksum mismatch: expected ${REGISTER_SHA256}, received ${registerHash}. Freeze a new source version instead of overwriting this panel.`
    );
  }
  const parsedCsv = Papa.parse<CataloniaRegisterRow>(registerBuffer.toString('utf8'), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsedCsv.errors.length > 0) {
    throw new Error(`Register CSV parse failed: ${JSON.stringify(parsedCsv.errors.slice(0, 5))}`);
  }
  const registerRows = parsedCsv.data;
  const activeBarcelonaRows = registerRows.filter(
    (row) => row.Municipi === 'Barcelona' && row.Estat === 'Alta'
  );
  const activeBarcelonaHotels = activeBarcelonaRows.filter(
    (row) => row['Tipus establiment'] === 'Hotels'
  );
  const eligibleRegisterRows = activeBarcelonaHotels.filter(
    (row) =>
      row.Grup === 'Hotel' && row.Modalitat === 'Hotel' && isRegistryCategory(row.Categoria)
  );

  const {
    parsed: geolocation,
    rawSha256: geolocationSha256,
    rawByteCount: geolocationByteCount,
  } = parseBarcelonaGeolocation(fs.readFileSync(geolocationPath));
  const geolocationByRegistrationId = new Map<string, BarcelonaGeoRecord>();
  for (const record of geolocation.result.records) {
    const match = record.name.match(/(HB-\d{6})/);
    if (match && !geolocationByRegistrationId.has(match[1])) {
      geolocationByRegistrationId.set(match[1], record);
    }
  }

  const joined = eligibleRegisterRows.flatMap((row) => {
    const registrationId = row['Número inscripció'];
    const record = geolocationByRegistrationId.get(registrationId);
    if (!record || record.geo_epgs_4326_lat === null || record.geo_epgs_4326_lon === null) return [];
    const latitude = Number(record.geo_epgs_4326_lat);
    const longitude = Number(record.geo_epgs_4326_lon);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [{ registrationId, latitude, longitude }]
      : [];
  });
  if (joined.length === 0) throw new Error('No eligible register rows joined to official coordinates');

  const centreLatitude = componentMedian(joined.map((property) => property.latitude));
  const centreLongitude = componentMedian(joined.map((property) => property.longitude));
  const joinedByRegistrationId = new Map(
    joined.map((property) => [property.registrationId, property])
  );

  const provisional = eligibleRegisterRows.map((row) => {
    const registrationId = row['Número inscripció'];
    const measure = BARCELONA_REGISTRY_CATEGORY_TO_MEASURE[
      row.Categoria as keyof typeof BARCELONA_REGISTRY_CATEGORY_TO_MEASURE
    ];
    const geocoded = joinedByRegistrationId.get(registrationId);
    const distanceFromCentreKm = geocoded
      ? haversineDistanceKm(
          centreLatitude,
          centreLongitude,
          geocoded.latitude,
          geocoded.longitude
        )
      : null;
    return {
      row,
      registrationId,
      measure,
      geocoded,
      distanceFromCentreKm,
      inRadius: distanceFromCentreKm !== null && distanceFromCentreKm <= SEARCH_RADIUS_KM,
    };
  });

  const properties: AccommodationPanelProperty[] = provisional.map((property) => {
    const missingGeolocation = !property.geocoded;
    const geographicDisposition = property.inRadius
      ? 'eligible_in_radius'
      : missingGeolocation
        ? 'excluded_missing_official_geolocation'
        : 'excluded_outside_radius';
    const addressLine1 = [
      nullable(property.row['Tipus de via']),
      nullable(property.row['Nom de la via']),
      nullable(property.row.Número),
    ]
      .filter((value): value is string => value !== null)
      .join(' ');
    return {
      propertyId: property.registrationId,
      sourcePropertyId: property.registrationId,
      name: property.row.Rètol.trim(),
      sourceStatus: 'Alta',
      sourcePropertyType: 'Hotels',
      sourcePropertySubtype: 'Hotel / Hotel',
      sourceClassification: {
        scheme: 'Catalonia Tourism Register hotel category',
        value: property.row.Categoria,
      },
      eligibleMeasures: [property.measure],
      address: {
        addressLine1: addressLine1 || null,
        postalCode: nullable(property.row['Codi Postal']),
        locality: 'Barcelona',
        municipality: 'Barcelona',
      },
      capacity: nullableInteger(property.row['Total places']),
      latitude: property.geocoded ? round(property.geocoded.latitude, 8) : null,
      longitude: property.geocoded ? round(property.geocoded.longitude, 8) : null,
      distanceFromCentreKm:
        property.distanceFromCentreKm === null ? null : round(property.distanceFromCentreKm, 6),
      geographicDisposition,
      exclusionReason: property.inRadius
        ? null
        : missingGeolocation
          ? 'No matching HB registration id with usable coordinates was present in the official Barcelona city hotels datastore snapshot.'
          : `Official coordinates are more than ${SEARCH_RADIUS_KM} km from the frozen sampling-frame centre.`,
      officialWebsiteUrl: null,
      websiteVerificationStatus: 'pending',
    };
  });

  const geographicDispositionOrder = {
    eligible_in_radius: 0,
    excluded_outside_radius: 2,
    excluded_missing_official_geolocation: 3,
    pending_inventory_verification: 4,
    pending_inventory_and_geolocation: 5,
    pending_website_and_inventory_verification: 6,
    excluded_candidate_outside_radius: 7,
  } as const;
  properties.sort(
    (left, right) =>
      ACCOMMODATION_HOTEL_PANEL_MEASURES.indexOf(
        left.eligibleMeasures[0] as (typeof ACCOMMODATION_HOTEL_PANEL_MEASURES)[number]
      ) -
        ACCOMMODATION_HOTEL_PANEL_MEASURES.indexOf(
          right.eligibleMeasures[0] as (typeof ACCOMMODATION_HOTEL_PANEL_MEASURES)[number]
        ) ||
      geographicDispositionOrder[left.geographicDisposition] -
        geographicDispositionOrder[right.geographicDisposition] ||
      (left.distanceFromCentreKm ?? Number.MAX_SAFE_INTEGER) -
        (right.distanceFromCentreKm ?? Number.MAX_SAFE_INTEGER) ||
      left.propertyId.localeCompare(right.propertyId)
  );

  const ranking = rankAccommodationProperties(
    properties.filter(
      (property) => property.geographicDisposition === 'eligible_in_radius'
    ),
    {
      scheduleId: SCHEDULE_ID,
      city: 'Barcelona',
      country: 'Spain',
      targetPrimaryCount: TARGET_PRIMARY_COUNT,
    }
  );

  const measurePanels = ACCOMMODATION_PANEL_MEASURES.map((measure) => {
    if (
      !ACCOMMODATION_HOTEL_PANEL_MEASURES.includes(
        measure as (typeof ACCOMMODATION_HOTEL_PANEL_MEASURES)[number]
      )
    ) {
      return {
        measure,
        status: 'unavailable_no_unambiguous_registry_class' as const,
        eligibleInRadiusCount: 0,
        targetPrimaryCount: 0,
        rankedProperties: [],
        notes:
          "The Catalonia hotel's 'Hostal o pensió' group is a lodging classification, not evidence of youth-hostel dorm or private-room inventory. A separate official youth-hostel frame is required.",
      };
    }
    const rankedProperties = ranking.get(measure) ?? [];
    return {
      measure,
      status: 'frozen_pending_website_verification' as const,
      eligibleInRadiusCount: rankedProperties.length,
      targetPrimaryCount: Math.min(TARGET_PRIMARY_COUNT, rankedProperties.length),
      rankedProperties,
      notes:
        'The primary twelve are selected without price or brand inputs. Website ownership and public booking access remain pending; unusable properties are replaced in the frozen reserve order.',
    };
  });

  const collection: AccommodationPropertyPanelCollection = {
    schemaVersion: 'accommodation-property-panels-v2',
    collectionId: 'accommodation-property-panels-2026-2027-v2',
    scheduleId: SCHEDULE_ID,
    lockedAt: LOCKED_AT,
    protocol: {
      targetPanelPropertiesPerMeasure: TARGET_PRIMARY_COUNT,
      minimumAcceptedQuotesPerSeason: 5,
      searchRadiusKm: SEARCH_RADIUS_KM,
      selectionAlgorithm: 'sha256_ascending_v1',
      selectionSeedTemplate:
        '{scheduleId}<US>{city}<US>{country}<US>{measure}<US>official-register-panel-v1',
      selectionRule:
        'Within each measure, sort the SHA-256 hash of the frozen unit-separator seed plus stable property id ascending; property id is the deterministic tie-break. Price, brand, capacity, and website visibility are not ranking inputs.',
      replacementRule:
        'Attempt primary properties in rank order. If a property has no verified official website, no public booking path, no comparable room, or no acceptable quote, record the failure and continue through the frozen reserve order without re-ranking.',
    },
    cities: [
      {
        panelId: 'barcelona-accommodation-property-panel-2026-07-24-v1',
        city: 'Barcelona',
        country: 'Spain',
        region: 'Europe',
        status: 'sampling_frame_frozen_websites_pending',
        samplingFrame: {
          frameKind: 'official_register_join',
          joinKey:
            'catalonia_tourism_register.Número inscripció == barcelona_city_hotels.name embedded HB registration id',
          inclusionCriteria: [
            "Catalonia register municipality equals 'Barcelona' and status equals 'Alta'.",
            "Establishment type equals 'Hotels', group equals 'Hotel', modality equals 'Hotel', and category is exactly 1, 2, 3, or 4 stars.",
            'Registration id joins to usable official Barcelona City Council latitude/longitude.',
            `Distance from the frozen component-wise median hotel centre is at most ${SEARCH_RADIUS_KM} km.`,
          ],
          exclusionCriteria: [
            "Exclude 'Hostal o pensió' because it does not establish youth-hostel dorm/private-room inventory.",
            'Exclude hotel apartments, 4-star superior, 5-star, and gran-luxe categories because they do not match a published measure.',
            'Retain but mark active eligible register rows missing official municipal coordinates as excluded from ranking.',
            `Retain but mark geocoded rows beyond ${SEARCH_RADIUS_KM} km as excluded from ranking.`,
          ],
          centre: {
            method:
              'componentwise_median_of_joined_active_1_to_4_star_hotel_coordinates',
            latitude: round(centreLatitude, 8),
            longitude: round(centreLongitude, 8),
            inputPropertyCount: joined.length,
            searchRadiusKm: SEARCH_RADIUS_KM,
          },
          sources: [
            {
              sourceId: 'catalonia-tourism-register-t2h3-cgys-2026-07-01',
              publisher: 'Generalitat de Catalunya',
              datasetName:
                'Establiments d’allotjament turístic inscrits al Registre de Turisme de Catalunya',
              role: 'eligibility_and_classification',
              landingPageUrl: 'https://analisi.transparenciacatalunya.cat/d/t2h3-cgys',
              dataUrl:
                'https://analisi.transparenciacatalunya.cat/api/v3/views/t2h3-cgys/export.csv?accessType=DOWNLOAD',
              requestBody: null,
              retrievedAt: REGISTER_RETRIEVED_AT,
              sourceLastUpdatedAt: '2026-07-01T22:00:00.000Z',
              licenceName: "Llicència oberta d’ús d'informació - Catalunya",
              licenceUrl:
                'https://web.gencat.cat/ca/generalitat/dades-indicadors/dades-obertes/llicencies',
              rawRecordCount: registerRows.length,
              rawByteCount: registerBuffer.length,
              rawSha256: registerHash,
            },
            {
              sourceId: 'barcelona-city-hotels-ckan-9bccce1b-2026-07-24',
              publisher: 'Ajuntament de Barcelona',
              datasetName: 'Hotels de la ciutat de Barcelona',
              role: 'geolocation',
              landingPageUrl:
                'https://opendata-ajuntament.barcelona.cat/data/en/dataset/allotjaments-hotels',
              dataUrl: CKAN_DATA_URL,
              requestBody: null,
              retrievedAt: CKAN_RETRIEVED_AT,
              sourceLastUpdatedAt: '2023-10-31T08:26:45.535Z',
              licenceName: 'Creative Commons Attribution 4.0',
              licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
              rawRecordCount: geolocation.result.total,
              rawByteCount: geolocationByteCount,
              rawSha256: geolocationSha256,
            },
          ],
          counts: {
            sourceRecordCount: registerRows.length,
            sourceLodgingRecordCount: activeBarcelonaRows.length,
            eligiblePropertyCount: eligibleRegisterRows.length,
            candidatePropertyCount: 0,
            geolocatedEligiblePropertyCount: joined.length,
            missingOfficialGeolocationCount: eligibleRegisterRows.length - joined.length,
            outsideRadiusCount: properties.filter(
              (property) => property.geographicDisposition === 'excluded_outside_radius'
            ).length,
            eligibleInRadiusCount: properties.filter(
              (property) => property.geographicDisposition === 'eligible_in_radius'
            ).length,
            sourceSpecificCounts: {
              activeBarcelonaAccommodationRows: activeBarcelonaRows.length,
              activeBarcelonaHotelRows: activeBarcelonaHotels.length,
              eligibleRegisterRows: eligibleRegisterRows.length,
              barcelonaCityGeolocationRows: geolocation.result.total,
            },
          },
        },
        measurePanels,
        properties,
      },
    ],
  };

  return accommodationPropertyPanelCollectionSchema.parse(collection);
}

async function main() {
  const args = parseArgs();
  const rebuilt = buildCollection(args.registerPath, args.geolocationPath);
  const barcelona = rebuilt.cities[0];
  let collection = rebuilt;
  if (fs.existsSync(OUTPUT_PATH)) {
    const existing = accommodationPropertyPanelCollectionSchema.parse(
      JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'))
    );
    collection = upsertAccommodationCityPanel(existing, barcelona, rebuilt.lockedAt);
  }
  const summary = summarizeAccommodationPropertyPanels(collection);
  if (args.write) {
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
