import { countryInRegionOffset } from '../../../../../scripts/city-cost-accuracy/hillclimb/calibration.mjs';
// Leave-one-city-out country-in-region correction (k = 3) fitted on Luna's raw answers (101).
const P = 'iterations/101-v11-luna-r2/predictions.jsonl';
export default (anchors, ctx) => Object.fromEntries(Object.entries(anchors).map(([a, v]) => { const o = countryInRegionOffset(P, { exclude: ctx.cityKey, anchor: a, country: ctx.country, region: ctx.region, k: 3 }); return [a, o === null ? v : v * Math.exp(o)]; }));
