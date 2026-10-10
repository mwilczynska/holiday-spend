import { z } from 'zod';
import { cityImageViewSchema } from './city-image-view';

const amount = z.number().finite();
const optionalAmount = amount.nullable();
const status = z.enum(['planned', 'active', 'completed']).nullable();

export const dashboardReadSchema = z.object({
  summary: z.object({
    totalBudget: amount, plannedLegsTotal: amount, fixedTotal: amount,
    groupSize: z.number().int().min(1).max(5), totalSpent: amount,
    plannedToDate: amount, varianceToDate: amount, projectedTotal: amount,
    forecastVariance: amount, remainingLegBudget: amount, remaining: amount,
    asOfDate: z.string(), asOfSource: z.enum(['last_transaction', 'today']),
    daysElapsed: amount, daysRemaining: amount, totalNights: amount,
    destinations: amount, expenseCount: amount,
    burnRate: z.object({
      tripAvg: amount, plannedAvgSoFar: amount, sevenDayAvg: optionalAmount,
      thirtyDayAvg: optionalAmount, requiredDailyPace: optionalAmount,
    }),
    budgetHealth: z.enum(['on_track', 'warning', 'over_budget']),
  }),
  plannedVsActual: z.object({
    comparison: z.array(z.object({
      countryId: z.string(), countryName: z.string(), blockIndex: amount.nullable(),
      planned: amount, actual: amount, plannedDays: amount,
      plannedPerDay: optionalAmount, actualPerDay: optionalAmount, status,
    })),
    cityComparison: z.array(z.object({
      legId: amount, cityName: z.string(), countryName: z.string(), startDate: z.string().nullable(),
      planned: amount, actual: amount, plannedDays: amount,
      plannedPerDay: optionalAmount, actualPerDay: optionalAmount, status,
      cityImage: cityImageViewSchema.nullable().default(null),
    })).default([]),
    actualCategoryTotals: z.record(z.string(), amount), plannedCategoryTotals: z.record(z.string(), amount),
  }),
  burnRate: z.object({
    cumulative: z.array(z.object({
      date: z.string(), cumulative: amount, daily: amount,
      plannedCumulative: amount, plannedDaily: amount,
      countryName: z.string().nullable(), cityName: z.string().nullable(), legStatus: z.string().nullable(),
    })),
    countryBands: z.array(z.object({
      countryName: z.string(), startDate: z.string(), endDate: z.string(), pointCount: amount,
    })),
  }),
});
