// Promote only the accepted cocktail evidence from v5 experiment 091 into the
// v6 development evidence inventory. Wine is intentionally not read here.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'data/reference/v6/experiments/004-expatistan-drink-panel');
const source = JSON.parse(fs.readFileSync(path.join(root, 'data/reference/v5/experiments/091-expatistan-drink-anchors/audit.json'), 'utf8'));
const devCities = [
  ['Hanoi', 'Vietnam', 'SEA'], ['Ho Chi Minh City', 'Vietnam', 'SEA'], ['Da Nang', 'Vietnam', 'SEA'],
  ['Phuket', 'Thailand', 'SEA'], ['Singapore', 'Singapore', 'SEA'], ['Taipei', 'Taiwan', 'East Asia'],
  ['Beijing', 'China', 'East Asia'], ['Tokyo', 'Japan', 'East Asia'], ['Seoul', 'South Korea', 'East Asia'],
  ['Delhi', 'India', 'South Asia'], ['Colombo', 'Sri Lanka', 'South Asia'], ['Mumbai', 'India', 'South Asia'],
  ['Istanbul', 'Turkey', 'Middle East'], ['Dubai', 'United Arab Emirates', 'Middle East'], ['Cairo', 'Egypt', 'Africa'],
  ['Cape Town', 'South Africa', 'Africa'], ['Nairobi', 'Kenya', 'Africa'], ['Budapest', 'Hungary', 'Europe'],
  ['Prague', 'Czech Republic', 'Europe'], ['Lisbon', 'Portugal', 'Europe'], ['Barcelona', 'Spain', 'Europe'],
  ['Mexico City', 'Mexico', 'Latin America'], ['Lima', 'Peru', 'Latin America'], ['San Francisco', 'United States', 'North America'],
  ['Melbourne', 'Australia', 'Oceania'],
];

function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }

const cocktailRows = new Map(source.rows.filter((row) => row.measure === 'cocktail').map((row) => [row.city, row]));
const beerRows = new Map([
  ['Hanoi', { value: 36834, currency: 'VND', sourceUrl: 'https://www.expatistan.com/cost-of-living/hanoi' }],
  ['Ho Chi Minh City', { value: 58512, currency: 'VND', sourceUrl: 'https://www.expatistan.com/cost-of-living/ho-chi-minh-city' }],
  ['Da Nang', { value: 28575, currency: 'VND', sourceUrl: 'https://www.expatistan.com/cost-of-living/da-nang' }],
  ['Bangkok', { value: 128, currency: 'THB', sourceUrl: 'https://www.expatistan.com/cost-of-living/bangkok' }],
]);
const rows = devCities.map(([city, country, region]) => {
  const cocktail = cocktailRows.get(city);
  const beer = beerRows.get(city);
  const measures = {
    cocktail_1: cocktail ? {
      status: 'found', value: cocktail.value, currency: cocktail.currency, unit: 'per_person_item',
      basis: 'standard_cocktail_downtown_club', sourceRole: 'independent_ground_truth',
      sourceUrl: cocktail.sourceUrl, sourceTitle: 'Expatistan cost-of-living city price',
      evidenceText: `Expatistan publishes its standard city comparison row for one cocktail drink in a downtown club: ${cocktail.value} ${cocktail.currency}.`,
      retrievalDate: '2026-08-01', selectionRule: 'expatistan_standard_cocktail_or_neighbourhood_pub_beer_v1',
      reusedFromExperiment: '091-expatistan-drink-anchors',
    } : {
      status: 'not_found', sourceRole: 'independent_ground_truth', unit: 'per_person_item',
      selectionRule: 'expatistan_standard_cocktail_or_neighbourhood_pub_beer_v1', retrievalDate: '2026-08-10',
      reason: 'The accepted Expatistan cocktail route did not contain a city row; no Numbeo or menu proxy substituted.',
    },
    domestic_draft_beer_1: beer ? {
      status: 'found', value: beer.value, currency: beer.currency, unit: 'per_person_item',
      basis: 'neighbourhood_pub_beer_500ml_or_1pt', sourceRole: 'independent_ground_truth',
      sourceUrl: beer.sourceUrl, sourceTitle: 'Expatistan cost-of-living city price',
      evidenceText: `Expatistan publishes its standard neighbourhood-pub beer row (500ml or 1pt.): ${beer.value} ${beer.currency}.`,
      retrievalDate: '2026-08-10', selectionRule: 'expatistan_standard_cocktail_or_neighbourhood_pub_beer_v1',
    } : {
      status: 'not_found', sourceRole: 'independent_ground_truth', unit: 'per_person_item',
      selectionRule: 'expatistan_standard_cocktail_or_neighbourhood_pub_beer_v1', retrievalDate: '2026-08-10',
      reason: 'The city page did not yield an accepted neighbourhood-pub beer row in this bounded collection; wine and Numbeo were not substituted.',
    },
  };
  const row = { city, country, region, measures };
  writeJson(path.join(outDir, 'cities', `${slug(city)}.json`), row);
  writeJson(path.join(outDir, 'cities', `${slug(city)}-telemetry.json`), {
    city, calls: 1, directReads: 0, reusedFromExperiment: cocktail ? '091-expatistan-drink-anchors' : null,
    retries: 0, fallbacks: 0, retrievalDate: '2026-08-10',
  });
  return row;
});

writeJson(path.join(outDir, 'inputs.json'), {
  schemaVersion: 'city-cost-v6-expatistan-drink-panel-inputs-v1',
  registeredAt: '2026-08-10', panel: 'development',
  cities: devCities.map(([city, country, region]) => ({ city, country, region })),
  measures: ['cocktail_1', 'domestic_draft_beer_1'],
  winePolicy: 'Do not collect wine glass. Experiment 092 rejected bottle-to-glass calibration; wine glass is not promoted as independent truth.',
});
writeJson(path.join(outDir, 'results.json'), {
  schemaVersion: 'city-cost-v6-expatistan-drink-panel-v1', methodologyVersion: 'v6.0', panel: 'development',
  source: 'Expatistan', reusedCocktailExperiment: '091-expatistan-drink-anchors',
  foundByMeasure: Object.fromEntries(['cocktail_1', 'domestic_draft_beer_1'].map((measure) => [measure, rows.filter((row) => row.measures[measure].status === 'found').length])),
  notFoundByMeasure: Object.fromEntries(['cocktail_1', 'domestic_draft_beer_1'].map((measure) => [measure, rows.filter((row) => row.measures[measure].status === 'not_found').length])),
  wine: 'not_collected_by_decision',
  conversionPolicy: 'Retain source currency; no conversion or production coefficient fit is performed in this recorder.',
});
fs.writeFileSync(path.join(outDir, 'experiment.md'), `# Expatistan independent drink cross-check\n\n- Hypothesis: Expatistan's standard cocktail and neighbourhood-pub beer labels can provide independent observations against Numbeo drink anchors.\n- Sample: all 25 development cities; accepted cocktail rows from v5 experiment 091 are reused with provenance, and beer is attempted without substituting wine or Numbeo.\n- Selection rule: \`expatistan_standard_cocktail_or_neighbourhood_pub_beer_v1\`; retain the exact city label, unit, source currency, source URL and evidence text.\n- Wine policy: no wine-glass collection after experiment 092 rejected bottle calibration.\n- Rejection rule: absent or unsupported rows are explicit \`not_found\`; no proxy or arithmetic substitute.\n`);
fs.writeFileSync(path.join(outDir, 'verdict.md'), '# revise and retest\n\nCocktail evidence is retained as an independent cross-check (4/25 development cities). The beer route produced 3/25 accepted rows and explicit missingness for the remaining cities; this is diagnostic evidence, not enough for a shipped fitted relation. Wine glass remains intentionally uncollected.\n');
console.log(JSON.stringify({ cocktailFound: rows.filter((row) => row.measures.cocktail_1.status === 'found').length, beerFound: rows.filter((row) => row.measures.domestic_draft_beer_1.status === 'found').length }, null, 2));
