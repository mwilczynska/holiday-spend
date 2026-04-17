import { Card, CardContent } from '@/components/ui/card';

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
      '`cocktail`: standard cocktail, or `beer x 2.5` fallback',
      '`wine_glass`: glass of wine, or `beer x 1.5` fallback',
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
      'Cocktail fallback: `beer x 2.5`',
      'Wine fallback: `beer x 1.5`',
      'No hostel scene: `hostel_dorm_1p = hotel_1star_2p / 2` and `hostel_private_2p = hotel_1star_2p`',
    ],
    paragraphs: [
      'If cocktail or wine data is missing, those are estimated from beer using fixed ratios. If a city has no hostel scene, the hostel dorm and private-room anchors fall back from the 1-star hotel price.',
      'For expensive Western cities, "street food" should be interpreted as cheap takeaway, fast food, or budget counter-service rather than literal street stalls.',
    ],
  },
  {
    title: 'Accommodation Formulas',
    summary: 'Accommodation outputs are deterministic transformations of the accommodation anchors.',
    codeBlocks: [
      `accom_shared_hostel_dorm  = hostel_dorm_1p x 2
accom_hostel_private_room = hostel_private_2p
accom_1_star              = hotel_1star_2p
accom_2_star              = (hotel_1star_2p + hotel_3star_2p) / 2
accom_3_star              = hotel_3star_2p
accom_4_star              = hotel_3star_2p x 1.80`,
    ],
    paragraphs: [
      'The 2-star tier is interpolated between 1-star and 3-star. The 4-star tier uses a fixed 1.80x multiplier on 3-star pricing.',
    ],
  },
  {
    title: 'Food Formulas',
    summary: 'Food budgets are derived from inexpensive-meal and mid-range-meal anchors.',
    codeBlocks: [
      `street_food_meal = inexp_meal_1p x 0.60

food_street_food = street_food_meal x 3 meals x 2 people
food_budget      = (street_food_meal x 2 + inexp_meal_1p) x 2 people
food_mid_range   = (street_food_meal + inexp_meal_1p + midrange_meal_2p / 2) x 2 people
food_high_end    = food_mid_range x 1.50`,
    ],
    paragraphs: [
      'Street assumes three very cheap meals. Budget mixes two street-style meals with one inexpensive restaurant meal. Mid-range blends a street meal, a cheap meal, and a proper restaurant meal. High-end is a fixed 1.5x uplift on mid-range.',
    ],
  },
  {
    title: 'Drinks Formulas',
    summary: 'Drink tiers are literal baskets for two people per day.',
    codeBlocks: [
      `drinks_none     = 2 x coffee
drinks_light    = 2 x coffee + 2 x beer
drinks_moderate = 2 x coffee + 4 x beer + 2 x cocktail
drinks_heavy    = 2 x coffee + 6 x beer + 4 x cocktail + 2 x wine_glass`,
    ],
    bullets: [
      'None: 1 coffee each',
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
activities_budget     = blended_factor x 2
activities_mid_range  = blended_factor x 5.5
activities_high_end   = blended_factor x 12`,
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
      `Hostel dorm: scaled = base_2p x (N / 2)

Room-based accommodation: scaled = base_2p x ceil(N / 2)

Food: scaled = base_2p x (N / 2) x (1.0 - 0.05 x max(0, N - 2))

Drinks and activities: scaled = base_2p x (N / 2)`,
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
      'That is the workflow used by the server-side city generation flow today.',
    ],
  },
];

export default function EstimatesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Methodology</h1>
        <p className="text-sm text-muted-foreground">
          Review the current city-cost methodology. The editable planner dataset and its generation
          history now live on the Dataset page.
        </p>
      </div>

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
    </div>
  );
}
