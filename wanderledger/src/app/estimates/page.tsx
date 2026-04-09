'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EstimateHistoryItem {
  id: number;
  cityId: string;
  cityName: string;
  countryName: string;
  estimatedAt: string;
  source: string | null;
  llmProvider: string | null;
  confidence: string | null;
  reasoning: string | null;
  isActive: number | null;
}

interface EstimateRow {
  cityId: string;
  cityName: string;
  countryId: string | null;
  countryName: string | null;
  region: string | null;
  currencyCode: string | null;
  estimationSource: string | null;
  estimatedAt: string | null;
  notes: string | null;
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
  drinksLight: number | null;
  drinksModerate: number | null;
  drinksHeavy: number | null;
  activitiesFree: number | null;
  activitiesBudget: number | null;
  activitiesMid: number | null;
  activitiesHigh: number | null;
  currentEstimate: {
    id: number;
    source: string | null;
    llmProvider: string | null;
    confidence: string | null;
    reasoning: string | null;
    estimatedAt: string | null;
  } | null;
  estimateHistory: EstimateHistoryItem[];
}

interface EstimatesResponse {
  summary: {
    cityCount: number;
    countryCount: number;
    sourceBreakdown: Array<{ source: string; count: number }>;
    historyCount: number;
  };
  rows: EstimateRow[];
  history: EstimateHistoryItem[];
}

interface MethodologySection {
  title: string;
  summary: string;
  paragraphs?: string[];
  bullets?: string[];
  codeBlocks?: string[];
}

const METHODOLOGY_SECTIONS: MethodologySection[] = [
  {
    title: 'Anchor Inputs',
    summary: 'Each city begins with 10 directly researched USD anchor prices.',
    paragraphs: [
      'The anchor set is: beer, coffee, inexpensive meal for one, mid-range meal for two, cocktail, wine glass, hostel dorm bed, hostel private room for two, 1-star hotel room for two, and 3-star hotel room for two.',
      'These anchors are researched first, then converted into the app-facing AUD budget tiers for two people.',
    ],
    bullets: [
      '`beer`: domestic draft beer, 1 pint, restaurant',
      '`coffee`: regular cappuccino',
      '`inexp_meal_1p`: meal at inexpensive restaurant',
      '`midrange_meal_2p`: three-course mid-range meal for two',
      '`cocktail`: standard cocktail, or `beer × 2.5` fallback',
      '`wine_glass`: glass of wine, or `beer × 1.5` fallback',
      '`hostel_dorm_1p`: one dorm bed per night',
      '`hostel_private_2p`: one private hostel or guesthouse room per night',
      '`hotel_1star_2p`: basic private hotel room per night',
      '`hotel_3star_2p`: comfortable 3-star hotel room per night',
    ],
  },
  {
    title: 'Source Priority And Fallbacks',
    summary: 'The methodology uses a fixed lookup hierarchy before estimating anything.',
    bullets: [
      'Numbeo first for food and drink anchors',
      'Hostelworld and Booking.com for accommodation anchors',
      'Nearest-city scaling when a city lacks direct data',
      'Regional-hub adjustment for very small or remote places',
      'Cocktail fallback: `beer × 2.5`',
      'Wine fallback: `beer × 1.5`',
      'No hostel scene: `hostel_dorm_1p = hotel_1star_2p / 2` and `hostel_private_2p = hotel_1star_2p`',
    ],
    paragraphs: [
      'If cocktail or wine data is missing, those are estimated from beer using fixed ratios. If a city has no hostel scene, the hostel dorm and private-room anchors fall back from the 1-star hotel price.',
      'For expensive Western cities, “street food” should be interpreted as cheap takeaway, fast food, or budget counter-service rather than literal street stalls.',
    ],
  },
  {
    title: 'Accommodation Formulas',
    summary: 'Accommodation outputs are deterministic transformations of the accommodation anchors.',
    codeBlocks: [
      `accom_shared_hostel_dorm  = hostel_dorm_1p × 2
accom_hostel_private_room = hostel_private_2p
accom_1_star              = hotel_1star_2p
accom_2_star              = (hotel_1star_2p + hotel_3star_2p) / 2
accom_3_star              = hotel_3star_2p
accom_4_star              = hotel_3star_2p × 1.80`,
    ],
    paragraphs: [
      'The 2-star tier is interpolated between 1-star and 3-star. The 4-star tier uses a fixed 1.80× multiplier on 3-star pricing.',
    ],
  },
  {
    title: 'Food Formulas',
    summary: 'Food budgets are derived from inexpensive-meal and mid-range-meal anchors.',
    codeBlocks: [
      `street_food_meal = inexp_meal_1p × 0.60

food_street_food = street_food_meal × 3 meals × 2 people
food_budget      = (street_food_meal × 2 + inexp_meal_1p) × 2 people
food_mid_range   = (street_food_meal + inexp_meal_1p + midrange_meal_2p / 2) × 2 people
food_high_end    = food_mid_range × 1.50`,
    ],
    paragraphs: [
      'Street assumes three very cheap meals. Budget mixes two street-style meals with one inexpensive restaurant meal. Mid-range blends a street meal, a cheap meal, and a proper restaurant meal. High-end is a fixed 1.5× uplift on mid-range.',
    ],
  },
  {
    title: 'Drinks Formulas',
    summary: 'Drink tiers are literal baskets for two people per day.',
    codeBlocks: [
      `drinks_light    = 2 × coffee + 2 × beer
drinks_moderate = 2 × coffee + 4 × beer + 2 × cocktail
drinks_heavy    = 2 × coffee + 6 × beer + 4 × cocktail + 2 × wine_glass`,
    ],
    bullets: [
      'Light: 1 coffee each + 1 beer each',
      'Moderate: 1 coffee each + 2 beers each + 1 cocktail each',
      'Heavy: 1 coffee each + 3 beers each + 2 cocktails each + 1 wine each',
    ],
    paragraphs: [
      'This is the most direct and stable part of the model because it is just a sum of observable unit prices.',
    ],
  },
  {
    title: 'Activities Formulas',
    summary: 'Activities blend local cost levels with a global floor so cheap cities do not come out unrealistically low.',
    codeBlocks: [
      `blended_factor      = (inexp_meal_1p + 10.00) / 2
activities_free       = 0.00
activities_budget     = blended_factor × 2
activities_mid_range  = blended_factor × 5.5
activities_high_end   = blended_factor × 12`,
    ],
    paragraphs: [
      'The `$10` global baseline prevents premium experiences in very cheap cities from collapsing to implausible numbers, while still letting expensive cities remain meaningfully more expensive.',
      'Local transport is not estimated anymore. Transport is manual-only in the planner through daily overrides and one-off intercity costs.',
    ],
  },
  {
    title: 'Group Size Scaling',
    summary: 'The stored dataset is always for two people. Runtime scaling handles groups of one to five.',
    codeBlocks: [
      `Hostel dorm: scaled = base_2p × (N / 2)

Room-based accommodation: scaled = base_2p × ceil(N / 2)

Food: scaled = base_2p × (N / 2) × (1.0 − 0.05 × max(0, N − 2))

Drinks and activities: scaled = base_2p × (N / 2)`,
    ],
    paragraphs: [
      'Accommodation uses room logic because hotels charge per room. Food gets a modest sharing discount for groups larger than two. Drinks and activities scale linearly.',
    ],
  },
  {
    title: 'Validation Snapshot',
    summary: 'The formulas were checked against a 20-city calibration set and published traveler-budget sanity checks.',
    bullets: [
      'Food high-end to mid-range ratio: `1.50`, fixed by design',
      'Drinks heavy to light ratio: coefficient of variation `11.5%`',
      'Hostel private to dorm ratio: coefficient of variation `13.7%`',
      'Activities high-end to budget ratio: `6.00`, fixed by design',
      'Food mid-range to street food ratio: `21.3%`, intentionally more variable across regions',
    ],
    paragraphs: [
      'The methodology documentation also benchmarks backpacker, mid-range, and luxury daily budget outcomes against published travel-budget references to make sure city totals stay plausible.',
    ],
  },
  {
    title: 'Known Limitations And New Cities',
    summary: 'The methodology is consistent, but it still has explicit limits and a defined path for filling gaps.',
    bullets: [
      'Seasonality is not captured; shoulder-season assumptions can miss holiday and festival spikes',
      '4-star pricing uses a fixed multiplier and may understate steep luxury gradients in some cities',
      'Remote and very small places often rely on regional-hub adjustments and carry lower confidence',
      'Cocktail and wine estimates are weaker in places with sparse alcohol pricing',
      'USD to AUD conversion in the written methodology uses an approximate reference rate',
    ],
    paragraphs: [
      'New cities should be generated by following the same anchor lookup hierarchy, applying the exact formulas above, converting to AUD, and storing the resulting outputs with confidence metadata and notes.',
      'That is the workflow we are about to wire into the server-side LLM generation flow next.',
    ],
  },
];

const fmtMoney = (value: number | null) => (value == null ? '-' : value.toFixed(2));

function fmtDate(value: string | null) {
  return value ? value.slice(0, 10) : '-';
}

function matchesRow(row: EstimateRow, query: string) {
  const haystack = [
    row.cityName,
    row.countryName,
    row.region,
    row.estimationSource,
    row.currentEstimate?.llmProvider,
    row.currentEstimate?.reasoning,
    row.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export default function EstimatesPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<EstimatesResponse | null>(null);
  const [query, setQuery] = useState('');

  async function load() {
    const response = await fetch('/api/estimates', { cache: 'no-store' });
    const data = await response.json();
    setPayload(data.data || null);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(row: EstimateRow) {
    const confirmed = window.confirm(`Delete ${row.cityName}${row.countryName ? `, ${row.countryName}` : ''}? This will also remove its generation history.`);
    if (!confirmed) return;

    const response = await fetch(`/api/cities/${row.cityId}`, {
      method: 'DELETE',
    });
    const data = await response.json();

    if (!response.ok) {
      window.alert(data.error || 'Failed to delete city.');
      return;
    }

    await load();
  }

  const filteredRows = useMemo(() => {
    const rows = payload?.rows || [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => matchesRow(row, normalized));
  }, [payload, query]);

  const filteredHistory = useMemo(() => {
    const rows = payload?.history || [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      [row.cityName, row.countryName, row.source, row.llmProvider, row.reasoning]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [payload, query]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">City Cost Methodology</h1>
        <p className="text-sm text-muted-foreground">
          Review the current city cost library, the April 2026 base dataset, and any stored generation
          history. All planner-facing values are AUD for two people.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cities</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{payload?.summary.cityCount ?? '-'}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Countries</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{payload?.summary.countryCount ?? '-'}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">History Records</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{payload?.summary.historyCount ?? '-'}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Primary Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {payload?.summary.sourceBreakdown?.[0] ? (
              <>
                <div className="text-base font-semibold">{payload.summary.sourceBreakdown[0].source}</div>
                <div className="text-xs text-muted-foreground">
                  {payload.summary.sourceBreakdown[0].count} cities
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">-</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Methodology Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Version 2.0 of the city cost model covers 121 base cities as of April 2026. All values
            shown in the app are AUD and represent budgets for two people.
          </p>
          <p>
            The workflow is: research anchor prices, derive fixed tiers, convert to AUD, store the
            final two-person outputs, then scale at runtime for different group sizes.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {METHODOLOGY_SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardContent className="p-0">
              <details className="group" open={section.title === 'Anchor Inputs'}>
                <summary className="cursor-pointer list-none px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-base font-semibold text-foreground">{section.title}</div>
                      <p className="text-sm text-muted-foreground">{section.summary}</p>
                    </div>
                    <div className="text-xs text-muted-foreground group-open:hidden">Expand</div>
                    <div className="hidden text-xs text-muted-foreground group-open:block">Collapse</div>
                  </div>
                </summary>
                <div className="border-t px-6 py-4">
                  <div className="space-y-4 text-sm text-muted-foreground">
                    {section.paragraphs?.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                    {section.bullets ? (
                      <ul className="space-y-2">
                        {section.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    ) : null}
                    {section.codeBlocks?.map((codeBlock) => (
                      <pre
                        key={codeBlock}
                        className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs text-foreground"
                      >
                        {codeBlock}
                      </pre>
                    ))}
                  </div>
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Current Dataset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="estimate-query">Search</Label>
            <Input
              id="estimate-query"
              placeholder="Search city, country, region, source, or notes"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(payload?.summary.sourceBreakdown || []).map((entry) => (
              <Badge key={entry.source} variant="outline">
                {entry.source}: {entry.count}
              </Badge>
            ))}
          </div>

          <div className="w-full overflow-x-auto rounded-md border">
            <table className="min-w-[1800px] text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="sticky left-0 z-30 min-w-[180px] bg-muted px-3 py-2 text-left font-medium shadow-[1px_0_0_0_hsl(var(--border))]">City</th>
                  <th className="sticky left-[180px] z-20 min-w-[160px] bg-muted px-3 py-2 text-left font-medium shadow-[1px_0_0_0_hsl(var(--border))]">Country</th>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-left font-medium">Updated</th>
                  <th className="px-3 py-2 text-left font-medium">Hostel</th>
                  <th className="px-3 py-2 text-left font-medium">Private</th>
                  <th className="px-3 py-2 text-left font-medium">1-Star</th>
                  <th className="px-3 py-2 text-left font-medium">2-Star</th>
                  <th className="px-3 py-2 text-left font-medium">3-Star</th>
                  <th className="px-3 py-2 text-left font-medium">4-Star</th>
                  <th className="px-3 py-2 text-left font-medium">Food Street</th>
                  <th className="px-3 py-2 text-left font-medium">Food Budget</th>
                  <th className="px-3 py-2 text-left font-medium">Food Mid</th>
                  <th className="px-3 py-2 text-left font-medium">Food High</th>
                  <th className="px-3 py-2 text-left font-medium">Drinks Light</th>
                  <th className="px-3 py-2 text-left font-medium">Drinks Moderate</th>
                  <th className="px-3 py-2 text-left font-medium">Drinks Heavy</th>
                  <th className="px-3 py-2 text-left font-medium">Activities Free</th>
                  <th className="px-3 py-2 text-left font-medium">Activities Budget</th>
                  <th className="px-3 py-2 text-left font-medium">Activities Mid</th>
                  <th className="px-3 py-2 text-left font-medium">Activities High</th>
                  <th className="px-3 py-2 text-left font-medium">Notes</th>
                  <th className="px-3 py-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.cityId} className="border-b align-top last:border-0">
                    <td className="sticky left-0 z-20 min-w-[180px] bg-background px-3 py-2 font-medium shadow-[1px_0_0_0_hsl(var(--border))]">
                      {row.cityName}
                    </td>
                    <td className="sticky left-[180px] z-10 min-w-[160px] bg-background px-3 py-2 shadow-[1px_0_0_0_hsl(var(--border))]">
                      <div>{row.countryName || '-'}</div>
                      {row.region ? <div className="text-xs text-muted-foreground">{row.region}</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      <div>{row.estimationSource || '-'}</div>
                      {row.currentEstimate?.llmProvider ? (
                        <div className="text-xs text-muted-foreground">{row.currentEstimate.llmProvider}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{fmtDate(row.estimatedAt)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.accomHostel)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.accomPrivateRoom)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.accom1star)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.accom2star)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.accom3star)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.accom4star)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.foodStreet)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.foodBudget)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.foodMid)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.foodHigh)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.drinksLight)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.drinksModerate)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.drinksHeavy)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.activitiesFree)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.activitiesBudget)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.activitiesMid)}</td>
                    <td className="px-3 py-2">{fmtMoney(row.activitiesHigh)}</td>
                    <td className="min-w-[16rem] px-3 py-2 text-xs text-muted-foreground">{row.notes || '-'}</td>
                    <td className="min-w-[10rem] px-3 py-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/settings/cities?cityId=${encodeURIComponent(row.cityId)}`)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(row)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={23} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No city rows match the current search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Generation History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto rounded-md border">
            <table className="min-w-[900px] text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">City</th>
                  <th className="px-3 py-2 text-left font-medium">Country</th>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-left font-medium">Provider</th>
                  <th className="px-3 py-2 text-left font-medium">Confidence</th>
                  <th className="px-3 py-2 text-left font-medium">Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((entry) => (
                  <tr key={entry.id} className="border-b align-top last:border-0">
                    <td className="px-3 py-2">{fmtDate(entry.estimatedAt)}</td>
                    <td className="px-3 py-2 font-medium">
                      {entry.cityName}
                      {entry.isActive ? <div className="text-xs text-muted-foreground">active</div> : null}
                    </td>
                    <td className="px-3 py-2">{entry.countryName}</td>
                    <td className="px-3 py-2">{entry.source || '-'}</td>
                    <td className="px-3 py-2">{entry.llmProvider || '-'}</td>
                    <td className="px-3 py-2">{entry.confidence || '-'}</td>
                    <td className="min-w-[24rem] px-3 py-2 text-xs text-muted-foreground">{entry.reasoning || '-'}</td>
                  </tr>
                ))}
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No generated estimate history is stored yet for the current filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
