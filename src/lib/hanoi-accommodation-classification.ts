import { z } from 'zod';

const starSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

const decisionEvidenceSchema = z.object({
  sourceUrl: z.string().url(),
  sourceTitle: z.string().min(1),
  decisionNumber: z.string().min(1).nullable(),
  decisionDate: z.string().date().nullable(),
  validFrom: z.string().date().nullable(),
  validThrough: z.string().date().nullable(),
  reviewedAt: z.string().datetime(),
  notes: z.string().min(1),
});

const recordSchema = z.discriminatedUnion('reconciliationStatus', [
  z.object({
    sourcePropertyId: z.string().regex(/^\d+$/),
    name: z.string().min(1),
    address: z.string().min(1),
    capturedStars: starSchema,
    reconciliationStatus: z.literal('pending_current_decision'),
    decisionEvidence: z.null(),
  }),
  z.object({
    sourcePropertyId: z.string().regex(/^\d+$/),
    name: z.string().min(1),
    address: z.string().min(1),
    capturedStars: starSchema,
    reconciliationStatus: z.literal('verified_active'),
    decisionEvidence: decisionEvidenceSchema,
  }),
  z.object({
    sourcePropertyId: z.string().regex(/^\d+$/),
    name: z.string().min(1),
    address: z.string().min(1),
    capturedStars: starSchema,
    reconciliationStatus: z.literal('verified_inactive'),
    decisionEvidence: decisionEvidenceSchema,
  }),
]);

const countSchema = z.object({
  '1': z.number().int().nonnegative(),
  '2': z.number().int().nonnegative(),
  '3': z.number().int().nonnegative(),
  '4': z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export const hanoiAccommodationClassificationReconciliationSchema = z
  .object({
    schemaVersion: z.literal('hanoi-accommodation-classification-reconciliation-v1'),
    city: z.literal('Hanoi'),
    country: z.literal('Vietnam'),
    asOf: z.string().date(),
    sourceUniverse: z.object({
      snapshotSha256: z.string().regex(/^[a-f0-9]{64}$/),
      snapshotByteCount: z.number().int().positive(),
      capturedAt: z.string().datetime(),
      sourceUrl: z.literal('https://csdl.vietnamtourism.gov.vn/cslt/'),
      provinceCode: z.literal('01'),
      recordCounts: countSchema,
    }),
    currentCountBenchmark: z.object({
      sourceUrl: z.string().url(),
      sourceTitle: z.string().min(1),
      publishedAt: z.string().date(),
      scope: z.literal('currently valid 1-4-star Hanoi hotels and tourist apartments'),
      recordCounts: countSchema,
      limitation: z.string().min(1),
    }),
    eligibilityRule: z.literal(
      'Only verified_active rows backed by authoritative current classification evidence may enter geolocation or ranking.'
    ),
    records: z.array(recordSchema).min(1),
    summary: z.object({
      pending: z.number().int().nonnegative(),
      verifiedActive: z.number().int().nonnegative(),
      verifiedInactive: z.number().int().nonnegative(),
      eligibleForGeolocation: z.number().int().nonnegative(),
    }),
  })
  .superRefine((artifact, context) => {
    const ids = new Set<string>();
    const capturedCounts: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let pending = 0;
    let verifiedActive = 0;
    let verifiedInactive = 0;
    artifact.records.forEach((record, index) => {
      if (ids.has(record.sourcePropertyId)) {
        context.addIssue({ code: 'custom', path: ['records', index, 'sourcePropertyId'], message: 'Duplicate source property id' });
      }
      ids.add(record.sourcePropertyId);
      capturedCounts[record.capturedStars] += 1;
      if (record.reconciliationStatus === 'pending_current_decision') pending += 1;
      if (record.reconciliationStatus === 'verified_active') verifiedActive += 1;
      if (record.reconciliationStatus === 'verified_inactive') verifiedInactive += 1;
    });
    for (const stars of [1, 2, 3, 4] as const) {
      if (capturedCounts[stars] !== artifact.sourceUniverse.recordCounts[String(stars) as '1' | '2' | '3' | '4']) {
        context.addIssue({ code: 'custom', path: ['sourceUniverse', 'recordCounts', String(stars)], message: 'Star count does not reconcile to records' });
      }
    }
    if (artifact.records.length !== artifact.sourceUniverse.recordCounts.total) {
      context.addIssue({ code: 'custom', path: ['sourceUniverse', 'recordCounts', 'total'], message: 'Total does not reconcile to records' });
    }
    const expectedSummary = { pending, verifiedActive, verifiedInactive, eligibleForGeolocation: verifiedActive };
    if (JSON.stringify(artifact.summary) !== JSON.stringify(expectedSummary)) {
      context.addIssue({ code: 'custom', path: ['summary'], message: 'Summary does not reconcile to record statuses' });
    }
  });

export type HanoiAccommodationClassificationReconciliation = z.infer<
  typeof hanoiAccommodationClassificationReconciliationSchema
>;
