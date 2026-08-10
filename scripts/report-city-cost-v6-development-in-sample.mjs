// Generate the current development-only M3 report.
// This script reads coefficients and the paired development score only. It
// never reads a holdout seal, ledger, score, or revealed_once measure.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const coefficients = JSON.parse(fs.readFileSync(path.join(root, 'data/reference/v6/coefficients-v6.json'), 'utf8'));
const score = JSON.parse(fs.readFileSync(path.join(root, 'data/reference/v6/experiments/005-development-in-sample-score/results.json'), 'utf8'));
const outputPath = path.join(root, 'data/reference/v6/m3-development-in-sample-report.md');

const tiers = [
  ['accom_shared_hostel_dorm', 'C', '±54%', 'accom_shared_hostel_dorm <- accom_3_star'],
  ['accom_hostel_private_room', 'C', '±35%', 'rollback; diagnostic fit retained'],
  ['accom_1_star', 'C', '±45%', 'interpolated geometric mean'],
  ['accom_2_star', 'C', '±25%', 'accom_2_star <- accom_3_star'],
  ['accom_3_star', 'B', '±20%', 'production Expedia anchor; Booking -> Expedia offset'],
  ['accom_4_star', 'C', '±25%', 'accom_4_star <- accom_3_star'],
  ['food_street_food', 'C', '±336%', 'measured street_food_meal_1p <- inexpensive_restaurant_meal_1p; n=6'],
  ['food_budget', 'C', 'derived from ±336% street relation', 'fixed basket'],
  ['food_mid_range', 'C', 'derived from input intervals', 'fixed basket plus midrange relation'],
  ['food_high_end', 'D', '±45% premium fallback; basket widens', 'fixed basket plus grade-D premium fallback'],
  ['drink_coffee', 'A', '±10%', 'production Numbeo anchor'],
  ['drinks_none', 'A', 'derived from cappuccino', 'fixed basket'],
  ['drinks_light', 'A', 'derived from cappuccino and beer', 'fixed basket'],
  ['drinks_moderate', 'C', 'derived from ±75% cocktail relation', 'fixed basket plus cocktail relation'],
  ['drinks_heavy', 'C', 'derived from cocktail relation; wine excluded', 'fixed basket without wine glass'],
  ['activities_free', 'definitional', '0%', 'definition'],
  ['activities_budget', 'B', '±20%', 'production BudgetYourTrip anchor; official-attraction truth check'],
  ['activities_mid_range', 'C', '±35%', 'production BudgetYourTrip proxy; independent validation blocked'],
  ['activities_high_end', 'C', '±35%', 'production BudgetYourTrip proxy; independent validation blocked'],
];

const relationByTier = {
  accom_shared_hostel_dorm: 'hostel_dorm_bed_1p <- accom_3_star',
  accom_2_star: 'hotel_2star_room_2p <- hotel_3star_room_2p (independent Booking validation)',
  accom_4_star: 'accom_4_star <- accom_3_star',
  food_mid_range: 'midrange_restaurant_meal_2p <- inexpensive_restaurant_meal_1p',
  food_street_food: 'street_food_meal_1p <- inexpensive_restaurant_meal_1p',
  drinks_moderate: 'cocktail_1 <- cappuccino_1',
};
const relationFor = (tier) => coefficients.relations.find((relation) => relation.key === (relationByTier[tier] ?? ''));
const fitText = (tier) => {
  const relation = relationFor(tier);
  if (!relation) return 'direct anchor, basket or documented fallback';
  const loo = relation.leaveOneCityOut;
  return loo
    ? `n=${relation.n}; k=${relation.coefficient}; LOO medAPE ${loo.medianApePct}%, p90 ${loo.p90ApePct}%`
    : `n=${relation.n}; ${relation.fitStatus}`;
};
const resultText = (tier) => {
  const result = score.tiers[tier];
  if (!result) return 'NOT REPORTED';
  if (result.status === 'evaluable_in_sample') return `IN-SAMPLE n=${result.n}; medAPE ${result.medianApePct}%; signed ${result.medianSignedErrorPct}%`;
  if (result.status === 'definitional_not_scored') return 'DEFINITIONAL — not scored';
  return `NOT EVALUABLE — ${result.reason}`;
};

const lines = [
  '# v6 M3 development in-sample report',
  '',
  'This report is generated from `coefficients-v6.json` and the paired development score in',
  '`experiments/005-development-in-sample-score/results.json`. It never reads a holdout file.',
  '',
  '**IN-SAMPLE ONLY.** These figures are development diagnostics, not holdout validation and not gate passes.',
  '',
  `Prediction coverage: ${score.predictionCoverage.materializedCities}/${score.predictionCoverage.totalCities} cities.`,
  `Tier coverage: ${score.summary.evaluableTiers} evaluable, ${score.summary.definitionalTiers} definitional, ${score.summary.blockedTiers} blocked.`,
  '',
  '| Product tier | Derivation | Grade | Interval | Development fit | In-sample result | v1 comparison |',
  '| --- | --- | --- | --- | --- | --- | --- |',
];
for (const [tier, grade, interval, derivation] of tiers) {
  lines.push(`| \`${tier}\` | ${derivation} | ${grade} | ${interval} | ${fitText(tier)} | ${resultText(tier)} | NOT EVALUABLE — no complete all-19 development truth comparison |`);
}
lines.push(
  '',
  '## Gates 2–6 (development)',
  '',
  '| Gate | Status | Reason |',
  '| --- | --- | --- |',
  `| Gate 2 tier accuracy | ${score.gate2TierAccuracy.status} | ${score.gate2TierAccuracy.evaluableTiers.length} tiers have paired in-sample truth; blocked tiers are not failures. |`,
  `| Gate 3 city ranking | ${score.gate3CityRanking.status} | ${score.gate3CityRanking.reason} |`,
  `| Gate 4 cost bands | ${score.gate4CostBandAgreement.status} | ${score.gate4CostBandAgreement.reason} |`,
  `| Gate 5 trip realism | ${score.gate5TripLevelRealism.status} | ${score.gate5TripLevelRealism.reason} |`,
  `| Gate 6 no regression vs v1 | ${score.gate6NoRegressionVsV1.status} | ${score.gate6NoRegressionVsV1.reason} |`,
  '',
  'The spent holdout remains closed. The fresh holdout proposal remains uncollected and requires owner approval.',
  '',
);
fs.writeFileSync(outputPath, lines.join('\n'));
console.log(JSON.stringify({ output: path.relative(root, outputPath), tiers: tiers.length, summary: score.summary }, null, 2));
