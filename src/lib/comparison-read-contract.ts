import { z } from 'zod';

const id = z.string().min(1);
const money = z.number().finite().nonnegative();
const count = z.number().int().nonnegative();
const groupSize = z.number().int().min(1).max(5);
export const comparisonPlanIdsSchema = z.array(id).min(1).max(5)
  .refine(ids => new Set(ids).size === ids.length, 'Plan IDs must be unique.');

export const comparisonSavedPlansSchema = z.array(z.object({
  id, name: z.string(), groupSize, legCount: count, totalNights: count, totalBudget: money,
  fixedCostCount: count, createdAt: z.string().nullable(), updatedAt: z.string().nullable(),
})).refine(plans => new Set(plans.map(plan => plan.id)).size === plans.length);

export const comparisonResultsSchema = z.object({ plans: z.array(z.object({
  id, name: z.string(), groupSize,
  summary: z.object({ totalBudget: money, totalNights: count, avgDailySpend: money, legCount: count, fixedCostTotal: money }),
  series: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), cumulativePlanned: money, dailyPlanned: money })),
  countryTotals: z.array(z.object({
    countryId: z.string().nullable(), countryName: z.string().nullable(), totalPlanned: money,
    plannedDays: count, plannedPerDay: money.nullable(),
  })),
  categoryTotals: z.array(z.object({
    category: z.enum(['accommodation', 'food', 'drinks', 'activities', 'transport', 'fixed_cost']), totalPlanned: money,
  })),
})) });
