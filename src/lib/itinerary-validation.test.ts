import { describe, expect, it } from 'vitest';
import { isPlausibleLegDate, validateLegDates } from '@/lib/itinerary-validation';

describe('isPlausibleLegDate', () => {
  it('accepts real ISO dates in range', () => {
    for (const value of ['2026-03-01', '2000-01-01', '2100-12-31', '2028-02-29']) {
      expect(isPlausibleLegDate(value), value).toBe(true);
    }
  });

  it('rejects partial-year, impossible, malformed and out-of-range dates', () => {
    for (const value of ['0202-03-01', '2026-02-30', '26-03-01', '2101-01-01', '1999-12-31', '2027-02-29', '2026-13-01', '2026-3-1', '']) {
      expect(isPlausibleLegDate(value), value).toBe(false);
    }
  });
});

describe('validateLegDates', () => {
  it('accepts null and missing values', () => {
    expect(validateLegDates({})).toBeNull();
    expect(validateLegDates({ startDate: null, endDate: null, nights: null })).toBeNull();
    expect(validateLegDates({ startDate: '2026-03-01', endDate: null })).toBeNull();
  });

  it('accepts a valid range and same-day start and end', () => {
    expect(validateLegDates({ startDate: '2026-03-01', endDate: '2026-03-05', nights: 4 })).toBeNull();
    expect(validateLegDates({ startDate: '2026-03-01', endDate: '2026-03-01' })).toBeNull();
  });

  it('rejects implausible start and end dates', () => {
    expect(validateLegDates({ startDate: '0202-03-01' })).toMatch(/Start date/);
    expect(validateLegDates({ startDate: '2026-02-30' })).toMatch(/Start date/);
    expect(validateLegDates({ endDate: '26-03-01' })).toMatch(/End date/);
    expect(validateLegDates({ endDate: '2101-01-01' })).toMatch(/End date/);
  });

  it('allows 366 nights and rejects 367', () => {
    expect(validateLegDates({ nights: 366 })).toBeNull();
    expect(validateLegDates({ nights: 367 })).toMatch(/366 nights/);
  });

  it('rejects an end date before the start date', () => {
    expect(validateLegDates({ startDate: '2026-03-05', endDate: '2026-03-01' })).toMatch(/earlier/);
  });
});
