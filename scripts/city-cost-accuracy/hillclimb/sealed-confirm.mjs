// Sealed test confirmation of bundle 022, exactly as registered in PLAN.md on 16 October 2026 before any answer.
//   node sealed-confirm.mjs
// Incumbent: 201 raw test answers x per-anchor x region factors fitted on all 101 dev answers.
// Bundle:    202 raw test answers x country-in-region factors (k = 3) fitted on all 102 dev answers.
// Each arm is scored once with score.mjs --test (logged in panel/test-access.jsonl), then paired by city.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { repo, hcRoot, readJson, readJsonl, loadPanel, pairedBootstrap } from './lib.mjs';
import { fitFactors, countryInRegionOffset } from './calibration.mjs';

const version = readJson(path.join(hcRoot, 'panel/panel-summary.json')).version;
const out = path.join(hcRoot, `confirmation-${version.toLowerCase()}`);
fs.mkdirSync(out, { recursive: true });
const cities = new Map(loadPanel().filter(r => r.split === 'test').map(r => [r.cityKey, r]));
const regionF = fitFactors('iterations/101-v11-luna-r2/predictions.jsonl', { shrink: 0, groupBy: 'region', hierarchical: null });
const arms = {
  incumbent: ['201-v11-luna-test', (a, v, c) => regionF[`${a}|${c.region}`] !== undefined ? v * Math.exp(regionF[`${a}|${c.region}`]) : v],
  bundle: ['202-search-food-drink-luna-test', (a, v, c) => { const o = countryInRegionOffset('iterations/102-search-food-drink-luna-r2/predictions.jsonl', { exclude: null, anchor: a, country: c.country, region: c.region, k: 3 }); return o === null ? v : v * Math.exp(o); }],
};
const scores = {};
for (const [arm, [it, f]] of Object.entries(arms)) {
  const rows = readJsonl(path.join(hcRoot, 'iterations', it, 'predictions.jsonl')).map(p => {
    if (p.status !== 'valid') return p;
    const c = cities.get(p.cityKey);
    return { ...p, anchors_usd: Object.fromEntries(Object.entries(p.anchors_usd).map(([a, v]) => [a, f(a, v, c)])) };
  });
  const file = path.join(out, `${arm}-predictions.jsonl`);
  fs.writeFileSync(file, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  const s = execFileSync(process.execPath, [path.join(repo, 'scripts/city-cost-accuracy/hillclimb/score.mjs'), file, '--test'], { encoding: 'utf8' });
  fs.writeFileSync(path.join(out, `${arm}-score-test.json`), s);
  scores[arm] = JSON.parse(s).groups.all;
}
const boot = pairedBootstrap(scores.incumbent.cityLosses, scores.bundle.cityLosses);
const result = { registered: 'PLAN.md, 16 October 2026', panel: version, incumbentLoss: scores.incumbent.primaryLoss, bundleLoss: scores.bundle.primaryLoss,
  bootstrap: { ...boot, cityLosses: undefined },
  perAnchor: Object.fromEntries(Object.keys(scores.bundle.perAnchor).map(a => [a, { incumbent: scores.incumbent.perAnchor[a]?.meanAbsLog, bundle: scores.bundle.perAnchor[a].meanAbsLog }])),
  confirmed: boot.meanImprovement > 0 && boot.lower95 > 0 };
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
