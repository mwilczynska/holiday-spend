interface DerivedLegBase {
  startDate: string | null;
  endDate: string | null;
  nights: number;
  sortOrder?: number | null;
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().split('T')[0];
}

function normalizeNights(nights: number | null | undefined): number {
  return Number.isInteger(nights) && Number(nights) > 0 ? Number(nights) : 1;
}

function stableSortByLegOrder<T extends { sortOrder?: number | null }>(legs: T[]): T[] {
  return legs
    .map((leg, index) => ({ leg, index }))
    .sort((a, b) => {
      const orderDelta = (a.leg.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.leg.sortOrder ?? Number.MAX_SAFE_INTEGER);
      if (orderDelta !== 0) return orderDelta;
      return a.index - b.index;
    })
    .map(({ leg }) => leg);
}

export function deriveLegDates<T extends DerivedLegBase>(legs: T[]): Array<T & { startDate: string | null; endDate: string | null }> {
  const orderedLegs = stableSortByLegOrder(legs);
  const resolved = orderedLegs.map((leg) => ({
    ...leg,
    startDate: leg.startDate ?? null,
    endDate: leg.endDate ?? null,
    _nights: normalizeNights(leg.nights),
    _startExplicit: leg.startDate != null,
    _endExplicit: leg.endDate != null,
  }));

  for (let index = 0; index < resolved.length; index += 1) {
    const current = resolved[index];
    const previous = index > 0 ? resolved[index - 1] : null;

    if (!current.startDate && previous) {
      if (previous._endExplicit && previous.endDate) {
        // Previous leg's endDate is the check-out day — new leg checks in same day
        current.startDate = previous.endDate;
      } else if (previous.startDate) {
        // endDate = startDate + nights, so next leg starts startDate + nights
        current.startDate = addDays(previous.startDate, previous._nights);
      } else if (previous.endDate) {
        // Derived endDate is already the check-out day
        current.startDate = previous.endDate;
      }
    }

    if (!current.endDate && current.startDate) {
      // endDate = check-out = startDate + nights
      current.endDate = addDays(current.startDate, current._nights);
    }

    if (!current.startDate && current.endDate) {
      // startDate = check-in = endDate - nights
      current.startDate = addDays(current.endDate, -current._nights);
    }
  }

  for (let index = resolved.length - 1; index >= 0; index -= 1) {
    const current = resolved[index];
    const next = index < resolved.length - 1 ? resolved[index + 1] : null;

    if (!current.endDate && next?.startDate) {
      // Next leg's check-in = this leg's check-out
      current.endDate = next.startDate;
    }

    if (!current.startDate && current.endDate) {
      current.startDate = addDays(current.endDate, -current._nights);
    }

    if (!current.endDate && current.startDate) {
      current.endDate = addDays(current.startDate, current._nights);
    }
  }

  return resolved.map((leg) => {
    const output = { ...leg } as T & {
      startDate: string | null;
      endDate: string | null;
      _nights?: number;
      _startExplicit?: boolean;
      _endExplicit?: boolean;
    };
    delete output._nights;
    delete output._startExplicit;
    delete output._endExplicit;
    return output as T & { startDate: string | null; endDate: string | null };
  });
}
