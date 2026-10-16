// Builds the hill-climb progress page (research/city-cost-accuracy/hillclimb/progress.html) from saved scores.
//   node build-progress.mjs
// The experiment register below is the curated, ordered list of judged experiments. Each entry names the iteration
// whose score is plotted (judged = calibrated form for prompt candidates) and, where relevant, its raw form.
// Verdicts come from the judged iteration's verdict.json; best-so-far lines follow accepted changes only.
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson } from './lib.mjs';

const E = [
  // panel, judged iteration, raw iteration, label, kind
  ['R1', '000-legacy-csv-baseline', null, 'Old v1 CSV prices', 'reference'],
  ['R1', '001-v11-haiku-baseline', null, 'v1.1 prompt, unchanged', 'baseline'],
  ['R1', '006-calibrate-anchor', null, 'Correction factor per item', 'calibration'],
  ['R1', '001-v11-haiku-baseline-cal-region', null, 'Correction per item and region', 'calibration'],
  ['R1', '001-v11-haiku-baseline-cal-s5-region', null, 'Region correction, shrunk to zero', 'calibration'],
  ['R1', '001-v11-haiku-baseline-cal-region-h3', null, 'Region correction, shrunk to item', 'calibration'],
  ['R1', '002-spec-definitions-cal-region', '002-spec-definitions', 'Clearer item definitions', 'prompt'],
  ['R1', '007-comparable-context-cal-region', '007-comparable-context', 'Prices of 3 comparable cities', 'prompt'],
  ['R1', '003-current-prices-cal-region', '003-current-prices', '"Prices are current" instruction', 'prompt'],
  ['R1', '004-local-currency-cal-region', '004-local-currency', 'Ask in local currency', 'prompt'],
  ['R1', '005-anchor-basis-cal-region', '005-anchor-basis', 'Local example per item', 'prompt'],
  ['R1', '008-accommodation-definitions-cal-region', '008-accommodation-definitions', 'Accommodation definitions', 'prompt'],
  ['R1', '012-v11-haiku-effort-high-cal-region', '012-v11-haiku-effort-high', 'Effort high instead of max (cost)', 'cost'],
  ['R2', '014-v11-haiku-high-r2', null, 'v1.1 prompt, unchanged (333 cities)', 'baseline'],
  ['R2', '014-v11-haiku-high-r2-cal', null, 'Correction factor per item', 'calibration'],
  ['R2', '014-v11-haiku-high-r2-cal-region', null, 'Correction per item and region', 'calibration'],
  ['R2', '014-v11-haiku-high-r2-cal-region-h3', null, 'Region correction, shrunk to item', 'calibration'],
  ['R2', '015-spec-definitions-r2-cal-region', '015-spec-definitions-r2', 'Clearer item definitions', 'prompt'],
  ['R2', '016-accommodation-definitions-r2-cal-region', '016-accommodation-definitions-r2', 'Accommodation definitions', 'prompt'],
  ['R2', '017-country-calibration-r2', null, 'Correction per country, shrunk to region', 'calibration'],
];

const it = id => path.join(hcRoot, 'iterations', id);
const loss = id => { const f = path.join(it(id), 'score-dev.json'); return id && fs.existsSync(f) ? readJson(f).groups?.all?.primaryLoss ?? null : null; };
const verdict = id => { const f = path.join(it(id), 'verdict.json'); return fs.existsSync(f) ? readJson(f) : null; };

const rows = E.map(([panel, judged, raw, label, kind], i) => {
  const v = verdict(judged);
  const l = loss(judged);
  return { n: i + 1, panel, id: judged, label, kind, error: l, raw: raw ? loss(raw) : null,
    verdict: kind === 'reference' || kind === 'baseline' ? kind : (v ? v.verdict : (l === null ? 'pending' : 'unassessed')),
    against: v?.against ?? null, improvement: v?.bootstrap?.meanImprovement ?? null,
    ci: v ? [v.bootstrap.lower95, v.bootstrap.upper95] : null };
});
// An accepted change that does not beat the best method already adopted in its panel is marked "not adopted".
for (const panel of ['R1', 'R2']) {
  let best = null;
  for (const r of rows.filter(x => x.panel === panel)) {
    if (r.kind === 'baseline') best = r.error;
    else if (r.verdict === 'accept') { if (best !== null && r.error >= best) r.verdict = 'not_adopted'; else best = r.error; }
  }
}
const data = { updated: new Date().toISOString(), rows,
  panels: { R1: { cities: 54, label: 'Panel R1 · 54 dev cities' }, R2: { cities: 333, label: 'Panel R2 · 333 dev cities' } } };
const tpl = fs.readFileSync(path.join(hcRoot, 'progress.template.html'), 'utf8');
fs.writeFileSync(path.join(hcRoot, 'progress.html'), tpl.replace('/*DATA*/null', JSON.stringify(data)));
console.log(`progress.html: ${rows.length} experiments, ${rows.filter(r => r.error !== null).length} scored`);
