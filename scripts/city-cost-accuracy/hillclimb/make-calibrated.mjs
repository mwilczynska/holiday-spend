// Registers the calibrated replay of an iteration: same responses, plus leave-one-city-out per-anchor calibration
// fitted on that iteration's own raw predictions. Prompt candidates are judged in this calibrated form against the
// calibrated incumbent (PROGRAM.md revision of 15 October 2026).
//   node make-calibrated.mjs <iteration> [--parent <calibrated incumbent>] [--shrink k] [--group region]
// Writes iterations/<iteration>-cal/{candidate.json,transform.mjs} and prints the full-dev fitted factors that a
// production version would ship.
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson } from './lib.mjs';
import { fitFactors } from './calibration.mjs';

const [source, ...rest] = process.argv.slice(2);
const opt = (n, d) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : d; };
const shrink = Number(opt('shrink', 0));
const group = opt('group', null);
const hier = opt('hier', null);
const id = `${source}-cal${shrink ? `-s${shrink}` : ''}${group ? `-${group}` : ''}${hier !== null ? `-h${hier}` : ''}`;
const src = readJson(path.join(hcRoot, 'iterations', source, 'candidate.json'));
const dir = path.join(hcRoot, 'iterations', id);
fs.mkdirSync(dir, { recursive: true });
const predictions = `iterations/${src.replayFrom ?? source}/predictions.jsonl`;
const groupExpr = group ? `\`\${a}|\${ctx.${group}}\`` : 'a';
fs.writeFileSync(path.join(dir, 'transform.mjs'),
`import { fitFactors } from '../../../../../scripts/city-cost-accuracy/hillclimb/calibration.mjs';
// Leave-one-city-out: factors are fitted on ${source}'s raw predictions for the other dev cities only.
export default (anchors, ctx) => {
  const f = fitFactors('${predictions}', { exclude: ctx.cityKey, shrink: ${shrink}, groupBy: ${group ? `'${group}'` : 'null'}, hierarchical: ${hier ?? 'null'} });
  return Object.fromEntries(Object.entries(anchors).map(([a, v]) => { const k = ${groupExpr}; return [a, f[k] !== undefined ? v * Math.exp(f[k]) : v]; }));
};
`);
fs.writeFileSync(path.join(dir, 'candidate.json'), JSON.stringify({ id, parent: opt('parent', src.parent ?? null),
  family: 'calibration', hypothesis: `Calibrated replay of ${source}: leave-one-city-out per-anchor${group ? ` x ${group}` : ''} multiplicative correction${shrink ? `, shrink ${shrink}` : ''}${hier !== null ? `, hierarchical shrink ${hier} towards the global anchor factor` : ''}.`,
  replayFrom: src.replayFrom ?? source, transform: 'transform.mjs', lane: src.lane, repeats: src.repeats, split: 'dev',
  localCurrency: src.localCurrency }, null, 2) + '\n');
const full = fitFactors(predictions, { shrink, groupBy: group, hierarchical: hier === null ? null : Number(hier) });
fs.writeFileSync(path.join(dir, 'factors-full-dev.json'), JSON.stringify(Object.fromEntries(Object.entries(full).map(([k, v]) => [k, +Math.exp(v).toFixed(4)])), null, 2) + '\n');
console.log(id);
