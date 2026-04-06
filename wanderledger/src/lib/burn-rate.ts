interface DailyExpense {
  date: string;
  amountAud: number;
}

export interface BurnRatePoint {
  date: string;
  cumulative: number;
  daily: number;
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
    return { date, cumulative, daily };
  });
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
