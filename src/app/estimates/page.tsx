import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  BedDouble,
  BookOpenText,
  Calculator,
  CloudSun,
  Coffee,
  Database,
  History,
  ListOrdered,
  Plane,
  TriangleAlert,
  Users,
  UtensilsCrossed,
  Ticket,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';

const anchors = [
  ['Beer', 'One domestic draft beer in a restaurant'],
  ['Coffee', 'One regular cappuccino'],
  ['Inexpensive meal', 'One meal at an inexpensive restaurant, one person'],
  ['Mid-range meal', 'Three courses for two at a mid-range restaurant, no drinks'],
  ['Cocktail', 'One standard cocktail'],
  ['Wine', 'One glass at a restaurant'],
  ['Hostel dorm', 'One bed, one night'],
  ['Hostel private room', 'One room for two, one night'],
  ['1-star room', 'A very basic hotel or guesthouse room for two, one night'],
  ['3-star room', 'A registered 3-star hotel room for two, one night'],
];

const tierGroups: { title: string; unit: string; icon: ReactNode; note: string; rows: [string, string][] }[] = [
  {
    title: 'Accommodation',
    unit: 'per night',
    icon: <BedDouble />,
    note: 'The 4-star multiplier is a fixed assumption applied to every city.',
    rows: [
      ['Hostel dorm', 'dorm bed × 2'],
      ['Private room', 'private room'],
      ['1-star', '1-star room'],
      ['2-star', '(1-star + 3-star) ÷ 2'],
      ['3-star', '3-star room'],
      ['4-star', '3-star room × 1.8'],
    ],
  },
  {
    title: 'Food',
    unit: 'per day',
    icon: <UtensilsCrossed />,
    note: 'street meal = inexpensive meal × 0.6',
    rows: [
      ['Street food', 'street meal × 3 × 2'],
      ['Budget', '(street meal × 2 + inexpensive meal) × 2'],
      ['Mid-range', '(street meal + inexpensive meal + mid-range meal ÷ 2) × 2'],
      ['High-end', 'mid-range food × 1.5'],
    ],
  },
  {
    title: 'Drinks',
    unit: 'per day',
    icon: <Coffee />,
    note: 'None means no alcohol. It still includes one coffee each.',
    rows: [
      ['None', 'coffee × 2'],
      ['Light', 'coffee × 2 + beer × 2'],
      ['Moderate', 'coffee × 2 + beer × 4 + cocktail × 2'],
      ['Heavy', 'coffee × 2 + beer × 6 + cocktail × 4 + wine × 2'],
    ],
  },
  {
    title: 'Activities',
    unit: 'per day',
    icon: <Ticket />,
    note: 'unit = (inexpensive meal + USD 10) ÷ 2. A meal-based proxy, not attraction or tour prices.',
    rows: [
      ['Free', '0'],
      ['Budget', 'unit × 2'],
      ['Mid-range', 'unit × 5.5'],
      ['High-end', 'unit × 12'],
    ],
  },
];

const example = [
  ['3-star', '150', 'A$231'],
  ['4-star', '150 × 1.8 = 270', 'A$415'],
  ['Mid-range food', '(9 + 15 + 30) × 2 = 108', 'A$166'],
  ['Light drinks', '4 × 2 + 6 × 2 = 20', 'A$31'],
  ['Budget activities', '(15 + 10) ÷ 2 × 2 = 25', 'A$38'],
];

const scaling = [
  ['Dorm, drinks, activities', 'In proportion to group size', 'One traveller pays half'],
  ['Rooms', 'One room per two travellers, rounded up', 'Three travellers pay for two rooms'],
  ['Food', 'In proportion, less 5% per traveller above two', 'Five travellers pay 2.125×'],
];

const history: {
  version: string;
  when: string;
  outcome: string;
  tried: string;
  why: string;
  labels?: [string, string];
}[] = [
  {
    version: 'v1',
    when: 'April 2026',
    outcome: 'Replaced by v1.1',
    labels: ['What it did', 'Why it was replaced'],
    tried: 'The model estimated the ten prices, applied the formulas and converted to AUD, all in one answer.',
    why: 'Its arithmetic and exchange rate could not be checked, and the rate was not recorded. An early audit reported 17.5% average error, but it covered nine prices in three cities and most of the error came from one city, so it did not show the prices were unusable. v1 still supplies the reference dataset and remains a rollback.',
  },
  {
    version: 'v3',
    when: 'July 2026',
    outcome: 'Abandoned',
    tried: 'Collect every price directly from named sources, such as restaurant menus and hotel sites, for a 36-city pilot.',
    why: 'Each tier needs several prices at once, so one missing price blanks every tier that uses it. Street food alone blocked three food tiers in every pilot city. After weeks of collection it had 23% of the tier values and no complete city. It averaged one usable price per six web searches, and finishing all 121 cities would have taken about 17,300 lookups, repeated at every refresh.',
  },
  {
    version: 'v4',
    when: 'July 2026',
    outcome: 'Never integrated',
    tried: 'Read food and drink prices from a crowd-sourced cost-of-living site and hotel prices from booking-site pages, then derive the remaining prices from ratios fitted across 99 cities.',
    why: 'Food and drink prices were exact when the site lookup worked, but the site blocked requests after about 40 in a row and had no usable page for 55% of low-cost destinations. Hotel prices read from booking pages came out about 50% high against direct quotes, and the reading method was unstable. Activity prices had no relationship to food prices. The fitted ratios still missed by 18 to 22%.',
  },
  {
    version: 'v5',
    when: 'August 2026',
    outcome: 'Rejected',
    tried: 'About 90 prompt experiments, each sending a model to find particular prices from particular sources, including Expedia, Momondo, Expatistan and BudgetYourTrip.',
    why: 'No source covered every price for every city. Many pages did not say whether a room was for one or two people, or which star class it was. A single call asking for every price never returned a complete city.',
  },
  {
    version: 'v6',
    when: 'August 2026',
    outcome: 'Rejected',
    tried: 'Three web-search calls per city to collect source prices, with statistical fallbacks for gaps and graded estimates with ranges, staged as a full replacement of the 121 cities.',
    why: 'Too large and fragile to run or refresh. In the final test, the searches found none of the nine prices in three Japanese cities, so the estimates rested on fallback values anyway while costing several model calls per city.',
  },
];

const keyFacts = [
  { value: '19', label: 'Values per city', subtext: '6 accommodation, 4 food, 4 drinks, 4 activities, plus coffee', icon: <ListOrdered /> },
  { value: '10', label: 'Prices from the model', subtext: 'Everything else is calculated by the app', icon: <Calculator /> },
  { value: '2', label: 'Travellers per base value', subtext: 'The planner scales for groups of 1 to 5', icon: <Users /> },
  { value: '121', label: 'Reference cities', subtext: '58 countries, April 2026 (v1)', icon: <Database /> },
];

/** Bento tile: title row with an icon chip, then content. */
function Tile({
  title,
  icon,
  lead,
  className,
  children,
}: {
  title: string;
  icon: ReactNode;
  lead?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('min-w-0 rounded-2xl border bg-card p-4 sm:px-[18px]', className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          {lead ? <p className="mt-0.5 text-xs text-muted-foreground">{lead}</p> : null}
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-info-soft text-blue-700 [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
      </div>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

function Table({ head, rows, mono }: { head: string[]; rows: ReadonlyArray<ReadonlyArray<string>>; mono?: number[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-secondary text-left text-xs font-semibold text-slate-600">
          <tr>{head.map(cell => <th key={cell} scope="col" className="px-3 py-2">{cell}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.join('|')} className="border-t align-top">
              {row.map((cell, index) => (
                <td
                  key={index}
                  className={cn('px-3 py-2', index === 0 && 'font-medium text-foreground', mono?.includes(index) && 'font-mono text-[12.5px]')}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border bg-card p-4 sm:px-[18px]">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-brand-teal/10 text-sm font-extrabold text-brand-teal">
          {number}
        </span>
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

function GroupHeading({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>;
}

export default function EstimatesPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        icon={BookOpenText}
        title="Methodology"
        description="How the app estimates city costs, transport and weather, and how they become your trip budget."
      />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {keyFacts.map(fact => (
          <section key={fact.label} className="rounded-2xl border bg-card p-4 sm:px-[18px]">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700">{fact.label}</h2>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-info-soft text-blue-700 [&_svg]:h-4 [&_svg]:w-4">
                {fact.icon}
              </span>
            </div>
            <p className="mt-1 text-[28px] font-extrabold tracking-tight">{fact.value}</p>
            <p className="text-xs text-muted-foreground">{fact.subtext}</p>
          </section>
        ))}
      </div>

      <div className="grid gap-3.5 lg:grid-cols-3">
        <Tile title="What an estimate is" icon={<BookOpenText />} lead="AUD, for two people">
          <p>
            Accommodation is priced per night. Food, drinks and activities are priced per day. These are planning
            estimates, not quotes or observed prices.
          </p>
          <p>Transport between cities is not part of a city estimate and is handled separately.</p>
        </Tile>
        <Tile title="Where prices come from" icon={<Database />} className="lg:col-span-2">
          <ul className="space-y-1.5">
            <li><span className="font-semibold text-foreground">Reference dataset.</span> 121 cities produced in April 2026 with the v1 method.</li>
            <li><span className="font-semibold text-foreground">Generated cities.</span> Cities generated in the app, or added in batches, use v1.1, described below.</li>
            <li><span className="font-semibold text-foreground">Manual edits.</span> Values entered by hand.</li>
          </ul>
          <p>
            New and regenerated cities use v1.1. Reference cities stay on v1 until they are regenerated. The{' '}
            <Link href="/dataset" className="font-semibold text-brand-blue underline-offset-2 hover:underline">Dataset</Link>{' '}
            page shows each city’s source and generation history.
          </p>
        </Tile>
      </div>

      <GroupHeading>How a city is estimated</GroupHeading>
      <div className="grid gap-3.5 lg:grid-cols-3">
        <Step number={1} title="The model estimates ten prices in USD">
          <p>
            One request goes to the selected model (OpenAI, Anthropic or Gemini). It estimates the ten prices listed
            below from its general knowledge. It does not search for them and does no arithmetic.
          </p>
          <p>It also gives a confidence label (high, medium or low) and a short note on how it reached the estimate.</p>
        </Step>
        <Step number={2} title="The model looks up the exchange rate">
          <p>
            In the same request it searches the web for one thing: the latest Reserve Bank of Australia USD/AUD rate,
            with its date and source page. The app inverts the usual USD-per-AUD quote.
          </p>
          <Note>
            Nothing is saved if a price is missing or not positive, the source is not rba.gov.au, the rate is more than
            seven days old, or it is outside 0.1 to 10.
          </Note>
        </Step>
        <Step number={3} title="The app calculates the tiers">
          <p>
            The app applies the formulas below in USD, converts each result to AUD and rounds to whole dollars.
          </p>
          <p>
            It saves the ten prices, every tier, the model and settings used, the confidence note and the exchange rate
            with its date and source.
          </p>
        </Step>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Tile title="The ten model prices" icon={<ListOrdered />} lead="In USD, before conversion">
          <Table head={['Price', 'Definition']} rows={anchors} />
        </Tile>
        <Tile title="Worked example" icon={<Calculator />} lead="One city, from model prices to AUD">
          <p>
            The model returns an inexpensive meal of USD 15, a mid-range meal for two of USD 60, beer USD 6, coffee
            USD 4 and a 3-star room of USD 150. The RBA rate is 0.65 USD per AUD, so 1 USD = 1.5385 AUD. A street meal
            is 15 × 0.6 = USD 9.
          </p>
          <Table head={['Tier', 'USD', 'AUD']} rows={example} mono={[1, 2]} />
        </Tile>
      </div>

      <GroupHeading>Tier formulas · inputs are the ten model prices · all tiers for two people</GroupHeading>
      <div className="grid gap-3.5 md:grid-cols-2">
        {tierGroups.map(group => (
          <Tile key={group.title} title={group.title} icon={group.icon} lead={group.unit}>
            <Table head={['Tier', 'Formula']} rows={group.rows} mono={[1]} />
            <Note>{group.note}</Note>
          </Tile>
        ))}
      </div>

      <GroupHeading>Using estimates in your plan</GroupHeading>
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Tile title="From estimates to your budget" icon={<Users />} lead="Group size is set in Settings, from 1 to 5">
          <p>For each leg you choose one tier per category. City values are for two people, so the planner scales them:</p>
          <Table head={['Category', 'Scaling', 'Example']} rows={scaling} />
          <div className="rounded-xl bg-secondary px-3 py-2 font-mono text-[12.5px] leading-6">
            <div>leg total = daily cost × nights + intercity transport + miscellaneous</div>
            <div>daily cost = accommodation + food + drinks + activities + transport per day</div>
          </div>
        </Tile>
        <Tile title="Overrides and edge cases" icon={<ListOrdered />}>
          <ul className="space-y-2">
            <li><span className="font-semibold text-foreground">Overrides</span> replace a category for the whole group and are not scaled again. Use one when you know a real price, such as a booked hotel.</li>
            <li><span className="font-semibold text-foreground">Transport per day</span> is a manual daily amount, zero unless entered.</li>
            <li><span className="font-semibold text-foreground">Intercity transport</span> and <span className="font-semibold text-foreground">miscellaneous expenses</span> are added once per leg, not per night.</li>
            <li><span className="font-semibold text-foreground">Missing values.</span> A missing private-room value uses the average of dorm and 1-star. Any other missing value counts as zero.</li>
            <li><span className="font-semibold text-foreground">Saved plans</span> store tier choices, not prices, so later city changes flow through.</li>
          </ul>
        </Tile>
      </div>

      <GroupHeading>Other estimates</GroupHeading>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Tile title="Intercity transport" icon={<Plane />} lead="One-way, whole AUD, added once to the destination leg">
          <p>
            Entered by hand or estimated by a language model for your group at standard adult fares. The model is asked
            for the typical fare a traveller would book: not the cheapest, and not premium or flexible. Flights are
            economy with carry-on only; driving covers fuel and tolls.
          </p>
          <p>
            It may search the web and returns up to four options, each with a confidence label, price basis and
            sources. Nothing is saved until you apply one. If search fails, the model is asked again without it and the
            result is marked as not web-grounded.
          </p>
        </Tile>
        <Tile title="Trip climate" icon={<CloudSun />} lead="Monthly averages for 2021 to 2025, not a forecast">
          <p>
            From the Open-Meteo historical archive (ECMWF ERA5 and ERA5-Land). Each month averages the daily mean, high
            and low temperatures over five years, and the five monthly precipitation totals, including snow as water.
          </p>
          <p>
            These are grid estimates of about 11 to 25 km, not station readings, and five years is a short sample.
            Salento, Colombia uses ECMWF IFS, because ERA5 rainfall there disagrees badly with station records.
          </p>
        </Tile>
      </div>

      <div className="grid gap-3.5">
        <section className="min-w-0 rounded-2xl border border-[#F6D9AE] bg-[#FFF5E6] p-4 sm:px-[18px]">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">Limitations</h2>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#FCE7C8] text-[#9A4B00] [&_svg]:h-4 [&_svg]:w-4">
              <TriangleAlert />
            </span>
          </div>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 lg:columns-2 lg:gap-10 [&>li]:break-inside-avoid">
            <li>City prices come from model knowledge, not current listings, and ignore season, neighbourhood and events.</li>
            <li>Tier multipliers are fixed assumptions, never fitted to data. The 4-star value adds nothing beyond 3-star.</li>
            <li>Activity tiers are not based on activity prices.</li>
            <li>Confidence labels are the model’s own judgement, not a measured error.</li>
            <li>No accuracy figure is claimed for city costs; transport was checked on three routes. Both are accepted as reasonable for budgeting.</li>
          </ul>
        </section>
        <Tile title="Earlier methods" icon={<History />} lead="Only v1 and v1.1 have shipped. The rest were researched and set aside.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {history.map(method => (
              <article key={method.version} className="rounded-xl border bg-secondary/40 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-card px-2 py-0.5 text-xs font-extrabold text-foreground ring-1 ring-border">{method.version}</span>
                  <span className="text-xs text-muted-foreground">{method.when}</span>
                  <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-border">{method.outcome}</span>
                </div>
                <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{method.labels?.[0] ?? 'What it tried'}</h3>
                <p className="mt-1">{method.tried}</p>
                <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{method.labels?.[1] ?? 'Why it was not used'}</h3>
                <p className="mt-1">{method.why}</p>
              </article>
            ))}
            <article className="rounded-xl border border-brand-teal/30 bg-brand-teal/5 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-card px-2 py-0.5 text-xs font-extrabold text-brand-teal ring-1 ring-brand-teal/30">v1.1</span>
                <span className="text-xs text-muted-foreground">August 2026</span>
                <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-brand-teal ring-1 ring-brand-teal/30">Current</span>
              </div>
              <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What it does</h3>
              <p className="mt-1">Keeps v1’s ten model prices and formulas, and moves the arithmetic, currency conversion and checks into the app.</p>
              <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why</h3>
              <p className="mt-1">
                The research showed that public prices exist for large cities but often not for small destinations, and
                collecting enough of them to fill every tier cost far more than the accuracy it added. v1.1 takes one
                model call per city and records everything it used.
              </p>
            </article>
          </div>
        </Tile>
      </div>
    </div>
  );
}
