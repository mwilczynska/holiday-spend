import { getExpenseAudAmount } from '@/lib/expense-aud';
import { getPageItems } from '@/lib/performance-bounds';

interface ExpenseTrackMetadataRow {
  id: number;
  amount: number;
  amountAud: number | null;
  currency: string;
  isExcluded: number | null;
}

export function buildExpenseTrackPageMetadata(
  expenses: readonly ExpenseTrackMetadataRow[],
  page: number,
  pageSize: number,
) {
  return {
    pageIds: getPageItems(expenses, page, pageSize).map((expense) => expense.id),
    totalCount: expenses.length,
    totalAud: expenses
      .filter((expense) => !expense.isExcluded)
      .reduce((sum, expense) => sum + getExpenseAudAmount(expense), 0),
    expenseIds: expenses.map((expense) => expense.id),
  };
}

export interface ExpenseExportFilters {
  /** `'all'` means the filter is not applied. */
  category: string;
  source: string;
  from: string;
  to: string;
}

/**
 * Builds the CSV export URL for the expenses screen from the filters currently applied to the
 * list, so a download matches what is on screen instead of silently returning every expense.
 * `/api/export` accepts the same parameter names as `/api/expenses`.
 */
export function buildExpenseExportHref(filters: ExpenseExportFilters): string {
  const params = new URLSearchParams({ format: 'csv' });
  if (filters.category && filters.category !== 'all') params.set('cat', filters.category);
  if (filters.source && filters.source !== 'all') params.set('source', filters.source);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return `/api/export?${params}`;
}
