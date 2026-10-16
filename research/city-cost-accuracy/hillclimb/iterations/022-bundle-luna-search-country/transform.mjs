import { countryInRegionOffset } from '../../../../../scripts/city-cost-accuracy/hillclimb/calibration.mjs';
// Bundle: Luna answers to the food/drink-search prompt (102), then country-in-region correction (k = 3) fitted
// leave-one-city-out on 102's own raw answers.
const P = 'iterations/102-search-food-drink-luna-r2/predictions.jsonl';
export default (anchors, ctx) => Object.fromEntries(Object.entries(anchors).map(([a, v]) => { const o = countryInRegionOffset(P, { exclude: ctx.cityKey, anchor: a, country: ctx.country, region: ctx.region, k: 3 }); return [a, o === null ? v : v * Math.exp(o)]; }));
