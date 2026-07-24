import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  accommodationPropertyPanelCollectionSchema,
  accommodationPropertySelectionHash,
  componentMedian,
  haversineDistanceKm,
  rankAccommodationProperties,
  summarizeAccommodationPropertyPanels,
  upsertAccommodationCityPanel,
  type AccommodationPropertyPanelCollection,
} from './accommodation-property-panel';

function checkedInCollection() {
  return accommodationPropertyPanelCollectionSchema.parse(
    JSON.parse(
      fs.readFileSync(
        'data/reference/accommodation_property_panels_2026_2027.json',
        'utf8'
      )
    )
  );
}

describe('accommodation property panels', () => {
  it('validates and reconciles all checked-in sampling frames', () => {
    const collection = checkedInCollection();
    expect(summarizeAccommodationPropertyPanels(collection)).toEqual({
      collectionId: 'accommodation-property-panels-2026-2027-v2',
      cities: 5,
      frozenHotelPanels: 17,
      frozenHostelPanels: 2,
      belowQuoteMinimumPanels: 1,
      unavailableHotelPanels: 3,
      candidateHostelPanels: 4,
      unavailableHostelPanels: 4,
      eligibleSourceProperties: 1379,
      candidateProperties: 120,
      eligibleInRadiusProperties: 667,
      primaryProperties: 198,
      reserveProperties: 478,
      missingOfficialGeolocation: 392,
      outsideRadius: 329,
      websitesSourceListed: 449,
      websitesVerified: 11,
    });

    const barcelona = collection.cities.find((city) => city.city === 'Barcelona')!;
    expect(barcelona.samplingFrame.centre).toEqual({
      method: 'componentwise_median_of_joined_active_1_to_4_star_hotel_coordinates',
      latitude: 41.38749043,
      longitude: 2.16952564,
      inputPropertyCount: 327,
      searchRadiusKm: 5,
    });
    expect(
      barcelona.measurePanels
        .find((panel) => panel.measure === 'hotel_1star_room_2p')!
        .rankedProperties.filter((property) => property.disposition === 'primary')
        .map((property) => property.propertyId)
    ).toEqual([
      'HB-003443',
      'HB-003925',
      'HB-000063',
      'HB-004640',
      'HB-000947',
      'HB-004641',
      'HB-004719',
      'HB-003252',
      'HB-002644',
      'HB-003728',
      'HB-004248',
      'HB-004606',
    ]);
    expect(
      barcelona.properties.every(
        (property) => property.sourcePropertySubtype === 'Hotel / Hotel'
      )
    ).toBe(true);
  });

  it('freezes Da Nang only from accepted property-level coordinates', () => {
    const daNang = checkedInCollection().cities.find((city) => city.city === 'Da Nang')!;
    expect(daNang.samplingFrame.centre).toEqual({
      method:
        'componentwise_median_of_50_deduplicated_name_matched_poi_or_exact_house_address_coordinates',
      latitude: 16.06682875,
      longitude: 108.24336055,
      inputPropertyCount: 50,
      searchRadiusKm: 5,
    });
    expect(daNang.samplingFrame.counts).toMatchObject({
      sourceRecordCount: 423,
      eligiblePropertyCount: 421,
      geolocatedEligiblePropertyCount: 50,
      missingOfficialGeolocationCount: 371,
      outsideRadiusCount: 1,
      eligibleInRadiusCount: 49,
    });
    expect(
      daNang.measurePanels.map((panel) => [
        panel.measure,
        panel.status,
        panel.eligibleInRadiusCount,
      ])
    ).toEqual([
      ['hostel_dorm_bed_1p', 'unavailable_no_unambiguous_registry_class', 0],
      ['hostel_private_room_2p', 'unavailable_no_unambiguous_registry_class', 0],
      ['hotel_1star_room_2p', 'frozen_pending_website_verification', 10],
      ['hotel_2star_room_2p', 'frozen_pending_website_verification', 8],
      ['hotel_3star_room_2p', 'frozen_pending_website_verification', 12],
      ['hotel_4star_room_2p', 'frozen_pending_website_verification', 19],
    ]);
    expect(
      daNang.properties.find((property) => property.sourcePropertyId === '17756+17757')
    ).toMatchObject({
      name: 'Hilton Garden Inn Đà Nẵng',
      geographicDisposition: 'eligible_in_radius',
      sourceClassification: { value: '4 star' },
    });
  });

  it('freezes Copenhagen without inventing missing classes or hostel inventory', () => {
    const copenhagen = checkedInCollection().cities.find(
      (city) => city.city === 'Copenhagen'
    )!;
    expect(copenhagen.samplingFrame.centre).toEqual({
      method: 'componentwise_median_of_official_kobenhavn_1_to_4_star_hotel_coordinates',
      latitude: 55.6725,
      longitude: 12.5645,
      inputPropertyCount: 29,
      searchRadiusKm: 5,
    });
    expect(copenhagen.samplingFrame.counts).toMatchObject({
      eligiblePropertyCount: 201,
      candidatePropertyCount: 13,
      outsideRadiusCount: 172,
      eligibleInRadiusCount: 29,
    });
    expect(
      copenhagen.measurePanels.map((panel) => [
        panel.measure,
        panel.status,
        panel.eligibleInRadiusCount,
      ])
    ).toEqual([
      ['hostel_dorm_bed_1p', 'candidate_universe_pending_inventory_verification', 0],
      ['hostel_private_room_2p', 'candidate_universe_pending_inventory_verification', 0],
      ['hotel_1star_room_2p', 'unavailable_no_eligible_properties', 0],
      ['hotel_2star_room_2p', 'frozen_below_quote_minimum', 3],
      ['hotel_3star_room_2p', 'frozen_pending_website_verification', 11],
      ['hotel_4star_room_2p', 'frozen_pending_website_verification', 15],
    ]);
    expect(
      copenhagen.measurePanels
        .find((panel) => panel.measure === 'hotel_2star_room_2p')!
        .rankedProperties.map((property) => property.propertyId)
    ).toEqual([
      'hotelstars-union:DK:112075',
      'hotelstars-union:DK:89237',
      'hotelstars-union:DK:89232',
    ]);
    expect(
      copenhagen.properties.filter(
        (property) => property.geographicDisposition === 'pending_inventory_and_geolocation'
      )
    ).toHaveLength(13);
  });

  it('deduplicates Prague hotels and ranks only explicitly evidenced hostel inventory', () => {
    const prague = checkedInCollection().cities.find((city) => city.city === 'Prague')!;
    expect(prague.samplingFrame.centre).toEqual({
      method:
        'componentwise_median_of_deduplicated_official_praha_1_to_4_star_hotel_coordinates',
      latitude: 50.0787,
      longitude: 14.43375,
      inputPropertyCount: 18,
      searchRadiusKm: 5,
    });
    expect(prague.samplingFrame.counts).toMatchObject({
      sourceRecordCount: 253,
      sourceLodgingRecordCount: 241,
      eligiblePropertyCount: 159,
      candidatePropertyCount: 1,
      geolocatedEligiblePropertyCount: 155,
      missingOfficialGeolocationCount: 4,
      outsideRadiusCount: 130,
      eligibleInRadiusCount: 25,
      sourceSpecificCounts: {
        hotelstarsCzechRecords: 229,
        hotelstarsOneToFourStarRawRows: 225,
        hotelstarsOneToFourStarPhysicalProperties: 148,
        hotelstarsDuplicateIdentityGroups: 76,
        hotelstarsCoordinateConflictGroups: 4,
        praguePhysicalCentreInputs: 18,
        pragueCityTourismHostelCandidates: 12,
        pragueCityTourismHostelDetailPages: 12,
        hostelDormEligibleInRadius: 10,
        hostelPrivateEligibleInRadius: 10,
        hostelInventoryPending: 1,
      },
    });
    expect(
      prague.measurePanels.map((panel) => [
        panel.measure,
        panel.status,
        panel.eligibleInRadiusCount,
      ])
    ).toEqual([
      ['hostel_dorm_bed_1p', 'frozen_pending_website_verification', 10],
      ['hostel_private_room_2p', 'frozen_pending_website_verification', 10],
      ['hotel_1star_room_2p', 'unavailable_no_eligible_properties', 0],
      ['hotel_2star_room_2p', 'unavailable_no_eligible_properties', 0],
      ['hotel_3star_room_2p', 'frozen_pending_website_verification', 5],
      ['hotel_4star_room_2p', 'frozen_pending_website_verification', 9],
    ]);
    expect(
      prague.measurePanels
        .find((panel) => panel.measure === 'hotel_3star_room_2p')!
        .rankedProperties.map((property) => property.propertyId)
    ).toEqual([
      'hotelstars-union:CZ:119417',
      'hotelstars-union:CZ:123801',
      'hotelstars-union:CZ:118911',
      'hotelstars-union:CZ:125697',
      'hotelstars-union:CZ:118408',
    ]);
    expect(
      prague.properties.find(
        (property) => property.propertyId === 'prague-city-tourism:luma-terra-prague'
      )
    ).toMatchObject({
      eligibleMeasures: [],
      geographicDisposition: 'pending_inventory_verification',
      latitude: 50.07625299,
      longitude: 14.43046796,
    });
  });

  it('freezes Lisbon from complete official hotel and hostel registers without inferring hostel inventory', () => {
    const lisbon = checkedInCollection().cities.find((city) => city.city === 'Lisbon')!;
    expect(lisbon.samplingFrame.centre).toEqual({
      method: 'componentwise_median_of_all_official_lisbon_1_to_4_star_hotel_coordinates',
      latitude: 38.72280334,
      longitude: -9.14327108,
      inputPropertyCount: 254,
      searchRadiusKm: 5,
    });
    expect(lisbon.samplingFrame.counts).toMatchObject({
      sourceRecordCount: 17_514,
      sourceLodgingRecordCount: 12_237,
      eligiblePropertyCount: 254,
      candidatePropertyCount: 106,
      geolocatedEligiblePropertyCount: 254,
      missingOfficialGeolocationCount: 0,
      outsideRadiusCount: 21,
      eligibleInRadiusCount: 242,
      sourceSpecificCounts: {
        rnetPortugalRecords: 5_649,
        rnetLisbonRecords: 372,
        rnetLisbonOneToFourStarHotels: 254,
        rnalLisbonRecords: 11_865,
        rnalLisbonHostelRegistrations: 113,
        rnalLisbonPhysicalHostelCandidates: 106,
        rnalLisbonDuplicateHostelGroups: 4,
        rnalLisbonHostelCandidatesInRadius: 97,
        rnalLisbonHostelCandidatesOutsideRadius: 9,
        rnet1StarInRadius: 13,
        rnet2StarInRadius: 29,
        rnet3StarInRadius: 90,
        rnet4StarInRadius: 110,
      },
    });
    expect(
      lisbon.measurePanels.map((panel) => [
        panel.measure,
        panel.status,
        panel.eligibleInRadiusCount,
      ])
    ).toEqual([
      ['hostel_dorm_bed_1p', 'candidate_universe_pending_inventory_verification', 0],
      ['hostel_private_room_2p', 'candidate_universe_pending_inventory_verification', 0],
      ['hotel_1star_room_2p', 'frozen_pending_website_verification', 13],
      ['hotel_2star_room_2p', 'frozen_pending_website_verification', 29],
      ['hotel_3star_room_2p', 'frozen_pending_website_verification', 90],
      ['hotel_4star_room_2p', 'frozen_pending_website_verification', 110],
    ]);
    expect(
      lisbon.measurePanels
        .find((panel) => panel.measure === 'hotel_1star_room_2p')!
        .rankedProperties.filter((property) => property.disposition === 'primary')
        .map((property) => property.propertyId)
    ).toEqual([
      'rnet:PT:11228',
      'rnet:PT:7575',
      'rnet:PT:1384',
      'rnet:PT:12517',
      'rnet:PT:12066',
      'rnet:PT:8976',
      'rnet:PT:13475',
      'rnet:PT:3100',
      'rnet:PT:11959',
      'rnet:PT:12357',
      'rnet:PT:9836',
      'rnet:PT:3914',
    ]);
    expect(
      lisbon.properties.filter(
        (property) =>
          property.geographicDisposition === 'pending_website_and_inventory_verification'
      )
    ).toHaveLength(97);
    expect(
      lisbon.properties.find((property) => property.propertyId.includes('11282+25262+114343'))
    ).toMatchObject({
      name: 'Lisboa Central Hostel',
      capacity: 70,
      eligibleMeasures: [],
      sourceStatus: '3 registrations collapsed to one physical establishment',
    });
  });

  it('ranks properties identically regardless of input order', () => {
    const properties = [
      { propertyId: 'property-3', eligibleMeasures: ['hotel_1star_room_2p' as const] },
      { propertyId: 'property-1', eligibleMeasures: ['hotel_1star_room_2p' as const] },
      { propertyId: 'property-2', eligibleMeasures: ['hotel_1star_room_2p' as const] },
    ];
    const input = {
      scheduleId: 'test-schedule',
      city: 'Test City',
      country: 'Testland',
      targetPrimaryCount: 2,
    };
    expect(rankAccommodationProperties(properties, input)).toEqual(
      rankAccommodationProperties([...properties].reverse(), input)
    );
    expect(accommodationPropertySelectionHash('frozen-seed', 'property-1')).toMatch(
      /^[a-f0-9]{64}$/
    );
  });

  it('upserts city frames in stable order without moving the collection lock backwards', () => {
    const collection = checkedInCollection();
    const copenhagen = collection.cities.find((city) => city.city === 'Copenhagen')!;
    const reordered = {
      ...collection,
      cities: [...collection.cities].reverse(),
    };
    const upserted = upsertAccommodationCityPanel(
      reordered,
      copenhagen,
      '2026-07-24T07:23:48.123Z'
    );
    expect(upserted.cities.map((city) => city.city)).toEqual([
      'Barcelona',
      'Copenhagen',
      'Da Nang',
      'Lisbon',
      'Prague',
    ]);
    expect(upserted.lockedAt).toBe(collection.lockedAt);
    expect(upserted.lockedAt.localeCompare('2026-07-24T07:23:48.123Z')).toBeGreaterThan(0);
  });

  it('allows one verified hostel to participate in both hostel measures', () => {
    const ranking = rankAccommodationProperties(
      [
        {
          propertyId: 'shared-hostel',
          eligibleMeasures: ['hostel_dorm_bed_1p', 'hostel_private_room_2p'],
        },
      ],
      {
        scheduleId: 'test-schedule',
        city: 'Test City',
        country: 'Testland',
        targetPrimaryCount: 12,
      }
    );
    expect(ranking.get('hostel_dorm_bed_1p')?.[0].propertyId).toBe('shared-hostel');
    expect(ranking.get('hostel_private_room_2p')?.[0].propertyId).toBe('shared-hostel');
  });

  it('calculates the centre and radius inputs deterministically', () => {
    expect(componentMedian([4, 1, 3, 2])).toBe(2.5);
    expect(componentMedian([3, 1, 2])).toBe(2);
    expect(haversineDistanceKm(41.38749043, 2.16952564, 41.38749043, 2.16952564)).toBe(0);
    expect(haversineDistanceKm(0, 0, 0, 1)).toBeCloseTo(111.195, 3);
  });

  it('rejects panel ids that drift from the deterministic property ranks', () => {
    const collection = structuredClone(
      checkedInCollection()
    ) as AccommodationPropertyPanelCollection;
    const oneStar = collection.cities[0].measurePanels.find(
      (panel) => panel.measure === 'hotel_1star_room_2p'
    )!;
    [oneStar.rankedProperties[0], oneStar.rankedProperties[1]] = [
      oneStar.rankedProperties[1],
      oneStar.rankedProperties[0],
    ];
    expect(accommodationPropertyPanelCollectionSchema.safeParse(collection).success).toBe(false);
  });

  it('rejects a property hash that does not match the frozen selection seed', () => {
    const collection = structuredClone(
      checkedInCollection()
    ) as AccommodationPropertyPanelCollection;
    const rankedProperty = collection.cities[0].measurePanels.find(
      (panel) => panel.rankedProperties.length > 0
    )!.rankedProperties[0];
    rankedProperty.selectionHash = '0'.repeat(64);
    expect(accommodationPropertyPanelCollectionSchema.safeParse(collection).success).toBe(false);
  });

  it('rejects a hostel candidate promoted without inventory or geolocation evidence', () => {
    const collection = structuredClone(
      checkedInCollection()
    ) as AccommodationPropertyPanelCollection;
    const candidate = collection.cities
      .find((city) => city.city === 'Copenhagen')!
      .properties.find(
        (property) => property.geographicDisposition === 'pending_inventory_and_geolocation'
      )!;
    candidate.eligibleMeasures = ['hostel_dorm_bed_1p'];
    expect(accommodationPropertyPanelCollectionSchema.safeParse(collection).success).toBe(false);
  });
});
