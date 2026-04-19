export const PLAN_COLORS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#eab308', '#22c55e'];

export function getPlanColor(index: number): string {
  return PLAN_COLORS[index % PLAN_COLORS.length];
}
