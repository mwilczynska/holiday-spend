import { describe, expect, it } from 'vitest';
import {
  assertSafeMigrationOutput,
  buildImportPlan,
  buildStagedCsv,
  sha256Bytes,
  type V61MigrationProvenanceRow,
} from './city-cost-v6-1-migration';

function row(city: string, cityId: string): V61MigrationProvenanceRow {
  return {
    schemaVersion: 'city-cost-v6-1-migration-provenance-row-v1',
    cityId,
    city,
    country: 'Testland',
    region: 'TEST',
    methodologyVersion: 'v6.1',
    estimationImportKey: `key-${cityId}`,
    estimateSource: 'llm_city_generation_v6_1',
    estimatedAt: '2026-08-13T00:00:00.000Z',
    provider: 'delegated',
    model: 'test',
    promptVersion: 'city-cost-v6-1-spine-v1',
    confidence: 'medium',
    reasoning: 'test',
    data: {
      accomHostel: 1,
      accomPrivateRoom: 2,
      accom1star: 3,
      accom2star: 4,
      accom3star: 5,
      accom4star: 6,
      foodStreet: 7,
      foodBudget: 8,
      foodMid: 9,
      foodHigh: 10,
      drinkCoffee: 11,
      drinksNone: 12,
      drinksLight: 13,
      drinksModerate: 14,
      drinksHeavy: 15,
      activitiesFree: 0,
      activitiesBudget: 16,
      activitiesMid: 17,
      activitiesHigh: 18,
    },
    anchors: {},
    metadata: {},
    sources: {},
    inputSnapshot: {},
    fallbackLog: [],
    materializationHash: 'hash',
    calls: [],
  };
}

describe('v6.1 migration artifacts', () => {
  it('writes the exact shipping columns and deterministic row order', () => {
    const csv = buildStagedCsv([row('B', 'b'), row('A', 'a')]);
    const [header, first, second] = csv.trimEnd().split('\n');
    expect(header.split(',')).toHaveLength(22);
    expect(first.startsWith('B,Testland,TEST,1,2,3')).toBe(true);
    expect(second.startsWith('A,Testland,TEST,1,2,3')).toBe(true);
  });

  it('sorts the database import plan by deterministic city identity', () => {
    const plan = buildImportPlan([row('B', 'b'), row('A', 'a')]);
    expect(plan.map((entry) => entry.cityId)).toEqual(['a', 'b']);
    expect(plan.every((entry) => entry.methodologyVersion === 'v6.1')).toBe(true);
  });

  it('rejects the live CSV as a migration output', () => {
    expect(() => assertSafeMigrationOutput('C:\\repo', 'C:\\repo\\data\\reference\\city_costs_app_aud.csv')).toThrow();
    expect(() => assertSafeMigrationOutput('C:\\repo', 'C:\\repo\\data\\reference\\v6\\migration-v6-1\\staged.csv')).not.toThrow();
  });

  it('hashes identical bytes identically for checkpoint/reuse records', () => {
    expect(sha256Bytes('same')).toBe(sha256Bytes('same'));
    expect(sha256Bytes('same')).not.toBe(sha256Bytes('different'));
  });
});
