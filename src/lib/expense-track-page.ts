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
