'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EXPENSE_CATEGORIES } from '@/types';
import Link from 'next/link';
import { Map, Receipt, Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line, ReferenceArea, ReferenceLine,
} from 'recharts';

interface Summary {
  totalBudget: number;
  totalSpent: number;
  projectedTotal: number;
  remaining: number;
  daysElapsed: number;
  daysRemaining: number;
  totalNights: number;
  destinations: number;
  expenseCount: number;
  burnRate: { tripAvg: number; sevenDayAvg: number | null; thirtyDayAvg: number | null };
  budgetHealth: 'on_track' | 'warning' | 'over_budget';
}

interface CountryComparison {
  countryId: string;
  countryName: string;
  planned: number;
  actual: number;
  status: 'planned' | 'active' | 'completed' | null;
}

interface BurnRatePoint {
  date: string;
  cumulative: number;
  daily: number;
  plannedCumulative: number;
  plannedDaily: number;
  countryName: string | null;
  cityName: string | null;
}

interface CountryBand {
  countryName: string;
  startDate: string;
  endDate: string;
  pointCount: number;
}

const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
const COUNTRY_BAND_COLORS = ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#e0e7ff', '#cffafe'];
const COUNTRY_STATUS_BADGE: Record<'planned' | 'active' | 'completed', string> = {
  planned: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
};

const fmtAud = (n: number) => `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tooltipFmt = (v: any) => fmtAud(Number(v));

function BurnRateTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; dataKey?: string; name?: string; value?: number; payload?: BurnRatePoint }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-md border bg-background p-3 text-sm shadow-md">
      <div className="font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">
        {point.cityName && point.countryName
          ? `${point.cityName}, ${point.countryName}`
          : point.countryName || 'Outside planned legs'}
      </div>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color || '#94a3b8' }}
              />
              <span>{entry.name}</span>
            </div>
            <span className="font-medium">{fmtAud(Number(entry.value || 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [comparison, setComparison] = useState<CountryComparison[]>([]);
  const [categoryTotals, setCategoryTotals] = useState<Record<string, number>>({});
  const [burnData, setBurnData] = useState<BurnRatePoint[]>([]);
  const [countryBands, setCountryBands] = useState<CountryBand[]>([]);
  const [budgetCeiling, setBudgetCeiling] = useState(0);

  useEffect(() => {
    async function load() {
      const [summaryRes, compRes, burnRes] = await Promise.all([
        fetch('/api/dashboard/summary'),
        fetch('/api/dashboard/planned-vs-actual'),
        fetch('/api/dashboard/burn-rate'),
      ]);
      const summaryData = await summaryRes.json();
      const compData = await compRes.json();
      const burnRateData = await burnRes.json();

      if (summaryData.data) setSummary(summaryData.data);
      if (compData.data) {
        setComparison(compData.data.comparison || []);
        setCategoryTotals(compData.data.categoryTotals || {});
      }
      if (burnRateData.data) {
        setBurnData(burnRateData.data.cumulative || []);
        setCountryBands(burnRateData.data.countryBands || []);
      }
      if (summaryData.data) {
        setBudgetCeiling(summaryData.data.totalBudget);
      }
    }
    load();
  }, []);

  const healthColor = summary?.budgetHealth === 'on_track' ? 'text-green-600' :
    summary?.budgetHealth === 'warning' ? 'text-yellow-600' : 'text-red-600';

  const HealthIcon = summary?.budgetHealth === 'on_track' ? TrendingDown :
    summary?.budgetHealth === 'warning' ? Minus : TrendingUp;

  // Pie chart data
  const pieData = Object.entries(categoryTotals)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: EXPENSE_CATEGORIES.find(c => c.value === key)?.label ?? key,
      value: Math.round(value),
    }))
    .sort((a, b) => b.value - a.value);

  // Bar chart data
  const barData = comparison
    .filter(c => c.planned > 0 || c.actual > 0)
    .map(c => ({
      name: c.countryName,
      Planned: Math.round(c.planned),
      Actual: Math.round(c.actual),
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wanderledger</h1>
          <p className="text-sm text-muted-foreground">Travel Budget Planner & Tracker</p>
        </div>
        <div className="flex gap-2">
          <Link href="/track/add">
            <Badge variant="default" className="cursor-pointer py-1 px-3">
              <Plus className="h-3 w-3 mr-1" />Quick Add
            </Badge>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Budget</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold">{fmtAud(summary.totalBudget)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Spent</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{fmtAud(summary.totalSpent)}</p>
              <p className="text-xs text-muted-foreground">{summary.totalBudget > 0 ? `${((summary.totalSpent / summary.totalBudget) * 100).toFixed(0)}% of budget` : ''}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Projected Total</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-xl font-bold ${healthColor}`}>{fmtAud(summary.projectedTotal)}</p>
              <div className={`flex items-center gap-1 text-xs ${healthColor}`}>
                <HealthIcon className="h-3 w-3" />
                <span>{summary.budgetHealth === 'on_track' ? 'On Track' : summary.budgetHealth === 'warning' ? 'Warning' : 'Over Budget'}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Remaining</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-xl font-bold ${summary.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmtAud(summary.remaining)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Secondary stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Days Elapsed</p>
              <p className="text-lg font-bold">{summary.daysElapsed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Days Left</p>
              <p className="text-lg font-bold">{summary.daysRemaining}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Daily Avg</p>
              <p className="text-lg font-bold">{fmtAud(summary.burnRate.tripAvg)}/day</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">7-Day Avg</p>
              <p className="text-lg font-bold">{summary.burnRate.sevenDayAvg != null ? `${fmtAud(summary.burnRate.sevenDayAvg)}/day` : '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">30-Day Avg</p>
              <p className="text-lg font-bold">{summary.burnRate.thirtyDayAvg != null ? `${fmtAud(summary.burnRate.thirtyDayAvg)}/day` : '—'}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Planned vs Actual */}
        {barData.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Planned vs Actual by Country</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={tooltipFmt} />
                  <Legend />
                  <Bar dataKey="Planned" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Category Breakdown */}
        {pieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Spending by Category</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={{ strokeWidth: 1 }}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={tooltipFmt} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Burn Rate Chart */}
      {burnData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cumulative Spend Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={burnData} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip content={<BurnRateTooltip />} />
                <Legend />
                {countryBands.map((band, index) => (
                  <ReferenceArea
                    key={`${band.countryName}-${band.startDate}-${band.endDate}`}
                    x1={band.startDate}
                    x2={band.endDate}
                    fill={COUNTRY_BAND_COLORS[index % COUNTRY_BAND_COLORS.length]}
                    fillOpacity={0.18}
                    ifOverflow="extendDomain"
                    label={band.pointCount >= 4 ? {
                      value: band.countryName,
                      position: 'insideTop',
                      fill: '#64748b',
                      fontSize: 10,
                    } : undefined}
                  />
                ))}
                <Line type="monotone" dataKey="cumulative" name="Spent" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="plannedCumulative" name="Estimated" stroke="#6b7280" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                {budgetCeiling > 0 && (
                  <ReferenceLine y={budgetCeiling} stroke="#ef4444" strokeDasharray="5 5" label={{ value: `Budget ${fmtAud(budgetCeiling)}`, position: 'right', fontSize: 10, fill: '#ef4444' }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Country Comparison Table */}
      {comparison.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Country Comparison</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="p-2 text-left">Country</th>
                    <th className="p-2 text-right">Planned</th>
                    <th className="p-2 text-right">Actual</th>
                    <th className="p-2 text-right">Difference</th>
                    <th className="p-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.filter(c => c.planned > 0 || c.actual > 0).map((c) => {
                    const diff = c.actual - c.planned;
                    const isOver = diff > 0;
                    return (
                      <tr key={c.countryId} className="border-b last:border-0">
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{c.countryName}</span>
                            {c.status ? (
                              <Badge variant="outline" className={`text-[10px] capitalize ${COUNTRY_STATUS_BADGE[c.status]}`}>
                                {c.status}
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-2 text-right">{fmtAud(c.planned)}</td>
                        <td className="p-2 text-right">{fmtAud(c.actual)}</td>
                        <td className={`p-2 text-right ${isOver ? 'text-red-600' : 'text-green-600'}`}>
                          {isOver ? '+' : ''}{fmtAud(diff)}
                        </td>
                        <td className="p-2 text-right">
                          {c.planned > 0 ? (
                            <Badge variant={isOver ? 'destructive' : 'default'} className="text-xs">
                              {((c.actual / c.planned) * 100).toFixed(0)}%
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">No plan</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Nav */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/plan" className="block">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Map className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Plan Trip</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/track/add" className="block">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Quick Add</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/track" className="block">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Receipt className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Expenses</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/track/import" className="block">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Import CSV</span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
