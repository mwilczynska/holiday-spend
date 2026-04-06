interface ExpenseLike {
  amount: number;
  amountAud: number | null;
  currency: string;
}

export function getExpenseAudAmount(expense: ExpenseLike): number {
  if (expense.amountAud != null) return expense.amountAud;
  if (expense.currency === 'AUD') return expense.amount;
  return 0;
}
