import { countryInRegionOffset } from '../../../../../scripts/city-cost-accuracy/hillclimb/calibration.mjs';
// Bundle 022 correction (country-in-region, k = 3), fitted leave-one-city-out on 102's answers for the 104 sample only.
const P = 'iterations/022-bundle-s100/base-predictions.jsonl';
export default (anchors, ctx) => Object.fromEntries(Object.entries(anchors).map(([a, v]) => { const o = countryInRegionOffset(P, { exclude: ctx.cityKey, anchor: a, country: ctx.country, region: ctx.region, k: 3 }); return [a, o === null ? v : v * Math.exp(o)]; }));
