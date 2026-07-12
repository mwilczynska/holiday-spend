import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';

describe('canonical city drink inputs', () => {
  it('contains a complete coffee input and coffee-only tier for every city', () => {
    const csvPath = path.join(process.cwd(), 'data', 'reference', 'city_costs_app_aud.csv');
    const csv = fs.readFileSync(csvPath, 'utf8');
    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    });

    expect(parsed.errors).toEqual([]);
    expect(parsed.data.length).toBeGreaterThan(100);

    for (const row of parsed.data) {
      const coffee = Number(row.drink_coffee);
      const drinksNone = Number(row.drinks_none);

      expect(row.city).toBeTruthy();
      expect(row.drink_coffee?.trim()).toBeTruthy();
      expect(row.drinks_none?.trim()).toBeTruthy();
      expect(Number.isFinite(coffee)).toBe(true);
      expect(Number.isFinite(drinksNone)).toBe(true);
      expect(coffee).toBeGreaterThanOrEqual(0);
      expect(drinksNone).toBeGreaterThanOrEqual(0);
      expect(drinksNone).toBeCloseTo(coffee * 2, 2);
    }
  });
});
