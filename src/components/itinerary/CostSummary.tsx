'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PLANNER_UI_LOGIC } from '@/lib/planner-ui-logic';

interface LegData {
  countryName: string;
  countryId: string;
  dailyCost: number;
  legTotal: number;
  nights: number;
}

interface CostSummaryProps {
  legs: LegData[];
  fixedCostsTotal: number;
  groupSize?: number;
}

export function CostSummary({ legs, fixedCostsTotal, groupSize = 2 }: CostSummaryProps) {
  const totalLegsCost = legs.reduce((sum, l) => sum + l.legTotal, 0);
  const grandTotal = totalLegsCost + fixedCostsTotal;
  const totalNights = legs.reduce((sum, l) => sum + l.nights, 0);
  const months = totalNights / 30;
  const monthlyBurn = months > 0 ? grandTotal / months : 0;

  // Group by country
  const byCountry = legs.reduce<Record<string, { total: number; nights: number }>>((acc, leg) => {
    const key = leg.countryName;
    if (!acc[key]) acc[key] = { total: 0, nights: 0 };
    acc[key].total += leg.legTotal;
    acc[key].nights += leg.nights;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Trip Summary</CardTitle>
          <p className="text-xs leading-4 text-muted-foreground">
            {groupSize} {groupSize === 1 ? 'traveller' : 'travellers'} selected. {PLANNER_UI_LOGIC.tripSummary}
          </p>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Leg costs</span>
            <span className="font-medium">${totalLegsCost.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fixed costs</span>
            <span className="font-medium">${fixedCostsTotal.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-bold">
            <span>Total</span>
            <span>${grandTotal.toLocaleString('en-AU', { maximumFractionDigits: 0 })} AUD</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{totalNights} nights ({months.toFixed(1)} months)</span>
            <span>${monthlyBurn.toLocaleString('en-AU', { maximumFractionDigits: 0 })}/month</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">By Country</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {Object.entries(byCountry)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([country, data]) => (
              <div key={country} className="flex justify-between">
                <span className="text-muted-foreground">
                  {country} <span className="text-xs">({data.nights}n)</span>
                </span>
                <span>${data.total.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
