import type { PlanSnapshot } from './plan-snapshot';
import type { AccomTier, FoodTier, DrinksTier, ActivitiesTier } from '@/types';
import { getDailyCost, getLegTotal } from './cost-calculator';
import { getIntercityTransportTotal } from './intercity-transport';
import { deriveLegDates } from './itinerary-leg-dates';
import { enumerateDates } from './burn-rate';

interface CityData {
  accomHostel: number | null;
  accomPrivateRoom: number | null;
  accom1star: number | null;
  accom2star: number | null;
  accom3star: number | null;
  accom4star: number | null;
  foodStreet: number | null;
  foodBudget: number | null;
  foodMid: number | null;
  foodHigh: number | null;
  drinkCoffee: number | null;
  drinksNone: number | null;
  drinksLight: number | null;
  drinksModerate: number | null;
  drinksHeavy: number | null;
  activitiesFree: number | null;
  activitiesBudget: number | null;
  activitiesMid: number | null;
  activitiesHigh: number | null;
  transportLocal: number | null;
}

export interface PlanComparisonSeries {
  date: string;
  cumulativePlanned: number;
  dailyPlanned: number;
}

export interface PlanComparisonResult {
  id: string;
  name: string;
  groupSize: number;
  summary: {
    totalBudget: number;
    totalNights: number;
    avgDailySpend: number;
    legCount: number;
    fixedCostTotal: number;
  };
  series: PlanComparisonSeries[];
}

export function computePlanComparison(
  planId: string,
  name: string,
  snapshot: PlanSnapshot,
  cityMap: Map<string, CityData>
): PlanComparisonResult {
  const groupSize = snapshot.groupSize;

  // Derive dates for legs that may be missing start/end
  const datedLegs = deriveLegDates(
    snapshot.legs.map((leg, index) => ({
      startDate: leg.startDate ?? null,
      endDate: leg.endDate ?? null,
      nights: leg.nights,
      sortOrder: leg.sortOrder ?? index + 1,
      cityId: leg.cityId,
      accomTier: (leg.accomTier || '2star') as AccomTier,
      foodTier: (leg.foodTier || 'mid') as FoodTier,
      drinksTier: (leg.drinksTier || 'moderate') as DrinksTier,
      activitiesTier: (leg.activitiesTier || 'mid') as ActivitiesTier,
      accomOverride: leg.accomOverride ?? null,
      foodOverride: leg.foodOverride ?? null,
      drinksOverride: leg.drinksOverride ?? null,
      activitiesOverride: leg.activitiesOverride ?? null,
      transportOverride: leg.transportOverride ?? null,
      intercityTransports: leg.intercityTransports ?? [],
    }))
  );

  // Build planned spend per date
  const plannedByDate = new Map<string, number>();
  let totalLegBudget = 0;

  for (const leg of datedLegs) {
    const city = cityMap.get(leg.cityId);
    if (!city || !leg.startDate || !leg.endDate) continue;

    const dailyCost = getDailyCost(
      city,
      leg.accomTier,
      leg.foodTier,
      leg.drinksTier,
      leg.activitiesTier,
      {
        accomOverride: leg.accomOverride,
        foodOverride: leg.foodOverride,
        drinksOverride: leg.drinksOverride,
        activitiesOverride: leg.activitiesOverride,
        transportOverride: leg.transportOverride,
      },
      groupSize
    );

    const intercityCost = getIntercityTransportTotal(leg.intercityTransports);
    const legTotal = getLegTotal(dailyCost, leg.nights, intercityCost);
    totalLegBudget += legTotal;

    const dates = enumerateDates(leg.startDate, leg.endDate);
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const existing = plannedByDate.get(date) || 0;
      // Add intercity transport cost to the first day of the leg
      const dayAmount = i === 0 ? dailyCost + intercityCost : dailyCost;
      plannedByDate.set(date, existing + dayAmount);
    }
  }

  // Add fixed costs
  const fixedCostTotal = snapshot.fixedCosts.reduce((sum, fc) => sum + fc.amountAud, 0);
  const totalBudget = totalLegBudget + fixedCostTotal;

  // Spread fixed costs across trip dates if they have no specific date
  if (fixedCostTotal > 0) {
    const allDates = Array.from(plannedByDate.keys()).sort();
    for (const fc of snapshot.fixedCosts) {
      if (fc.date && plannedByDate.has(fc.date)) {
        plannedByDate.set(fc.date, (plannedByDate.get(fc.date) || 0) + fc.amountAud);
      } else if (fc.date) {
        plannedByDate.set(fc.date, fc.amountAud);
      } else if (allDates.length > 0) {
        // Spread evenly across all trip dates
        const perDay = fc.amountAud / allDates.length;
        for (const date of allDates) {
          plannedByDate.set(date, (plannedByDate.get(date) || 0) + perDay);
        }
      }
    }
  }

  // Build cumulative series
  const sortedDates = Array.from(plannedByDate.keys()).sort();
  const startDate = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];

  let cumulativePlanned = 0;
  const series: PlanComparisonSeries[] = startDate && endDate
    ? enumerateDates(startDate, endDate).map((date) => {
        const dailyPlanned = plannedByDate.get(date) || 0;
        cumulativePlanned += dailyPlanned;
        return { date, cumulativePlanned, dailyPlanned };
      })
    : [];

  const totalNights = snapshot.legs.reduce((sum, leg) => sum + leg.nights, 0);

  return {
    id: planId,
    name,
    groupSize,
    summary: {
      totalBudget,
      totalNights,
      avgDailySpend: totalNights > 0 ? totalBudget / totalNights : 0,
      legCount: snapshot.legs.length,
      fixedCostTotal,
    },
    series,
  };
}
