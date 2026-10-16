import { fitFactors } from '../../../../../scripts/city-cost-accuracy/hillclimb/calibration.mjs';
// Leave-one-city-out: factors are fitted on 004-local-currency's raw predictions for the other dev cities only.
export default (anchors, ctx) => {
  const f = fitFactors('iterations/004-local-currency/predictions.jsonl', { exclude: ctx.cityKey, shrink: 0, groupBy: 'region', hierarchical: null });
  return Object.fromEntries(Object.entries(anchors).map(([a, v]) => { const k = `${a}|${ctx.region}`; return [a, f[k] !== undefined ? v * Math.exp(f[k]) : v]; }));
};
