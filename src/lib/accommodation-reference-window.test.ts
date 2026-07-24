import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  accommodationReferenceWindowScheduleSchema,
  summarizeAccommodationReferenceWindows,
  type AccommodationReferenceWindowSchedule,
} from './accommodation-reference-window';

function fixture(): AccommodationReferenceWindowSchedule {
  return {
    schemaVersion: 'accommodation-reference-windows-v1' as const,
    scheduleId: 'test-schedule',
    lockedAt: '2026-07-24T00:00:00.000Z',
    referencePeriodStart: '2026-10-01',
    referencePeriodEnd: '2027-08-01',
    protocol: {
      adults: 2 as const,
      rooms: 1 as const,
      stayNights: 7 as const,
      targetBookingLeadDays: 90 as const,
      bookingLeadToleranceDays: 0 as const,
      bookerCountry: 'AU' as const,
      searchRadiusKm: 5,
      samplingFrame: 'official_accommodation_register' as const,
      priceSource: 'direct_property_website' as const,
      targetPanelPropertiesPerMeasure: 12,
      minimumPanelPropertiesPerMeasureSeason: 5,
      minimumCrossSeasonPanelOverlapPct: 60,
      memberRatePolicy: 'exclude_member_mobile_and_login_only_rates' as const,
      roomRatePolicy: 'lowest_public_standard_rate_record_cancellation_basis' as const,
      mandatoryChargePolicy: 'include_all_mandatory_taxes_and_nonconditional_fees' as const,
      mealPolicy: 'exclude_optional_meals_and_addons' as const,
      seasonWeighting: 'equal_weight_median_of_three_season_medians' as const,
      eventExclusionRule: 'Check official calendars on capture date.',
      replacementRule: 'Move to the next seven-night window in the same season.',
    },
    cities: [
      {
        city: 'Test City',
        country: 'Testland',
        region: 'Europe' as const,
        searchCentre: 'Marketplace-defined city centre',
        eventCalendarUrls: ['https://example.com/events'],
        seasonEvidence: ['low', 'shoulder', 'high'].map((season) => ({
          season,
          evidenceClass: 'official_peak_offpeak_guidance' as const,
          confidence: 'high' as const,
          sourceName: 'Official tourism source',
          sourceUrls: ['https://example.com/seasons'],
          accessedAt: '2026-07-24T00:00:00.000Z',
          rationale: `${season} season rationale`,
        })),
        windows: [
          ['low', '2026-10-22', '2026-10-29', '2026-07-24'],
          ['shoulder', '2027-02-08', '2027-02-15', '2026-11-10'],
          ['high', '2027-07-12', '2027-07-19', '2027-04-13'],
        ].map(([season, checkIn, checkOut, quoteCaptureDate]) => ({
          season,
          checkIn,
          checkOut,
          quoteCaptureDate,
          status: 'scheduled' as const,
          eventReview: {
            status: 'pending_final_check' as const,
            dueDate: quoteCaptureDate,
            checkedAt: null,
            notes: 'Final review is intentionally deferred until quote capture.',
          },
        })),
      },
    ],
  } as AccommodationReferenceWindowSchedule;
}

describe('accommodation reference-window schedule', () => {
  it('validates the checked-in nine-city schedule', () => {
    const parsed = accommodationReferenceWindowScheduleSchema.parse(
      JSON.parse(
        fs.readFileSync(
          'data/reference/accommodation_reference_windows_2026_2027.json',
          'utf8'
        )
      )
    );
    expect(summarizeAccommodationReferenceWindows(parsed)).toEqual({
      scheduleId: 'accommodation-reference-2026-2027-v1',
      cities: 9,
      windows: 27,
      seasons: { low: 9, shoulder: 9, high: 9 },
      nextQuoteCaptureDate: '2026-07-24',
      pendingEventReviews: 25,
    });
    expect(
      parsed.cities
        .find((city) => city.city === 'Lisbon')!
        .windows.find((window) => window.season === 'shoulder')
    ).toMatchObject({
      checkIn: '2026-10-29',
      checkOut: '2026-11-05',
      quoteCaptureDate: '2026-07-31',
      replacementHistory: [
        {
          checkIn: '2026-10-22',
          checkOut: '2026-10-29',
          quoteCaptureDate: '2026-07-24',
        },
      ],
    });
  });

  it('rejects a stay that is not seven nights', () => {
    const data = fixture();
    data.cities[0].windows[0].checkOut = '2026-10-28';
    expect(accommodationReferenceWindowScheduleSchema.safeParse(data).success).toBe(false);
  });

  it('rejects a quote that is not captured at the fixed 90-day lead', () => {
    const data = fixture();
    data.cities[0].windows[0].quoteCaptureDate = '2026-07-25';
    data.cities[0].windows[0].eventReview.dueDate = '2026-07-25';
    expect(accommodationReferenceWindowScheduleSchema.safeParse(data).success).toBe(false);
  });

  it('rejects duplicate or missing season strata', () => {
    const data = fixture();
    data.cities[0].windows[2].season = 'shoulder';
    expect(accommodationReferenceWindowScheduleSchema.safeParse(data).success).toBe(false);
  });

  it('rejects replacement history that does not move exactly seven days forward', () => {
    const data = fixture();
    data.cities[0].windows[0] = {
      ...data.cities[0].windows[0],
      checkIn: '2026-10-30',
      checkOut: '2026-11-06',
      quoteCaptureDate: '2026-08-01',
      eventReview: {
        status: 'pending_final_check',
        dueDate: '2026-08-01',
        checkedAt: null,
        notes: 'Replacement pending review.',
      },
      replacementHistory: [
        {
          checkIn: '2026-10-22',
          checkOut: '2026-10-29',
          quoteCaptureDate: '2026-07-24',
          checkedAt: '2026-07-24T12:00:00.000Z',
          reason: 'Official calendar conflict.',
          sourceUrls: ['https://example.com/events'],
        },
      ],
    };
    expect(accommodationReferenceWindowScheduleSchema.safeParse(data).success).toBe(false);
  });
});
