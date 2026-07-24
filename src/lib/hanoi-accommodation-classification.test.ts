import { describe, expect, it } from 'vitest';
import { hanoiAccommodationClassificationReconciliationSchema } from './hanoi-accommodation-classification';

function fixture() {
  return {
    schemaVersion: 'hanoi-accommodation-classification-reconciliation-v1',
    city: 'Hanoi',
    country: 'Vietnam',
    asOf: '2026-07-24',
    sourceUniverse: {
      snapshotSha256: 'a'.repeat(64),
      snapshotByteCount: 100,
      capturedAt: '2026-07-24T00:00:00.000Z',
      sourceUrl: 'https://csdl.vietnamtourism.gov.vn/cslt/',
      provinceCode: '01',
      recordCounts: { 1: 1, 2: 0, 3: 0, 4: 0, total: 1 },
    },
    currentCountBenchmark: {
      sourceUrl: 'https://vietnamtourism.gov.vn/post/66938',
      sourceTitle: 'Official Hanoi accommodation summary',
      publishedAt: '2026-02-27',
      scope: 'currently valid 1-4-star Hanoi hotels and tourist apartments',
      recordCounts: { 1: 3, 2: 10, 3: 8, 4: 16, total: 37 },
      limitation: 'Aggregate counts do not identify individual properties.',
    },
    eligibilityRule: 'Only verified_active rows backed by authoritative current classification evidence may enter geolocation or ranking.',
    records: [{
      sourcePropertyId: '1',
      name: 'Hotel One',
      address: 'Hanoi',
      capturedStars: 1,
      reconciliationStatus: 'pending_current_decision',
      decisionEvidence: null,
    }],
    summary: { pending: 1, verifiedActive: 0, verifiedInactive: 0, eligibleForGeolocation: 0 },
  };
}

describe('Hanoi accommodation classification reconciliation', () => {
  it('keeps unresolved source rows ineligible', () => {
    expect(hanoiAccommodationClassificationReconciliationSchema.parse(fixture()).summary.eligibleForGeolocation).toBe(0);
  });

  it('rejects summary claims that are not backed by row statuses', () => {
    const input = fixture();
    input.summary.eligibleForGeolocation = 1;
    expect(() => hanoiAccommodationClassificationReconciliationSchema.parse(input)).toThrow(/Summary does not reconcile/);
  });
});
