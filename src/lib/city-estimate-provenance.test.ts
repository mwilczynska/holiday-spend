import { describe, expect, it } from 'vitest';
import { readV6Provenance } from './city-estimate-provenance';

describe('readV6Provenance', () => {
  it.each(['v6.0', 'v6.1'] as const)('accepts and returns the actual %s version', (methodologyVersion) => {
    const provenance = readV6Provenance(
      JSON.stringify({
        methodologyVersion,
        evidenceGrades: { accom_3_star: 'B' },
        intervals: { accom_3_star: { lowerAud: 10, upperAud: 20, widthPct: 41 } },
        anchorEvidenceGrades: { hotel_3star_room_2p: 'B' },
        anchorIntervals: { hotel_3star_room_2p: { lowerAud: 10, upperAud: 20, widthPct: 41 } },
        v6CollectionTelemetry: [{ source: 'expedia_3star', status: 'complete' }],
        v6Missingness: { cocktail_1: 'not_found' },
        v6PriorBasis: 'fixture prior',
      })
    );

    expect(provenance).toMatchObject({
      methodologyVersion,
      evidenceGrades: { accom_3_star: 'B' },
      intervals: { accom_3_star: { widthPct: 41 } },
      collectionTelemetry: [{ source: 'expedia_3star' }],
      missingness: { cocktail_1: 'not_found' },
      priorBasis: 'fixture prior',
    });
  });

  it('does not expose v1 or malformed metadata as v6 provenance', () => {
    expect(readV6Provenance(JSON.stringify({ methodologyVersion: 'v1', tiers: {} }))).toBeNull();
    expect(readV6Provenance('{not-json}')).toBeNull();
    expect(readV6Provenance(null)).toBeNull();
  });
});
