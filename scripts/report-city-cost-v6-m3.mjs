// Generate the auditable M3 all-19 table from the generated coefficient file
// and the one-time all-tier score metadata. It never reads a holdout ledger.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const coefficients = JSON.parse(fs.readFileSync(path.join(root, 'data/reference/v6/coefficients-v6.json'), 'utf8'));
const seal = JSON.parse(fs.readFileSync(path.join(root, 'data/reference/v6/ground-truth/holdout-seal.json'), 'utf8'));
const score = JSON.parse(fs.readFileSync(path.join(root, 'data/reference/v6/ground-truth/holdout-scores-all-tier.json'), 'utf8'));
const outputPath = path.join(root, 'data/reference/v6/m3-all-tier-report.md');

const tiers = [
  ['accom_shared_hostel_dorm', 'hostel_dorm_bed_1p', 'C', '±54%', 'hostel_dorm_bed_1p <- accom_3_star', 'hostel_dorm_bed_1p <- accom_3_star'],
  ['accom_hostel_private_room', 'hostel_private_room_2p', 'C', '±35%', 'rollback; diagnostic fit retained', 'hostel_private_room_2p <- accom_3_star'],
  ['accom_1_star', 'hotel_1star_room_2p', 'C', '±45%', 'interpolated geometric mean', null],
  ['accom_2_star', 'hotel_2star_room_2p', 'C', '±25%', 'accom_2_star <- accom_3_star; Booking diagnostic retained separately', 'accom_2_star <- accom_3_star'],
  ['accom_3_star', 'hotel_3star_room_2p', 'B', '±20%', 'production Expedia anchor; offset fitted on development', null],
  ['accom_4_star', 'hotel_4star_room_2p', 'C', '±25%', 'accom_4_star <- accom_3_star', 'accom_4_star <- accom_3_star'],
  ['food_street_food', 'street_food_meal_1p', 'C', 'materialized from ±336% street relation', 'street_food_meal_1p <- inexpensive_restaurant_meal_1p', 'street_food_meal_1p <- inexpensive_restaurant_meal_1p'],
  ['food_budget', null, 'C', 'materialized from street/inexpensive inputs', 'fixed basket', null],
  ['food_mid_range', 'midrange_restaurant_meal_2p', 'C', 'materialized from input intervals', 'midrange <- inexpensive; fixed basket', 'midrange_restaurant_meal_2p <- inexpensive_restaurant_meal_1p'],
  ['food_high_end', 'premium_restaurant_meal_2p', 'C', 'materialized from ±12% premium relation', 'premium <- midrange; fixed basket', 'premium_restaurant_meal_2p <- midrange_restaurant_meal_2p'],
  ['drink_coffee', 'cappuccino_1', 'A', '±10%', 'production Numbeo anchor', null],
  ['drinks_none', null, 'A', 'materialized from cappuccino', 'fixed basket', null],
  ['drinks_light', 'domestic_draft_beer_1', 'A', 'materialized from cappuccino/beer', 'fixed basket', 'cappuccino_1 <- domestic_draft_beer_1'],
  ['drinks_moderate', 'cocktail_1', 'C', 'materialized from ±75% cocktail relation', 'cocktail <- cappuccino; fixed basket', 'cocktail_1 <- cappuccino_1'],
  ['drinks_heavy', 'wine_glass_1', 'C', 'materialized from ±29% wine relation', 'wine <- cappuccino; fixed basket', 'wine_glass_1 <- cappuccino_1'],
  ['activities_free', null, 'definitional', '0%', 'definition', null],
  ['activities_budget', 'paid_attraction_adult_1', 'B', '±20%', 'production BudgetYourTrip anchor', null],
  ['activities_mid_range', 'half_day_group_activity_adult_1', 'B', '±20%', 'production BudgetYourTrip anchor', null],
  ['activities_high_end', 'full_day_premium_activity_adult_1', 'B', '±20%', 'production BudgetYourTrip anchor', null],
];

const relationFor = (needle) => coefficients.relations.find((relation) => relation.key === needle);
const fitText = (label) => {
  const relation = relationFor(label);
  if (!relation) return 'No independent coefficient; direct anchor, basket or definition.';
  const loo = relation.leaveOneCityOut;
  if (!loo) return `n=${relation.n}; ${relation.fitStatus}.`;
  return `n=${relation.n}; k=${relation.coefficient}; LOO medAPE ${loo.medianApePct}%, p90 ${loo.p90ApePct}%; ${relation.fitStatus}.`;
};
const holdoutText = (tier) => {
  const result = score.tiers[tier];
  if (result?.status === 'not_applicable') return 'Not applicable.';
  if (result?.status === 'not_evaluable') return `NOT EVALUABLE — ${result.reason}`;
  return result ? result.status : 'NOT EVALUABLE — no all-tier result.';
};
const v1Text = 'NOT EVALUABLE — no valid all-19 candidate-versus-ground-truth comparison was possible.';
const lines = [
  '# v6 M3 all-19 derivation and validation report',
  '',
  'Generated from `coefficients-v6.json` and `holdout-scores-all-tier.json`; candidate ' + (seal.candidateConfigHash ?? 'not frozen') + '.',
  '',
  'M3 was reopened to require all 19 product tiers. Development fitting is script-generated. The fresh holdout extension was read once after the single candidate freeze, but the six old `revealed_once` measures were not reopened. Because no paired production-path prediction bundle exists for the fresh cities, gates 2–6 are reported as `not_evaluable`; these are integrity and design reasons, not passes.',
  '',
  '| Product tier | Fitted derivation / source | Grade | Interval | Development fit | Holdout result | v1 comparison |',
  '| --- | --- | --- | --- | --- | --- | --- |',
];
for (const [tier, measure, grade, interval, derivation, fitKey] of tiers) {
  lines.push(`| \`${tier}\` | ${derivation}${measure ? ` (measure: \`${measure}\`)` : ''} | ${grade} | ${interval} | ${fitKey ? fitText(fitKey) : 'No independent coefficient; direct anchor, basket or definition.'} | ${holdoutText(tier)} | ${v1Text} |`);
}
lines.push(
  '',
  '## Coverage and unresolved validation',
  '',
  '- Development: 25 cities × 18 measures, 280 found rows, zero pending slots; the street-food tranche was 11 found / 14 `not_found` / 0 `class_absent`.',
  '- Fresh holdout: 15 cities × 12 measures, 12 found / 168 explicit `not_found`; the twelve measures are now `revealed_once`.',
  '- The old six-measure holdout remains spent. Its historical conditional accommodation results remain in `holdout-scores.json`, but they are not an all-19 score and the private row describes a withdrawn candidate.',
  '- A valid end-to-end M3 score requires paired production-path predictions for the same 15 holdout cities and a fresh complete basket if the spent six-measure boundary is to remain inviolate.',
  '- v5 never validated a product relationship against product ground truth. v6 has generated all 19 derivations and completed the independent development panel, but the all-19 holdout validation remains explicitly incomplete for the reasons above.',
  '',
  'No coefficient was refit from holdout data. The 121-city CSV remains untouched; M4 is out of scope.',
);
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
console.log(JSON.stringify({ output: path.relative(root, outputPath), tiers: tiers.length, candidateConfigHash: seal.candidateConfigHash, holdoutScoreStatus: 'not_evaluable_by_design' }, null, 2));
