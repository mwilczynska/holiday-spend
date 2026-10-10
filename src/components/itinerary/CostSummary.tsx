'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
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

const fmt = (n: number) => `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

export function TripSummaryCard({ legs, fixedCostsTotal, groupSize = 2 }: CostSummaryProps) {
  const totalLegsCost = legs.reduce((sum, l) => sum + l.legTotal, 0);
  const grandTotal = totalLegsCost + fixedCostsTotal;
  const totalNights = legs.reduce((sum, l) => sum + l.nights, 0);
  const months = totalNights / 30;
  const monthlyBurn = months > 0 ? grandTotal / months : 0;

  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">Trip summary</h2>
        <Link href="/" className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue-700 hover:text-blue-900">
          View dashboard <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
      <p className="text-xs leading-4 text-muted-foreground">
        {groupSize} {groupSize === 1 ? 'traveller' : 'travellers'} selected. {PLANNER_UI_LOGIC.tripSummary}
      </p>
      <div className="flex justify-between text-sm">
        <span className="text-slate-700">Total leg costs</span>
        <span className="font-bold">{fmt(totalLegsCost)}</span>
      </div>
      {/* Fixed costs are retired; only older ones that still count toward the total are listed. */}
      {fixedCostsTotal > 0 ? (
        <div className="flex justify-between text-sm">
          <span className="text-slate-700">Older fixed costs</span>
          <span className="font-bold">{fmt(fixedCostsTotal)}</span>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between border-t pt-2.5">
        <span className="text-base font-extrabold">Total</span>
        <span className="text-xl font-extrabold">
          {fmt(grandTotal)} <span className="text-xs font-semibold text-muted-foreground">AUD</span>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {totalNights} nights ({months.toFixed(1)} months) · {fmt(monthlyBurn)}/month
      </p>
    </section>
  );
}

export function CountrySummaryCard({ legs }: Pick<CostSummaryProps, 'legs'>) {
  const byCountry = legs.reduce<Record<string, { total: number; nights: number }>>((acc, leg) => {
    const key = leg.countryName;
    if (!acc[key]) acc[key] = { total: 0, nights: 0 };
    acc[key].total += leg.legTotal;
    acc[key].nights += leg.nights;
    return acc;
  }, {});

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border bg-card p-5">
      <h2 className="text-[15px] font-bold">By country</h2>
      {/* Full-width below lg's two-column hero, a single narrow column beside it at 2xl. */}
      <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-3 text-sm sm:grid sm:grid-cols-2 sm:gap-x-8 sm:space-y-0 sm:gap-y-1.5 xl:grid-cols-3 2xl:block 2xl:space-y-1.5">
        {Object.entries(byCountry)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([country, data]) => (
            <div key={country} className="flex justify-between gap-3">
              <span className="text-slate-700">
                {country} <span className="text-xs text-muted-foreground">({data.nights}n)</span>
              </span>
              <span className="shrink-0 font-semibold">{fmt(data.total)}</span>
            </div>
          ))}
      </div>
    </section>
  );
}
