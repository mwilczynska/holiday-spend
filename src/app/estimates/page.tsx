import Link from 'next/link';
import { BookOpenText } from 'lucide-react';
import { PageTitle } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

const sections = [
  {
    title: 'Current city-cost method',
    summary: 'v1.1 estimates new cities; existing library prices keep their recorded version.',
    paragraphs: [
      'City costs are planning estimates in AUD for two people. Accommodation is per night; food, drinks and activities are daily baskets. The April 2026 reference dataset contains 121 cities in 58 countries and remains on v1. Generating a new city uses v1.1 by default; it does not rewrite the reference dataset or migrate existing cities.',
      'One model call estimates ten USD anchor prices from general knowledge and city context. Web search obtains the latest published Reserve Bank of Australia exchange-rate observation. The server validates the response, calculates the tiers and converts them to AUD.',
      'City-price anchors are holistic model estimates. They are not observed prices from live hotel, restaurant or attraction listings. Transport and fixed costs are separate from city-cost generation.',
    ],
  },
  {
    title: 'Ten anchor prices',
    summary: 'Each anchor has a defined serving, person or room unit.',
    paragraphs: ['The model returns positive USD estimates for these inputs. Uncertainty and any comparable-city basis are recorded with the estimate.'],
    bullets: [
      'Domestic draft beer: one standard restaurant serving.',
      'Coffee: one regular cappuccino.',
      'Inexpensive meal: one person at an inexpensive restaurant.',
      'Mid-range meal: a three-course restaurant meal for two, without drinks.',
      'Cocktail: one standard bar or restaurant cocktail.',
      'Wine: one restaurant glass.',
      'Hostel dorm: one bed for one person per night.',
      'Hostel private room: one room for two per night.',
      'One-star accommodation: one basic hotel or guesthouse room for two per night.',
      'Three-star accommodation: one registered three-star hotel room for two per night.',
    ],
  },
  {
    title: 'Currency conversion and provenance',
    summary: 'A dated RBA observation is validated before any new estimate is saved.',
    paragraphs: [
      'The model returns the published rate, quote direction, observation date and official RBA source URL. The server checks that the observation is recent and valid. A USD-per-AUD quote is inverted before converting USD anchors and tiers to AUD. Invalid or stale FX prevents the estimate from being saved.',
      'Daily tiers and accommodation are rounded to whole AUD. Unit anchor prices, including coffee, retain cents. Generation history records anchors, provider, model, reasoning effort, prompt and formula versions, confidence notes and FX provenance. Confidence labels are qualitative; they are not calibrated probabilities, grades or statistical intervals.',
    ],
  },
  {
    title: 'Accommodation and food baskets',
    summary: 'v1.1 preserves the v1 tier formulas for two travellers.',
    paragraphs: [
      'A dorm night uses two beds. Private, one-star and three-star rooms use their room anchors. Two-star accommodation is the average of the one-star and three-star anchors. Four-star accommodation is 1.80 times the three-star anchor. That multiplier is a modelling assumption with known limitations.',
      'A street-food meal is 60% of the inexpensive-meal anchor. Each food tier combines meals for two people using the formulas below. These are representative baskets, not itemised restaurant quotes.',
    ],
    formulas: [
      'street meal = inexpensive meal × 0.60',
      'street food = street meal × 3 × 2',
      'budget food = (street meal × 2 + inexpensive meal) × 2',
      'mid-range food = (street meal + inexpensive meal + mid-range meal for two ÷ 2) × 2',
      'high-end food = mid-range food × 1.50',
    ],
  },
  {
    title: 'Drinks and activity baskets',
    summary: 'No alcohol still includes coffee; activities use a meal-based proxy.',
    paragraphs: [
      'The None drinks tier means no alcohol and includes one coffee per person. Activity tiers use a blended proxy based on the inexpensive-meal price and a fixed USD 10 input. They do not represent observed attraction or tour prices.',
    ],
    formulas: [
      'drinks none = coffee × 2',
      'drinks light = coffee × 2 + beer × 2',
      'drinks moderate = coffee × 2 + beer × 4 + cocktail × 2',
      'drinks heavy = coffee × 2 + beer × 6 + cocktail × 4 + wine glass × 2',
      'activity proxy = (inexpensive meal + USD 10) ÷ 2',
      'activities free = 0; budget = proxy × 2; mid-range = proxy × 5.5; high-end = proxy × 12',
    ],
  },
  {
    title: 'Using estimates in your plan',
    summary: 'Traveller count, selected tiers, nights and overrides determine your budget.',
    paragraphs: [
      'Settings supports one to five travellers. Dorm beds, drinks and activities scale with traveller count. Rooms use one room per pair, rounded up. Food scales per person with a 5% sharing discount for each traveller above two. A manual override is the total for your group and replaces the scaled category value.',
      'The planner multiplies the daily basket by nights and adds manual transport separately. Saved plans retain tier choices rather than freezing city prices, so later library edits can change a saved plan’s budget. Expenses and fixed costs are tracked separately from these city estimates.',
      'Use the Dataset page to inspect prices and generation history, and adjust your itinerary when a known booking or personal spending preference differs from the model.',
    ],
  },
  {
    title: 'Limitations and historical methods',
    summary: 'Useful planning estimates do not establish a precise spend for every traveller.',
    paragraphs: [
      'Season, neighbourhood, room availability, events, exchange rates and personal choices can change actual spending. Qualitative confidence does not establish an error tolerance. City-cost and transport accuracy are accepted as reasonably useful; no broad calibration or holdout study is claimed.',
      'The former v2/v3 and later source-heavy research methods are archived. They are not the active generation workflow. The v1 method remains available as a rollback, while v1.1 keeps its tier formulas and moves validation, conversion and calculation to the server.',
    ],
  },
];

export default function EstimatesPage() {
  return <div className="space-y-6">
    <div className="space-y-2">
      <PageTitle icon={BookOpenText}>Methodology</PageTitle>
      <p className="text-sm text-muted-foreground">How city-cost estimates become your travel budget.</p>
      <p className="text-xs text-muted-foreground">New cities: v1.1 · Reference dataset: April 2026 · Base values: 2 travellers · Currency: AUD</p>
      <div className="flex gap-4 text-sm">
        <Link className="underline" href="/dataset">View Dataset</Link>
        <Link className="underline" href="/plan">Open Planner</Link>
      </div>
    </div>
    <div className="grid gap-4">
      {sections.map((section, index) => <Card key={section.title}>
        <CardContent className="p-0">
          <details className="group" open={index === 0}>
            <summary className="cursor-pointer list-none px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-base font-semibold">{section.title}</h2>
                  <p className="text-sm text-muted-foreground">{section.summary}</p>
                </div>
                <span className="text-xs text-muted-foreground group-open:hidden">Expand</span>
                <span className="hidden text-xs text-muted-foreground group-open:block">Collapse</span>
              </div>
            </summary>
            <div className="space-y-4 border-t px-6 py-4 text-sm text-muted-foreground">
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
