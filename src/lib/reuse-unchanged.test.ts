import { describe, expect, it } from 'vitest';
import { reuseUnchangedById } from './reuse-unchanged';

describe('reuseUnchangedById', () => {
  const a = { id: 1, nights: 3 };
  const b = { id: 2, nights: 4 };

  it('returns the previous array when nothing changed', () => {
    const previous = [a, b];
    expect(reuseUnchangedById(previous, [{ id: 1, nights: 3 }, { id: 2, nights: 4 }])).toBe(previous);
  });

  it('keeps unchanged objects and takes changed ones', () => {
    const next = reuseUnchangedById([a, b], [{ id: 1, nights: 3 }, { id: 2, nights: 5 }]);
    expect(next[0]).toBe(a);
    expect(next[1]).toEqual({ id: 2, nights: 5 });
    expect(next[1]).not.toBe(b);
  });

  it('treats reordering, additions and removals as changes', () => {
    expect(reuseUnchangedById([a, b], [{ ...b }, { ...a }])).toEqual([b, a]);
    expect(reuseUnchangedById([a, b], [{ ...b }, { ...a }])[0]).toBe(b);
    expect(reuseUnchangedById([a], [{ ...a }, { ...b }])).toHaveLength(2);
    expect(reuseUnchangedById([a, b], [{ ...a }])).toEqual([a]);
  });
});
