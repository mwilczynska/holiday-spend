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
  Gauge,
  RefreshCw,
  SlidersHorizontal,
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
    note: 'The 4-star multiplier is a fixed assumption applied to every city, so the 3-star correction carries through to 4-star.',
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
  ['3-star', '150 × 0.60 = 90', 'A$129'],
  ['4-star', '90 × 1.8 = 162', 'A$231'],
  ['2-star', '(72 + 90) ÷ 2 = 81', 'A$116'],
  ['Mid-range food', '(9 + 15 + 30) × 2 = 108', 'A$154'],
  ['Light drinks', '4 × 2 + 6 × 2 = 20', 'A$29'],
];

const corrections = [
  ['3-star room', '× 0.62', 'Median 3-star price on Booking.com and Trip.com, taxes included, over six dates across a year'],
  ['1-star room', '× 0.85', 'Cheaper quarter of decently rated hotels and guest houses on Booking.com'],
  ['Meals, beer, coffee', '× 0.96 to 1.01', 'Numbeo city medians'],
  ['Hostel dorm', '× 0.77', 'Cheapest Hostelworld bed, scaled to a year-typical level by the city\'s Booking.com prices'],
  ['Hostel private room', '× 0.70', 'Cheapest Hostelworld private room, scaled the same way'],
  ['Cocktail, wine', 'not corrected', 'No reliable reference for a cocktail or a glass of wine'],
];

const accuracy = [
  ['v1.1, uncorrected', '0.435 (≈54%)', 'not measured'],
  ['v1.2', '0.163 (≈18%)', '0.190 (≈21%)'],
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
  {
    version: 'v1.1',
    when: 'September 2026',
    outcome: 'Replaced by v1.2',
    labels: ['What it did', 'Why it was replaced'],
    tried: 'Kept v1’s ten model prices and formulas, and moved the arithmetic, currency conversion and checks into the app. The model searched only for the exchange rate.',
    why: 'Measured against real prices in 475 cities, its uncorrected prices were about 54% off on a typical item, mostly because model hotel prices sit well above booking-site prices. A research program tested 38 changes and adopted the two that helped.',
  },
];

const keyFacts = [
  { value: '19', label: 'Values per city', subtext: '6 accommodation, 4 food, 4 drinks, 4 activities, plus coffee', icon: <ListOrdered /> },
  { value: '10', label: 'Prices from the model', subtext: 'Everything else is calculated by the app', icon: <Calculator /> },
  { value: '2', label: 'Travellers per base value', subtext: 'The planner scales for groups of 1 to 5', icon: <Users /> },
  { value: '≈18%', label: 'Typical price error', subtext: 'v1.2 on 333 cities; ≈21% on 142 held-out cities', icon: <Gauge /> },
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
        <Tile title="What an estimate is" icon={<BookOpenText />} lead="Base costs for two people">
          <p>
            Accommodation is priced per night. Food, drinks and activities are priced per day. These are planning
            estimates, not quotes or observed prices.
          </p>
          <p>Choose your display currency beside traveller count or in Settings. Totals, charts and editable costs
            convert from the stored AUD amounts at the latest available daily Frankfurter rate. The worked example
            below keeps its stated AUD rate so its arithmetic remains reproducible.</p>
          <p>Transport between cities is not part of a city estimate and is handled separately.</p>
        </Tile>
        <Tile title="Where prices come from" icon={<Database />} className="lg:col-span-2">
          <ul className="space-y-1.5">
            <li><span className="font-semibold text-foreground">Generated cities.</span> Cities generated in the app, or added in batches, use v1.2, described below.</li>
            <li><span className="font-semibold text-foreground">Earlier cities.</span> Cities generated before 18 October 2026 use v1.1, and the 121 reference cities use v1, until the library regeneration reaches them.</li>
            <li><span className="font-semibold text-foreground">Manual edits.</span> Values entered by hand.</li>
          </ul>
          <p>
            The{' '}
            <Link data-analytics="page.dataset" href="/dataset" className="font-semibold text-brand-blue underline-offset-2 hover:underline">Dataset</Link>{' '}
            page shows each city’s source and generation history.
          </p>
        </Tile>
      </div>

      <GroupHeading>How a city is estimated</GroupHeading>
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        <Step number={1} title="The model estimates ten prices in USD">
          <p>
            One request goes to the selected model (GPT-6 Luna by default; OpenAI, Anthropic or Gemini). It may make up
            to five web searches for current restaurant, coffee and drink prices. Accommodation prices are its own
            estimates: it does not search for them.
          </p>
          <p>It also gives a confidence label (high, medium or low) and a short note on how it reached the estimate.</p>
        </Step>
        <Step number={2} title="The model looks up the exchange rate">
          <p>
            One more search finds the latest Reserve Bank of Australia USD/AUD rate, with its date and source page. The
            app inverts the usual USD-per-AUD quote.
          </p>
          <Note>
            Nothing is saved if a price is missing or not positive, the source is not rba.gov.au, the rate is more than
            seven days old, or it is outside 0.1 to 10.
          </Note>
        </Step>
        <Step number={3} title="The app corrects consistent errors">
          <p>
            Models price some items consistently high or low. The app multiplies eight of the ten prices by a fixed factor
            for the city’s country, learnt from real prices in 475 reference cities.
          </p>
          <Note>A country with few reference cities leans on its region’s factor; a country with none uses the region’s.</Note>
        </Step>
        <Step number={4} title="The app calculates the tiers">
          <p>
            The app applies the formulas below to the corrected prices in USD, converts each result to AUD and rounds to
            whole dollars.
          </p>
          <p>
            It saves the model’s prices, the corrected prices, the correction, every tier, the model and settings used,
            the confidence note and the exchange rate with its date and source.
          </p>
        </Step>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Tile title="The correction" icon={<SlidersHorizontal />} lead="Typical factors; each country has its own">
          <Table head={['Price', 'Factor', 'Aligned to']} rows={corrections} mono={[1]} />
          <Note>
            Model 3-star prices sit about 60% above what 3-star rooms cost on booking sites, so the 3-star factor is the
            largest. Food and drink factors are close to 1 because those prices come from current searches.
          </Note>
        </Tile>
        <Tile title="How accurate it is" icon={<Gauge />} lead="Budget-weighted error per city; ≈% is the typical miss">
          <Table head={['Method', '333 development cities', '142 held-out cities']} rows={accuracy} mono={[1, 2]} />
          <p>
            Measured in October 2026 against independently collected prices. The held-out cities were set aside before
            any experiment. Typical errors are 7 to 11% for meals, beer and coffee, about 20% for 3-star rooms, 23 to 25%
            for 1-star rooms and about 26% for hostels.
          </p>
        </Tile>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Tile title="The ten model prices" icon={<ListOrdered />} lead="In USD, before conversion">
          <Table head={['Price', 'Definition']} rows={anchors} />
        </Tile>
        <Tile title="Worked example" icon={<Calculator />} lead="One city in Italy, from model prices to AUD">
          <p>
            The model returns an inexpensive meal of USD 15, a mid-range meal for two of USD 60, beer USD 6, coffee
            USD 4, a 1-star room of USD 90 and a 3-star room of USD 150. Suppose Italy’s factors are 0.60 for 3-star,
            0.80 for 1-star and 1.00 for food and drink. The RBA rate is 0.70 USD per AUD, so 1 USD = 1.4286 AUD. A
            street meal is 15 × 0.6 = USD 9.
          </p>
          <Table head={['Tier', 'USD', 'AUD']} rows={example} mono={[1, 2]} />
        </Tile>
      </div>

      <GroupHeading>Tier formulas · inputs are the ten corrected prices · all tiers for two people</GroupHeading>
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

      <div className="grid gap-3.5">
        <Tile title="Keeping prices current" icon={<RefreshCw />} lead="Exchange rates without a new model call">
          <p>
            Each city stores its USD prices, so its AUD values can be recalculated at a newer exchange rate without
            asking a model again. The refresh uses the European Central Bank’s daily USD/AUD cross rate, keeps the
            previous rate in the city’s history and leaves values edited by hand unchanged. Food and drink prices are
            searched afresh whenever a city is generated; the accommodation correction is refitted against new booking
            prices about once a year.
          </p>
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
            <li>Accommodation is the weakest part: the correction fixes the price level, but the model still does not know which cities are dearer than others.</li>
            <li>Food and drink accuracy is partly the model finding the same crowd-sourced sources the references use, so it overstates accuracy against what travellers pay.</li>
            <li>Cocktail and wine prices are uncorrected model estimates. Hostel references are near-term prices scaled by hotel seasonality.</li>
            <li>Tier multipliers are fixed assumptions, never fitted to data. The 4-star value adds nothing beyond 3-star.</li>
            <li>Activity tiers are not based on activity prices.</li>
            <li>Confidence labels are the model’s own judgement, not a measured error. Transport was checked on three routes only.</li>
          </ul>
        </section>
        <Tile title="Earlier methods" icon={<History />} lead="v1, v1.1 and v1.2 have shipped. The rest were researched and set aside.">
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
                <span className="rounded-md bg-card px-2 py-0.5 text-xs font-extrabold text-brand-teal ring-1 ring-brand-teal/30">v1.2</span>
                <span className="text-xs text-muted-foreground">October 2026</span>
                <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-brand-teal ring-1 ring-brand-teal/30">Current</span>
              </div>
              <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What it does</h3>
              <p className="mt-1">v1.1 plus up to five food and drink searches, and a fixed per-country correction of six prices before the formulas; hostels added on 19 October 2026.</p>
              <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why</h3>
              <p className="mt-1">
                Prompt rewording, model averaging and searching for hotels did not help once consistent bias was removed.
                Correcting that bias and searching for food and drink cut the typical error from about 54% to 18%, and
                the gain held on 142 cities set aside in advance. It still takes one model call per city.
              </p>
            </article>
          </div>
        </Tile>
      </div>
    </div>
  );
}
