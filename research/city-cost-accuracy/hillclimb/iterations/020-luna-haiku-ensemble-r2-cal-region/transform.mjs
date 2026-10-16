import ens from '../020-luna-haiku-ensemble-r2/transform.mjs';
import { fitFactors } from '../../../../../scripts/city-cost-accuracy/hillclimb/calibration.mjs';
// Ensemble first, then leave-one-city-out per-region correction fitted on the ensemble's own raw outputs.
export default (anchors, ctx) => { const e = ens(anchors, ctx); const f = fitFactors('iterations/020-luna-haiku-ensemble-r2/predictions.jsonl', { exclude: ctx.cityKey, groupBy: 'region' });
  return Object.fromEntries(Object.entries(e).map(([a, v]) => { const k = `${a}|${ctx.region}`; return [a, f[k] !== undefined ? v * Math.exp(f[k]) : v]; })); };
