import { z } from 'zod';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const currencyCode = /^[A-Z]{3}$/;

export const CITY_COST_MEASURES = [
  'hostel_dorm_bed_1p',
  'hostel_private_room_2p',
  'hotel_1star_room_2p',
  'hotel_2star_room_2p',
  'hotel_3star_room_2p',
  'hotel_4star_room_2p',
  'street_food_meal_1p',
  'inexpensive_restaurant_meal_1p',
  'midrange_restaurant_meal_2p',
  'premium_restaurant_meal_2p',
  'cappuccino_1',
  'domestic_draft_beer_1',
  'cocktail_1',
  'wine_glass_1',
  'paid_attraction_adult_1',
  'half_day_group_activity_adult_1',
  'full_day_premium_activity_adult_1',
] as const;

type CityCostMeasure = (typeof CITY_COST_MEASURES)[number];

export const CITY_COST_MEASURE_DEFINITIONS = {
  hostel_dorm_bed_1p: { category: 'accommodation', unit: 'per_bed_night', travellers: 1 },
  hostel_private_room_2p: { category: 'accommodation', unit: 'per_room_night', travellers: 2 },
  hotel_1star_room_2p: { category: 'accommodation', unit: 'per_room_night', travellers: 2 },
  hotel_2star_room_2p: { category: 'accommodation', unit: 'per_room_night', travellers: 2 },
  hotel_3star_room_2p: { category: 'accommodation', unit: 'per_room_night', travellers: 2 },
  hotel_4star_room_2p: { category: 'accommodation', unit: 'per_room_night', travellers: 2 },
  street_food_meal_1p: { category: 'food', unit: 'per_person_item', travellers: 1 },
  inexpensive_restaurant_meal_1p: { category: 'food', unit: 'per_person_item', travellers: 1 },
  midrange_restaurant_meal_2p: { category: 'food', unit: 'per_two_person_meal', travellers: 2 },
  premium_restaurant_meal_2p: { category: 'food', unit: 'per_two_person_meal', travellers: 2 },
  cappuccino_1: { category: 'drinks', unit: 'per_person_item', travellers: 1 },
  domestic_draft_beer_1: { category: 'drinks', unit: 'per_person_item', travellers: 1 },
  cocktail_1: { category: 'drinks', unit: 'per_person_item', travellers: 1 },
  wine_glass_1: { category: 'drinks', unit: 'per_person_item', travellers: 1 },
  paid_attraction_adult_1: { category: 'activities', unit: 'per_person_ticket', travellers: 1 },
  half_day_group_activity_adult_1: { category: 'activities', unit: 'per_person_ticket', travellers: 1 },
  full_day_premium_activity_adult_1: { category: 'activities', unit: 'per_person_ticket', travellers: 1 },
} as const satisfies Record<
  CityCostMeasure,
  {
    category: 'accommodation' | 'food' | 'drinks' | 'activities';
    unit:
      | 'per_bed_night'
      | 'per_room_night'
      | 'per_person_item'
      | 'per_two_person_meal'
      | 'per_person_ticket';
    travellers: number;
  }
>;

export const cityCostObservationSchema = z
  .object({
    schemaVersion: z.literal('city-cost-observation-v1'),
    observationId: z.string().min(1),
    batchId: z.string().min(1),
    city: z.string().min(1),
    country: z.string().min(1),
    region: z.enum([
      'SEA',
      'East Asia',
      'South Asia',
      'Middle East',
      'Africa',
      'Europe',
      'Latin America',
      'North America',
      'Oceania',
    ]),
    category: z.enum(['accommodation', 'food', 'drinks', 'activities']),
    measure: z.enum(CITY_COST_MEASURES),
    valueStatus: z.enum(['direct', 'derived', 'imputed']),
    priceAmount: z.number().nonnegative(),
    currency: z.string().regex(currencyCode),
    unit: z.enum([
      'per_bed_night',
      'per_room_night',
      'per_person_item',
      'per_two_person_meal',
      'per_person_ticket',
    ]),
    travellers: z.number().int().min(1).max(5),
    quantity: z.number().positive().default(1),
    taxStatus: z.enum(['included', 'excluded', 'mixed', 'unknown']),
    sourceName: z.string().min(1),
    sourceType: z.enum([
      'official_api',
      'marketplace_api',
      'official_website',
      'crowdsourced_api',
      'published_dataset',
      'manual_menu_sample',
      'derived_model',
    ]),
    sourceAccess: z
      .enum(['personal_use_with_attribution', 'open_license', 'public_official', 'user_supplied', 'unknown'])
      .default('unknown'),
    sourceTermsUrl: z.string().url().nullable().default(null),
    sourceUrl: z.string().url().nullable(),
    sourceRecordId: z.string().min(1).nullable().default(null),
    retrievedAt: z.string().datetime(),
    priceValidFrom: z.string().regex(isoDate).nullable().default(null),
    priceValidTo: z.string().regex(isoDate).nullable().default(null),
    reportedLow: z.number().nonnegative().nullable().default(null),
    reportedHigh: z.number().nonnegative().nullable().default(null),
    sampleSize: z.number().int().positive().nullable().default(null),
    resultCount: z.number().int().positive().nullable().default(null),
    checkIn: z.string().regex(isoDate).nullable().default(null),
    checkOut: z.string().regex(isoDate).nullable().default(null),
    bookingLeadDays: z.number().int().nonnegative().nullable().default(null),
    stayNights: z.number().int().positive().nullable().default(null),
    season: z.enum(['low', 'shoulder', 'high', 'not_applicable', 'unknown']),
    searchRadiusKm: z.number().positive().nullable().default(null),
    minimumReviewScore: z.number().min(0).max(10).nullable().default(null),
    bookerCountry: z.string().regex(/^[A-Z]{2}$/).nullable().default(null),
    extractionMethod: z.enum(['api', 'browser_research', 'manual_entry', 'deterministic_derivation', 'statistical_model']),
    extractorVersion: z.string().min(1),
    parentObservationIds: z.array(z.string().min(1)).default([]),
    derivationMethod: z.string().min(1).nullable().default(null),
    modelVersion: z.string().min(1).nullable().default(null),
    predictionLower: z.number().nonnegative().nullable().default(null),
    predictionUpper: z.number().nonnegative().nullable().default(null),
    reviewerStatus: z.enum(['unreviewed', 'accepted', 'rejected']),
    exclusionReason: z.string().min(1).nullable().default(null),
    notes: z.string().default(''),
  })
  .superRefine((observation, context) => {
    const definition = CITY_COST_MEASURE_DEFINITIONS[observation.measure];
    if (observation.category !== definition.category) {
      context.addIssue({
        code: 'custom',
        path: ['category'],
        message: `${observation.measure} requires category ${definition.category}`,
      });
    }
    if (observation.unit !== definition.unit) {
      context.addIssue({
        code: 'custom',
        path: ['unit'],
        message: `${observation.measure} requires unit ${definition.unit}`,
      });
    }
    if (observation.travellers !== definition.travellers) {
      context.addIssue({
        code: 'custom',
        path: ['travellers'],
        message: `${observation.measure} requires ${definition.travellers} traveller(s)`,
      });
    }

    if (observation.reportedLow !== null && observation.reportedHigh !== null && observation.reportedLow > observation.reportedHigh) {
      context.addIssue({ code: 'custom', path: ['reportedLow'], message: 'reportedLow cannot exceed reportedHigh' });
    }

    if (observation.priceValidFrom && observation.priceValidTo && observation.priceValidFrom > observation.priceValidTo) {
      context.addIssue({ code: 'custom', path: ['priceValidFrom'], message: 'priceValidFrom cannot be after priceValidTo' });
    }

    if (observation.checkIn && observation.checkOut && observation.checkIn >= observation.checkOut) {
      context.addIssue({ code: 'custom', path: ['checkIn'], message: 'checkIn must be before checkOut' });
    }

    if (observation.valueStatus === 'direct' && !observation.sourceUrl) {
      context.addIssue({ code: 'custom', path: ['sourceUrl'], message: 'Direct observations require a source URL' });
    }

    if (observation.valueStatus === 'derived') {
      if (!observation.parentObservationIds.length) {
        context.addIssue({ code: 'custom', path: ['parentObservationIds'], message: 'Derived values require parent observations' });
      }
      if (!observation.derivationMethod) {
        context.addIssue({ code: 'custom', path: ['derivationMethod'], message: 'Derived values require a derivation method' });
      }
    }

    if (observation.valueStatus === 'imputed') {
      if (!observation.modelVersion) {
        context.addIssue({ code: 'custom', path: ['modelVersion'], message: 'Imputed values require a model version' });
      }
      if (observation.predictionLower === null || observation.predictionUpper === null) {
        context.addIssue({ code: 'custom', path: ['predictionLower'], message: 'Imputed values require a prediction interval' });
      } else if (
        observation.predictionLower > observation.priceAmount ||
        observation.predictionUpper < observation.priceAmount
      ) {
        context.addIssue({ code: 'custom', path: ['predictionLower'], message: 'Prediction interval must contain the estimate' });
      }
    }

    const isAccommodation = observation.category === 'accommodation';
    if (isAccommodation && observation.valueStatus === 'direct') {
      for (const field of ['checkIn', 'checkOut', 'bookingLeadDays', 'stayNights', 'bookerCountry'] as const) {
        if (observation[field] === null) {
          context.addIssue({ code: 'custom', path: [field], message: `Direct accommodation observations require ${field}` });
        }
      }
    }

    if (observation.reviewerStatus === 'rejected' && !observation.exclusionReason) {
      context.addIssue({ code: 'custom', path: ['exclusionReason'], message: 'Rejected observations require an exclusion reason' });
    }
  });

export type CityCostObservation = z.infer<typeof cityCostObservationSchema>;

export function summarizeObservationCoverage(observations: CityCostObservation[]) {
  const accepted = observations.filter((observation) => observation.reviewerStatus === 'accepted');
  const cities = new Set(accepted.map((observation) => `${observation.city}|${observation.country}`));
  const direct = accepted.filter((observation) => observation.valueStatus === 'direct');

  return {
    observations: accepted.length,
    cities: cities.size,
    directObservations: direct.length,
    directObservationPct: accepted.length ? (direct.length / accepted.length) * 100 : 0,
    byCategory: Object.fromEntries(
      ['accommodation', 'food', 'drinks', 'activities'].map((category) => [
        category,
        accepted.filter((observation) => observation.category === category).length,
      ])
    ),
  };
}
