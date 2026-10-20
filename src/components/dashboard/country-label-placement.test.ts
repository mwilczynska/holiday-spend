import { describe, expect, it } from 'vitest';
import { BURN_COUNTRY_LABEL_COLUMN_GAP, placeCountryLabels } from './dashboard-chart-parts';

// Ten equal country bands across the strip, each label 60px wide (about "Philippines" at 11px).
const tenBands = Array.from({ length: 10 }, (_, i) => ({
  segmentStartRatio: i / 10,
  segmentEndRatio: (i + 1) / 10,
  width: 60,
}));

function overlapsOnSameRow(placed: Array<{ left: number; level: number }>, widths: number[]) {
  return placed.some((a, i) =>
    placed.some((b, j) =>
      j > i && a.level === b.level && a.left < b.left + widths[j] && b.left < a.left + widths[i]));
}

describe('placeCountryLabels', () => {
  it('keeps every label on one row when the strip is wide enough', () => {
    const placed = placeCountryLabels(tenBands, 1000);
    expect(placed.every((label) => label.level === 0)).toBe(true);
  });

  it('stacks labels that would collide on a phone-width strip', () => {
    const placed = placeCountryLabels(tenBands, 300);
    expect(new Set(placed.map((label) => label.level)).size).toBeGreaterThan(1);
    expect(overlapsOnSameRow(placed, tenBands.map((band) => band.width))).toBe(false);
  });

  it('leaves at least the column gap between neighbours on a row', () => {
    const placed = placeCountryLabels(tenBands, 300);
    const rowZero = placed.filter((label) => label.level === 0).map((label) => label.left);
    for (let i = 1; i < rowZero.length; i += 1) {
      expect(rowZero[i] - (rowZero[i - 1] + 60)).toBeGreaterThanOrEqual(BURN_COUNTRY_LABEL_COLUMN_GAP);
    }
  });

  it('clamps labels on narrow end bands inside the strip', () => {
    const placed = placeCountryLabels(
      [
        { segmentStartRatio: 0, segmentEndRatio: 0.02, width: 80 },
        { segmentStartRatio: 0.98, segmentEndRatio: 1, width: 80 },
      ],
      300,
    );
    expect(placed[0].left).toBe(0);
    expect(placed[1].left).toBe(220);
  });
});
