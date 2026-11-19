import { countryInRegionOffset } from '../../../../../scripts/city-cost-accuracy/hillclimb/calibration.mjs';
// Haiku arm of bundle 022: Haiku 5.5 Max answers to the food/drink-search prompt (108, Luna's frozen 102 prompts), then
// country-in-region correction (k = 3) fitted leave-one-city-out on 108's own raw answers. Identical to 022's transform
// except for the predictions file.
const P = 'iterations/108-search-food-drink-haiku-max/predictions.jsonl';
export default (anchors, ctx) => Object.fromEntries(Object.entries(anchors).map(([a, v]) => { const o = countryInRegionOffset(P, { exclude: ctx.cityKey, anchor: a, country: ctx.country, region: ctx.region, k: 3 }); return [a, o === null ? v : v * Math.exp(o)]; }));
