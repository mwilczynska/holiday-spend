import { countryInRegionOffset } from '../../../../../scripts/city-cost-accuracy/hillclimb/calibration.mjs';
// Leave-one-city-out country-in-region correction fitted on 014's raw answers (k = 3).
const P = 'iterations/014-v11-haiku-high-r2/predictions.jsonl';
export default (anchors, ctx) => Object.fromEntries(Object.entries(anchors).map(([a, v]) => {
  const o = countryInRegionOffset(P, { exclude: ctx.cityKey, anchor: a, country: ctx.country, region: ctx.region, k: 3 });
  return [a, o === null ? v : v * Math.exp(o)];
}));
