import { describe, expect, it } from 'vitest';
import { cityCostObservationSchema, summarizeObservationCoverage } from './city-cost-observation';

function directFoodObservation() {
  return {
    schemaVersion: 'city-cost-observation-v1' as const,
    observationId: 'hanoi-coffee-001',
    batchId: 'pilot-2026-07',
    city: 'Hanoi',
    country: 'Vietnam',
    region: 'SEA' as const,
    category: 'drinks' as const,
    measure: 'cappuccino_1' as const,
    valueStatus: 'direct' as const,
    priceAmount: 45000,
    currency: 'VND',
    unit: 'per_person_item' as const,
    travellers: 1,
    quantity: 1,
    taxStatus: 'included' as const,
    sourceName: 'Example source',
    sourceType: 'official_website' as const,
    sourceAccess: 'public_official' as const,
    sourceTermsUrl: null,
    sourceUrl: 'https://example.com/hanoi-coffee',
    sourceRecordId: null,
    retrievedAt: '2026-07-24T00:00:00.000Z',
    priceValidFrom: '2026-07-01',
    priceValidTo: '2026-07-31',
    reportedLow: 40000,
    reportedHigh: 50000,
    sampleSize: 12,
    resultCount: null,
    checkIn: null,
    checkOut: null,
    bookingLeadDays: null,
    stayNights: null,
    season: 'not_applicable' as const,
    searchRadiusKm: 5,
    minimumReviewScore: null,
    bookerCountry: null,
    extractionMethod: 'browser_research' as const,
    extractorVersion: 'manual-v1',
    parentObservationIds: [],
    derivationMethod: null,
    modelVersion: null,
    predictionLower: null,
    predictionUpper: null,
    reviewerStatus: 'accepted' as const,
    exclusionReason: null,
    notes: '',
  };
}

function directAccommodationObservation() {
  return {
    ...directFoodObservation(),
    observationId: 'test-city-hotel-3star-low-property-1',
    category: 'accommodation' as const,
    measure: 'hotel_3star_room_2p' as const,
    priceAmount: 700,
    unit: 'per_room_night' as const,
    travellers: 2,
    sourceName: 'Property 1 official website',
    sourceType: 'official_website' as const,
    sourceAccess: 'public_property' as const,
    sourceRecordId: 'official-register-property-1',
    checkIn: '2026-10-22',
    checkOut: '2026-10-29',
    quoteCaptureDate: '2026-07-24',
    bookingLeadDays: 90,
    stayNights: 7,
    season: 'low' as const,
    searchRadiusKm: 5,
    bookerCountry: 'AU',
    samplingFrameId: 'test-city-panel-v1',
    rateAccess: 'public' as const,
    rateCondition: 'flexible' as const,
  };
}

describe('city cost observation schema', () => {
  it('accepts a sourced direct observation', () => {
    expect(cityCostObservationSchema.parse(directFoodObservation()).observationId).toBe('hanoi-coffee-001');
  });

  it('rejects a direct observation without a source URL', () => {
    const result = cityCostObservationSchema.safeParse({ ...directFoodObservation(), sourceUrl: null });
    expect(result.success).toBe(false);
  });

  it('rejects category, unit, or traveller definitions that do not match the measure', () => {
    const result = cityCostObservationSchema.safeParse({
      ...directFoodObservation(),
      category: 'food',
      unit: 'per_two_person_meal',
      travellers: 2,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(
        expect.arrayContaining(['category', 'unit', 'travellers'])
      );
    }
  });

  it('requires imputed estimates to carry a model version and interval', () => {
    const result = cityCostObservationSchema.safeParse({
      ...directFoodObservation(),
      valueStatus: 'imputed',
      sourceType: 'derived_model',
      sourceUrl: null,
      extractionMethod: 'statistical_model',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a direct property quote with fixed dates and public-rate provenance', () => {
    expect(cityCostObservationSchema.parse(directAccommodationObservation())).toMatchObject({
      bookingLeadDays: 90,
      stayNights: 7,
      season: 'low',
      rateAccess: 'public',
    });
  });

  it('rejects inconsistent stay or booking-lead arithmetic', () => {
    expect(
      cityCostObservationSchema.safeParse({
        ...directAccommodationObservation(),
        bookingLeadDays: 89,
        stayNights: 6,
      }).success
    ).toBe(false);
  });

  it('rejects accepted accommodation quotes with unknown taxes or restricted rates', () => {
    expect(
      cityCostObservationSchema.safeParse({
        ...directAccommodationObservation(),
        taxStatus: 'unknown',
        rateAccess: 'member',
        rateCondition: 'unknown',
      }).success
    ).toBe(false);
  });

  it('summarizes accepted direct coverage without counting rejected rows', () => {
    const accepted = cityCostObservationSchema.parse(directFoodObservation());
    const rejected = cityCostObservationSchema.parse({
      ...directFoodObservation(),
      observationId: 'hanoi-coffee-rejected',
      reviewerStatus: 'rejected',
      exclusionReason: 'Definition mismatch',
    });
    expect(summarizeObservationCoverage([accepted, rejected])).toEqual({
      observations: 1,
      cities: 1,
      directObservations: 1,
      directObservationPct: 100,
      byCategory: { accommodation: 0, food: 0, drinks: 1, activities: 0 },
    });
  });
});
