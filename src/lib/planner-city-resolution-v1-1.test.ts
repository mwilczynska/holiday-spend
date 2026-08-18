import { describe, expect, it } from 'vitest';
import { buildV11PlannerIdentity } from '@/lib/planner-city-resolution';

describe('v1.1 planner identity boundary', () => {
  it('keeps the requested city and canonicalizes only the country', () => {
    expect(
      buildV11PlannerIdentity(
        [{ id: 'czechia', name: 'Czechia' }],
        'Brno',
        'Czech Republic'
      )
    ).toMatchObject({ city: 'Brno', country: 'Czech Republic' });
  });

  it('fails before generation for an unsupported country', () => {
    expect(() => buildV11PlannerIdentity([], 'Toyama', 'Unknownland')).toThrow(/not in the canonical country dataset/);
  });
});
