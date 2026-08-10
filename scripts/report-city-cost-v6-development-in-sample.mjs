// Generate the current development-only M3 report.
// This script reads coefficients and the paired development score only. It
// never reads a holdout seal, ledger, score, or revealed_once measure.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const coefficients = JSON.parse(fs.readFileSync(path.join(root, 'data/reference/v6/coefficients-v6.json'), 'utf8'));
const score = JSON.parse(fs.readFileSync(path.join(root, 'data/reference/v6/experiments/005-development-in-sample-score/results.json'), 'utf8'));
const diagnostic = JSON.parse(fs.readFileSync(path.join(root, 'data/reference/v6/m3-food-basket-diagnostic.json'), 'utf8'));
const outputPath = path.join(root, 'data/reference/v6/m3-development-in-sample-report.md');

const tiers = [
  ['accom_shared_hostel_dorm', 'C', '±54%', 'accom_shared_hostel_dorm <- accom_3_star'],
  ['accom_hostel_private_room', 'C', '±35%', 'rollback; diagnostic fit retained'],
  ['accom_1_star', 'C', '±45%', 'interpolated geometric mean'],
  ['accom_2_star', 'C', '±25%', 'accom_2_star <- accom_3_star'],
  ['accom_3_star', 'B', '±20%', 'production Expedia anchor; Booking -> Expedia offset'],
  ['accom_4_star', 'C', '±25%', 'accom_4_star <- accom_3_star'],
  ['food_street_food', 'D', '+/-45%', 'global prior fallback; measured n=6 relation retained as diagnostic only'],
  ['food_budget', 'D', 'derived from street prior +/-45%', 'fixed basket; observed inexpensive anchor required for score'],
  ['food_mid_range', 'D', 'derived from street prior +/-45%', 'fixed basket plus midrange relation; observed source anchors required for score'],
  ['food_high_end', 'D', '±45% premium fallback; basket widens', 'fixed basket plus grade-D premium fallback'],
  ['drink_coffee', 'A', '±10%', 'production Numbeo anchor'],
  ['drinks_none', 'A', 'derived from cappuccino', 'fixed basket'],
  ['drinks_light', 'A', 'derived from cappuccino and beer', 'fixed basket'],
  ['drinks_moderate', 'C', 'derived from ±75% cocktail relation', 'fixed basket plus cocktail relation'],
  ['drinks_heavy', 'C', 'derived from cocktail relation; wine excluded', 'fixed basket without wine glass'],
  ['activities_free', 'definitional', '0%', 'definition'],
  ['activities_budget', 'B', '±20%', 'production BudgetYourTrip daily-spend anchor; ticket observations withdrawn as mismatched truth'],
  ['activities_mid_range', 'C', '±35%', 'production BudgetYourTrip daily-spend proxy; independent validation blocked'],
  ['activities_high_end', 'C', '±35%', 'production BudgetYourTrip daily-spend proxy; independent validation blocked'],
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

const ratioText = (value) => `${value.toFixed(2)}x`;
const weightsText = (weights) => `inexpensive ${weights.inexpensive}; midrange ${weights.midrange}`;
const dispersionText = (metrics) => `${metrics.residualDispersionPct.min}% / ${metrics.residualDispersionPct.q25}% / ${metrics.residualDispersionPct.q75}% / ${metrics.residualDispersionPct.max}%`;
const basketDiagnosticLines = [
  '## Food basket diagnosis (existing data; in-sample)',
  '',
  'This screen uses the existing production bundles and BYT food truth only. It does not read a holdout, make provider calls, or change coefficients.',
  '',
  '| Food tier | Food only | + drinks_none | + drinks_light |',
  '| --- | ---: | ---: | ---: |',
];
for (const tier of ['food_budget', 'food_mid_range', 'food_high_end']) {
  const boundary = diagnostic.beverageBoundary[tier];
  basketDiagnosticLines.push(`| \`${tier}\` | ${ratioText(boundary.food_only.medianPredictionToTruth)} | ${ratioText(boundary.plus_drinks_none.medianPredictionToTruth)} | ${ratioText(boundary.plus_drinks_light.medianPredictionToTruth)} |`);
}
basketDiagnosticLines.push(
  '',
  'At budget, adding the product\'s beverage tiers moves the prediction from 0.76x to 0.90x and then 1.04x of BYT food truth. That near-closure is a category-boundary artifact: BYT Food & Meals evidently includes beverages that the product books under drinks. At mid and high, the same additions move 0.63x to 0.70x and 0.48x to 0.51x; the remaining under-prediction is a genuine basket-composition question.',
  '',
  '### Basket-weight re-fit (diagnostic only)',
  '',
  'Because street food is a fixed multiple of inexpensive food and premium is a fixed multiple of midrange, raw basket terms are collinear. The fitted values below are identifiable effective weights and are not shipped.',
  '',
  '| Tier | n | Current effective weights | Fitted effective weights | Current LOO medAPE / p90 | Reweighted LOO medAPE / p90 | Beats current on both? |',
  '| --- | ---: | --- | --- | ---: | ---: | --- |',
);
for (const tier of ['food_mid_range', 'food_high_end']) {
  const fit = diagnostic.basketFits[tier];
  basketDiagnosticLines.push(`| \`${tier}\` | ${fit.n} | ${weightsText(fit.currentEffectiveWeights)} | ${weightsText(fit.fittedEffectiveWeights)} (${fit.fittedEffectiveWeights.fitMode}) | ${fit.currentLoo.medianApePct}% / ${fit.currentLoo.p90ApePct}% | ${fit.reweightedLoo.medianApePct}% / ${fit.reweightedLoo.p90ApePct}% | ${fit.comparison.beatsCurrentOnBoth ? 'yes' : 'no'} |`);
  basketDiagnosticLines.push(`|  |  |  | Full-panel medAPE ${fit.fullPanelFit.medianApePct}%; signed residual dispersion min / Q1 / Q3 / max: ${dispersionText(fit.fullPanelFit)} |  | LOO signed residual dispersion min / Q1 / Q3 / max: ${dispersionText(fit.reweightedLoo)} |  |`);
}
basketDiagnosticLines.push(
  '',
  'The mid-range re-fit improves LOO median APE by 0.43 percentage points but worsens p90 by 1.47 points, so it does not beat the current basket on both criteria. The high-end re-fit beats it on both (LOO median APE 29.82% vs 51.99%; p90 47.21% vs 61.00%). Neither re-weighting is shipped; the high-end result is a candidate for a separately reviewed model change.',
  '',
  '### Numbeo observation coverage by region',
  '',
  'Rates below are for the five Numbeo production anchors in the 25-city development prediction bundles. The food score therefore runs on a Western/East-Asian-leaning subsample and may not generalise to cities with weak Numbeo coverage.',
  '',
  '| Region | Cities | Inexpensive | Midrange | Cappuccino | Draft beer | McMeal | All five |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
);
for (const [region, coverage] of Object.entries(diagnostic.numbeoObservationRatesByRegion)) {
  const rates = coverage.ratesPct;
  basketDiagnosticLines.push(`| ${region} | ${coverage.cities} | ${rates.inexpensive_restaurant_meal_1p}% | ${rates.midrange_restaurant_meal_2p}% | ${rates.cappuccino_1}% | ${rates.domestic_draft_beer_1}% | ${rates.mcmeal_combo}% | ${coverage.allFiveRatePct}% |`);
}
const allFiveObserved = Object.values(diagnostic.numbeoObservationRatesByRegion).reduce((sum, row) => sum + row.allFiveObserved, 0);
basketDiagnosticLines.push(
  '',
  `Overall food-anchor observation rates are inexpensive ${diagnostic.overallNumbeoObservationRates.inexpensive_restaurant_meal_1p.observed}/${diagnostic.overallNumbeoObservationRates.inexpensive_restaurant_meal_1p.total} (${diagnostic.overallNumbeoObservationRates.inexpensive_restaurant_meal_1p.ratePct}%), midrange ${diagnostic.overallNumbeoObservationRates.midrange_restaurant_meal_2p.observed}/${diagnostic.overallNumbeoObservationRates.midrange_restaurant_meal_2p.total} (${diagnostic.overallNumbeoObservationRates.midrange_restaurant_meal_2p.ratePct}%), and all-five ${allFiveObserved}/25 (${(allFiveObserved / 25 * 100).toFixed(1)}%).`,
);

const lines = [
  '# v6 M3 development in-sample report',
  '',
  'This report is generated from `coefficients-v6.json` and the paired development score in',
  '`experiments/005-development-in-sample-score/results.json`. It never reads a holdout file.',
  '',
  '**IN-SAMPLE ONLY.** These figures are development diagnostics, not holdout validation and not gate passes.',
  '',
  `Prediction coverage: ${score.predictionCoverage.materializedCities}/${score.predictionCoverage.totalCities} cities.`,
  `Tier coverage: ${score.summary.evaluableTiers} evaluable, ${score.summary.definitionalTiers} definitional, ${score.summary.blockedTiers} blocked, ${score.summary.notEvaluableTiers} not evaluable.`,
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
  `| Gate 2 tier accuracy | ${score.gate2TierAccuracy.status} | ${score.gate2TierAccuracy.evaluableTiers.length} tiers have paired in-sample truth; blocked and not-evaluable tiers are not failures. |`,
  `| Gate 3 city ranking | ${score.gate3CityRanking.status} | ${score.gate3CityRanking.reason} |`,
  `| Gate 4 cost bands | ${score.gate4CostBandAgreement.status} | ${score.gate4CostBandAgreement.reason} |`,
  `| Gate 5 trip realism | ${score.gate5TripLevelRealism.status} | ${score.gate5TripLevelRealism.reason} |`,
  `| Gate 6 no regression vs v1 | ${score.gate6NoRegressionVsV1.status} | ${score.gate6NoRegressionVsV1.reason} |`,
  '',
  '',
  '## Food score eligibility',
  '',
  'Food rows are scored only where the required production Numbeo anchors were observed. Derived street-food and premium anchors do not count as independent observations; cities with imputed source anchors are excluded.',
  '',
  ...['food_budget', 'food_mid_range', 'food_high_end'].map((tier) => {
    const result = score.tiers[tier];
    return `- \`${tier}\`: n=${result.n}; required observed anchors: ${(result.requiredObservedAnchors ?? []).join(', ')}; excluded ${result.excludedCount ?? 0}: ${(result.excludedCities ?? []).join(', ') || 'none'}`;
  }),
  '',
  ...basketDiagnosticLines,
  '',
  'The spent holdout remains closed. The fresh holdout proposal remains uncollected and requires owner approval.',
  '',
);
fs.writeFileSync(outputPath, lines.join('\n'));
console.log(JSON.stringify({ output: path.relative(root, outputPath), tiers: tiers.length, summary: score.summary }, null, 2));
