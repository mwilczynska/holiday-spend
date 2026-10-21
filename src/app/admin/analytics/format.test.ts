import { describe, expect, it } from 'vitest';
import { actionLabel, daysBefore, eventLabel, formatBytes, formatDuration, humanize, rateVital, stepLabel, zeroFillDays } from './format';

describe('analytics dashboard formatting', () => {
  it('fills every UTC day in the range so quiet days chart as zero', () => {
    const rows = zeroFillDays([{ day: '2026-10-02', events: 5 }], '2026-10-01', '2026-10-03', { events: 0 });
    expect(rows).toEqual([{ day: '2026-10-01', events: 0 }, { day: '2026-10-02', events: 5 }, { day: '2026-10-03', events: 0 }]);
    expect(zeroFillDays<{ day: string; events: number }>([], '2026-10-05', '2026-10-01', { events: 0 })).toEqual([]);
  });
  it('counts back whole UTC days for the default range', () => {
    expect(daysBefore('2026-10-21', 29)).toBe('2026-09-22');
    expect(daysBefore('2026-03-01', 1)).toBe('2026-02-28');
  });
  it('turns codes into readable labels', () => {
    expect(eventLabel('page_viewed')).toBe('Page view');
    expect(eventLabel('something_new')).toBe('Something new');
    expect(actionLabel('migration_baseline')).toBe('History started');
    expect(actionLabel('leg_created')).toBe('Leg created');
    expect(stepLabel('cities.create-with-generation')).toBe('City generated and saved');
    expect(humanize('deliveryDelayed')).toBe('Delivery delayed');
    expect(humanize('desktop-sidebar.plan-compare')).toBe('Desktop sidebar plan compare');
  });
  it('formats sizes and durations', () => {
    expect(formatBytes(258048)).toBe('252 KB');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatDuration(52.93)).toBe('53 ms');
    expect(formatDuration(12_300)).toBe('12 s');
    expect(formatDuration(125_000)).toBe('2 min 5 s');
    expect(formatDuration(null)).toBe('—');
  });
  it('rates Web Vitals against the published thresholds', () => {
    expect(rateVital('LCP', 2400)).toBe('good');
    expect(rateVital('LCP', 3000)).toBe('needs-improvement');
    expect(rateVital('CLS', 0.3)).toBe('poor');
    expect(rateVital('UNKNOWN', 1)).toBeNull();
  });
});
