import { describe, expect, it } from 'vitest';
import { climateSegments, temperature, tripClimatePoints, type CityClimate, type ClimateLeg } from './climate';

function leg(overrides: Partial<ClimateLeg> = {}): ClimateLeg {
  return {
    id: 1,
    cityId: 'city-a',
    cityName: 'City A',
    startDate: '2024-01-31',
    endDate: '2024-02-02',
    nights: 2,
    ...overrides,
  };
}

function cityClimate(months: CityClimate['months']): CityClimate {
  return {
    cityId: 'city-a',
    location: { name: 'City A', countryCode: 'AA', latitude: 1, longitude: 2 },
    period: '2021-2025',
    sourceUrl: 'https://example.test/climate',
    grid: { latitude: 1, longitude: 2, elevation: 50, timezone: 'Etc/UTC' },
    months,
  };
}

describe('climate date segments', () => {
  it('uses UTC calendar months and treats checkout as exclusive', () => {
    const segments = climateSegments(leg());

    expect(segments.map(({ month, label, start, end }) => ({
      month,
      label,
      start: new Date(start).toISOString().slice(0, 10),
      end: new Date(end).toISOString().slice(0, 10),
    }))).toEqual([
      { month: 1, label: 'Jan 2024', start: '2024-01-31', end: '2024-02-01' },
      { month: 2, label: 'Feb 2024', start: '2024-02-01', end: '2024-02-02' },
    ]);

    expect(climateSegments(leg({ startDate: '2024-01-31', endDate: '2024-02-01', nights: 1 })))
      .toHaveLength(1);
    expect(climateSegments(leg({ startDate: '2024-01-31', endDate: '2024-02-01', nights: 1 }))[0].month)
      .toBe(1);
  });

  it('preserves leap-day month boundaries', () => {
    const segments = climateSegments(leg({ startDate: '2024-02-01', endDate: '2024-03-01', nights: 29 }));

    expect(segments).toHaveLength(1);
    expect(segments[0].month).toBe(2);
    expect(new Date(segments[0].end).toISOString().slice(0, 10)).toBe('2024-03-01');
  });

  it('infers a missing endpoint from the positive night count across leap day', () => {
    const inferredStart = climateSegments(leg({ startDate: null, endDate: '2024-03-01', nights: 2 }));
    const inferredEnd = climateSegments(leg({ startDate: '2024-02-28', endDate: null, nights: 2 }));

    expect(inferredStart.map(({ month, start, end }) => ({
      month,
      start: new Date(start).toISOString().slice(0, 10),
      end: new Date(end).toISOString().slice(0, 10),
    }))).toEqual([{ month: 2, start: '2024-02-28', end: '2024-03-01' }]);
    expect(inferredEnd.map(({ month, start, end }) => ({
      month,
      start: new Date(start).toISOString().slice(0, 10),
      end: new Date(end).toISOString().slice(0, 10),
    }))).toEqual([{ month: 2, start: '2024-02-28', end: '2024-03-01' }]);
  });

  it.each([
    { startDate: '2024-02-30', endDate: '2024-03-02', nights: 2 },
    { startDate: '2024-02-01', endDate: '2024-02-01', nights: 0 },
    { startDate: '2024-02-01', endDate: '2024-01-31', nights: 1 },
    { startDate: '2024-02-01', endDate: null, nights: 0 },
  ])('returns no segment for invalid or non-positive date ranges: $startDate to $endDate', (range) => {
    expect(climateSegments(leg(range))).toEqual([]);
  });
});

describe('climate display values', () => {
  it('keeps Celsius as Celsius and converts it to Fahrenheit', () => {
    expect(temperature(0, 'C')).toBe(0);
    expect(temperature(20, 'C')).toBe(20);
    expect(temperature(0, 'F')).toBe(32);
    expect(temperature(100, 'F')).toBe(212);
  });

  it('keeps all trip month points and leaves absent climate values null', () => {
    const jan: CityClimate['months'][number] = { month: 1, temperatureC: 10, highC: 15, lowC: 5, rainfallMm: 40 };
    const points = tripClimatePoints([
      leg({ id: 1, startDate: '2024-01-31', endDate: '2024-02-02', nights: 2 }),
      leg({ id: 2, cityId: 'city-b', cityName: 'City B', startDate: '2024-02-02', endDate: '2024-02-03', nights: 1 }),
      leg({ id: 3, cityId: 'city-c', cityName: 'City C', startDate: '2024-02-03', endDate: '2024-02-04', nights: 1 }),
    ], {
      'city-a': cityClimate([jan]),
      'city-b': null,
      // city-c is absent while its climate request is still pending.
    }, 'F');

    expect(points).toHaveLength(4);
    expect(points.map(point => point.startDate)).toEqual(['2024-01-31', '2024-02-01', '2024-02-02', '2024-02-03']);
    expect(points[0]).toMatchObject({ temperature: 50, rainfall: 40 });
    expect(points[1]).toMatchObject({ temperature: null, rainfall: null });
    expect(points[2]).toMatchObject({ temperature: null, rainfall: null });
    expect(points[3]).toMatchObject({ temperature: null, rainfall: null });
  });
});
