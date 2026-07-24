import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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
import { hotelstarsResponseSchema } from '../src/lib/hotelstars-directory';

const HOTELSTARS_SHA256 = 'fa4d08b08fff6e90f1e7c9d2b6fdf5aac2b8e53f0e4cf25b129db77829336a63';
const HOTELSTARS_RETRIEVED_AT = '2026-07-24T07:23:48.123Z';
const HOTELSTARS_REQUEST_BODY =
  '{"hotelCategories":[1,2,3,4,5],"filters":[],"region":null,"sortDirection":"ASC","countryCodes":["DK"],"sortKey":"hotelName"}';
const HOSTEL_DIRECTORY_SHA256 =
  'e2a557b1239ad4baf8a3188fce1d8c8d7a5fa40b5a7e920f6c94990eab539996';
const HOSTEL_DIRECTORY_RETRIEVED_AT = '2026-07-24T07:22:41.357Z';
const LOCKED_AT = '2026-07-24T07:23:48.123Z';
const SCHEDULE_ID = 'accommodation-reference-2026-2027-v1';
const TARGET_PRIMARY_COUNT = 12;
const SEARCH_RADIUS_KM = 5;
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'data/reference/accommodation_property_panels_2026_2027.json'
);
const HOTELSTARS_LANDING_PAGE = 'https://www.hotelstars.eu/denmark/hotel-search';
const HOTELSTARS_DATA_URL = 'https://www.hotelstars.eu/search/proxy.php';
const HOSTEL_DIRECTORY_URL = 'https://www.visitcopenhagen.dk/node/1570';

const EXPECTED_HOSTELS = [
  'a&o Copenhagen Nørrebro',
  'a&o Copenhagen Sydhavn',
  'Bedwood Hostel',
  'Copenhagen Backpackers',
  'Copenhagen Downtown Hostel',
  'Generator Copenhagen',
  'Globalhagen Hostel',
  'Hostel Belægningen',
  'Lyngby Hostel',
  'Sleep in Heaven',
  'Urban Camper Hostel',
  'Urban House Copenhagen by MEININGER',
  'Woodah Hostel',
] as const;

function parseArgs() {
  const hotelstarsIndex = process.argv.indexOf('--hotelstars-json');
  const hostelsIndex = process.argv.indexOf('--hostels-html');
  if (
    hotelstarsIndex === -1 ||
    !process.argv[hotelstarsIndex + 1] ||
    hostelsIndex === -1 ||
    !process.argv[hostelsIndex + 1]
  ) {
    throw new Error(
      'Usage: tsx scripts/build-copenhagen-accommodation-property-panel.ts --hotelstars-json <downloaded JSON> --hostels-html <downloaded HTML> [--write]'
    );
  }
  return {
    hotelstarsPath: path.resolve(process.argv[hotelstarsIndex + 1]),
    hostelsPath: path.resolve(process.argv[hostelsIndex + 1]),
    write: process.argv.includes('--write'),
  };
}

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex');
}

function round(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function nullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function decodeHtml(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function slug(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sourceWebsite(value: string) {
  const trimmed = nullable(value);
  if (trimmed === null || trimmed === '\\0') return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

function extractHostelDirectory(html: string) {
  const anchors = new Map<string, string>();
  const anchorPattern = /<a\s+[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) !== null) {
    const name = decodeHtml(match[2]).trim();
    if (EXPECTED_HOSTELS.includes(name as (typeof EXPECTED_HOSTELS)[number])) {
      anchors.set(name, decodeHtml(match[1]));
    }
  }
  const missing = EXPECTED_HOSTELS.filter((name) => !anchors.has(name));
  if (missing.length > 0 || anchors.size !== EXPECTED_HOSTELS.length) {
    throw new Error(`Hostel directory did not match the frozen 13-property universe: ${missing.join(', ')}`);
  }
  return EXPECTED_HOSTELS.map((name) => ({ name, website: anchors.get(name)! }));
}

function buildCityPanel(
  hotelstarsBuffer: Buffer,
  hostelDirectoryBuffer: Buffer
): AccommodationCityPanel {
  const hotelstarsHash = sha256(hotelstarsBuffer);
  if (hotelstarsHash !== HOTELSTARS_SHA256) {
    throw new Error(
      `Hotelstars checksum mismatch: expected ${HOTELSTARS_SHA256}, received ${hotelstarsHash}. Freeze a new source version instead of overwriting this panel.`
    );
  }
  const hostelDirectoryHash = sha256(hostelDirectoryBuffer);
  if (hostelDirectoryHash !== HOSTEL_DIRECTORY_SHA256) {
    throw new Error(
      `VisitCopenhagen checksum mismatch: expected ${HOSTEL_DIRECTORY_SHA256}, received ${hostelDirectoryHash}. Freeze a new source version instead of overwriting this panel.`
    );
  }

  const hotelstars = hotelstarsResponseSchema.parse(
    JSON.parse(hotelstarsBuffer.toString('utf8'))
  );
  if (hotelstars.companies.some((company) => company.countryCode !== 'DK')) {
    throw new Error('Hotelstars Denmark snapshot contains a non-DK record');
  }
  const hostelCandidates = extractHostelDirectory(hostelDirectoryBuffer.toString('utf8'));
  if (hotelstars.companies.length !== 309) {
    throw new Error(`Expected 309 Hotelstars Denmark records, received ${hotelstars.companies.length}`);
  }

  const hotelRecords = hotelstars.companies.filter(
    (company) => company.catalogName === 'Hotel'
  );
  const conferenceRecords = hotelstars.companies.filter(
    (company) => company.catalogName === 'Conference'
  );
  const eligibleHotelRecords = hotelRecords.filter(
    (company) => company.hotelCategory in HOTEL_STAR_TO_MEASURE
  );
  const invalidCoordinates = eligibleHotelRecords.filter(
    (company) =>
      !Number.isFinite(company.location.lat) ||
      !Number.isFinite(company.location.lon) ||
      company.location.lat < -90 ||
      company.location.lat > 90 ||
      company.location.lon < -180 ||
      company.location.lon > 180
  );
  if (
    hotelRecords.length !== 209 ||
    conferenceRecords.length !== 100 ||
    eligibleHotelRecords.length !== 201 ||
    invalidCoordinates.length !== 0
  ) {
    throw new Error('Hotelstars source-shape counts drifted from the audited snapshot');
  }

  const coreCentreInputs = eligibleHotelRecords.filter((company) =>
    /^København(?:\s|$)/.test(company.city.trim())
  );
  if (coreCentreInputs.length !== 29) {
    throw new Error(`Expected 29 Copenhagen centre inputs, received ${coreCentreInputs.length}`);
  }
  const centreLatitude = componentMedian(
    coreCentreInputs.map((company) => company.location.lat)
  );
  const centreLongitude = componentMedian(
    coreCentreInputs.map((company) => company.location.lon)
  );

  const hotelProperties: AccommodationPanelProperty[] = eligibleHotelRecords.map((company) => {
    const measure = HOTEL_STAR_TO_MEASURE[
      company.hotelCategory as keyof typeof HOTEL_STAR_TO_MEASURE
    ];
    const distanceFromCentreKm = haversineDistanceKm(
      centreLatitude,
      centreLongitude,
      company.location.lat,
      company.location.lon
    );
    const officialWebsiteUrl = sourceWebsite(company.website);
    const sourceSubtype = [company.superior ? 'Superior' : null, company.garni ? 'Garni' : null]
      .filter((value): value is string => value !== null)
      .join(' / ');
    return {
      propertyId: `hotelstars-union:DK:${company.id}`,
      sourcePropertyId: company.id,
      name: company.hotelName.trim(),
      sourceStatus: 'listed',
      sourcePropertyType: 'Hotel',
      sourcePropertySubtype: sourceSubtype || null,
      sourceClassification: {
        scheme: 'Hotelstars Union harmonised classification',
        value: `${company.hotelCategory} star`,
      },
      eligibleMeasures: [measure],
      address: {
        addressLine1:
          [nullable(company.street), nullable(company.streetNumber)]
            .filter((value): value is string => value !== null)
            .join(' ') || null,
        postalCode: nullable(company.zip),
        locality: nullable(company.city),
        municipality: nullable(company.city),
      },
      capacity: null,
      latitude: round(company.location.lat, 8),
      longitude: round(company.location.lon, 8),
      distanceFromCentreKm: round(distanceFromCentreKm, 6),
      geographicDisposition:
        distanceFromCentreKm <= SEARCH_RADIUS_KM
          ? 'eligible_in_radius'
          : 'excluded_outside_radius',
      exclusionReason:
        distanceFromCentreKm <= SEARCH_RADIUS_KM
          ? null
          : `Official directory coordinates are more than ${SEARCH_RADIUS_KM} km from the frozen sampling-frame centre.`,
      officialWebsiteUrl,
      websiteVerificationStatus: officialWebsiteUrl
        ? 'source_listed_unverified'
        : 'pending',
    };
  });

  const hostelProperties: AccommodationPanelProperty[] = hostelCandidates.map((candidate) => ({
    propertyId: `visitcopenhagen-hostel:${slug(candidate.name)}`,
    sourcePropertyId: slug(candidate.name),
    name: candidate.name,
    sourceStatus: 'listed',
    sourcePropertyType: 'Hostel candidate',
    sourcePropertySubtype: null,
    sourceClassification: {
      scheme: 'VisitCopenhagen accommodation directory heading',
      value: 'Hostels',
    },
    eligibleMeasures: [],
    address: {
      addressLine1: null,
      postalCode: null,
      locality: null,
      municipality: null,
    },
    capacity: null,
    latitude: null,
    longitude: null,
    distanceFromCentreKm: null,
    geographicDisposition: 'pending_inventory_and_geolocation',
    exclusionReason: null,
    officialWebsiteUrl: candidate.website,
    websiteVerificationStatus: 'source_listed_unverified',
  }));

  const properties = [...hotelProperties, ...hostelProperties];
  const measureOrder = new Map(
    ACCOMMODATION_PANEL_MEASURES.map((measure, index) => [measure, index])
  );
  const dispositionOrder = {
    eligible_in_radius: 0,
    excluded_outside_radius: 1,
    excluded_missing_official_geolocation: 2,
    pending_inventory_verification: 3,
    pending_inventory_and_geolocation: 4,
    pending_website_and_inventory_verification: 5,
    excluded_candidate_outside_radius: 6,
  } as const;
  properties.sort(
    (left, right) =>
      (measureOrder.get(left.eligibleMeasures[0] as AccommodationPanelMeasure) ??
        Number.MAX_SAFE_INTEGER) -
        (measureOrder.get(right.eligibleMeasures[0] as AccommodationPanelMeasure) ??
          Number.MAX_SAFE_INTEGER) ||
      dispositionOrder[left.geographicDisposition] -
        dispositionOrder[right.geographicDisposition] ||
      (left.distanceFromCentreKm ?? Number.MAX_SAFE_INTEGER) -
        (right.distanceFromCentreKm ?? Number.MAX_SAFE_INTEGER) ||
      left.propertyId.localeCompare(right.propertyId)
  );

  const ranking = rankAccommodationProperties(
    hotelProperties.filter(
      (property) => property.geographicDisposition === 'eligible_in_radius'
    ),
    {
      scheduleId: SCHEDULE_ID,
      city: 'Copenhagen',
      country: 'Denmark',
      targetPrimaryCount: TARGET_PRIMARY_COUNT,
    }
  );

  const measurePanels = ACCOMMODATION_PANEL_MEASURES.map((measure) => {
    const rankedProperties = ranking.get(measure) ?? [];
    if (
      !ACCOMMODATION_HOTEL_PANEL_MEASURES.some(
        (hotelMeasure) => hotelMeasure === measure
      )
    ) {
      return {
        measure,
        status: 'candidate_universe_pending_inventory_verification' as const,
        eligibleInRadiusCount: 0,
        targetPrimaryCount: 0,
        rankedProperties: [],
        notes:
          'VisitCopenhagen supplies a current 13-property hostel candidate universe and direct property links. Dorm/private inventory, address, and 5 km eligibility must be verified on those sites before either panel is ranked.',
      };
    }
    if (rankedProperties.length === 0) {
      return {
        measure,
        status: 'unavailable_no_eligible_properties' as const,
        eligibleInRadiusCount: 0,
        targetPrimaryCount: 0,
        rankedProperties: [],
        notes:
          'The current official Hotelstars Union Denmark snapshot contains no eligible in-radius property in this class; the missing class is retained rather than inferred from another tier.',
      };
    }
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
        ? `The full eligible in-radius class contains ${rankedProperties.length} properties, below the frozen minimum of ${ACCOMMODATION_MIN_QUOTES_PER_SEASON} accepted quotes per season; the direct measure cannot materialize unless the methodology is explicitly revised.`
        : 'Properties are selected without price, brand, capacity, or website visibility inputs. Source-listed sites still require ownership and public-booking verification.',
    };
  });

  const inRadiusCount = hotelProperties.filter(
    (property) => property.geographicDisposition === 'eligible_in_radius'
  ).length;
  const outsideRadiusCount = hotelProperties.length - inRadiusCount;
  if (inRadiusCount !== 29 || outsideRadiusCount !== 172) {
    throw new Error(
      `Expected 29 in-radius and 172 outside-radius hotels, received ${inRadiusCount} and ${outsideRadiusCount}`
    );
  }

  return {
    panelId: 'copenhagen-accommodation-property-panel-2026-07-24-v1',
    city: 'Copenhagen',
    country: 'Denmark',
    region: 'Europe',
    status: 'sampling_frame_frozen_websites_pending',
    samplingFrame: {
      frameKind: 'official_classification_directory',
      joinKey: null,
      inclusionCriteria: [
        "Hotel record has catalogName 'Hotel'; conference products are excluded before sampling.",
        'Hotelstars Union classification is exactly 1, 2, 3, or 4 stars and official directory coordinates are usable.',
        "The centre is the component-wise median of all eligible 1–4-star hotel records whose official city field starts with 'København'.",
        `All Denmark directory hotel records within ${SEARCH_RADIUS_KM} km of that frozen centre are retained, including other official locality labels such as Valby.`,
        'VisitCopenhagen hostel candidates are retained separately but receive no dorm/private eligibility until their direct sites verify inventory and location.',
      ],
      exclusionCriteria: [
        'Exclude Hotelstars conference products so a physical hotel is not double-weighted by its separate meeting classification.',
        'Exclude 5-star hotels because the planner publishes accommodation tiers only through 4 stars.',
        `Retain but mark otherwise eligible hotel records beyond ${SEARCH_RADIUS_KM} km as excluded from ranking.`,
        'Do not infer hostel dorm or private-room inventory from the destination directory heading alone.',
      ],
      centre: {
        method: 'componentwise_median_of_official_kobenhavn_1_to_4_star_hotel_coordinates',
        latitude: round(centreLatitude, 8),
        longitude: round(centreLongitude, 8),
        inputPropertyCount: coreCentreInputs.length,
        searchRadiusKm: SEARCH_RADIUS_KM,
      },
      sources: [
        {
          sourceId: 'hotelstars-union-denmark-public-search-2026-07-24',
          publisher: 'Hotelstars Union',
          datasetName: 'Hotelstars Union Denmark public classified-hotel search',
          role: 'eligibility_classification_and_geolocation',
          landingPageUrl: HOTELSTARS_LANDING_PAGE,
          dataUrl: HOTELSTARS_DATA_URL,
          requestBody: HOTELSTARS_REQUEST_BODY,
          retrievedAt: HOTELSTARS_RETRIEVED_AT,
          sourceLastUpdatedAt: null,
          licenceName: 'No open-data licence stated; factual directory use with attribution',
          licenceUrl: null,
          rawRecordCount: hotelstars.companies.length,
          rawByteCount: hotelstarsBuffer.length,
          rawSha256: hotelstarsHash,
        },
        {
          sourceId: 'visitcopenhagen-hostel-directory-2026-07-24',
          publisher: 'VisitCopenhagen / VisitDenmark',
          datasetName: 'VisitCopenhagen Hostels directory',
          role: 'candidate_universe',
          landingPageUrl: HOSTEL_DIRECTORY_URL,
          dataUrl: HOSTEL_DIRECTORY_URL,
          requestBody: null,
          retrievedAt: HOSTEL_DIRECTORY_RETRIEVED_AT,
          sourceLastUpdatedAt: null,
          licenceName: 'No open-data licence stated; factual directory use with attribution',
          licenceUrl: null,
          rawRecordCount: hostelCandidates.length,
          rawByteCount: hostelDirectoryBuffer.length,
          rawSha256: hostelDirectoryHash,
        },
      ],
      counts: {
        sourceRecordCount: hotelstars.companies.length + hostelCandidates.length,
        sourceLodgingRecordCount: hotelRecords.length + hostelCandidates.length,
        eligiblePropertyCount: hotelProperties.length,
        candidatePropertyCount: hostelProperties.length,
        geolocatedEligiblePropertyCount: hotelProperties.length,
        missingOfficialGeolocationCount: 0,
        outsideRadiusCount,
        eligibleInRadiusCount: inRadiusCount,
        sourceSpecificCounts: {
          hotelstarsDenmarkRecords: hotelstars.companies.length,
          hotelstarsHotelRecords: hotelRecords.length,
          hotelstarsConferenceRecords: conferenceRecords.length,
          hotelstarsOneToFourStarHotelRecords: eligibleHotelRecords.length,
          visitCopenhagenHostelCandidates: hostelCandidates.length,
          copenhagenCoreCentreInputs: coreCentreInputs.length,
        },
      },
    },
    measurePanels,
    properties,
  };
}

function mergeCollection(city: AccommodationCityPanel): AccommodationPropertyPanelCollection {
  const collection = accommodationPropertyPanelCollectionSchema.parse(
    JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'))
  );
  return upsertAccommodationCityPanel(collection, city, LOCKED_AT);
}

function main() {
  const args = parseArgs();
  const city = buildCityPanel(
    fs.readFileSync(args.hotelstarsPath),
    fs.readFileSync(args.hostelsPath)
  );
  const collection = mergeCollection(city);
  if (args.write) {
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
  }
  console.log(JSON.stringify(summarizeAccommodationPropertyPanels(collection), null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
