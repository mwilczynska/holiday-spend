import { fitFactors } from '../../../../../scripts/city-cost-accuracy/hillclimb/calibration.mjs';
// Fitted on the parent's raw predictions, excluding the city being transformed.
export default (anchors, ctx) => {
  const f = fitFactors('iterations/001-v11-haiku-baseline/predictions.jsonl', { exclude: ctx.cityKey });
  return Object.fromEntries(Object.entries(anchors).map(([a, v]) => [a, f[a] !== undefined ? v * Math.exp(f[a]) : v]));
};
