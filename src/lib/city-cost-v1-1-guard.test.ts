import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertV11OutputPathSafe,
  isLiveCityCostCsvPath,
  LIVE_CITY_COST_CSV_RELATIVE_PATH,
} from '@/lib/city-cost-v1-1-guard';

describe('city-cost v1.1 output guard', () => {
  it('identifies the checked-in live CSV independent of path spelling', () => {
    expect(isLiveCityCostCsvPath(LIVE_CITY_COST_CSV_RELATIVE_PATH)).toBe(true);
    expect(isLiveCityCostCsvPath(`.${path.sep}${LIVE_CITY_COST_CSV_RELATIVE_PATH}`)).toBe(true);
    expect(isLiveCityCostCsvPath('data/reference/v1-1-staged/city_costs_app_aud.csv')).toBe(false);
  });

  it('refuses the live CSV but permits staged outputs', () => {
    expect(() => assertV11OutputPathSafe(LIVE_CITY_COST_CSV_RELATIVE_PATH)).toThrow(/cannot write the live/);
    expect(() => assertV11OutputPathSafe('data/reference/v1-1-staged/city_costs_app_aud.csv')).not.toThrow();
  });
});
