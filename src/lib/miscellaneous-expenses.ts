import { z } from 'zod';
import type { MiscellaneousExpenseItem } from '@/types';

export const miscellaneousExpenseSchema = z.object({
  description: z.string().trim().max(500).nullable().default(null),
  cost: z.number().finite().nonnegative(),
}).strict();

export const miscellaneousExpensesSchema = z.array(miscellaneousExpenseSchema);

export function getMiscellaneousExpenseTotal(
  expenses: MiscellaneousExpenseItem[] | null | undefined
): number {
  return (expenses ?? []).reduce((total, expense) => total + expense.cost, 0);
}
