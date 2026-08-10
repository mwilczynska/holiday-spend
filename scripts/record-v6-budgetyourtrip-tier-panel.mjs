// Record the pre-registered one-call-per-city BudgetYourTrip tier panel.
// This is a source-fact recorder: it does not convert currency or scale to two people.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'data/reference/v6/experiments/003-budgetyourtrip-tier-panel');
const retrievedAt = '2026-08-10';
const sourceTitle = 'BudgetYourTrip city travel cost page';

const cities = [
  ['Hanoi', 'Vietnam', 'SEA', [9, 23, 58], [3, 8, 28], 'https://www.budgetyourtrip.com/vietnam/hanoi'],
  ['Ho Chi Minh City', 'Vietnam', 'SEA', [9, 23, 58], [7, 19, 53], 'https://www.budgetyourtrip.com/vietnam/ho-chi-minh-city'],
  ['Da Nang', 'Vietnam', 'SEA', [11, 27, 64], [6, 13, 23], 'https://www.budgetyourtrip.com/vietnam/da-nang'],
  ['Phuket', 'Thailand', 'SEA', [16, 41, 108], [18, 47, 125], 'https://www.budgetyourtrip.com/thailand/phuket'],
  ['Singapore', 'Singapore', 'SEA', [19, 47, 119], [13, 34, 88], 'https://www.budgetyourtrip.com/singapore'],
  ['Taipei', 'Taiwan', 'East Asia', [11, 28, 75], [7, 18, 48], 'https://www.budgetyourtrip.com/taiwan/taipei'],
  ['Beijing', 'China', 'East Asia', [14, 36, 90], [10, 26, 65], 'https://www.budgetyourtrip.com/china/beijing'],
  ['Tokyo', 'Japan', 'East Asia', [23, 61, 171], [22, 65, 215], 'https://www.budgetyourtrip.com/japan/tokyo'],
  ['Seoul', 'South Korea', 'East Asia', [18, 47, 124], [9, 24, 72], 'https://www.budgetyourtrip.com/south-korea/seoul'],
  ['Delhi', 'India', 'South Asia', [7, 18, 46], [6, 17, 60], 'https://www.budgetyourtrip.com/india/delhi'],
  ['Colombo', 'Sri Lanka', 'South Asia', null, null, 'https://www.budgetyourtrip.com/sri-lanka/colombo'],
  ['Mumbai', 'India', 'South Asia', [12, 38, 135], [1, 2, 6], 'https://www.budgetyourtrip.com/india/mumbai'],
  ['Istanbul', 'Turkey', 'Middle East', [24, 59, 133], [15, 39, 95], 'https://www.budgetyourtrip.com/turkey/istanbul'],
  ['Dubai', 'United Arab Emirates', 'Middle East', [39, 96, 235], [6, 19, 77], 'https://www.budgetyourtrip.com/united-arab-emirates/dubai'],
  ['Cairo', 'Egypt', 'Africa', [7, 17, 33], [4, 9, 17], 'https://www.budgetyourtrip.com/egypt/cairo'],
  ['Cape Town', 'South Africa', 'Africa', [63, 82, 116], [9, 26, 79], 'https://www.budgetyourtrip.com/south-africa/cape-town'],
  ['Nairobi', 'Kenya', 'Africa', [11, 13, 17], [17, 46, 129], 'https://www.budgetyourtrip.com/kenya/nairobi'],
  ['Budapest', 'Hungary', 'Europe', [18, 49, 137], [10, 27, 77], 'https://www.budgetyourtrip.com/hungary/budapest'],
  ['Prague', 'Czech Republic', 'Europe', [21, 50, 111], [7, 18, 45], 'https://www.budgetyourtrip.com/czech-republic/prague'],
  ['Lisbon', 'Portugal', 'Europe', [35, 85, 199], [11, 28, 73], 'https://www.budgetyourtrip.com/portugal/lisbon'],
  ['Barcelona', 'Spain', 'Europe', [27, 66, 156], [15, 38, 91], 'https://www.budgetyourtrip.com/spain/barcelona'],
  ['Mexico City', 'Mexico', 'Latin America', [17, 46, 135], [6, 15, 34], 'https://www.budgetyourtrip.com/mexico/mexico-city'],
  ['Lima', 'Peru', 'Latin America', [13, 33, 86], [3, 9, 30], 'https://www.budgetyourtrip.com/peru/lima'],
  ['San Francisco', 'United States', 'North America', [32, 79, 191], [13, 31, 78], 'https://www.budgetyourtrip.com/united-states-of-america/san-francisco'],
  ['Melbourne', 'Australia', 'Oceania', [24, 57, 128], [12, 30, 70], 'https://www.budgetyourtrip.com/australia/melbourne'],
];

const tierNames = [
  ['food_budget_per_person_day', 'food', 'budget'],
  ['food_mid_per_person_day', 'food', 'mid_range'],
  ['food_high_per_person_day', 'food', 'luxury'],
  ['activities_budget_per_person_day', 'entertainment_or_sightseeing', 'budget'],
  ['activities_mid_per_person_day', 'entertainment_or_sightseeing', 'mid_range'],
  ['activities_high_per_person_day', 'entertainment_or_sightseeing', 'luxury'],
];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function foundMeasure(city, country, url, measure, scope, tier, value, sourceRole) {
  const label = scope === 'food' ? 'Food & Meal Budget' : 'Entertainment';
  const reusedActivitySource = scope !== 'food' && (city === 'Istanbul' || city === 'Dubai');
  return {
    status: 'found',
    value,
    currency: 'USD',
    unit: 'per_person_per_day',
    tier,
    scope,
    partyBasis: 'one_person',
    sourceRole,
    sourceUrl: url,
    sourceTitle,
    evidenceText: reusedActivitySource
      ? `BudgetYourTrip ${city} exact-city tier row from v5 experiment 080 reports ${label} ${tier} at $${value} USD per person per day; reused without recalculation.`
      : `BudgetYourTrip ${city} page reports ${label} ${tier} at $${value} USD per person per day.`,
    retrievalDate: reusedActivitySource ? '2026-08-01' : retrievedAt,
    evidenceOrigin: reusedActivitySource ? 'reused_v5_experiment_080' : 'current_page_capture_2026-08-10',
    selectionRule: 'budgetyourtrip_labelled_tier_per_person_day_v1',
    reason: sourceRole === 'independent_ground_truth'
      ? 'Direct labelled daily food tier; food is not read by the production Numbeo spine.'
      : 'Direct labelled daily entertainment tier retained as a production-source diagnostic; not independent ground truth because production uses BudgetYourTrip.'
  };
}

function missingMeasure(city, url, measure) {
  return {
    status: 'not_found',
    sourceRole: 'independent_ground_truth',
    sourceUrl: url,
    retrievalDate: retrievedAt,
    selectionRule: 'budgetyourtrip_labelled_tier_per_person_day_v1',
    reason: `City-scoped BudgetYourTrip page for ${city} was not found; no country or neighbouring-city page was substituted.`,
    measure,
  };
}

const rows = cities.map(([city, country, region, food, activities, url]) => {
  const measures = {};
  if (food && activities) {
    const values = [...food, ...activities];
    tierNames.forEach(([measure, scope, tier], index) => {
      measures[measure] = foundMeasure(
        city,
        country,
        url,
        measure,
        scope,
        tier,
        values[index],
        scope === 'food' ? 'independent_ground_truth' : 'production_source_unvalidated'
      );
    });
  } else {
    for (const [measure] of tierNames) measures[measure] = missingMeasure(city, url, measure);
  }
  const row = { city, country, region, sourceUrl: url, oneCall: true, measures };
  writeJson(path.join(outDir, 'cities', `${slug(city)}.json`), row);
  writeJson(path.join(outDir, 'cities', `${slug(city)}-telemetry.json`), {
    city, calls: 1, directReads: 1, retries: 0, fallbacks: 0, source: 'BudgetYourTrip', retrievalDate: retrievedAt,
  });
  return row;
});

const foundByMeasure = Object.fromEntries(tierNames.map(([measure]) => [
  measure,
  rows.filter((row) => row.measures[measure].status === 'found').length,
]));

writeJson(path.join(outDir, 'inputs.json'), {
  schemaVersion: 'city-cost-v6-budgetyourtrip-tier-panel-inputs-v1',
  registeredAt: retrievedAt,
  panel: 'development',
  cities: cities.map(([city, country, region, , , sourceUrl]) => ({ city, country, region, sourceUrl })),
  oneCallPerCity: true,
  currencyPolicy: 'Retain USD source facts; no conversion or two-person scaling in this experiment.',
});
writeJson(path.join(outDir, 'results.json'), {
  schemaVersion: 'city-cost-v6-budgetyourtrip-tier-panel-v1',
  methodologyVersion: 'v6.0',
  panel: 'development',
  source: 'BudgetYourTrip',
  retrievedAt,
  totalCities: rows.length,
  citiesWithCompleteRows: rows.filter((row) => Object.values(row.measures).every((measure) => measure.status === 'found')).length,
  foundByMeasure,
  explicitNotFoundRows: rows.reduce((count, row) => count + Object.values(row.measures).filter((measure) => measure.status === 'not_found').length, 0),
  activityValidation: 'blocked_as_independent_ground_truth; BudgetYourTrip is the production activity source',
  foodValidation: 'eligible_independent_ground_truth; production food source is Numbeo',
  twoPersonComparisonRule: 'Multiply a per-person/day truth value by 2 only in the separate product-level scoring/reporting layer.',
});
fs.writeFileSync(path.join(outDir, 'experiment.md'), `# BudgetYourTrip labelled tier-level daily panel\n\n- **Hypothesis:** BudgetYourTrip publishes the product-level food and activity spend estimand more directly and consistently than sparse item-price panels.\n- **Pre-registered sample:** 25 development cities, one city-scoped page call per city, six labelled per-person/day tiers per city.\n- **Source policy:** Food is independent ground truth against production Numbeo. Activity is retained for production diagnostics only because production also uses BudgetYourTrip.\n- **Selection rule:** \`budgetyourtrip_labelled_tier_per_person_day_v1\`: record the displayed budget, mid-range and luxury food and entertainment values, with the displayed currency, label, URL and evidence text; do not infer missing tiers.\n- **Rejection rule:** Missing city page is explicit \`not_found\`; never substitute a country or neighbouring city. Do not score activity rows as independent truth.\n- **Maximum calls:** 25.\n`);
fs.writeFileSync(path.join(outDir, 'verdict.md'), '# accept\n\nThe labelled source-fact panel is recorded. Food rows are eligible for independent development validation; activity rows are retained as production-source diagnostics and are not promoted to independent ground truth. Colombo remains explicit not_found.\n');
console.log(JSON.stringify({ totalCities: rows.length, foundByMeasure }, null, 2));
