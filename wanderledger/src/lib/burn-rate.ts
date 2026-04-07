interface DailyExpense {
  date: string;
  amountAud: number;
}

export interface BurnRatePoint {
  date: string;
  cumulative: number;
  daily: number;
  plannedCumulative: number;
  plannedDaily: number;
  countryName: string | null;
  cityName: string | null;
}

export interface CountryBand {
  countryName: string;
  startDate: string;
  endDate: string;
  pointCount: number;
}

export function buildCumulativeSpend(expenses: DailyExpense[]): BurnRatePoint[] {
  if (expenses.length === 0) return [];

  // Group by date
  const byDate = new Map<string, number>();
  for (const e of expenses) {
    byDate.set(e.date, (byDate.get(e.date) || 0) + e.amountAud);
  }

  // Sort dates
  const dates = Array.from(byDate.keys()).sort();
  let cumulative = 0;
  return dates.map(date => {
    const daily = byDate.get(date) || 0;
    cumulative += daily;
    return {
      date,
      cumulative,
      daily,
      plannedCumulative: 0,
      plannedDaily: 0,
      countryName: null,
      cityName: null,
    };
  });
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().split('T')[0];
}

export function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = startDate;

  while (current <= endDate) {
    dates.push(current);
    current = addDays(current, 1);
  }

  return dates;
}

export function buildBurnRateSeries(params: {
  startDate: string;
  endDate: string;
  actualByDate: Map<string, number>;
  plannedByDate: Map<string, number>;
  metadataByDate: Map<string, { countryName: string | null; cityName: string | null }>;
}): BurnRatePoint[] {
  const { startDate, endDate, actualByDate, plannedByDate, metadataByDate } = params;
  let cumulative = 0;
  let plannedCumulative = 0;

  return enumerateDates(startDate, endDate).map((date) => {
    const daily = actualByDate.get(date) || 0;
    const plannedDaily = plannedByDate.get(date) || 0;
    const metadata = metadataByDate.get(date) || { countryName: null, cityName: null };

    cumulative += daily;
    plannedCumulative += plannedDaily;

    return {
      date,
      cumulative,
      daily,
      plannedCumulative,
      plannedDaily,
      countryName: metadata.countryName,
      cityName: metadata.cityName,
    };
  });
}

export function buildCountryBands(points: BurnRatePoint[]): CountryBand[] {
  const bands: CountryBand[] = [];
  let lastCountryName: string | null = null;

  for (const point of points) {
    if (!point.countryName) {
      lastCountryName = null;
      continue;
    }

    const currentBand = bands[bands.length - 1];
    if (currentBand && lastCountryName === point.countryName) {
      currentBand.endDate = point.date;
      currentBand.pointCount += 1;
      lastCountryName = point.countryName;
      continue;
    }

    bands.push({
      countryName: point.countryName,
      startDate: point.date,
      endDate: point.date,
      pointCount: 1,
    });
    lastCountryName = point.countryName;
  }

  return bands;
}

export function calcBurnRate(
  totalSpent: number,
  daysElapsed: number,
  window?: { expenses: DailyExpense[]; days: number }
): { tripAvg: number; windowAvg: number | null } {
  const tripAvg = daysElapsed > 0 ? totalSpent / daysElapsed : 0;

  if (!window || window.expenses.length === 0) {
    return { tripAvg, windowAvg: null };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - window.days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const windowTotal = window.expenses
    .filter(e => e.date >= cutoffStr)
    .reduce((s, e) => s + e.amountAud, 0);

  const windowAvg = windowTotal / window.days;
  return { tripAvg, windowAvg };
}

export function projectTotal(
  currentSpent: number,
  dailyRate: number,
  daysRemaining: number
): number {
  return currentSpent + dailyRate * daysRemaining;
}
