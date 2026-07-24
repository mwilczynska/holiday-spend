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
import {
  deduplicateHotelstarsCompanies,
  hotelstarsResponseSchema,
} from '../src/lib/hotelstars-directory';

const HOTELSTARS_SHA256 = 'ba48008940176a1b25d1a278e0a66bf27c5fc52513265403bb59587d05c826e4';
const HOTELSTARS_RETRIEVED_AT = '2026-07-24T07:48:21.2395307Z';
const HOTELSTARS_REQUEST_BODY =
  '{"hotelCategories":[1,2,3,4,5],"filters":[],"region":null,"sortDirection":"ASC","countryCodes":["CZ"],"sortKey":"hotelName"}';
const HOSTEL_DIRECTORY_SHA256 =
  'f83071fba3700c93138e9ff6684228c3c363e54c9b425ea6ad804f7ab06e785e';
const HOSTEL_DIRECTORY_RETRIEVED_AT = '2026-07-24T07:48:55.7378683Z';
const LOCKED_AT = '2026-07-24T07:51:38.7445202Z';
const SCHEDULE_ID = 'accommodation-reference-2026-2027-v1';
const TARGET_PRIMARY_COUNT = 12;
const SEARCH_RADIUS_KM = 5;
const DUPLICATE_COORDINATE_TOLERANCE_KM = 0.25;
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'data/reference/accommodation_property_panels_2026_2027.json'
);
const HOTELSTARS_LANDING_PAGE = 'https://www.hotelstars.eu/czech-republic/hotel-search';
const HOTELSTARS_DATA_URL = 'https://www.hotelstars.eu/search/proxy.php';
const HOSTEL_DIRECTORY_URL = 'https://prague.eu/en/ubytovani-kategorie/hostels/';

const HOSTELS: Array<{
  slug: string;
  name: string;
  sha256: string;
  retrievedAt: string;
  sourceLastUpdatedAt: string;
  eligibleMeasures: AccommodationPanelMeasure[];
  requiredEvidence: string[];
}> = [
  {
    slug: 'ahoy-hostel',
    name: 'Ahoy! Hostel',
    sha256: '51d60ebf23b3581b92a4b6344aa9938d6c58abd2d6cabbdd7ef3441dcbabc626',
    retrievedAt: '2026-07-24T07:51:18.1741601Z',
    sourceLastUpdatedAt: '2026-04-09T13:50:22.000Z',
    eligibleMeasures: ['hostel_dorm_bed_1p', 'hostel_private_room_2p'],
    requiredEvidence: ['private double rooms', 'shared dormitories'],
  },
  {
    slug: 'artharmony-pension-hostel',
    name: 'Artharmony Pension & Hostel',
    sha256: 'e3a3b15d06a1783716c808c98a23c22e5e4bac1f2567925929103d975cebcb9b',
    retrievedAt: '2026-07-24T07:51:19.6054632Z',
    sourceLastUpdatedAt: '2026-03-26T13:56:01.000Z',
    eligibleMeasures: ['hostel_private_room_2p'],
    requiredEvidence: ['private rooms of various sizes'],
  },
  {
    slug: 'brix-hostel',
    name: 'Brix Hostel',
    sha256: '3b9130d0da11177bee60af6310efef7634fee90281bfb6bd427ae7457c0b164c',
    retrievedAt: '2026-07-24T07:51:21.4338291Z',
    sourceLastUpdatedAt: '2026-03-25T11:30:34.000Z',
    eligibleMeasures: ['hostel_dorm_bed_1p', 'hostel_private_room_2p'],
    requiredEvidence: ['both private and shared options'],
  },
  {
    slug: 'hostel-downtown',
    name: 'Hostel Downtown',
    sha256: '42602d454dc8efea6ddf3968ebd49982ea514e31be003dcbd91eb5c92272952b',
    retrievedAt: '2026-07-24T07:51:22.3348671Z',
    sourceLastUpdatedAt: '2026-03-27T09:30:28.000Z',
    eligibleMeasures: ['hostel_dorm_bed_1p', 'hostel_private_room_2p'],
    requiredEvidence: ['private and shared rooms'],
  },
  {
    slug: 'hostel-little-quarter',
    name: 'Hostel Little Quarter',
    sha256: '7d4280b6cf8d695d7cd6651d79a1c78cbf3c3f7bda4e5be7fe6259ba6ede629e',
    retrievedAt: '2026-07-24T07:51:23.8168532Z',
    sourceLastUpdatedAt: '2026-03-27T10:09:03.000Z',
    eligibleMeasures: ['hostel_dorm_bed_1p', 'hostel_private_room_2p'],
    requiredEvidence: ['private rooms with shared bathrooms', 'dormitory-style rooms'],
  },
  {
    slug: 'luma-terra-prague',
    name: 'Luma Terra Prague',
    sha256: '32ea71623b6b18d3a4cb1ac3cc7a78c1b2529e50ca123fd2bcad997acc706224',
    retrievedAt: '2026-07-24T07:51:25.0570046Z',
    sourceLastUpdatedAt: '2026-03-27T12:55:40.000Z',
    eligibleMeasures: [],
    requiredEvidence: ['perfectly accessible for backpackers'],
  },
  {
    slug: 'plus-prague',
    name: 'Plus Prague',
    sha256: 'da05d60a4187bbe1fee030c7ae9605ca7f8a77b99f36685a1b2a1c255b0e347e',
    retrievedAt: '2026-07-24T07:51:26.3753232Z',
    sourceLastUpdatedAt: '2026-03-27T13:34:29.000Z',
    eligibleMeasures: ['hostel_dorm_bed_1p', 'hostel_private_room_2p'],
    requiredEvidence: ['private rooms', 'mixed dormitories'],
  },
  {
    slug: 'prague-dream-hostel',
    name: 'Prague Dream Hostel',
    sha256: '2d94f0f8696620d73cfc9015f77299d53738cf67d0808e52d0233bd06a2eed03',
    retrievedAt: '2026-07-24T07:51:28.0261900Z',
    sourceLastUpdatedAt: '2026-03-27T14:13:52.000Z',
    eligibleMeasures: ['hostel_dorm_bed_1p', 'hostel_private_room_2p'],
    requiredEvidence: ['dormitories', 'private rooms'],
  },
  {
    slug: 'sir-tobys-hostel',
    name: 'Sir Toby’s Hostel',
    sha256: '73de0087c99aa7fb8fba77e8f70e924a178a455900e28f9e7728dab3cd72d432',
    retrievedAt: '2026-07-24T07:51:28.9496646Z',
    sourceLastUpdatedAt: '2026-03-30T14:27:42.000Z',
    eligibleMeasures: ['hostel_dorm_bed_1p', 'hostel_private_room_2p'],
    requiredEvidence: ['shared and private rooms'],
  },
  {
    slug: 'sir-tobys-midtown',
    name: 'Sir Toby’s Midtown',
    sha256: '26c87fb89b040896f50690650aeeae0a9340dea73296410c43a32923e6856902',
    retrievedAt: '2026-07-24T07:51:30.4419391Z',
    sourceLastUpdatedAt: '2026-03-30T14:13:17.000Z',
    eligibleMeasures: ['hostel_dorm_bed_1p', 'hostel_private_room_2p'],
    requiredEvidence: ['both shared and private rooms'],
  },
  {
    slug: 'sophies-hostel',
    name: 'Sophie’s Hostel',
    sha256: '82b14e133fdebeaba2440c5765d4b114cb9577cd014f8463a53d290e7fe188b7',
    retrievedAt: '2026-07-24T07:51:37.3806791Z',
    sourceLastUpdatedAt: '2026-03-27T15:21:30.000Z',
    eligibleMeasures: ['hostel_dorm_bed_1p', 'hostel_private_room_2p'],
    requiredEvidence: ['dormitory rooms', 'small rooms with private bathrooms'],
  },
  {
    slug: 'white-wolf-house-hostel-apartments',
    name: 'White Wolf House Hostel & Apartments',
    sha256: 'a5d9ad605bbea55e7ae519fe1c89730d12fca9f637c08e44e54e8dfff53f64ec',
    retrievedAt: '2026-07-24T07:51:38.7445202Z',
    sourceLastUpdatedAt: '2026-03-27T14:36:38.000Z',
    eligibleMeasures: ['hostel_dorm_bed_1p'],
    requiredEvidence: ['shared rooms'],
  },
];

function parseArgs() {
  const hotelstarsIndex = process.argv.indexOf('--hotelstars-json');
  const hostelsIndex = process.argv.indexOf('--hostels-html');
  const detailsIndex = process.argv.indexOf('--hostel-details-dir');
  if (
    hotelstarsIndex === -1 ||
    !process.argv[hotelstarsIndex + 1] ||
    hostelsIndex === -1 ||
    !process.argv[hostelsIndex + 1] ||
    detailsIndex === -1 ||
    !process.argv[detailsIndex + 1]
  ) {
    throw new Error(
      'Usage: tsx scripts/build-prague-accommodation-property-panel.ts --hotelstars-json <downloaded JSON> --hostels-html <downloaded HTML> --hostel-details-dir <downloaded detail pages> [--write]'
    );
  }
  return {
    hotelstarsPath: path.resolve(process.argv[hotelstarsIndex + 1]),
    hostelsPath: path.resolve(process.argv[hostelsIndex + 1]),
    detailsPath: path.resolve(process.argv[detailsIndex + 1]),
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
    .replaceAll('&#038;', '&')
    .replaceAll('&#039;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
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

function detailUrl(slug: string) {
  return `https://prague.eu/en/ubytovani/${slug}/`;
}

function assertDirectoryUniverse(html: string) {
  const anchors = new Map<string, string>();
  const anchorPattern = /<h2><a href="([^"]+)">([^<]+)<\/a><\/h2>/g;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) !== null) {
    const name = decodeHtml(match[2]).trim();
    if (HOSTELS.some((hostel) => hostel.name === name)) {
      anchors.set(name, decodeHtml(match[1]));
    }
  }
  const missing = HOSTELS.filter(
    (hostel) => anchors.get(hostel.name) !== detailUrl(hostel.slug)
  );
  if (missing.length > 0 || anchors.size !== HOSTELS.length) {
    throw new Error(
      `Prague hostel directory did not match the frozen 12-property universe: ${missing
        .map((hostel) => hostel.name)
        .join(', ')}`
    );
  }
}

function firstMatch(html: string, expression: RegExp, label: string) {
  const value = expression.exec(html)?.[1];
  if (!value) throw new Error(`Missing ${label} in Prague City Tourism detail page`);
  return decodeHtml(value.trim());
}

function parseHostelDetail(
  metadata: (typeof HOSTELS)[number],
  detailsPath: string,
  centreLatitude: number,
  centreLongitude: number
) {
  const detailPath = path.join(detailsPath, `${metadata.slug}.html`);
  const buffer = fs.readFileSync(detailPath);
  const actualHash = sha256(buffer);
  if (actualHash !== metadata.sha256) {
    throw new Error(
      `${metadata.name} checksum mismatch: expected ${metadata.sha256}, received ${actualHash}`
    );
  }
  const html = buffer.toString('utf8');
  const name = firstMatch(html, /<h1[^>]*>([^<]+)<\/h1>/, 'property heading');
  if (name !== metadata.name) {
    throw new Error(`Expected ${metadata.name} detail page, received ${name}`);
  }
  const description = firstMatch(
    html,
    /<meta property="og:description" content="([^"]*)"/,
    'property description'
  );
  for (const evidence of metadata.requiredEvidence) {
    if (!description.toLocaleLowerCase('en').includes(evidence.toLocaleLowerCase('en'))) {
      throw new Error(`${metadata.name} no longer contains frozen inventory evidence: ${evidence}`);
    }
  }
  const mapJson = firstMatch(html, /data-mapdata='([^']+)'/, 'map evidence');
  const mapData = JSON.parse(mapJson) as Array<{
    address: string;
    lat: number;
    lng: number;
    street_number: string;
    street_name: string;
    post_code: string;
    country_short: string;
  }>;
  if (
    mapData.length !== 1 ||
    mapData[0].country_short !== 'CZ' ||
    !Number.isFinite(mapData[0].lat) ||
    !Number.isFinite(mapData[0].lng)
  ) {
    throw new Error(`${metadata.name} has unusable official destination coordinates`);
  }
  const website = sourceWebsite(
    firstMatch(
      html,
      /<strong>\s*Website\s*<\/strong>[\s\S]*?<a href="([^"]+)"/,
      'property website'
    )
  );
  if (!website) throw new Error(`${metadata.name} has no valid source-listed website`);
  const modifiedAt = firstMatch(html, /"dateModified":"([^"]+)"/, 'last-modified date');
  if (new Date(modifiedAt).toISOString() !== metadata.sourceLastUpdatedAt) {
    throw new Error(`${metadata.name} last-modified date drifted from the frozen source metadata`);
  }

  const location = mapData[0];
  const distanceFromCentreKm = haversineDistanceKm(
    centreLatitude,
    centreLongitude,
    location.lat,
    location.lng
  );
  const hasInventory = metadata.eligibleMeasures.length > 0;
  const inRadius = distanceFromCentreKm <= SEARCH_RADIUS_KM;
  const property: AccommodationPanelProperty = {
    propertyId: `prague-city-tourism:${metadata.slug}`,
    sourcePropertyId: metadata.slug,
    name: metadata.name,
    sourceStatus: 'listed; inventory and geolocation reviewed from destination detail page',
    sourcePropertyType: 'Hostel directory property',
    sourcePropertySubtype: null,
    sourceClassification: {
      scheme: 'Prague City Tourism hostel directory and property detail',
      value: hasInventory
        ? `Explicit inventory: ${metadata.eligibleMeasures.join(', ')}`
        : 'Hostel listing without explicit dorm or private-room inventory',
    },
    eligibleMeasures: metadata.eligibleMeasures,
    address: {
      addressLine1:
        [nullable(location.street_name), nullable(location.street_number)]
          .filter((value): value is string => value !== null)
          .join(' ') || null,
      postalCode: nullable(location.post_code),
      locality: 'Prague',
      municipality: 'Prague',
    },
    capacity: null,
    latitude: round(location.lat, 8),
    longitude: round(location.lng, 8),
    distanceFromCentreKm: round(distanceFromCentreKm, 6),
    geographicDisposition: !hasInventory
      ? 'pending_inventory_verification'
      : inRadius
        ? 'eligible_in_radius'
        : 'excluded_outside_radius',
    exclusionReason: !hasInventory
      ? 'The official destination page verifies this hostel and its location but does not state dorm or private-room inventory.'
      : inRadius
        ? null
        : `Official destination coordinates are more than ${SEARCH_RADIUS_KM} km from the frozen sampling-frame centre.`,
    officialWebsiteUrl: website,
    websiteVerificationStatus: 'source_listed_unverified',
  };

  return { property, buffer };
}

function buildCityPanel(
  hotelstarsBuffer: Buffer,
  hostelDirectoryBuffer: Buffer,
  detailsPath: string
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
      `Prague City Tourism directory checksum mismatch: expected ${HOSTEL_DIRECTORY_SHA256}, received ${hostelDirectoryHash}. Freeze a new source version instead of overwriting this panel.`
    );
  }
  const hostelDirectoryHtml = hostelDirectoryBuffer.toString('utf8');
  assertDirectoryUniverse(hostelDirectoryHtml);

  const hotelstars = hotelstarsResponseSchema.parse(
    JSON.parse(hotelstarsBuffer.toString('utf8'))
  );
  if (
    hotelstars.companies.length !== 229 ||
    hotelstars.companies.some(
      (company) => company.countryCode !== 'CZ' || company.catalogName !== 'Hotel'
    )
  ) {
    throw new Error('Hotelstars Czech Republic source shape drifted from the audited snapshot');
  }
  const eligibleHotelRows = hotelstars.companies.filter(
    (company) => company.hotelCategory in HOTEL_STAR_TO_MEASURE
  );
  if (eligibleHotelRows.length !== 225) {
    throw new Error(`Expected 225 eligible 1–4-star rows, received ${eligibleHotelRows.length}`);
  }
  const deduplicated = deduplicateHotelstarsCompanies(eligibleHotelRows, {
    countryCode: 'CZ',
    coordinateToleranceKm: DUPLICATE_COORDINATE_TOLERANCE_KM,
  });
  if (
    deduplicated.physicalPropertyCount !== 148 ||
    deduplicated.duplicateIdentityGroupCount !== 76 ||
    deduplicated.coordinateConflictGroupCount !== 4
  ) {
    throw new Error('Hotelstars Czech physical-property deduplication counts drifted');
  }

  const coreCentreInputs = deduplicated.properties.filter(
    (property) =>
      /^Praha(?:\s|$)/.test(property.representative.city.trim()) &&
      property.latitude !== null &&
      property.longitude !== null
  );
  if (coreCentreInputs.length !== 18) {
    throw new Error(`Expected 18 Prague physical centre inputs, received ${coreCentreInputs.length}`);
  }
  const centreLatitude = componentMedian(
    coreCentreInputs.map((property) => property.latitude as number)
  );
  const centreLongitude = componentMedian(
    coreCentreInputs.map((property) => property.longitude as number)
  );

  const hotelProperties: AccommodationPanelProperty[] = deduplicated.properties.map(
    (physicalProperty) => {
      const company = physicalProperty.representative;
      const measure = HOTEL_STAR_TO_MEASURE[
        company.hotelCategory as keyof typeof HOTEL_STAR_TO_MEASURE
      ];
      const hasCoordinates =
        physicalProperty.latitude !== null && physicalProperty.longitude !== null;
      const distanceFromCentreKm = hasCoordinates
        ? haversineDistanceKm(
            centreLatitude,
            centreLongitude,
            physicalProperty.latitude as number,
            physicalProperty.longitude as number
          )
        : null;
      const inRadius =
        distanceFromCentreKm !== null && distanceFromCentreKm <= SEARCH_RADIUS_KM;
      const officialWebsiteUrl = sourceWebsite(company.website);
      const sourceSubtype = [
        company.superior ? 'Superior' : null,
        company.garni ? 'Garni' : null,
      ]
        .filter((value): value is string => value !== null)
        .join(' / ');
      return {
        propertyId: physicalProperty.propertyId,
        sourcePropertyId: physicalProperty.sourcePropertyIds.join(','),
        name: company.hotelName.trim(),
        sourceStatus: `listed; ${physicalProperty.sourceRecordCount} source row(s) collapsed by physical identity`,
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
        latitude: hasCoordinates ? round(physicalProperty.latitude as number, 8) : null,
        longitude: hasCoordinates ? round(physicalProperty.longitude as number, 8) : null,
        distanceFromCentreKm:
          distanceFromCentreKm === null ? null : round(distanceFromCentreKm, 6),
        geographicDisposition: !hasCoordinates
          ? ('excluded_missing_official_geolocation' as const)
          : inRadius
            ? ('eligible_in_radius' as const)
            : ('excluded_outside_radius' as const),
        exclusionReason: !hasCoordinates
          ? `Duplicate official rows disagree by more than ${DUPLICATE_COORDINATE_TOLERANCE_KM} km, so no coordinate is chosen.`
          : inRadius
            ? null
            : `Official directory coordinates are more than ${SEARCH_RADIUS_KM} km from the frozen sampling-frame centre.`,
        officialWebsiteUrl,
        websiteVerificationStatus: officialWebsiteUrl
          ? ('source_listed_unverified' as const)
          : ('pending' as const),
      };
    }
  );

  const hostelDetails = HOSTELS.map((hostel) =>
    parseHostelDetail(hostel, detailsPath, centreLatitude, centreLongitude)
  );
  const hostelProperties = hostelDetails.map((detail) => detail.property);
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
    properties.filter((property) => property.geographicDisposition === 'eligible_in_radius'),
    {
      scheduleId: SCHEDULE_ID,
      city: 'Prague',
      country: 'Czech Republic',
      targetPrimaryCount: TARGET_PRIMARY_COUNT,
    }
  );
  const measurePanels = ACCOMMODATION_PANEL_MEASURES.map((measure) => {
    const rankedProperties = ranking.get(measure) ?? [];
    if (rankedProperties.length === 0) {
      return {
        measure,
        status: 'unavailable_no_eligible_properties' as const,
        eligibleInRadiusCount: 0,
        targetPrimaryCount: 0,
        rankedProperties: [],
        notes: ACCOMMODATION_HOTEL_PANEL_MEASURES.includes(
          measure as (typeof ACCOMMODATION_HOTEL_PANEL_MEASURES)[number]
        )
          ? 'The deduplicated official Hotelstars Czech Republic frame contains no eligible in-radius physical property in this class; the class is retained as unavailable rather than inferred from another tier.'
          : 'The official destination frame contains no in-radius property with explicit inventory for this hostel measure.',
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
        : 'Properties are selected without price, brand, capacity, or website visibility inputs. Source-listed sites still require ownership and public-booking verification before quote collection.',
    };
  });

  const eligibleProperties = properties.filter(
    (property) => property.eligibleMeasures.length > 0
  );
  const candidateProperties = properties.filter(
    (property) =>
      property.geographicDisposition === 'pending_inventory_verification' ||
      property.geographicDisposition === 'pending_inventory_and_geolocation'
  );
  const geolocatedEligible = eligibleProperties.filter(
    (property) => property.latitude !== null && property.longitude !== null
  );
  const missing = properties.filter(
    (property) => property.geographicDisposition === 'excluded_missing_official_geolocation'
  );
  const outside = properties.filter(
    (property) => property.geographicDisposition === 'excluded_outside_radius'
  );
  const inRadius = properties.filter(
    (property) => property.geographicDisposition === 'eligible_in_radius'
  );

  return {
    panelId: 'prague-accommodation-property-panel-2026-07-24-v1',
    city: 'Prague',
    country: 'Czech Republic',
    region: 'Europe',
    status: 'sampling_frame_frozen_websites_pending',
    samplingFrame: {
      frameKind: 'official_classification_directory',
      joinKey: null,
      inclusionCriteria: [
        'Hotelstars Union Czech Republic record has catalogName Hotel and classification is exactly 1, 2, 3, or 4 stars.',
        'Duplicate hotel rows are collapsed before sampling by normalized name, street, street number, and postcode; price and website visibility are not identity inputs.',
        `Duplicate coordinates are retained only when their maximum pairwise spread is at most ${DUPLICATE_COORDINATE_TOLERANCE_KM} km; wider official conflicts remain visibly ungeolocated.`,
        "The centre is the component-wise median of deduplicated eligible physical hotels whose official city field starts with 'Praha'.",
        `All deduplicated Czech directory hotels within ${SEARCH_RADIUS_KM} km of that frozen centre are retained, regardless of district label.`,
        'Prague City Tourism hostel properties receive measure eligibility only when their frozen detail page explicitly states shared/dorm or private-room inventory and supplies usable coordinates.',
      ],
      exclusionCriteria: [
        'Exclude 5-star hotels because the planner publishes accommodation tiers only through 4 stars.',
        'Do not allow duplicate official classifications to give one physical hotel multiple sampling chances.',
        `Retain but mark otherwise eligible hotel identities with coordinate disagreement above ${DUPLICATE_COORDINATE_TOLERANCE_KM} km as excluded from ranking.`,
        `Retain but mark eligible geolocated properties beyond ${SEARCH_RADIUS_KM} km as excluded from ranking.`,
        'Retain a geolocated hostel with no explicit room-type evidence as inventory-pending rather than inferring eligibility from the directory heading or the word hostel.',
      ],
      centre: {
        method:
          'componentwise_median_of_deduplicated_official_praha_1_to_4_star_hotel_coordinates',
        latitude: round(centreLatitude, 8),
        longitude: round(centreLongitude, 8),
        inputPropertyCount: coreCentreInputs.length,
        searchRadiusKm: SEARCH_RADIUS_KM,
      },
      sources: [
        {
          sourceId: 'hotelstars-union-czech-republic-public-search-2026-07-24',
          publisher: 'Hotelstars Union',
          datasetName: 'Hotelstars Union Czech Republic public classified-hotel search',
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
          sourceId: 'prague-city-tourism-hostel-directory-2026-07-24',
          publisher: 'Prague City Tourism',
          datasetName: 'Prague City Tourism Hostels directory',
          role: 'candidate_universe',
          landingPageUrl: HOSTEL_DIRECTORY_URL,
          dataUrl: HOSTEL_DIRECTORY_URL,
          requestBody: null,
          retrievedAt: HOSTEL_DIRECTORY_RETRIEVED_AT,
          sourceLastUpdatedAt: null,
          licenceName: 'No open-data licence stated; factual directory use with attribution',
          licenceUrl: null,
          rawRecordCount: HOSTELS.length,
          rawByteCount: hostelDirectoryBuffer.length,
          rawSha256: hostelDirectoryHash,
        },
        ...HOSTELS.map((hostel, index) => ({
          sourceId: `prague-city-tourism-hostel-detail-${hostel.slug}-2026-07-24`,
          publisher: 'Prague City Tourism',
          datasetName: `${hostel.name} accommodation detail`,
          role: 'inventory_and_geolocation' as const,
          landingPageUrl: detailUrl(hostel.slug),
          dataUrl: detailUrl(hostel.slug),
          requestBody: null,
          retrievedAt: hostel.retrievedAt,
          sourceLastUpdatedAt: hostel.sourceLastUpdatedAt,
          licenceName: 'No open-data licence stated; factual directory use with attribution',
          licenceUrl: null,
          rawRecordCount: 1,
          rawByteCount: hostelDetails[index].buffer.length,
          rawSha256: hostel.sha256,
        })),
      ],
      counts: {
        sourceRecordCount: hotelstars.companies.length + HOSTELS.length * 2,
        sourceLodgingRecordCount: hotelstars.companies.length + HOSTELS.length,
        eligiblePropertyCount: eligibleProperties.length,
        candidatePropertyCount: candidateProperties.length,
        geolocatedEligiblePropertyCount: geolocatedEligible.length,
        missingOfficialGeolocationCount: missing.length,
        outsideRadiusCount: outside.length,
        eligibleInRadiusCount: inRadius.length,
        sourceSpecificCounts: {
          hotelstarsCzechRecords: hotelstars.companies.length,
          hotelstarsOneToFourStarRawRows: eligibleHotelRows.length,
          hotelstarsOneToFourStarPhysicalProperties: deduplicated.physicalPropertyCount,
          hotelstarsDuplicateIdentityGroups: deduplicated.duplicateIdentityGroupCount,
          hotelstarsCoordinateConflictGroups: deduplicated.coordinateConflictGroupCount,
          praguePhysicalCentreInputs: coreCentreInputs.length,
          pragueCityTourismHostelCandidates: HOSTELS.length,
          pragueCityTourismHostelDetailPages: hostelDetails.length,
          hostelDormEligibleInRadius: hostelProperties.filter(
            (property) =>
              property.geographicDisposition === 'eligible_in_radius' &&
              property.eligibleMeasures.includes('hostel_dorm_bed_1p')
          ).length,
          hostelPrivateEligibleInRadius: hostelProperties.filter(
            (property) =>
              property.geographicDisposition === 'eligible_in_radius' &&
              property.eligibleMeasures.includes('hostel_private_room_2p')
          ).length,
          hostelInventoryPending: candidateProperties.filter((property) =>
            property.propertyId.startsWith('prague-city-tourism:')
          ).length,
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
    fs.readFileSync(args.hostelsPath),
    args.detailsPath
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
