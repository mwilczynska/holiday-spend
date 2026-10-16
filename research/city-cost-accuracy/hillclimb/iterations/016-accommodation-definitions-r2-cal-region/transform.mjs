import { fitFactors } from '../../../../../scripts/city-cost-accuracy/hillclimb/calibration.mjs';
// Leave-one-city-out: factors are fitted on 016-accommodation-definitions-r2's raw predictions for the other dev cities only.
export default (anchors, ctx) => {
  const f = fitFactors('iterations/016-accommodation-definitions-r2/predictions.jsonl', { exclude: ctx.cityKey, shrink: 0, groupBy: 'region', hierarchical: null });
  return Object.fromEntries(Object.entries(anchors).map(([a, v]) => { const k = `${a}|${ctx.region}`; return [a, f[k] !== undefined ? v * Math.exp(f[k]) : v]; }));
};
