import { describe, expect, it } from 'vitest';
import { createCountryBlockRefs } from './country-blocks';

describe('createCountryBlockRefs', () => {
  it('keeps repeated countries separate when another country is visited between them', () => {
    const refs = createCountryBlockRefs(
      ['A', 'A', 'B', 'B', 'A'],
      (countryId) => countryId
    );

    expect(refs.map((ref) => ref?.blockId ?? null)).toEqual([
      'A:0',
      'A:0',
      'B:1',
      'B:1',
      'A:2',
    ]);
  });

  it('breaks a block across an item without a country', () => {
    const refs = createCountryBlockRefs(
      [{ countryId: 'A' }, { countryId: null }, { countryId: 'A' }],
      (item) => item.countryId
    );

    expect(refs.map((ref) => ref?.blockId ?? null)).toEqual(['A:0', null, 'A:1']);
  });

  it('keeps planned and actual totals attached to their own repeated block', () => {
    const items = [
      { countryId: 'A', planned: 10, actual: 8 },
      { countryId: 'A', planned: 20, actual: 21 },
      { countryId: 'B', planned: 30, actual: 25 },
      { countryId: 'A', planned: 40, actual: 45 },
    ];
    const refs = createCountryBlockRefs(items, (item) => item.countryId);
    const totals = new Map<string, { planned: number; actual: number }>();

    refs.forEach((ref, index) => {
      if (!ref) return;
      const current = totals.get(ref.blockId) ?? { planned: 0, actual: 0 };
      current.planned += items[index].planned;
      current.actual += items[index].actual;
      totals.set(ref.blockId, current);
    });

    expect(Array.from(totals.entries())).toEqual([
      ['A:0', { planned: 30, actual: 29 }],
      ['B:1', { planned: 30, actual: 25 }],
      ['A:2', { planned: 40, actual: 45 }],
    ]);
  });

  it('does not create a row for an empty itinerary', () => {
    expect(createCountryBlockRefs([], () => 'A')).toEqual([]);
  });
});
