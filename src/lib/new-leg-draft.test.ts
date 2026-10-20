import { describe, expect, it } from 'vitest';
import { createNewLegDraft, newLegDraftError, nextLegStartDate, updateNewLegDraft } from './new-leg-draft';

describe('new leg draft', () => {
  const draft = createNewLegDraft(1, '2026-11-01');

  it('starts with seven nights and the matching check-out day', () => {
    expect(draft).toMatchObject({ startDate: '2026-11-01', endDate: '2026-11-08', nights: '7' });
    expect(newLegDraftError(draft)).toBeNull();
  });

  it('moves the end date with the start date and with nights', () => {
    expect(updateNewLegDraft(draft, 'startDate', '2026-12-30')).toMatchObject({ endDate: '2027-01-06', nights: '7' });
    expect(updateNewLegDraft(draft, 'nights', '3')).toMatchObject({ endDate: '2026-11-04' });
  });

  it('derives nights from a new end date', () => {
    expect(updateNewLegDraft(draft, 'endDate', '2026-11-15')).toMatchObject({ nights: '14' });
  });

  it('reports an end date that does not give a valid stay instead of guessing', () => {
    const before = updateNewLegDraft(draft, 'endDate', '2026-10-20');
    expect(before.nights).toBe('7');
    expect(newLegDraftError(before)).toMatch(/end date/);
    expect(newLegDraftError(updateNewLegDraft(draft, 'endDate', '2028-01-01'))).toMatch(/end date/);
  });

  it('rejects partial dates typed into a date input and invalid nights', () => {
    expect(newLegDraftError(updateNewLegDraft(draft, 'startDate', '0202-11-01'))).toMatch(/start date/);
    expect(newLegDraftError(updateNewLegDraft(draft, 'nights', '0'))).toMatch(/nights/);
    expect(newLegDraftError(updateNewLegDraft(draft, 'nights', '1.5'))).toMatch(/nights/);
    expect(newLegDraftError(updateNewLegDraft(draft, 'nights', '367'))).toMatch(/nights/);
  });

  it('starts the next leg at the last check-out day, else today', () => {
    const now = new Date('2026-10-20T12:00:00Z');
    expect(nextLegStartDate('2027-03-03', now)).toBe('2027-03-03');
    expect(nextLegStartDate(null, now)).toBe('2026-10-20');
    expect(nextLegStartDate('0202-01-01', now)).toBe('2026-10-20');
  });
});
