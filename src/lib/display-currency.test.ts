import { describe, expect, it } from 'vitest';
import { DEFAULT_CURRENCY_STATE, displayToAud, formatDisplayMoney, isDisplayCurrency, parseCurrencyState } from './display-currency';
const eur = { currency: 'EUR' as const, rate: 0.6, asOf: '2026-10-20', error: null };
describe('display currency', () => {
  it('converts from canonical AUD once, including zero and signed variances', () => {
    expect(formatDisplayMoney(100, eur)).toBe('€60');
    expect(formatDisplayMoney(-100, eur)).toBe('-€60');
    expect(formatDisplayMoney(0, eur)).toBe('€0');
    expect(formatDisplayMoney(12.5, eur, 2)).toBe('€7.50');
    expect(formatDisplayMoney(100, { ...eur, currency: 'JPY', rate: 100 })).toContain('10,000');
    expect(formatDisplayMoney(100, DEFAULT_CURRENCY_STATE)).toBe('$100');
  });
  it('reverses input conversion without rounding the stored value', () => {
    const aud = displayToAud(7.5, eur.rate);
    expect(aud).toBe(12.5);
    expect(displayToAud(0, eur.rate)).toBe(0);
    expect(displayToAud(123.45, 0.612345)).toBe(123.45 / 0.612345);
  });
  it('leaves unavailable, invalid and overflowing values unavailable', () => {
    for (const rate of [null, 0, -1, NaN, Infinity]) {
      expect(formatDisplayMoney(100, { ...eur, rate })).toBe('—');
      expect(() => displayToAud(100, rate)).toThrow();
    }
    expect(formatDisplayMoney(NaN, eur)).toBe('—');
    expect(() => displayToAud(Number.MAX_VALUE, 0.01)).toThrow();
    expect(formatDisplayMoney(Number.MAX_VALUE, { ...eur, rate: 10 })).toBe('—');
  });
  it('validates currency settings instead of accepting a mismatched or missing rate', () => {
    expect(parseCurrencyState(eur)).toEqual(eur);
    expect(parseCurrencyState({ ...eur, rate: null, asOf: null, error: 'Unavailable' }).rate).toBeNull();
    for (const invalid of [{}, { ...eur, rate: undefined }, { ...eur, currency: 'ABC' }, { ...eur, rate: -1 },
      { ...eur, asOf: null }, { ...eur, asOf: '2026-02-30' }, { ...eur, currency: 'AUD' }]) expect(() => parseCurrencyState(invalid)).toThrow();
    expect(isDisplayCurrency('__proto__')).toBe(false);
  });
});
