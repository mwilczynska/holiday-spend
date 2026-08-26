import { describe, expect, it } from 'vitest';
import type { TransportAccuracyObservation } from './transport-estimation-accuracy';
import { buildTransportAccuracyReport } from './transport-estimation-accuracy';

function observation(overrides: Partial<TransportAccuracyObservation>): TransportAccuracyObservation {
  return {
    routeId: 'route-1',
    routeClass: 'domestic_short',
    originCity: 'Origin',
    originCountry: 'Country A',
    destinationCity: 'Destination',
    destinationCountry: 'Country A',
    travelDate: '2026-09-15',
    capturedAt: '2026-08-26',
    groupSize: 2,
    referenceMode: 'train',
    referenceTotalAud: 100,
    referenceSource: 'deterministic test fixture',
    provider: 'openai',
    model: 'gpt-5.6-luna',
    promptVersion: 'llm_prompt_intercity_transport_1.md',
    usedWebSearch: true,
    fallbackReason: null,
    searchQueries: ['Origin to Destination train fare'],
    citations: [{ url: 'https://example.com/fare', title: 'Fixture quote' }],
    assumptions: ['One-way fare for two travellers.'],
    options: [{
      mode: 'train',
      label: 'Train',
      totalAud: 110,
      confidence: 'medium',
      sourceBasis: 'Fixture operator quote',
      notes: 'Fixture estimate.',
      reasons: [],
      appliedAssumptions: [],
      transportRowDraft: { mode: 'Train', note: 'Fixture estimate.', cost: 110 },
    }],
    ...overrides,
  };
}

describe('transport estimation accuracy report', () => {
  it('reports absolute and relative errors, median, range, and outliers', () => {
    const report = buildTransportAccuracyReport([
      observation({ routeId: 'short', referenceTotalAud: 100, options: [{
        mode: 'train', label: 'Train', totalAud: 110, confidence: 'medium', sourceBasis: 'fixture', notes: 'fixture',
        reasons: [], appliedAssumptions: [], transportRowDraft: { mode: 'Train', note: null, cost: 110 },
      }] }),
      observation({ routeId: 'long', referenceTotalAud: 400, options: [{
        mode: 'train', label: 'Train', totalAud: 600, confidence: 'low', sourceBasis: 'fixture', notes: 'fixture',
        reasons: [], appliedAssumptions: [], transportRowDraft: { mode: 'Train', note: null, cost: 600 },
      }] }),
    ]);

    expect(report.summary).toMatchObject({
      matchedRoutes: 2,
      missingModeRoutes: 0,
      medianAbsoluteErrorAud: 105,
      medianRelativeError: 0.3,
      absoluteErrorRangeAud: [10, 200],
      relativeErrorRange: [0.1, 0.5],
    });
    expect(report.outliers.map((row) => row.routeId)).toEqual(['long']);
  });

  it('keeps provider/search provenance and flags a missing reference mode', () => {
    const report = buildTransportAccuracyReport([
      observation({
        routeId: 'fallback-route',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        usedWebSearch: false,
        fallbackReason: 'Search unavailable',
        options: [{
          mode: 'flight', label: 'Flight', totalAud: 250, confidence: 'low', sourceBasis: 'fallback', notes: 'fallback',
          reasons: [], appliedAssumptions: [], transportRowDraft: { mode: 'Flight', note: null, cost: 250 },
        }],
      }),
    ]);

    expect(report.summary).toMatchObject({ matchedRoutes: 0, missingModeRoutes: 1 });
    expect(report.outliers[0]).toMatchObject({
      routeId: 'fallback-route',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      usedWebSearch: false,
      fallbackReason: 'Search unavailable',
      matchedMode: false,
    });
  });

  it('rejects an invalid tolerance', () => {
    expect(() => buildTransportAccuracyReport([], -0.1)).toThrow(/tolerance/i);
  });
});
