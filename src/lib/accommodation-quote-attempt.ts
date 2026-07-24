import { z } from 'zod';
import {
  ACCOMMODATION_PANEL_MEASURES,
  type AccommodationPanelMeasure,
} from './accommodation-reference-window';
import { cityCostRegionSchema } from './city-cost-collection-batch';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const currencyCode = /^[A-Z]{3}$/;

export const ACCOMMODATION_QUOTE_ATTEMPT_OUTCOMES = [
  'quoted',
  'no_availability',
  'official_site_not_found',
  'booking_path_unavailable',
  'exact_dates_not_supported',
  'access_blocked',
  'rate_not_comparable',
] as const;

function daysBetween(start: string, end: string) {
  return (
    new Date(`${end}T00:00:00.000Z`).getTime() -
    new Date(`${start}T00:00:00.000Z`).getTime()
  ) / 86_400_000;
}

const quoteSchema = z.object({
  currency: z.string().regex(currencyCode),
  totalAmount: z.number().positive(),
  nightlyAmount: z.number().positive(),
  roomName: z.string().min(1),
  rateName: z.string().min(1),
  taxStatus: z.enum(['included', 'excluded', 'mixed', 'unknown']),
  rateAccess: z.enum(['public', 'member', 'mobile', 'login', 'unknown']),
  rateCondition: z.enum(['flexible', 'non_refundable', 'mixed', 'unknown']),
  mealBasis: z.enum([
    'room_only',
    'breakfast_included_bundled',
    'other_meal_included_bundled',
    'unknown',
  ]),
  cancellationNotes: z.string().min(1),
  mandatoryChargeNotes: z.string().min(1),
});

export const accommodationQuoteAttemptSchema = z
  .object({
    schemaVersion: z.literal('accommodation-quote-attempt-v1'),
    attemptId: z.string().min(1),
    scheduleId: z.string().min(1),
    panelId: z.string().min(1),
    propertyId: z.string().min(1),
    selectionRank: z.number().int().positive(),
    panelDisposition: z.enum(['primary', 'reserve']),
    city: z.string().min(1),
    country: z.string().min(1),
    region: cityCostRegionSchema,
    measure: z.enum(ACCOMMODATION_PANEL_MEASURES),
    season: z.enum(['low', 'shoulder', 'high']),
    attemptedAt: z.string().datetime(),
    quoteCaptureDate: z.string().regex(isoDate),
    checkIn: z.string().regex(isoDate),
    checkOut: z.string().regex(isoDate),
    bookingLeadDays: z.literal(90),
    stayNights: z.literal(7),
    adults: z.literal(2),
    rooms: z.literal(1),
    bookerCountry: z.literal('AU'),
    searchRadiusKm: z.literal(5),
    officialWebsiteUrl: z.string().url(),
    bookingUrl: z.string().url().nullable(),
    websiteOwnershipStatus: z.enum(['verified', 'unverified']),
    outcome: z.enum(ACCOMMODATION_QUOTE_ATTEMPT_OUTCOMES),
    protocolDisposition: z.enum(['accepted', 'rejected', 'not_applicable']),
    quote: quoteSchema.nullable(),
    observationId: z.string().min(1).nullable(),
    exclusionReason: z.string().min(1).nullable(),
    evidenceNotes: z.string().min(1),
  })
  .superRefine((attempt, context) => {
    if (daysBetween(attempt.checkIn, attempt.checkOut) !== attempt.stayNights) {
      context.addIssue({
        code: 'custom',
        path: ['stayNights'],
        message: 'Attempt dates must describe the frozen seven-night stay',
      });
    }
    if (
      daysBetween(attempt.quoteCaptureDate, attempt.checkIn) !==
      attempt.bookingLeadDays
    ) {
      context.addIssue({
        code: 'custom',
        path: ['bookingLeadDays'],
        message: 'Attempt must use the frozen 90-day booking lead',
      });
    }

    const hasQuote = attempt.outcome === 'quoted';
    if (hasQuote !== (attempt.quote !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['quote'],
        message: 'Only a quoted outcome may carry quote values',
      });
    }
    if (!hasQuote && attempt.protocolDisposition !== 'not_applicable') {
      context.addIssue({
        code: 'custom',
        path: ['protocolDisposition'],
        message: 'A failed retrieval attempt must be not_applicable, not accepted or rejected',
      });
    }
    if (hasQuote && attempt.protocolDisposition === 'not_applicable') {
      context.addIssue({
        code: 'custom',
        path: ['protocolDisposition'],
        message: 'A retrieved quote must be accepted or rejected against the protocol',
      });
    }

    if (attempt.quote) {
      const expectedNightly = attempt.quote.totalAmount / attempt.stayNights;
      if (Math.abs(expectedNightly - attempt.quote.nightlyAmount) > 0.02) {
        context.addIssue({
          code: 'custom',
          path: ['quote', 'nightlyAmount'],
          message: 'nightlyAmount must reconcile to totalAmount over seven nights',
        });
      }
    }

    if (attempt.protocolDisposition === 'accepted') {
      if (!attempt.quote) return;
      if (attempt.websiteOwnershipStatus !== 'verified') {
        context.addIssue({
          code: 'custom',
          path: ['websiteOwnershipStatus'],
          message: 'Accepted quotes require verified official-site ownership',
        });
      }
      if (!attempt.bookingUrl) {
        context.addIssue({
          code: 'custom',
          path: ['bookingUrl'],
          message: 'Accepted quotes require the exact public booking URL',
        });
      }
      if (!attempt.observationId) {
        context.addIssue({
          code: 'custom',
          path: ['observationId'],
          message: 'Accepted quotes must link to a materializable observation',
        });
      }
      if (attempt.exclusionReason !== null) {
        context.addIssue({
          code: 'custom',
          path: ['exclusionReason'],
          message: 'Accepted quotes cannot carry an exclusion reason',
        });
      }
      if (attempt.quote.taxStatus !== 'included') {
        context.addIssue({
          code: 'custom',
          path: ['quote', 'taxStatus'],
          message: 'Accepted quotes must include all mandatory taxes and fees',
        });
      }
      if (attempt.quote.rateAccess !== 'public') {
        context.addIssue({
          code: 'custom',
          path: ['quote', 'rateAccess'],
          message: 'Accepted quotes must use a public, non-member rate',
        });
      }
      if (!['flexible', 'non_refundable'].includes(attempt.quote.rateCondition)) {
        context.addIssue({
          code: 'custom',
          path: ['quote', 'rateCondition'],
          message: 'Accepted quotes must record a comparable cancellation basis',
        });
      }
    } else {
      if (attempt.observationId !== null) {
        context.addIssue({
          code: 'custom',
          path: ['observationId'],
          message: 'Only accepted quotes may link to an observation',
        });
      }
      if (!attempt.exclusionReason) {
        context.addIssue({
          code: 'custom',
          path: ['exclusionReason'],
          message: 'Failed or rejected attempts require an explicit exclusion reason',
        });
      }
    }
  });

export type AccommodationQuoteAttempt = z.infer<
  typeof accommodationQuoteAttemptSchema
>;

export function summarizeAccommodationQuoteAttempts(
  attempts: AccommodationQuoteAttempt[]
) {
  const accepted = attempts.filter(
    (attempt) => attempt.protocolDisposition === 'accepted'
  );
  const failed = attempts.filter((attempt) => attempt.outcome !== 'quoted');
  const properties = new Set(attempts.map((attempt) => attempt.propertyId));
  const acceptedProperties = new Set(accepted.map((attempt) => attempt.propertyId));
  const measures = new Set<AccommodationPanelMeasure>(
    accepted.map((attempt) => attempt.measure)
  );

  return {
    attempts: attempts.length,
    properties: properties.size,
    acceptedQuotes: accepted.length,
    acceptedProperties: acceptedProperties.size,
    failedAttempts: failed.length,
    acceptedMeasures: measures.size,
    byOutcome: Object.fromEntries(
      ACCOMMODATION_QUOTE_ATTEMPT_OUTCOMES.map((outcome) => [
        outcome,
        attempts.filter((attempt) => attempt.outcome === outcome).length,
      ])
    ),
  };
}
