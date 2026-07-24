import { z } from 'zod';
import { ACCOMMODATION_PANEL_MEASURES } from './accommodation-reference-window';

export const accommodationWebsiteVerificationSchema = z.object({
  schemaVersion: z.literal('accommodation-website-verification-v1'),
  verificationId: z.string().min(1),
  panelId: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  capturedAt: z.string().datetime(),
  records: z.array(z.object({
    propertyId: z.string().min(1),
    measure: z.enum(ACCOMMODATION_PANEL_MEASURES),
    selectionRank: z.number().int().positive(),
    officialWebsiteUrl: z.string().url(),
    verificationSourceName: z.string().min(1),
    verificationSourceUrl: z.string().url(),
    ownershipBasis: z.enum([
      'official_property_page_with_matching_registration_id',
      'official_property_page_with_matching_name_address',
      'official_destination_or_city_directory_link',
    ]),
    notes: z.string().min(1),
  })).min(1),
}).superRefine((artifact, context) => {
  const ids = new Set<string>();
  artifact.records.forEach((record, index) => {
    if (ids.has(record.propertyId)) {
      context.addIssue({ code: 'custom', path: ['records', index, 'propertyId'], message: 'Duplicate property verification' });
    }
    ids.add(record.propertyId);
  });
});

export type AccommodationWebsiteVerification = z.infer<typeof accommodationWebsiteVerificationSchema>;
