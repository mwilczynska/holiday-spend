import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransportAccuracyObservation } from './transport-estimation-accuracy';
import { buildTransportAccuracyReport } from './transport-estimation-accuracy';
import { estimateIntercityTransport } from './transport-estimation';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

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
  it('runs a four-route mocked pipeline smoke across domestic and international classes', async () => {
    const fixtures = [
      {
        routeId: 'domestic-short', routeClass: 'domestic_short' as const,
        originCity: 'Sydney', originCountry: 'Australia', destinationCity: 'Canberra', destinationCountry: 'Australia',
        referenceMode: 'train' as const, referenceTotalAud: 120, estimatedTotalAud: 132,
      },
      {
        routeId: 'domestic-long', routeClass: 'domestic_long' as const,
        originCity: 'Sydney', originCountry: 'Australia', destinationCity: 'Perth', destinationCountry: 'Australia',
        referenceMode: 'flight' as const, referenceTotalAud: 620, estimatedTotalAud: 700,
      },
      {
        routeId: 'international-short', routeClass: 'international_short' as const,
        originCity: 'Paris', originCountry: 'France', destinationCity: 'Brussels', destinationCountry: 'Belgium',
        referenceMode: 'train' as const, referenceTotalAud: 220, estimatedTotalAud: 198,
      },
      {
        routeId: 'international-long', routeClass: 'international_long' as const,
        originCity: 'Tokyo', originCountry: 'Japan', destinationCity: 'London', destinationCountry: 'United Kingdom',
        referenceMode: 'flight' as const, referenceTotalAud: 2400, estimatedTotalAud: 3100,
      },
    ];

    global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { input?: string };
      const fixture = fixtures.find((candidate) => body.input?.includes(`Destination: ${candidate.destinationCity}`));
      if (!fixture) return new Response('missing fixture', { status: 500 });

      const payload = {
        assumptions: ['One-way fare for two travellers.', 'Deterministic smoke fixture; not an observed quote.'],
        options: [{
          mode: fixture.referenceMode,
          label: fixture.referenceMode === 'flight' ? 'Flight' : 'Train',
          total_aud: fixture.estimatedTotalAud,
          confidence: 'medium',
          source_basis: 'Deterministic mocked provider response',
          notes: 'Directional smoke fixture.',
          reasons: ['Fixture response exercises the transport JSON contract.'],
          applied_assumptions: ['Two travellers', 'One-way total'],
          transport_row_draft: {
            mode: fixture.referenceMode === 'flight' ? 'Flight' : 'Train',
            note: 'Directional smoke fixture.',
            cost: fixture.estimatedTotalAud,
          },
        }],
      };

      return new Response(JSON.stringify({
        model: 'gpt-5.6-luna',
        output: [
          { type: 'web_search_call', queries: [`${fixture.originCity} ${fixture.destinationCity} fare`] },
          {
            type: 'message',
            content: [{
              type: 'output_text',
              text: JSON.stringify(payload),
              annotations: [{ url: 'https://example.com/fixture-quote', title: 'Fixture source' }],
            }],
          },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const observations: TransportAccuracyObservation[] = [];
    for (const fixture of fixtures) {
      const result = await estimateIntercityTransport({
        originCity: fixture.originCity,
        originCountry: fixture.originCountry,
        destinationCity: fixture.destinationCity,
        destinationCountry: fixture.destinationCountry,
        travelDate: '2026-09-15',
        groupSize: 2,
        allowedModes: [fixture.referenceMode],
        provider: 'openai',
        apiKey: 'fixture-key',
        model: 'gpt-5.6-luna',
        reasoningEffort: 'max',
        routeFacts: ['Deterministic smoke fixture.'],
      });

      observations.push({
        ...fixture,
        travelDate: '2026-09-15',
        capturedAt: '2026-08-26',
        groupSize: 2,
        referenceSource: 'deterministic smoke fixture; replace with same-day operator quote',
        provider: result.providerResult.provider,
        model: result.providerResult.model,
        promptVersion: result.providerResult.promptVersion,
        usedWebSearch: result.providerResult.usedWebSearch,
        fallbackReason: result.providerResult.fallbackReason,
        searchQueries: result.providerResult.searchQueries,
        citations: result.providerResult.citations,
        assumptions: result.assumptions,
        options: result.options,
      });
    }

    const report = buildTransportAccuracyReport(observations, 0.25);

    expect(report.rows).toHaveLength(4);
    expect(report.rows.map((row) => row.routeClass)).toEqual([
      'domestic_short', 'domestic_long', 'international_short', 'international_long',
    ]);
    expect(report.rows.every((row) => row.provider === 'openai' && row.model === 'gpt-5.6-luna')).toBe(true);
    expect(report.rows.every((row) => row.usedWebSearch && row.searchQueries.length === 1 && row.citations.length === 1)).toBe(true);
    expect(report.summary).toMatchObject({ matchedRoutes: 4, missingModeRoutes: 0 });
    expect(report.outliers.map((row) => row.routeId)).toEqual(['international-long']);
  });

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
