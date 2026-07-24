import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
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

const RNET_SHA256 = '0a5487c0a8029c8441fd7ebf0bdbef573a66a5d908deb0e99cda027f065f04f6';
const RNAL_SHA256 = '77fdbf7df3dadb5b0c29bcfdfcf8da30b6d4000d0516cd221c05de1c1bcfc635';
const RNET_RETRIEVED_AT = '2026-07-24T14:15:40.000Z';
const RNAL_RETRIEVED_AT = '2026-07-24T14:19:31.000Z';
const LOCKED_AT = '2026-07-24T14:22:00.000Z';
const SCHEDULE_ID = 'accommodation-reference-2026-2027-v1';
const TARGET_PRIMARY_COUNT = 12;
const SEARCH_RADIUS_KM = 5;
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'data/reference/accommodation_property_panels_2026_2027.json'
);
const OPEN_DATA_LANDING_PAGE =
  'https://travelbi.turismodeportugal.pt/alojamento/empreendimentos-turisticos-oferta/';
const RNET_DATA_URL =
  'https://dadosabertos.turismodeportugal.pt/api/download/v1/items/84912bbcfc7041eba5722a6f52b6bddf/csv?layers=0';
const RNAL_DATA_URL =
  "https://dadosabertos.turismodeportugal.pt/api/download/v1/items/4e62eb1977564991bd01e61d7aa8266f/csv?layers=6&where=Concelho%3D%27Lisboa%27";

type RnetRow = {
  NrRNET: string;
  Denominacao: string;
  TipologiaET: string;
  Categoria: string;
  NrQuartos: string;
  Website: string;
  Endereco: string;
  CodigoPostal: string;
  LocalidadeCP: string;
  LatLong: string;
  FiabilidadeGeo: string;
  Concelho: string;
};

type RnalRow = {
  NrRNAL: string;
  Denominacao: string;
  Modalidade: string;
  NrUtentes: string;
  Endereco: string;
  CodigoPostal: string;
  LOCALIDADE: string;
  LatLong: string;
  FiabilidadeGeo: string;
  Concelho: string;
};

function parseArgs() {
  const rnetIndex = process.argv.indexOf('--rnet-csv');
  const rnalIndex = process.argv.indexOf('--rnal-csv');
  if (
    rnetIndex === -1 ||
    !process.argv[rnetIndex + 1] ||
    rnalIndex === -1 ||
    !process.argv[rnalIndex + 1]
  ) {
    throw new Error(
      'Usage: tsx scripts/build-lisbon-accommodation-property-panel.ts --rnet-csv <downloaded CSV> --rnal-csv <Lisbon-filtered CSV> [--write]'
    );
  }
  return {
    rnetPath: path.resolve(process.argv[rnetIndex + 1]),
    rnalPath: path.resolve(process.argv[rnalIndex + 1]),
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

function nullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sourceWebsite(value: string) {
  const trimmed = nullable(value);
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

function parseCoordinates(value: string) {
  const parts = value
    .split(';')
    .map((part) => Number(part.trim().replace(',', '.')));
  if (
    parts.length !== 2 ||
    !parts.every(Number.isFinite) ||
    parts[0] < -90 ||
    parts[0] > 90 ||
    parts[1] < -180 ||
    parts[1] > 180
  ) {
    return null;
  }
  return { latitude: parts[0], longitude: parts[1] };
}

function parseCsv<T>(buffer: Buffer, label: string) {
  const parsed = Papa.parse<T>(buffer.toString('utf8'), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error(`${label} CSV parse failed: ${parsed.errors[0].message}`);
  }
  return parsed.data;
}

function normalizedIdentityPart(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hostelPhysicalKey(row: RnalRow) {
  const coordinates = parseCoordinates(row.LatLong);
  return [
    normalizedIdentityPart(row.Denominacao),
    normalizedIdentityPart(row.CodigoPostal),
    coordinates
      ? `${coordinates.latitude.toFixed(6)},${coordinates.longitude.toFixed(6)}`
      : 'missing-coordinate',
  ].join('|');
}

function buildCityPanel(rnetBuffer: Buffer, rnalBuffer: Buffer): AccommodationCityPanel {
  if (sha256(rnetBuffer) !== RNET_SHA256) {
    throw new Error('RNET CSV does not match the frozen 24 July 2026 snapshot');
  }
  if (sha256(rnalBuffer) !== RNAL_SHA256) {
    throw new Error('RNAL CSV does not match the frozen Lisbon-filtered 24 July 2026 snapshot');
  }

  const rnetRows = parseCsv<RnetRow>(rnetBuffer, 'RNET');
  const rnalRows = parseCsv<RnalRow>(rnalBuffer, 'RNAL');
  if (rnetRows.length !== 5_649 || rnalRows.length !== 11_865) {
    throw new Error('Official register source-shape counts drifted from the audited snapshots');
  }

  const lisbonRnetRows = rnetRows.filter((row) => row.Concelho === 'Lisboa');
  const eligibleHotelRows = lisbonRnetRows.filter(
    (row) => row.TipologiaET === 'Hotel' && ['1', '2', '3', '4'].includes(row.Categoria)
  );
  const geolocatedHotelRows = eligibleHotelRows.map((row) => ({
    row,
    coordinates: parseCoordinates(row.LatLong),
  }));
  if (
    lisbonRnetRows.length !== 372 ||
    eligibleHotelRows.length !== 254 ||
    geolocatedHotelRows.some(({ coordinates }) => coordinates === null)
  ) {
    throw new Error('Lisbon RNET hotel counts or coordinate coverage drifted');
  }

  const centreLatitude = componentMedian(
    geolocatedHotelRows.map(({ coordinates }) => coordinates!.latitude)
  );
  const centreLongitude = componentMedian(
    geolocatedHotelRows.map(({ coordinates }) => coordinates!.longitude)
  );

  const hotelProperties: AccommodationPanelProperty[] = geolocatedHotelRows.map(
    ({ row, coordinates }) => {
      const measure = HOTEL_STAR_TO_MEASURE[
        row.Categoria as keyof typeof HOTEL_STAR_TO_MEASURE
      ];
      const distanceFromCentreKm = haversineDistanceKm(
        centreLatitude,
        centreLongitude,
        coordinates!.latitude,
        coordinates!.longitude
      );
      const website = sourceWebsite(row.Website);
      return {
        propertyId: `rnet:PT:${row.NrRNET}`,
        sourcePropertyId: row.NrRNET,
        name: row.Denominacao.trim(),
        sourceStatus: 'registered',
        sourcePropertyType: 'Hotel',
        sourcePropertySubtype: null,
        sourceClassification: {
          scheme: 'Portuguese RNET national hotel classification',
          value: `${row.Categoria} star`,
        },
        eligibleMeasures: [measure],
        address: {
          addressLine1: nullable(row.Endereco),
          postalCode: nullable(row.CodigoPostal),
          locality: nullable(row.LocalidadeCP),
          municipality: 'Lisboa',
        },
        capacity: Number.isInteger(Number(row.NrQuartos)) ? Number(row.NrQuartos) : null,
        latitude: round(coordinates!.latitude, 8),
        longitude: round(coordinates!.longitude, 8),
        distanceFromCentreKm: round(distanceFromCentreKm, 6),
        geographicDisposition:
          distanceFromCentreKm <= SEARCH_RADIUS_KM
            ? 'eligible_in_radius'
            : 'excluded_outside_radius',
        exclusionReason:
          distanceFromCentreKm <= SEARCH_RADIUS_KM
            ? null
            : `Official register coordinates are more than ${SEARCH_RADIUS_KM} km from the frozen sampling-frame centre.`,
        officialWebsiteUrl: website,
        websiteVerificationStatus: website ? 'source_listed_unverified' : 'pending',
      };
    }
  );

  const hostelRows = rnalRows.filter(
    (row) =>
      row.Concelho === 'Lisboa' && row.Modalidade === 'EstabelecimentoHospedagemHostel'
  );
  const hostelGroups = new Map<string, RnalRow[]>();
  for (const row of hostelRows) {
    const key = hostelPhysicalKey(row);
    const group = hostelGroups.get(key) ?? [];
    group.push(row);
    hostelGroups.set(key, group);
  }
  const physicalHostelGroups = Array.from(hostelGroups.values()).map((group: RnalRow[]) =>
    group.sort((left, right) => Number(left.NrRNAL) - Number(right.NrRNAL))
  );
  if (
    hostelRows.length !== 113 ||
    physicalHostelGroups.length !== 106 ||
    physicalHostelGroups.filter((group) => group.length > 1).length !== 4
  ) {
    throw new Error('Lisbon RNAL hostel deduplication counts drifted');
  }

  const hostelProperties: AccommodationPanelProperty[] = physicalHostelGroups.map((group) => {
    const representative = group[0];
    const coordinates = parseCoordinates(representative.LatLong);
    if (!coordinates) throw new Error(`RNAL hostel ${representative.NrRNAL} lacks usable coordinates`);
    const distanceFromCentreKm = haversineDistanceKm(
      centreLatitude,
      centreLongitude,
      coordinates.latitude,
      coordinates.longitude
    );
    const ids = group.map((row) => row.NrRNAL);
    const capacity = group.reduce((sum, row) => sum + (Number(row.NrUtentes) || 0), 0);
    return {
      propertyId: `rnal:PT:${ids.join('+')}`,
      sourcePropertyId: ids.join('+'),
      name: representative.Denominacao.trim(),
      sourceStatus:
        group.length === 1
          ? 'registered'
          : `${group.length} registrations collapsed to one physical establishment`,
      sourcePropertyType: 'Local accommodation hostel',
      sourcePropertySubtype: 'EstabelecimentoHospedagemHostel',
      sourceClassification: {
        scheme: 'Portuguese RNAL local-accommodation modality',
        value: 'Estabelecimento de Hospedagem - Hostel',
      },
      eligibleMeasures: [],
      address: {
        addressLine1: nullable(representative.Endereco),
        postalCode: nullable(representative.CodigoPostal),
        locality: nullable(representative.LOCALIDADE),
        municipality: 'Lisboa',
      },
      capacity,
      latitude: round(coordinates.latitude, 8),
      longitude: round(coordinates.longitude, 8),
      distanceFromCentreKm: round(distanceFromCentreKm, 6),
      geographicDisposition:
        distanceFromCentreKm <= SEARCH_RADIUS_KM
          ? 'pending_website_and_inventory_verification'
          : 'excluded_candidate_outside_radius',
      exclusionReason:
        distanceFromCentreKm <= SEARCH_RADIUS_KM
          ? 'RNAL explicitly classifies the establishment as a hostel but supplies no official website or current dorm/private inventory; both must be verified before measure eligibility and ranking.'
          : `Official RNAL coordinates are more than ${SEARCH_RADIUS_KM} km from the frozen sampling-frame centre.`,
      officialWebsiteUrl: null,
      websiteVerificationStatus: 'pending',
    };
  });

  const properties = [...hotelProperties, ...hostelProperties];
  const measureOrder = new Map(
    ACCOMMODATION_PANEL_MEASURES.map((measure, index) => [measure, index])
  );
  const dispositionOrder = new Map([
    ['eligible_in_radius', 0],
    ['excluded_outside_radius', 1],
    ['pending_website_and_inventory_verification', 2],
    ['excluded_candidate_outside_radius', 3],
  ]);
  properties.sort(
    (left, right) =>
      (measureOrder.get(left.eligibleMeasures[0] as AccommodationPanelMeasure) ??
        Number.MAX_SAFE_INTEGER) -
        (measureOrder.get(right.eligibleMeasures[0] as AccommodationPanelMeasure) ??
          Number.MAX_SAFE_INTEGER) ||
      (dispositionOrder.get(left.geographicDisposition) ?? Number.MAX_SAFE_INTEGER) -
        (dispositionOrder.get(right.geographicDisposition) ?? Number.MAX_SAFE_INTEGER) ||
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
      city: 'Lisbon',
      country: 'Portugal',
      targetPrimaryCount: TARGET_PRIMARY_COUNT,
    }
  );

  const measurePanels = ACCOMMODATION_PANEL_MEASURES.map((measure) => {
    if (!ACCOMMODATION_HOTEL_PANEL_MEASURES.includes(measure as never)) {
      return {
        measure,
        status: 'candidate_universe_pending_inventory_verification' as const,
        eligibleInRadiusCount: 0,
        targetPrimaryCount: 0,
        rankedProperties: [],
        notes:
          'RNAL supplies a complete explicit Lisbon hostel modality and official coordinates, but no websites or room inventory. The 97 in-radius physical candidates remain unranked until direct-site matching verifies dorm and private-room eligibility.',
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
        ? `Only ${rankedProperties.length} registered in-radius hotels exist in this class, below the five-quote minimum.`
        : 'Properties are ranked without price, brand, capacity, or website visibility inputs. Source-listed websites still require ownership and public-booking verification.',
    };
  });

  const inRadiusHotels = hotelProperties.filter(
    (property) => property.geographicDisposition === 'eligible_in_radius'
  );
  const outsideHotels = hotelProperties.length - inRadiusHotels.length;
  const inRadiusHostels = hostelProperties.filter(
    (property) => property.geographicDisposition === 'pending_website_and_inventory_verification'
  ).length;
  const outsideHostels = hostelProperties.length - inRadiusHostels;
  const classCounts = Object.fromEntries(
    ['1', '2', '3', '4'].map((star) => [
      `rnet${star}StarInRadius`,
      inRadiusHotels.filter(
        (property) => property.sourceClassification.value === `${star} star`
      ).length,
    ])
  );
  if (
    inRadiusHotels.length !== 242 ||
    outsideHotels !== 12 ||
    inRadiusHostels !== 97 ||
    outsideHostels !== 9 ||
    classCounts.rnet1StarInRadius !== 13 ||
    classCounts.rnet2StarInRadius !== 29 ||
    classCounts.rnet3StarInRadius !== 90 ||
    classCounts.rnet4StarInRadius !== 110
  ) {
    throw new Error('Lisbon frozen-centre radius counts drifted');
  }

  return {
    panelId: 'lisbon-accommodation-property-panel-2026-07-24-v1',
    city: 'Lisbon',
    country: 'Portugal',
    region: 'Europe',
    status: 'sampling_frame_frozen_websites_pending',
    samplingFrame: {
      frameKind: 'official_classification_directory',
      joinKey: null,
      inclusionCriteria: [
        'RNET municipality is Lisboa, property type is Hotel, and national classification is exactly 1, 2, 3, or 4 stars.',
        'The price-independent centre is the component-wise median of all 254 eligible official hotel coordinates.',
        `Registered hotels within ${SEARCH_RADIUS_KM} km of the frozen centre are eligible for their exact star measure.`,
        'RNAL modality is explicitly EstabelecimentoHospedagemHostel; multiple registrations with the same normalized name, postcode, and rounded coordinates are collapsed to one physical establishment.',
        'In-radius RNAL hostels remain candidates only until an official property site verifies dorm or private-room inventory.',
      ],
      exclusionCriteria: [
        'Exclude hotel-apartments, tourist apartments, pousadas, tourism residences, campsites, and 5-star hotels from hotel measures.',
        `Retain but mark registered hotels and hostel candidates beyond ${SEARCH_RADIUS_KM} km as outside-radius exclusions.`,
        'Do not infer hostel dorm or private-room inventory from the RNAL hostel modality or establishment capacity.',
        'Do not use price, brand, capacity, or website visibility in hotel selection or ranking.',
      ],
      centre: {
        method: 'componentwise_median_of_all_official_lisbon_1_to_4_star_hotel_coordinates',
        latitude: round(centreLatitude, 8),
        longitude: round(centreLongitude, 8),
        inputPropertyCount: eligibleHotelRows.length,
        searchRadiusKm: SEARCH_RADIUS_KM,
      },
      sources: [
        {
          sourceId: 'turismo-portugal-rnet-open-data-2026-07-24',
          publisher: 'Turismo de Portugal',
          datasetName: 'Empreendimentos Turísticos Existentes (RNET)',
          role: 'eligibility_classification_and_geolocation',
          landingPageUrl: OPEN_DATA_LANDING_PAGE,
          dataUrl: RNET_DATA_URL,
          requestBody: null,
          retrievedAt: RNET_RETRIEVED_AT,
          sourceLastUpdatedAt: null,
          licenceName: 'No licence stated in the official open-data catalog; factual register use with attribution',
          licenceUrl: null,
          rawRecordCount: rnetRows.length,
          rawByteCount: rnetBuffer.length,
          rawSha256: RNET_SHA256,
        },
        {
          sourceId: 'turismo-portugal-rnal-lisbon-open-data-2026-07-24',
          publisher: 'Turismo de Portugal',
          datasetName: 'Estabelecimentos de Alojamento Local (RNAL), Lisboa filter',
          role: 'candidate_universe',
          landingPageUrl: 'https://dadosabertos.turismodeportugal.pt/search?categories=%252Fcategories%252Falojamento%2520tur%25C3%25ADstico',
          dataUrl: RNAL_DATA_URL,
          requestBody: "layers=6; where=Concelho='Lisboa'",
          retrievedAt: RNAL_RETRIEVED_AT,
          sourceLastUpdatedAt: null,
          licenceName: 'No licence stated in the official open-data catalog; factual register use with attribution',
          licenceUrl: null,
          rawRecordCount: rnalRows.length,
          rawByteCount: rnalBuffer.length,
          rawSha256: RNAL_SHA256,
        },
      ],
      counts: {
        sourceRecordCount: rnetRows.length + rnalRows.length,
        sourceLodgingRecordCount: lisbonRnetRows.length + rnalRows.length,
        eligiblePropertyCount: hotelProperties.length,
        candidatePropertyCount: hostelProperties.length,
        geolocatedEligiblePropertyCount: hotelProperties.length,
        missingOfficialGeolocationCount: 0,
    outsideRadiusCount: outsideHotels + outsideHostels,
        eligibleInRadiusCount: inRadiusHotels.length,
        sourceSpecificCounts: {
          rnetPortugalRecords: rnetRows.length,
          rnetLisbonRecords: lisbonRnetRows.length,
          rnetLisbonOneToFourStarHotels: hotelProperties.length,
          rnalLisbonRecords: rnalRows.length,
          rnalLisbonHostelRegistrations: hostelRows.length,
          rnalLisbonPhysicalHostelCandidates: hostelProperties.length,
          rnalLisbonDuplicateHostelGroups: physicalHostelGroups.filter(
            (group) => group.length > 1
          ).length,
          rnalLisbonHostelCandidatesInRadius: inRadiusHostels,
          rnalLisbonHostelCandidatesOutsideRadius: outsideHostels,
          ...classCounts,
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
    fs.readFileSync(args.rnetPath),
    fs.readFileSync(args.rnalPath)
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
