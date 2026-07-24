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
    title: 'Methodology Purpose And Scope',
    summary: 'A transparent planning model with explicit estimands, transformations, and uncertainty.',
    paragraphs: [
      'This page specifies how city-level travel budgets are constructed. It is intended to be reproducible: a reviewer should be able to start with the named anchor inputs, apply the documented formulas, and recover the stored value within rounding tolerance.',
      'The model optimises for comparability across cities rather than false precision for any individual hotel, restaurant, or activity. A budget is therefore an estimate of a representative daily basket, not a quote, forecast, or statistical confidence interval.',
    ],
    bullets: [
      'Unit of analysis: a city-level daily or nightly cost basket',
      'Base population: two travellers; group-size scaling is applied at runtime',
      'Currency: source anchors are researched in USD and app-facing city values are stored in AUD',
      'Included categories: accommodation, food, drinks, and activities',
      'Excluded from this city model: local transport estimates, intercity transport, and user-specific fixed costs',
      'Current dataset: 121 cities across 58 countries, with the active city row used as the planner source',
    ],
  },
  {
    title: 'Data Lineage And Calculation Flow',
    summary: 'Each planner number passes through an identifiable research, transformation, and application layer.',
    codeBlocks: [
      [
        'researched source prices (USD)',
        '        -> named anchors + source/date/confidence notes',
        '        -> deterministic tier formulas for two travellers',
        '        -> AUD conversion and monetary rounding',
        '        -> stored base-2 city row',
        '        -> runtime group-size scaling',
        '        -> itinerary allocation by city, date, and tier',
      ].join('\n'),
    ],
    paragraphs: [
      'The separation between observed inputs and derived outputs is deliberate. A source price is an input; a tier such as mid-range food is a model output. The model does not imply that every derived tier was directly observed in a source.',
      'The canonical CSV is the versioned app-facing output, but it does not retain complete observation-level lineage and cannot reproduce every reference row by itself. Generated estimates retain provider, model, prompt version, confidence notes, anchors, and related metadata where available; the version 3 observation store is designed to close the remaining provenance gap.',
    ],
  },
  {
    title: 'What The Current Accuracy Evidence Shows',
    summary: 'The first external audit finds material downward bias, but its sample is too small for a population-wide accuracy claim.',
    paragraphs: [
      'Internal consistency and external accuracy answer different questions. Stable tier ratios show that a transformation behaves consistently; they cannot show that the source prices are correct. The supplied external audit therefore compares stored anchors with independently retrieved July 2026 reference prices.',
      'Eight of nine stored values are below their reference. The mean signed error is -16.30%, almost as large as the median absolute error, which is evidence of one-directional under-estimation rather than symmetric noise. Error also varies sharply by city: Lisbon has 29.50% MAPE, compared with 6.56% in Prague and 9.77% in Hanoi. A single global uplift would not solve that heterogeneity.',
      'This is a baseline spot check, not a validated study. It covers only three cities and four food/drink anchor types. Accommodation, activities, seasonality, group scaling, and final itinerary totals remain untested, while the reference sources carry measurement error of their own.',
    ],
    bullets: [
      'Sample: 9 comparisons across 3 of 121 cities',
      'MAPE: 17.47%; median APE: 14.29%',
      'Mean signed percentage error: -16.30%',
      'Weighted absolute percentage error: 21.00%',
      'Root mean squared percentage error: 22.96%',
      'Within 10% / 15% / 25%: 3/9, 5/9, and 7/9',
    ],
  },
  {
    title: 'Version 3 Observed-First Redesign',
    summary: 'Direct dated observations become the default; statistical estimation is reserved for genuinely missing cells.',
    codeBlocks: [
      [
        'dated source observations',
        '        -> definition and unit validation',
        '        -> local-currency normalization',
        '        -> robust city/category aggregation',
        '        -> deterministic basket construction',
        '        -> validated imputation only for missing values',
        '        -> prediction intervals + evidence quality',
        '        -> frozen holdout validation',
        '        -> versioned AUD publication snapshot',
      ].join('\n'),
    ],
    paragraphs: [
      'The LLM changes role under the redesigned methodology. It may locate, extract, classify, and explain evidence, but it is not allowed to invent an uncited price, calculate the published tiers, or judge the accuracy of its own output. Deterministic server code performs normalization, currency conversion, aggregation, basket construction, invariant checks, and uncertainty calculations.',
      'Each observation will retain its original currency, unit, source URL, retrieval date, price-valid window, direct/derived/imputed status, sample size or listing count, reported range, tax treatment, and extraction version. The wide city CSV becomes a materialized output of a versioned observation table rather than the only retained evidence.',
      'Implementation has started. The first validated checkpoint contains 15 direct observations across Lisbon, Prague, and Hanoi: 12 standardized Numbeo food/drink prices and three official paid-attraction prices. They remain in EUR, CZK, and VND with source URLs, page dates, ranges, attribution/access basis, and extraction metadata. This is collection progress, not a new accuracy result.',
    ],
    bullets: [
      'Collection cost: paid data APIs are excluded; free web-enabled LLM calls have no project-imposed daily cap and continue until a provider enforces its actual free-tier limit',
      'Accommodation: standardized dates, 90-day lead time, seven-night stay, two adults, city radius, review threshold, mandatory charges, and seasonal sampling',
      'Food and drinks: explicit item definitions, fresh city medians, source counts/ranges, and independent menu checks in the validation sample',
      'Activities: observed attraction and tour prices using a fixed product taxonomy instead of an inexpensive-meal proxy',
      'Missing values: validated log-price model with whole-city cross-validation, not an arbitrary nearest-city discount',
    ],
  },
  {
    title: 'Accuracy Measures And Experimental Design',
    summary: 'Bias, typical error, tail error, ranking quality, and uncertainty calibration are measured separately.',
    codeBlocks: ['signed_log_error = ln(estimate / independent_benchmark)'],
    paragraphs: [
      'Log error is zero when an estimate is correct, positive when it is high, negative when it is low, and symmetric for reciprocal proportional misses. MAPE remains useful for continuity, but no single percentage average is allowed to stand in for the complete error distribution.',
      'The validation set will contain at least 30 whole cities stratified by region, cost quartile, city size, tourism intensity, and data density. Whole-city holdout prevents observations from the same local price system leaking into both fitting and evaluation. Benchmark collection is independent, and uncertainty intervals resample cities as clusters because prices within a city are correlated.',
      'All results will state city count, observation count, reference window, and dataset version, and will be reported by category, region, cost quartile, season, and direct-versus-imputed provenance. This prevents a good global average from hiding a failing subgroup.',
    ],
    bullets: [
      'Bias: median signed log error and mean signed percentage error',
      'Typical error: median absolute percentage error',
      'Budget impact: weighted absolute percentage error',
      'Variance and tail penalty: root mean squared log error plus 80th and 90th error percentiles',
      'Comparative usefulness: Spearman rank correlation between city affordability rankings',
      'Uncertainty quality: empirical prediction-interval coverage and interval width',
      'Product relevance: itinerary-weighted error after trip length and category mix are applied',
    ],
  },
  {
    title: 'Version 3 Acceptance Criteria',
    summary: 'The targets are gates for unseen holdout cities, not accuracy claims about the current dataset.',
    bullets: [
      'Food and drink anchors: median APE <= 10% and absolute bias <= 5%',
      'Accommodation and activities: median APE <= 15% and absolute bias <= 7.5%',
      'Two-person city basket: median APE <= 12% and 90th-percentile APE <= 25%',
      'Cross-city affordability ordering: Spearman rho >= 0.95',
      'Nominal 80% prediction intervals: empirical coverage between 75% and 85%',
      'Direct observations: at least 90% of spend-weighted inputs and 80% of all required inputs',
    ],
    paragraphs: [
      'A target is not evidence. These thresholds will only move into the results section after the collection pipeline is frozen and the untouched holdout evaluation has been run. Failed subgroup gates must be disclosed and remediated without repeatedly tuning on the holdout set.',
    ],
  },
  {
    title: 'Anchor Inputs',
    summary: 'Each city is represented by 10 named USD anchor slots, sourced directly where coverage exists and explicitly approximated when it does not.',
    paragraphs: [
      'The anchor set is intentionally small and operationally defined. This makes the model easier to audit and keeps the same observable concepts across countries with very different food, accommodation, and nightlife markets.',
      'Anchors are researched first, then transformed into app-facing AUD budget tiers for two people. A missing or approximated anchor is not hidden inside a final total; it is recorded as part of the confidence explanation.',
      'The definitions are proxies for comparable consumption baskets, not claims that every traveller will buy the exact named item. For example, an inexpensive restaurant meal is a repeatable local-price indicator, while the activity tiers are deliberately broader modelled baskets.',
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
    title: 'Research Procedure And Evidence',
    summary: 'The source hierarchy describes how evidence is collected and how a representative value is chosen.',
    paragraphs: [
      'For each anchor, the research record should identify the city, source, reference date or pricing window, currency, unit, occupancy, and whether the value is direct or inferred. These fields matter because a number without its unit or observation context is not reproducible.',
      'Source priority is a consistency rule, not a claim that one website is universally authoritative. Numbeo provides standardised city-level food and drink labels; Hostelworld and Booking.com provide accommodation observations; secondary travel-budget sources are used as external plausibility checks rather than silently mixed into the calculation.',
    ],
    bullets: [
      'Prefer city-level observations over country averages and preserve the original source unit before conversion.',
      'Use a representative accommodation price or median where possible; do not select an unusually cheap minimum and present it as a typical night.',
      'Use the most recent comparable observation available, while treating seasonal and event-driven prices as a limitation rather than smoothing them away without a note.',
      'When direct coverage is missing, scale from a nearby city with a documented cost relationship instead of inventing an unsupported city-specific number.',
      'For remote or very small destinations, use a regional hub and apply a stated 10% to 30% adjustment based on local price level and remoteness.',
      'Record the fallback and the reason for it in confidence notes so a later reviewer can replace the approximation without reverse-engineering the final tier.',
    ],
  },
  {
    title: 'Approximation And Confidence',
    summary: 'Uncertainty is attached to the evidence and assumptions, not disguised as extra decimal places.',
    paragraphs: [
      'The model has deterministic arithmetic after the inputs are selected, but the inputs are not equally certain. Confidence therefore describes the quality and proximity of the evidence behind a city row; it is not a calibrated probability that the estimate will be correct.',
      'The confidence label should be read alongside the written confidence notes. A high-confidence row can still miss a seasonal spike, while a low-confidence row may be directionally useful if its fallback assumptions are reasonable and explicit.',
    ],
    bullets: [
      'High: direct city-level observations are available for most material anchors, with accommodation and consumption categories supported by the preferred source types.',
      'Medium: one or more material anchors use a nearby city or a clearly comparable market with a documented scaling assumption.',
      'Low: the destination relies substantially on a regional hub, sparse alcohol data, or multiple formula fallbacks.',
      'Formula fallback: cocktail, wine, and hostel values can be derived from named anchors when direct observations are unavailable; the formula is transparent but the result is still an approximation.',
      'Generated estimates retain confidence notes plus provider, model, prompt version, anchor, source, input-snapshot, and fallback metadata where the generation flow supplies it.',
      'The current system does not publish formal prediction intervals. That is an explicit limitation, not an invitation to interpret a qualitative label as statistical uncertainty.',
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
      'The interpolation avoids inventing a separate 2-star source observation when the input set only contains the lower and upper reference categories. The 4-star multiplier was selected from the 20-city calibration set; its fixed nature is useful for comparability but cannot capture cities where luxury accommodation has a much steeper price gradient.',
      'The dorm calculation converts a per-bed observation into a two-bed base tier. Every other accommodation tier is room-based, so its value represents one room for two people before runtime group-size scaling is applied.',
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
      'The 0.60 factor is a stated modelling assumption: it treats takeaway, markets, and low-cost local meals as cheaper than an inexpensive sit-down restaurant while allowing the relationship to vary through the local anchor itself. It is not presented as a universal observed ratio.',
      'The mid-range meal anchor is divided by two before being combined with the two per-person proxies. Drinks are excluded from all food formulas so that the drinks basket cannot be counted twice. The fixed high-end uplift is intentionally simple and should be interpreted as a broader dining allowance, not a prediction of a particular restaurant bill.',
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
      'The basket composition is a normative planning assumption: it defines what none, light, moderate, and heavy consumption mean in this application. The prices are still local inputs, so the same basket changes with the city rather than hiding the variation behind a single multiplier.',
      'Coffee is stored as an explicit unit input and drinks_none is constrained to two coffees. In the April 2026 reference CSV, 44 city-name matches retained legacy seed coffee values; the remaining rows use a regional coffee-to-light-basket inference as an editable starting point. That backfill is disclosed because the composed basket existed before the unit coffee input was complete.',
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
      'Activities are the least directly observable category because a city can contain free beaches, museums, tours, classes, adventure operators, and highly seasonal attractions. The inexpensive-meal anchor is therefore used as a local cost proxy, while the USD 10 baseline acts as a global floor for paid experiences.',
      'The activity multipliers are policy choices calibrated for useful budget bands, not prices scraped from a single activity catalogue. This distinction is important when reviewing the result: accommodation, food, and drinks have more direct anchors than activities.',
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
      'Worked example: if the base room, food, and drinks values are each A$100, a three-person group receives A$200 for a room tier, A$142.50 for food, and A$150 for drinks. The example makes the discontinuity at a third room occupant explicit rather than hiding it in a single per-person multiplier.',
      'These are allocation assumptions for trip planning, not claims about the marginal price of every property or restaurant. A user can override the relevant planner value when the actual booking or travel party behaves differently.',
    ],
  },
  {
    title: 'Currency, Rounding And Storage',
    summary: 'Currency conversion is separated from the local-price model and documented as an approximation.',
    paragraphs: [
      'The research layer uses USD because the preferred source categories have broad international coverage there. The app-facing dataset stores AUD values for two people, using the written methodology reference rate of 1.55 AUD per USD unless a generated estimate infers a rate from its own anchor-to-tier outputs.',
      'For generated cities, the server calculates candidate AUD-per-USD ratios from multiple accommodation, food, drinks, and activity equations, averages the valid candidates, and stores the inferred rate with the estimate metadata. If no valid candidate exists, it falls back to 1.55 rather than failing silently.',
      'Monetary values are stored as numeric AUD values and generated unit prices are rounded to two decimal places. Display rounding is a presentation choice; two decimal places do not imply that the underlying travel estimate is accurate to the cent.',
    ],
    bullets: [
      'Convert after the USD anchor definitions and tier arithmetic are explicit.',
      'Keep unit prices and composed baskets separate so a reviewer can recompute drinks_none and other baskets.',
      'Treat the exchange rate as a dated modelling input that can become stale, not as a permanent truth about purchasing power.',
    ],
  },
  {
    title: 'Validation Snapshot',
    summary: 'Validation combines structural checks, formula invariants, ratio diagnostics, and external plausibility checks.',
    bullets: [
      'Food high-end to mid-range ratio: `1.50`, fixed by design',
      'Drinks heavy to light ratio: coefficient of variation `11.5%`',
      'Hostel private to dorm ratio: coefficient of variation `13.7%`',
      'Activities high-end to budget ratio: `6.00`, fixed by design',
      'Food mid-range to street food ratio: `21.3%`, intentionally more variable across regions',
    ],
    paragraphs: [
      'The methodology documentation also benchmarks backpacker, mid-range, and luxury daily budget outcomes against published travel-budget references to make sure city totals stay plausible.',
      'Structural checks ask whether required city fields are present, values are non-negative, the canonical dataset has the expected city and country coverage, and the explicit coffee input is available. Formula invariants then check relationships such as drinks_none being two coffees and fixed-ratio tiers remaining fixed.',
      'Ratio diagnostics are descriptive rather than proof of accuracy. A stable ratio indicates that a transformation behaves consistently across the calibration set; it does not establish that the absolute level is correct. The current workflow also leaves formal prediction intervals and automated outlier treatment as future work, which is why the limitations remain visible.',
    ],
  },
  {
    title: 'Provenance And Reproducibility',
    summary: 'The data lineage is retained so a later reviewer can distinguish a base row, a generated estimate, and a manual edit.',
    paragraphs: [
      'The active city row is the planner source, while estimate history is retained as an audit trail. This keeps the operational dataset simple without discarding the evidence and model settings that produced earlier estimates.',
      'For generated rows, the recorded metadata can include the provider, model, prompt version, confidence notes, anchor JSON, source JSON, input snapshot, fallback log, and inferred AUD-per-USD rate. Those fields make it possible to review the model context separately from the final tier values.',
    ],
    bullets: [
      'Reference rows are traceable to data/reference/city_costs_app_aud.csv and the base_csv_apr_2026 seed source.',
      'Generated rows retain the prompt version so a future prompt change does not make old results ambiguous.',
      'Source and fallback notes distinguish observed prices from nearest-city, regional-hub, or formula-derived values.',
      'The editable Dataset page exposes the current row and generation history; this page documents the shared calculation rules.',
      'A reviewer can recompute each composed category from the anchors without needing access to an LLM response.',
    ],
  },
  {
    title: 'Transport Boundary And Manual Overrides',
    summary: 'Transport is kept outside the city-cost methodology so it is not estimated or double-counted implicitly.',
    paragraphs: [
      'The city model covers recurring accommodation, food, drinks, and activities. Local transport is not included in those tiers, and intercity transport is represented separately as explicit per-leg entries in the planner.',
      'This boundary is a design choice for auditability: transport varies with route, timing, vehicle type, and itinerary geometry in a way that a city-wide daily proxy would hide. Users can add daily transport overrides or one-off intercity costs when they have a better route-specific estimate.',
    ],
  },
  {
    title: 'Known Limitations And New Cities',
    summary: 'The methodology is consistent, but it still has explicit limits, review gates, and a defined path for filling gaps.',
    bullets: [
      'Seasonality is not captured; shoulder-season assumptions can miss holiday and festival spikes',
      '4-star pricing uses a fixed multiplier and may understate steep luxury gradients in some cities',
      'Remote and very small places often rely on regional-hub adjustments and carry lower confidence',
      'Cocktail and wine estimates are weaker in places with sparse alcohol pricing',
      'USD to AUD conversion in the written methodology uses an approximate reference rate',
      'Qualitative confidence labels are not calibrated error probabilities or prediction intervals',
      'Activities are a proxy basket and should receive more scrutiny than directly anchored food or accommodation values',
      'Source availability and website definitions can change, so an estimate has a reference window rather than being permanently current',
    ],
    paragraphs: [
      'New cities should be generated by following the same anchor lookup hierarchy, applying the exact formulas above, converting to AUD, and storing the resulting outputs with confidence metadata and notes.',
      'That is the workflow used by the server-side city generation flow today. Before accepting a new row, a reviewer should confirm the city and country identity, inspect all ten anchors, check which values were direct versus inferred, recompute the tier formulas, review the confidence notes, and compare the resulting daily budget with a plausible external reference.',
      'The right interpretation of this model is therefore: transparent and consistently constructed, useful for comparing trip scenarios, and open about the uncertainty that remains. It is not: a claim that a city has one true daily cost or that the last decimal place has empirical meaning.',
    ],
  },
];

function renderInlineText(value: string) {
  const marker = String.fromCharCode(96);
  const pattern = new RegExp('(' + marker + '[^' + marker + ']+' + marker + ')', 'g');

  return value.split(pattern).map((part, index) => {
    const isCode = part.startsWith(marker) && part.endsWith(marker);
    return isCode ? (
      <code key={index} className="rounded bg-muted px-1 py-0.5 text-[0.8em] text-foreground">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    );
  });
}

export default function EstimatesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Methodology</h1>
        <p className="text-sm text-muted-foreground">
          Review the current evidence, the version 2 calculation rules, and the observed-first version 3
          redesign. The editable planner dataset and generation history live on the Dataset page.
        </p>
        <p className="text-xs text-muted-foreground">
          Version 2.1 baseline + Version 3 redesign | Reference dataset: April 2026 | Review: July 2026 |
          121 cities | 58 countries | Base values: 2 travellers | Currency: AUD
        </p>
      </div>

      <div className="grid gap-4">
        {METHODOLOGY_SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardContent className="p-0">
              <details className="group" open={section.title === 'Methodology Purpose And Scope'}>
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
                      <p key={paragraph}>{renderInlineText(paragraph)}</p>
                    ))}
                    {section.bullets ? (
                      <ul className="list-disc space-y-2 pl-5">
                        {section.bullets.map((bullet) => (
                          <li key={bullet}>{renderInlineText(bullet)}</li>
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
