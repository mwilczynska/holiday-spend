import Link from 'next/link';
import { BookOpenText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageTitle } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

type Section = {
  title: string;
  summary: string;
  paragraphs: string[];
  bullets?: string[];
  formulas?: string[];
};

const sections: Section[] = [
  {
    title: 'What a city estimate is',
    summary: 'Nineteen values per city, in AUD, for two people.',
    paragraphs: [
      'Each city has six accommodation tiers (hostel dorm, hostel private room, 1-star to 4-star) priced per night, and four food, four drinks and four activity tiers priced per day. All values are in AUD for two travellers. The planner adjusts them for your group size.',
      'These are planning estimates, not quotes or observed prices. Transport is not part of a city estimate; it is entered separately.',
    ],
  },
  {
    title: 'Where city prices come from',
    summary: 'The reference dataset, cities generated in the app, or manual edits.',
    paragraphs: [
      'The reference dataset has 121 cities in 58 countries, produced in April 2026 with the v1 method. Cities generated in the app, or added with the batch script, use v1.1. Cities edited by hand on the Dataset page are labelled manual. The Dataset page shows each city’s source and generation history.',
      'New and regenerated cities use v1.1. Reference cities stay on v1 until someone regenerates them.',
    ],
  },
  {
    title: 'Step 1: ten prices in USD',
    summary: 'A language model estimates ten prices from its general knowledge.',
    paragraphs: [
      'The app sends one request to the selected model (OpenAI, Anthropic or Gemini). The model returns these ten prices in USD. It does not search the web for them, and it does no arithmetic. It also returns a confidence label (high, medium or low) and a short note on how it reached the estimate.',
    ],
    bullets: [
      'Beer: one domestic draft beer in a restaurant.',
      'Coffee: one regular cappuccino.',
      'Inexpensive meal: one meal at an inexpensive restaurant, one person.',
      'Mid-range meal: three courses for two at a mid-range restaurant, no drinks.',
      'Cocktail: one standard cocktail.',
      'Wine: one glass at a restaurant.',
      'Hostel dorm: one bed, one night.',
      'Hostel private room: one room for two, one night.',
      '1-star: one very basic hotel or guesthouse room for two, one night.',
      '3-star: one registered 3-star hotel room for two, one night.',
    ],
  },
  {
    title: 'Step 2: the exchange rate',
    summary: 'The latest Reserve Bank of Australia rate, checked before anything is saved.',
    paragraphs: [
      'In the same request, the model uses web search for one thing: the latest published RBA USD/AUD rate, with its date and the rba.gov.au page it came from.',
      'Nothing is saved if any price is missing or not a positive number, if the source is not rba.gov.au, if the rate is more than seven days old, or if the rate is outside 0.1 to 10. The RBA usually quotes US dollars per Australian dollar, so the app inverts the rate to get AUD per USD.',
    ],
  },
  {
    title: 'Step 3: accommodation and food tiers',
    summary: 'The server calculates every tier, then converts to AUD.',
    paragraphs: [
      'Tiers are calculated in USD from the ten prices, converted to AUD and rounded to whole dollars. The 4-star and high-end food multipliers are fixed assumptions applied to every city.',
    ],
    formulas: [
      'hostel dorm = dorm bed × 2',
      'private room = hostel private room',
      '1-star = 1-star room;  3-star = 3-star room',
      '2-star = (1-star room + 3-star room) ÷ 2',
      '4-star = 3-star room × 1.8',
      'street meal = inexpensive meal × 0.6',
      'street food = street meal × 3 meals × 2 people',
      'budget food = (street meal × 2 + inexpensive meal) × 2',
      'mid-range food = (street meal + inexpensive meal + mid-range meal for two ÷ 2) × 2',
      'high-end food = mid-range food × 1.5',
    ],
  },
  {
    title: 'Step 3: drinks and activity tiers',
    summary: 'No alcohol still includes coffee; activities are a meal-based proxy.',
    paragraphs: [
      'The None drinks tier means no alcohol and includes one coffee each. The activity tiers are calculated from the inexpensive-meal price plus a fixed USD 10. They are not based on attraction or tour prices.',
    ],
    formulas: [
      'drinks none = coffee × 2',
      'drinks light = coffee × 2 + beer × 2',
      'drinks moderate = coffee × 2 + beer × 4 + cocktail × 2',
      'drinks heavy = coffee × 2 + beer × 6 + cocktail × 4 + wine × 2',
      'activity unit = (inexpensive meal + USD 10) ÷ 2',
      'activities free = 0;  budget = unit × 2;  mid-range = unit × 5.5;  high-end = unit × 12',
    ],
  },
  {
    title: 'Example',
    summary: 'One city, from model prices to AUD tiers.',
    paragraphs: [
      'Suppose the model returns an inexpensive meal of USD 15, a mid-range meal for two of USD 60, beer USD 6, coffee USD 4 and a 3-star room of USD 150, with an RBA rate of 0.65 USD per AUD. The app uses 1 ÷ 0.65 = 1.5385 AUD per USD.',
    ],
    formulas: [
      '3-star = 150 USD → A$231',
      '4-star = 150 × 1.8 = 270 USD → A$415',
      'mid-range food = (9 + 15 + 30) × 2 = 108 USD → A$166',
      'light drinks = 4 × 2 + 6 × 2 = 20 USD → A$31',
      'budget activities = (15 + 10) ÷ 2 × 2 = 25 USD → A$38',
    ],
  },
  {
    title: 'From city estimates to your budget',
    summary: 'Tiers, group size, nights, overrides and extras.',
    paragraphs: [
      'For each leg you choose one tier per category. Settings sets the group size, from one to five travellers. City values are for two people, so the planner scales them as follows.',
    ],
    bullets: [
      'Hostel dorm, drinks and activities: in proportion to group size. One traveller pays half.',
      'Rooms: one room for every two travellers, rounded up. One traveller pays for a full room; three pay for two rooms.',
      'Food: in proportion to group size, less 5% for each traveller above two. Five travellers pay 2.5 × 0.85 times the two-person value.',
      'Overrides replace a category for the whole group (accommodation per night, others per day) and are not scaled again.',
      'Leg total = daily cost × nights + intercity transport + miscellaneous expenses. Daily cost includes any transport per day you enter.',
      'If a city has no private-room value, the average of its dorm and 1-star values is used. Any other missing value counts as zero.',
      'Saved plans store your tier choices, not prices, so later changes to a city change saved plans too.',
    ],
  },
  {
    title: 'Intercity transport',
    summary: 'A separate model estimate, added once per leg.',
    paragraphs: [
      'Transport between cities can be entered by hand or estimated by a language model. An estimate is a one-way cost for your group at standard adult fares, in whole AUD, added once to the destination leg. The model is asked for the typical fare a traveller would book: not the cheapest fare and not a premium ticket. Flights are economy with carry-on only; driving covers fuel and tolls.',
      'The model may use web search. It returns up to four options with a confidence label, the basis for the price and its sources. Nothing is saved until you apply an option. If the search request fails, the model is asked again without search, and the result is marked as not web-grounded.',
    ],
  },
  {
    title: 'Trip climate',
    summary: 'Monthly averages for 2021 to 2025, not a forecast.',
    paragraphs: [
      'Temperatures and precipitation come from the Open-Meteo historical archive (ECMWF ERA5 and ERA5-Land reanalysis). For each month, the app averages the daily mean, high and low temperatures over 2021 to 2025, and averages the five monthly precipitation totals. Precipitation includes snow as water equivalent.',
      'These are grid estimates, not weather-station readings, and five years is a short sample. Salento, Colombia uses the ECMWF IFS model instead, because ERA5 rainfall there disagrees badly with local station records.',
    ],
  },
  {
    title: 'Limitations',
    summary: 'Useful for comparing cities and planning, not a precise forecast of spending.',
    paragraphs: [
      'City prices come from model knowledge, not current listings, and do not reflect season, neighbourhood or events. The tier multipliers are fixed assumptions that were never fitted to data; the 4-star value adds nothing beyond the 3-star price. Activity tiers are not based on activity prices. Confidence labels are the model’s own judgement, not a measured error.',
      'No accuracy figure is claimed for city costs. Transport estimates were checked on three routes only. Both are accepted as reasonable for budgeting, and further calibration is deliberately out of scope. When you know a real price, such as a booked hotel, use an override.',
    ],
  },
  {
    title: 'Earlier methods',
    summary: 'What was tried before v1.1.',
    paragraphs: [
      'v1 used the same ten prices and formulas, but the model also did the arithmetic and currency conversion, and the exchange rate was not recorded. It produced the reference dataset and remains available as a rollback.',
      'Between July and August 2026, several replacements were researched: collecting every price directly from named sources (v3), collecting a few prices and deriving the rest with fitted ratios (v4), prompt experiments (v5), and multi-call source collection (v6). None shipped. Each cost too much to run or refresh for the accuracy gained. v1.1 keeps v1’s formulas and moves the arithmetic, conversion and checks into the app.',
    ],
  },
];

export default function EstimatesPage() {
  return <div className="space-y-6">
    <div className="space-y-2">
      <PageTitle icon={BookOpenText}>Methodology</PageTitle>
      <p className="text-sm text-muted-foreground">How city-cost estimates become your travel budget.</p>
      <p className="text-xs text-muted-foreground">New cities: v1.1 · Reference dataset: April 2026 · Base values: 2 travellers · Currency: AUD</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" asChild><Link href="/dataset">View Dataset</Link></Button>
        <Button variant="outline" asChild><Link href="/plan">Open Planner</Link></Button>
      </div>
    </div>
    <div className="grid gap-4">
      {sections.map((section, index) => <Card key={section.title}>
        <CardContent className="p-0">
          <details className="group" open={index === 0}>
            <summary className="cursor-pointer list-none rounded-2xl px-5 py-4 hover:bg-secondary/60 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-base font-bold">{section.title}</h2>
                  <p className="text-sm text-muted-foreground">{section.summary}</p>
                </div>
                <span className="sr-only group-open:hidden">Expand</span>
                <span className="sr-only hidden group-open:inline">Collapse</span>
                <ChevronDown className="h-5 w-5 shrink-0 text-slate-600 transition-transform group-open:rotate-180" aria-hidden="true" />
              </div>
            </summary>
            <div className="space-y-4 border-t px-5 py-4 text-sm text-muted-foreground">
              {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets && <ul className="list-disc space-y-2 pl-5">{section.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</ul>}
              {section.formulas && <ul className="space-y-2">{section.formulas.map(formula => <li className="break-words font-mono text-xs" key={formula}>{formula}</li>)}</ul>}
            </div>
          </details>
        </CardContent>
      </Card>)}
    </div>
  </div>;
}
