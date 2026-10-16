import fs from 'node:fs';
import { hcRoot, readJsonl } from '../../../../../scripts/city-cost-accuracy/hillclimb/lib.mjs';
// Geometric mean of the Luna answer (this replay's source) and the Haiku-high answer (014) for the same city.
const H = new Map(readJsonl(hcRoot + '/iterations/014-v11-haiku-high-r2/predictions.jsonl').filter(p => p.status === 'valid').map(p => [p.cityKey, p.anchors_usd]));
export default (anchors, ctx) => { const h = H.get(ctx.cityKey); return h ? Object.fromEntries(Object.entries(anchors).map(([a, v]) => [a, h[a] > 0 ? Math.sqrt(v * h[a]) : v])) : anchors; };
