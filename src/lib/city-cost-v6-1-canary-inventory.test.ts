import { describe, expect, it } from 'vitest';
import { V61_SOURCE_CONFIG, V61_SPINE_SOURCES } from './city-cost-v6-1-collection';
import { inspectV61CallSlot } from './city-cost-v6-1-canary-inventory';

const city = { city: 'Lisbon', country: 'Portugal' };

function measure(observed = true) {
  return observed
    ? {
      status: 'observed', value: 10, currency: 'USD', sourceUrl: 'https://example.com/source',
      sourceTitle: 'Source', evidenceText: 'Evidence', query: 'query', taxStatus: 'unknown',
    }
    : {
      status: 'not_found', value: null, currency: null, sourceUrl: null,
      sourceTitle: '', evidenceText: '', query: '', taxStatus: 'unknown',
    };
}

function raw(source: (typeof V61_SPINE_SOURCES)[number], status = 'complete') {
  const measures = Object.fromEntries(V61_SOURCE_CONFIG[source].measures.map((name) => [name, measure()]));
  if (source === 'numbeo_drinks') {
    measures.domestic_draft_beer_1 = {
      ...measures.domestic_draft_beer_1,
      sourceTitle: 'Numbeo Domestic Draft Beer (0.5 Liter)',
      evidenceText: 'Domestic Draft Beer (0.5 Liter): USD 5.00',
    };
  }
  return {
    schemaVersion: 'city-cost-v6-1-spine-response-v1', source, city: city.city, country: city.country,
    retrievalStatus: status,
    searchesUsed: 1,
    directPageReads: 0,
    notes: '',
    measures,
  };
}

function telemetry(source: (typeof V61_SPINE_SOURCES)[number], status = 'complete') {
  return {
    source,
    promptVersion: V61_SOURCE_CONFIG[source].promptFile,
    provider: 'delegated-gpt-5.6-luna',
    model: 'gpt-5.6-luna',
    attempts: 1,
    retries: 0,
    status,
    searchesUsed: 1,
    directPageReads: 0,
    startedAt: '2026-09-17T00:00:00.000Z',
    completedAt: '2026-09-17T00:00:01.000Z',
    durationMs: 1000,
    error: status === 'error' ? 'provider failed' : null,
  };
}

describe('v6.1 canary collection inventory', () => {
  it('keeps raw-only and telemetry-only sibling evidence pending', () => {
    const rawOnly = inspectV61CallSlot({
      city, source: 'expedia_3star', rawPresent: true, telemetryPresent: false, raw: raw('expedia_3star'),
    });
    const telemetryOnly = inspectV61CallSlot({
      city, source: 'budgetyourtrip_daily_tiers', rawPresent: false, telemetryPresent: true,
      telemetry: telemetry('budgetyourtrip_daily_tiers'),
    });
    expect(rawOnly.terminal).toBe(false);
    expect(rawOnly.orphan).toBe('raw');
    expect(rawOnly.reusable).toBe(false);
    expect(telemetryOnly.terminal).toBe(false);
    expect(telemetryOnly.orphan).toBe('telemetry');
    expect(telemetryOnly.reusable).toBe(false);
  });

  it('validates a pair as reusable without changing its source evidence', () => {
    const slot = inspectV61CallSlot({
      city, source: 'numbeo_drinks', rawPresent: true, telemetryPresent: true,
      raw: raw('numbeo_drinks'), telemetry: telemetry('numbeo_drinks'),
    });
    expect(slot.terminal).toBe(true);
    expect(slot.reusable).toBe(true);
    expect(slot.invalid).toBe(false);
    expect(slot.actualProviderCall).toBe(true);
  });

  it('reports an invalid response while preserving the two valid sibling slots', () => {
    const invalid = raw('numbeo_drinks') as { measures: Record<string, Record<string, unknown>> };
    invalid.measures.cappuccino_1.sourceTitle = null;
    const slots = [
      inspectV61CallSlot({ city, source: 'expedia_3star', rawPresent: true, telemetryPresent: true, raw: raw('expedia_3star'), telemetry: telemetry('expedia_3star') }),
      inspectV61CallSlot({ city, source: 'budgetyourtrip_daily_tiers', rawPresent: true, telemetryPresent: true, raw: raw('budgetyourtrip_daily_tiers'), telemetry: telemetry('budgetyourtrip_daily_tiers') }),
      inspectV61CallSlot({ city, source: 'numbeo_drinks', rawPresent: true, telemetryPresent: true, raw: invalid, telemetry: telemetry('numbeo_drinks') }),
    ];
    expect(slots.filter((slot) => slot.reusable)).toHaveLength(2);
    expect(slots[2].invalid).toBe(true);
    expect(slots[2].terminal).toBe(true);
  });

  it('treats an explicit terminal provider error as terminal but not reusable', () => {
    const slot = inspectV61CallSlot({
      city, source: 'expedia_3star', rawPresent: false, telemetryPresent: true,
      telemetry: { ...telemetry('expedia_3star', 'error'), attempts: 0 },
    });
    expect(slot.terminal).toBe(true);
    expect(slot.reusable).toBe(false);
    expect(slot.invalid).toBe(false);
    expect(slot.providerError).toBe('provider failed');
  });
});
