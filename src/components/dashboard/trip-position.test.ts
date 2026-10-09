import { describe, expect, it } from 'vitest';
import type { BurnRatePoint } from './dashboard-chart-parts';
import { deriveLegs, deriveTripPosition } from './trip-position';

function point(date: string, cityName: string | null, overrides: Partial<BurnRatePoint> = {}): BurnRatePoint {
  return {
    date,
    cumulative: 0,
    daily: 0,
    plannedCumulative: 0,
    plannedDaily: 100,
    countryName: cityName ? 'Japan' : null,
    cityName,
    legStatus: 'planned',
    ...overrides,
  };
}

const series = [
  point('2027-03-01', 'Tokyo', { daily: 90 }),
  point('2027-03-02', 'Tokyo', { daily: 110 }),
  point('2027-03-03', 'Kyoto', { daily: 50 }),
  point('2027-03-04', 'Kyoto'),
  point('2027-03-05', 'Kyoto'),
  point('2027-03-06', 'Osaka'),
];

describe('deriveLegs', () => {
  it('groups consecutive dates of one city and sums planned and actual spend', () => {
    const legs = deriveLegs(series);
    expect(legs.map((leg) => [leg.cityName, leg.nights, leg.planned, leg.actual])).toEqual([
      ['Tokyo', 2, 200, 200],
      ['Kyoto', 3, 300, 50],
      ['Osaka', 1, 100, 0],
    ]);
  });

  it('splits a city that reappears after a gap into separate legs', () => {
    const legs = deriveLegs([point('2027-03-01', 'Tokyo'), point('2027-03-02', null), point('2027-03-03', 'Tokyo')]);
    expect(legs).toHaveLength(2);
  });
});

describe('deriveTripPosition', () => {
  it('finds the leg containing the cutoff date, the day within it and the next leg', () => {
    const position = deriveTripPosition(series, '2027-03-04');
    expect(position.current).toMatchObject({ cityName: 'Kyoto', dayOfLeg: 2, nightsLeft: 1 });
    expect(position.next?.cityName).toBe('Osaka');
  });

  it('reports no current leg before the trip and offers the first leg as next', () => {
    const position = deriveTripPosition(series, '2027-02-20');
    expect(position.current).toBeNull();
    expect(position.next?.cityName).toBe('Tokyo');
  });

  it('reports nothing when the cutoff is after the last leg', () => {
    expect(deriveTripPosition(series, '2027-04-01')).toEqual({ current: null, next: null });
  });

  it('stays empty without data rather than inventing a destination', () => {
    expect(deriveTripPosition([], '2027-03-01')).toEqual({ current: null, next: null });
  });
});
