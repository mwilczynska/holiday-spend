import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { accommodationWebsiteVerificationSchema } from './accommodation-website-verification';

describe('accommodation website verification', () => {
  it('validates the Barcelona 4-star primary checkpoint', () => {
    const artifact = accommodationWebsiteVerificationSchema.parse(JSON.parse(fs.readFileSync(
      path.join(process.cwd(), 'data/reference/accommodation_website_verifications/barcelona-4star-primary-2026-07-24.json'),
      'utf8'
    )));
    expect(artifact.records).toHaveLength(10);
    expect(artifact.records.map((record) => record.selectionRank)).toEqual([1, 2, 3, 5, 6, 8, 9, 10, 11, 12]);
    expect(artifact.records.find((record) => record.propertyId === 'HB-004243')?.ownershipBasis)
      .toBe('official_property_page_with_matching_registration_id');
  });
});
