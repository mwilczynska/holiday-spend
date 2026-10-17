import { countryInRegionOffset } from '../../../../../scripts/city-cost-accuracy/hillclimb/calibration.mjs';
// Same correction as 022-bundle-s100, fitted leave-one-city-out on 107's own sample answers.
const P = 'iterations/107-booking-comparables-luna-s100/predictions.jsonl';
export default (anchors, ctx) => Object.fromEntries(Object.entries(anchors).map(([a, v]) => { const o = countryInRegionOffset(P, { exclude: ctx.cityKey, anchor: a, country: ctx.country, region: ctx.region, k: 3 }); return [a, o === null ? v : v * Math.exp(o)]; }));
