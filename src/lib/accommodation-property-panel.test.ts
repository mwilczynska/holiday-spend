import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  accommodationPropertyPanelCollectionSchema,
  accommodationPropertySelectionHash,
  componentMedian,
  haversineDistanceKm,
  rankAccommodationProperties,
  summarizeAccommodationPropertyPanels,
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
  it('validates and reconciles the checked-in Barcelona sampling frame', () => {
    const collection = checkedInCollection();
    expect(summarizeAccommodationPropertyPanels(collection)).toEqual({
      collectionId: 'accommodation-property-panels-2026-2027-v1',
      cities: 1,
      frozenHotelPanels: 4,
      unavailableHostelPanels: 2,
      eligibleRegisterProperties: 344,
      eligibleInRadiusProperties: 322,
      primaryProperties: 48,
      reserveProperties: 274,
      missingOfficialGeolocation: 17,
      outsideRadius: 5,
      websitesVerified: 0,
    });
    expect(collection.cities[0].samplingFrame.centre).toEqual({
      method: 'componentwise_median_of_joined_active_1_to_4_star_hotel_coordinates',
      latitude: 41.38749043,
      longitude: 2.16952564,
      inputPropertyCount: 327,
      searchRadiusKm: 5,
    });
    expect(
      collection.cities[0].measurePanels.find(
        (panel) => panel.measure === 'hotel_1star_room_2p'
      )?.primaryRegistrationIds
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
  });

  it('ranks properties identically regardless of input order', () => {
    const properties = [
      { registrationId: 'HB-000003', measure: 'hotel_1star_room_2p' as const },
      { registrationId: 'HB-000001', measure: 'hotel_1star_room_2p' as const },
      { registrationId: 'HB-000002', measure: 'hotel_1star_room_2p' as const },
    ];
    const input = {
      scheduleId: 'test-schedule',
      city: 'Test City',
      country: 'Testland',
      targetPrimaryCount: 2,
    };
    const normalize = (ranking: ReturnType<typeof rankAccommodationProperties>) =>
      Array.from(ranking.entries()).sort(([left], [right]) => left.localeCompare(right));
    expect(normalize(rankAccommodationProperties(properties, input))).toEqual(
      normalize(rankAccommodationProperties([...properties].reverse(), input))
    );
    expect(
      accommodationPropertySelectionHash('frozen-seed', 'HB-000001')
    ).toMatch(/^[a-f0-9]{64}$/);
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
    [oneStar.primaryRegistrationIds[0], oneStar.primaryRegistrationIds[1]] = [
      oneStar.primaryRegistrationIds[1],
      oneStar.primaryRegistrationIds[0],
    ];
    expect(accommodationPropertyPanelCollectionSchema.safeParse(collection).success).toBe(false);
  });

  it('rejects a property hash that does not match the frozen selection seed', () => {
    const collection = structuredClone(
      checkedInCollection()
    ) as AccommodationPropertyPanelCollection;
    const property = collection.cities[0].properties.find(
      (candidate) => candidate.disposition === 'primary'
    )!;
    property.selectionHash = '0'.repeat(64);
    expect(accommodationPropertyPanelCollectionSchema.safeParse(collection).success).toBe(false);
  });

  it('rejects a hotel-apartment modality in the standard-room frame', () => {
    const collection = structuredClone(checkedInCollection()) as unknown as {
      cities: Array<{ properties: Array<{ registryModality: string }> }>;
    };
    collection.cities[0].properties[0].registryModality = 'Hotel-apartament';
    expect(accommodationPropertyPanelCollectionSchema.safeParse(collection).success).toBe(false);
  });
});
