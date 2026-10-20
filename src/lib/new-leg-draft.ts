import { addDays, nightsBetween } from '@/lib/itinerary-leg-dates';
import { isPlausibleLegDate, MAX_LEG_NIGHTS } from '@/lib/itinerary-validation';

/** A leg being added: start date, end date (check-out) and nights are kept consistent with each other. */
export interface NewLegDraft {
  id: number;
  cityId: string;
  startDate: string;
  endDate: string;
  nights: string;
}

export const DEFAULT_NEW_LEG_NIGHTS = 7;

function isValidNights(value: string) {
  return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= MAX_LEG_NIGHTS;
}

export function todayIso(now = new Date()) {
  return now.toISOString().split('T')[0];
}

export function createNewLegDraft(id: number, startDate: string, nights = DEFAULT_NEW_LEG_NIGHTS): NewLegDraft {
  return { id, cityId: '', startDate, endDate: addDays(startDate, nights), nights: String(nights) };
}

/**
 * Start date for the next leg: the check-out day of the last leg in itinerary order (or of the last draft already
 * being added), else today.
 */
export function nextLegStartDate(lastEndDate: string | null | undefined, now = new Date()) {
  return lastEndDate && isPlausibleLegDate(lastEndDate) ? lastEndDate : todayIso(now);
}

/**
 * Applies one field edit. Start date and nights recompute the end date; the end date recomputes nights when it gives
 * a valid stay. Fields that would need an invalid value to stay consistent are left for `newLegDraftError` to report.
 */
export function updateNewLegDraft(draft: NewLegDraft, field: 'cityId' | 'startDate' | 'endDate' | 'nights', value: string): NewLegDraft {
  const next = { ...draft, [field]: value };
  if (field === 'startDate' || field === 'nights') {
    if (isPlausibleLegDate(next.startDate) && isValidNights(next.nights)) {
      next.endDate = addDays(next.startDate, Number(next.nights));
    }
  } else if (field === 'endDate') {
    if (isPlausibleLegDate(next.startDate) && isPlausibleLegDate(value)) {
      const nights = nightsBetween(next.startDate, value);
      if (nights >= 1 && nights <= MAX_LEG_NIGHTS) next.nights = String(nights);
    }
  }
  return next;
}

export function newLegDraftError(draft: NewLegDraft): string | null {
  if (!isPlausibleLegDate(draft.startDate)) return 'Enter a start date between 2000 and 2100.';
  if (!isValidNights(draft.nights)) return `Enter a whole number of nights from 1 to ${MAX_LEG_NIGHTS}.`;
  if (draft.endDate !== addDays(draft.startDate, Number(draft.nights))) {
    return `The end date must be after the start date, within ${MAX_LEG_NIGHTS} nights.`;
  }
  return null;
}
