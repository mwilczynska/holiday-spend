// Capture the fresh, never-read per-measure holdout extension.
//
// This batch deliberately prints only coverage metadata. Once the batch is
// written, the extension is merged and sealed; no command in this collection
// phase reads the resulting holdout prices back.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputPath = path.join(root, 'data/reference/v6/experiments/002-independent-anchor-panel/batch-007-holdout-extension.json');
const cities = [
  ['Hoi An', 'SEA', 'low'], ['Pu Luong', 'SEA', 'low'], ['Koh Samui', 'SEA', 'mid'],
  ['Kyoto', 'East Asia', 'high'], ['Fukuoka', 'East Asia', 'mid'], ['Nikko', 'East Asia', 'high'],
  ['Kathmandu', 'South Asia', 'low'], ['Amman', 'Middle East', 'mid'], ['Zanzibar', 'Africa', 'mid'],
  ['Krakow', 'Europe', 'mid'], ['Rome', 'Europe', 'high'], ['Cusco', 'Latin America', 'mid'],
  ['Buenos Aires', 'Latin America', 'mid'], ['Vancouver', 'North America', 'high'], ['Queenstown', 'Oceania', 'high'],
];
const measures = [
  'inexpensive_restaurant_meal_1p', 'midrange_restaurant_meal_2p', 'mcmeal_combo',
  'cappuccino_1', 'domestic_draft_beer_1', 'half_day_group_activity_adult_1',
  'full_day_premium_activity_adult_1', 'street_food_meal_1p', 'premium_restaurant_meal_2p',
  'cocktail_1', 'wine_glass_1', 'hotel_2star_room_2p',
];
const retrievedAt = '2026-08-10T00:00:00.000Z';
const selectionRule = 'independent_menu_panel_first5_median_v2';
const rows = [];

function found(city, measure, amount, currency, samplePrices, sourceUrl, evidenceText, propertyName = undefined) {
  rows.push({
    city,
    measure,
    status: 'found',
    amount,
    currency,
    sourceUrl,
    retrievedAt,
    taxStatus: 'Menu prices as displayed; no separate tax or service charge stated on the cited page.',
    evidenceText,
    samplePrices,
    selectionRule,
    ...(propertyName ? { propertyName } : {}),
  });
}

// Independent official menu observations. They are retained at source currency;
// the scoring phase applies only the frozen FX snapshot and never mutates these rows.
found('Hoi An', 'inexpensive_restaurant_meal_1p', 75000, 'VND', [75000, 75000, 85000],
  'https://anrestauranthoian.com/menu',
  'An Restaurant Hoi An official menu: Beef Noodle Soup 75,000 VND; Chicken Noodle Soup 75,000 VND; Hoi An specialties 85,000 VND.');
found('Hoi An', 'cocktail_1', 90000, 'VND', [90000, 90000, 120000],
  'https://anrestauranthoian.com/menu',
  'An Restaurant Hoi An official drinks menu: Gin Tonic, Rum Coke/Vodka Coke and Mojito 90,000 VND; Margarita/Pina Colada/Maitai 120,000 VND.');

found('Koh Samui', 'cocktail_1', 580, 'THB', [580, 580, 580],
  'https://www.fourseasons.com/kohsamui/dining/menus/koh-beverages/',
  'Four Seasons Resort Koh Samui official beverage menu: three named cocktails priced at 580 THB each; menu states prices are subject to service charge and tax.');

found('Kyoto', 'cocktail_1', 3000, 'JPY', [2700, 3000, 3200],
  'https://www.imperialhotel.co.jp/en/kyoto/restaurant/old-imperialbar/menu',
  'Imperial Hotel Kyoto Old Imperial Bar official menu: named cocktails at 2,700, 3,000 and 3,200 JPY.');
found('Kyoto', 'premium_restaurant_meal_2p', 32000, 'JPY', [26000, 32000, 60000],
  'https://www.gion-nakatani.kyoto.jp/en/',
  'Gion Nakatani official course menu: regular dinner courses at 13,000, 16,000 and 30,000 JPY per person; recorded as two-person equivalents 26,000, 32,000 and 60,000 JPY.');

found('Kathmandu', 'domestic_draft_beer_1', 795, 'NPR', [750, 795, 865],
  'https://www.divinekathmandurestaurant.com/menu',
  'Divine Kathmandu official menu: Barahsinghe/Gorkha, Tuborg and Carlsberg beer prices 750, 795 and 865 NPR. Frozen FX has no NPR rate; retained as an explicit source row but not comparable in scoring.');
found('Kathmandu', 'cocktail_1', 795, 'NPR', [625, 795, 850],
  'https://www.divinekathmandurestaurant.com/menu',
  'Divine Kathmandu official menu: Screwdriver, Gin & Tonic and named mixed drinks at 625, 795 and 850 NPR. Frozen FX has no NPR rate; retained as an explicit source row but not comparable in scoring.');

found('Amman', 'cocktail_1', 9, 'JOD', [8, 9, 10],
  'https://www.hyattrestaurants.com/en/amman/restaurant-bar/the-terrace/menu/',
  'The Terrace Amman official menu: named cocktails at 8, 9 and 10 JOD. Frozen FX has no JOD rate; retained as an explicit source row but not comparable in scoring.');
found('Amman', 'domestic_draft_beer_1', 9, 'JOD', [7, 9, 9],
  'https://www.hyattrestaurants.com/en/amman/restaurant-bar/the-terrace/menu/',
  'The Terrace Amman official menu: domestic beer prices at 7, 9 and 9 JOD. Frozen FX has no JOD rate; retained as an explicit source row but not comparable in scoring.');
found('Amman', 'wine_glass_1', 14, 'JOD', [10, 14, 18],
  'https://www.fourseasons.com/amman/dining/in_room_dining/in_room_dining/beverage/',
  'Four Seasons Amman official beverage menu: wine by the glass at 10, 14 and 18 JOD. Frozen FX has no JOD rate; retained as an explicit source row but not comparable in scoring.');

found('Rome', 'inexpensive_restaurant_meal_1p', 9, 'EUR', [9, 9, 11],
  'https://www.osteriamacondo.com/en/menu',
  'Osteria Macondo official Rome menu: regular casual mains including pasta and grilled dishes at 9, 9 and 11 EUR.');

found('Vancouver', 'cocktail_1', 19, 'CAD', [18, 19, 20],
  'https://www.bravovancouver.com/menu',
  'Bravo Vancouver official menu: three named cocktails priced at 18, 19 and 20 CAD.');

const foundKeys = new Set(rows.map((row) => `${row.city}\u001f${row.measure}`));
const missingRows = [];
for (const [city] of cities) {
  for (const measure of measures) {
    if (foundKeys.has(`${city}\u001f${measure}`)) continue;
    missingRows.push({
      city,
      measure,
      status: 'not_found',
      reason: 'Bounded independent-source route did not produce a compliant three-price observation before the collection budget; no source-level absence is inferred.',
      attempts: 1,
      lastAttemptAt: retrievedAt,
    });
  }
}

const batch = {
  schemaVersion: 'city-cost-v6-ground-truth-holdout-extension-batch-v1',
  methodologyVersion: 'v6.0',
  manifestPath: 'data/reference/v6/validation-manifest-v6.json',
  panel: 'holdout-extension',
  referenceWindow: { arrival: '2026-09-17', departure: '2026-09-18' },
  selectionRules: { measures },
  cities: cities.map(([city, region, band]) => ({
    city,
    region,
    band,
    observations: [...rows, ...missingRows].filter((row) => row.city === city).map(({ city: _city, ...row }) => row),
  })),
};

fs.writeFileSync(outputPath, `${JSON.stringify(batch, null, 2)}\n`);
console.log(JSON.stringify({ output: path.relative(root, outputPath), cities: cities.length, measures: measures.length, found: rows.length, missing: missingRows.length }, null, 2));
