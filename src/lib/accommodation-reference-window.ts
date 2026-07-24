import { z } from 'zod';
import { cityCostRegionSchema } from './city-cost-collection-batch';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export const ACCOMMODATION_REFERENCE_SEASONS = ['low', 'shoulder', 'high'] as const;
export type AccommodationReferenceSeason = (typeof ACCOMMODATION_REFERENCE_SEASONS)[number];

export const ACCOMMODATION_PANEL_MEASURES = [
  'hostel_dorm_bed_1p',
  'hostel_private_room_2p',
  'hotel_1star_room_2p',
  'hotel_2star_room_2p',
  'hotel_3star_room_2p',
  'hotel_4star_room_2p',
] as const;

const eventReviewSchema = z
  .object({
    status: z.enum(['pending_final_check', 'cleared', 'replaced']),
    dueDate: z.string().regex(isoDate),
    checkedAt: z.string().datetime().nullable(),
    notes: z.string().min(1),
  })
  .superRefine((review, context) => {
    if (review.status === 'cleared' && review.checkedAt === null) {
      context.addIssue({
        code: 'custom',
        path: ['checkedAt'],
        message: 'A cleared event review requires checkedAt',
      });
    }
    if (review.status === 'pending_final_check' && review.checkedAt !== null) {
      context.addIssue({
        code: 'custom',
        path: ['checkedAt'],
        message: 'A pending event review cannot have checkedAt',
      });
    }
  });

const seasonEvidenceSchema = z.object({
  season: z.enum(ACCOMMODATION_REFERENCE_SEASONS),
  evidenceClass: z.enum([
    'monthly_accommodation_demand',
    'official_peak_offpeak_guidance',
    'official_climate_guidance',
  ]),
  confidence: z.enum(['high', 'moderate', 'provisional']),
  sourceName: z.string().min(1),
  sourceUrls: z.array(z.string().url()).min(1),
  accessedAt: z.string().datetime(),
  rationale: z.string().min(1),
});

const referenceWindowSchema = z.object({
  season: z.enum(ACCOMMODATION_REFERENCE_SEASONS),
  checkIn: z.string().regex(isoDate),
  checkOut: z.string().regex(isoDate),
  quoteCaptureDate: z.string().regex(isoDate),
  status: z.enum(['scheduled', 'captured', 'replaced']),
  eventReview: eventReviewSchema,
});

const referenceCitySchema = z.object({
  city: z.string().min(1),
  country: z.string().min(1),
  region: cityCostRegionSchema,
  searchCentre: z.string().min(1),
  eventCalendarUrls: z.array(z.string().url()).min(1),
  seasonEvidence: z.array(seasonEvidenceSchema).length(3),
  windows: z.array(referenceWindowSchema).length(3),
});

function utcDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function daysBetween(start: string, end: string) {
  return (utcDate(end).getTime() - utcDate(start).getTime()) / 86_400_000;
}

export const accommodationReferenceWindowScheduleSchema = z
  .object({
    schemaVersion: z.literal('accommodation-reference-windows-v1'),
    scheduleId: z.string().min(1),
    lockedAt: z.string().datetime(),
    referencePeriodStart: z.string().regex(isoDate),
    referencePeriodEnd: z.string().regex(isoDate),
    protocol: z.object({
      adults: z.literal(2),
      rooms: z.literal(1),
      stayNights: z.literal(7),
      targetBookingLeadDays: z.literal(90),
      bookingLeadToleranceDays: z.literal(0),
      bookerCountry: z.literal('AU'),
      searchRadiusKm: z.number().positive(),
      samplingFrame: z.literal('official_accommodation_register'),
      priceSource: z.literal('direct_property_website'),
      targetPanelPropertiesPerMeasure: z.number().int().min(5),
      minimumPanelPropertiesPerMeasureSeason: z.number().int().min(3),
      minimumCrossSeasonPanelOverlapPct: z.number().min(0).max(100),
      memberRatePolicy: z.literal('exclude_member_mobile_and_login_only_rates'),
      roomRatePolicy: z.literal('lowest_public_standard_rate_record_cancellation_basis'),
      mandatoryChargePolicy: z.literal('include_all_mandatory_taxes_and_nonconditional_fees'),
      mealPolicy: z.literal('exclude_optional_meals_and_addons'),
      seasonWeighting: z.literal('equal_weight_median_of_three_season_medians'),
      eventExclusionRule: z.string().min(1),
      replacementRule: z.string().min(1),
    }),
    cities: z.array(referenceCitySchema).min(1),
  })
  .superRefine((schedule, context) => {
    if (schedule.referencePeriodStart > schedule.referencePeriodEnd) {
      context.addIssue({
        code: 'custom',
        path: ['referencePeriodStart'],
        message: 'referencePeriodStart cannot be after referencePeriodEnd',
      });
    }

    if (
      schedule.protocol.minimumPanelPropertiesPerMeasureSeason >
      schedule.protocol.targetPanelPropertiesPerMeasure
    ) {
      context.addIssue({
        code: 'custom',
        path: ['protocol', 'minimumPanelPropertiesPerMeasureSeason'],
        message: 'The minimum panel size cannot exceed the target panel size',
      });
    }

    const cityKeys = new Set<string>();
    schedule.cities.forEach((city, cityIndex) => {
      const cityKey = `${city.city}|${city.country}`;
      if (cityKeys.has(cityKey)) {
        context.addIssue({
          code: 'custom',
          path: ['cities', cityIndex],
          message: `Duplicate city ${cityKey}`,
        });
      }
      cityKeys.add(cityKey);

      const evidenceSeasons = city.seasonEvidence.map((item) => item.season).sort();
      const windowSeasons = city.windows.map((item) => item.season).sort();
      const expected = [...ACCOMMODATION_REFERENCE_SEASONS].sort();
      if (JSON.stringify(evidenceSeasons) !== JSON.stringify(expected)) {
        context.addIssue({
          code: 'custom',
          path: ['cities', cityIndex, 'seasonEvidence'],
          message: 'Season evidence must contain low, shoulder, and high exactly once',
        });
      }
      if (JSON.stringify(windowSeasons) !== JSON.stringify(expected)) {
        context.addIssue({
          code: 'custom',
          path: ['cities', cityIndex, 'windows'],
          message: 'Reference windows must contain low, shoulder, and high exactly once',
        });
      }

      city.windows.forEach((window, windowIndex) => {
        const path = ['cities', cityIndex, 'windows', windowIndex] as const;
        if (daysBetween(window.checkIn, window.checkOut) !== schedule.protocol.stayNights) {
          context.addIssue({
            code: 'custom',
            path: [...path, 'checkOut'],
            message: `Reference stays must be exactly ${schedule.protocol.stayNights} nights`,
          });
        }
        if (
          daysBetween(window.quoteCaptureDate, window.checkIn) !==
          schedule.protocol.targetBookingLeadDays
        ) {
          context.addIssue({
            code: 'custom',
            path: [...path, 'quoteCaptureDate'],
            message: `Quote capture must be exactly ${schedule.protocol.targetBookingLeadDays} days before check-in`,
          });
        }
        if (window.eventReview.dueDate !== window.quoteCaptureDate) {
          context.addIssue({
            code: 'custom',
            path: [...path, 'eventReview', 'dueDate'],
            message: 'Final event review is due on the quote-capture date',
          });
        }
        if (
          window.checkIn < schedule.referencePeriodStart ||
          window.checkOut > schedule.referencePeriodEnd
        ) {
          context.addIssue({
            code: 'custom',
            path: [...path, 'checkIn'],
            message: 'Reference stay falls outside the declared reference period',
          });
        }
      });
    });
  });

export type AccommodationReferenceWindowSchedule = z.infer<
  typeof accommodationReferenceWindowScheduleSchema
>;

export function summarizeAccommodationReferenceWindows(
  scheduleInput: AccommodationReferenceWindowSchedule
) {
  const schedule = accommodationReferenceWindowScheduleSchema.parse(scheduleInput);
  const windows = schedule.cities.flatMap((city) => city.windows);
  return {
    scheduleId: schedule.scheduleId,
    cities: schedule.cities.length,
    windows: windows.length,
    seasons: Object.fromEntries(
      ACCOMMODATION_REFERENCE_SEASONS.map((season) => [
        season,
        windows.filter((window) => window.season === season).length,
      ])
    ) as Record<AccommodationReferenceSeason, number>,
    nextQuoteCaptureDate: windows
      .filter((window) => window.status === 'scheduled')
      .map((window) => window.quoteCaptureDate)
      .sort()[0] ?? null,
    pendingEventReviews: windows.filter(
      (window) => window.eventReview.status === 'pending_final_check'
    ).length,
  };
}
