import { describe, expect, it } from 'vitest';
import {
  accommodationQuoteAttemptSchema,
  summarizeAccommodationQuoteAttempts,
} from './accommodation-quote-attempt';

function acceptedAttempt() {
  return {
    schemaVersion: 'accommodation-quote-attempt-v1' as const,
    attemptId: 'test-property-shoulder-2026-07-24',
    scheduleId: 'test-schedule',
    panelId: 'test-panel',
    propertyId: 'register:test-property',
    selectionRank: 1,
    panelDisposition: 'primary' as const,
    city: 'Test City',
    country: 'Testland',
    region: 'Europe' as const,
    measure: 'hotel_4star_room_2p' as const,
    season: 'shoulder' as const,
    attemptedAt: '2026-07-24T08:30:00.000Z',
    quoteCaptureDate: '2026-07-24',
    checkIn: '2026-10-22',
    checkOut: '2026-10-29',
    bookingLeadDays: 90 as const,
    stayNights: 7 as const,
    adults: 2 as const,
    rooms: 1 as const,
    bookerCountry: 'AU' as const,
    searchRadiusKm: 5 as const,
    officialWebsiteUrl: 'https://example.com/',
    bookingUrl: 'https://book.example.com/?in=2026-10-22&out=2026-10-29',
    websiteOwnershipStatus: 'verified' as const,
    outcome: 'quoted' as const,
    protocolDisposition: 'accepted' as const,
    quote: {
      currency: 'DKK',
      totalAmount: 7000,
      nightlyAmount: 1000,
      roomName: 'Standard Double',
      rateName: 'Public flexible rate',
      taxStatus: 'included' as const,
      rateAccess: 'public' as const,
      rateCondition: 'flexible' as const,
      mealBasis: 'room_only' as const,
      cancellationNotes: 'Free cancellation until one day before arrival.',
      mandatoryChargeNotes: 'Booking summary states that taxes are included.',
    },
    observationId: 'test-property-shoulder-observation',
    exclusionReason: null,
    evidenceNotes: 'Official site linked directly to the public booking engine.',
  };
}

describe('accommodation quote attempt schema', () => {
  it('accepts a fully reconciled public property quote', () => {
    expect(accommodationQuoteAttemptSchema.parse(acceptedAttempt())).toMatchObject({
      outcome: 'quoted',
      protocolDisposition: 'accepted',
      quote: { nightlyAmount: 1000 },
    });
  });

  it('retains a no-availability result without inventing a zero price', () => {
    const parsed = accommodationQuoteAttemptSchema.parse({
      ...acceptedAttempt(),
      attemptId: 'test-property-no-availability',
      outcome: 'no_availability',
      protocolDisposition: 'not_applicable',
      quote: null,
      observationId: null,
      exclusionReason: 'The exact seven-night reference week had no available category.',
    });
    expect(parsed.quote).toBeNull();
  });

  it('rejects unreconciled nightly and total values', () => {
    const result = accommodationQuoteAttemptSchema.safeParse({
      ...acceptedAttempt(),
      quote: { ...acceptedAttempt().quote, nightlyAmount: 900 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an accepted quote with unknown taxes or member access', () => {
    const result = accommodationQuoteAttemptSchema.safeParse({
      ...acceptedAttempt(),
      quote: {
        ...acceptedAttempt().quote,
        taxStatus: 'unknown',
        rateAccess: 'member',
      },
    });
    expect(result.success).toBe(false);
  });

  it('summarizes accepted quotes separately from failed attempts', () => {
    const accepted = accommodationQuoteAttemptSchema.parse(acceptedAttempt());
    const failed = accommodationQuoteAttemptSchema.parse({
      ...acceptedAttempt(),
      attemptId: 'test-property-no-availability',
      outcome: 'no_availability',
      protocolDisposition: 'not_applicable',
      quote: null,
      observationId: null,
      exclusionReason: 'No availability.',
    });
    expect(summarizeAccommodationQuoteAttempts([accepted, failed])).toMatchObject({
      attempts: 2,
      properties: 1,
      acceptedQuotes: 1,
      failedAttempts: 1,
      acceptedMeasures: 1,
      byOutcome: { quoted: 1, no_availability: 1 },
    });
  });
});
