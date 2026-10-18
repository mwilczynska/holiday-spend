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
  ['R1', '018-search-grounded-high-cal-region', '018-search-grounded-high', 'Web search for prices (effort high)', 'prompt'],
  ['R2', '014-v11-haiku-high-r2', null, 'v1.1 prompt, unchanged (333 cities)', 'baseline'],
  ['R2', '014-v11-haiku-high-r2-cal', null, 'Correction factor per item', 'calibration'],
  ['R2', '014-v11-haiku-high-r2-cal-region', null, 'Correction per item and region', 'calibration'],
  ['R2', '014-v11-haiku-high-r2-cal-region-h3', null, 'Region correction, shrunk to item', 'calibration'],
  ['R2', '015-spec-definitions-r2-cal-region', '015-spec-definitions-r2', 'Clearer item definitions', 'prompt'],
  ['R2', '016-accommodation-definitions-r2-cal-region', '016-accommodation-definitions-r2', 'Accommodation definitions', 'prompt'],
  ['R2', '017-country-calibration-r2', null, 'Correction per country, shrunk to region', 'calibration'],
  ['R2', '019-search-food-drink-r2-cal-region', '019-search-food-drink-r2', 'Web search for food and drink only', 'prompt'],
  ['R2', '101-v11-luna-r2-cal-region', '101-v11-luna-r2', 'Production model (GPT-6 Luna) + region correction', 'model'],
  ['R2', '020-luna-haiku-ensemble-r2-cal-region', '020-luna-haiku-ensemble-r2', 'Luna and Haiku averaged', 'model'],
  ['R2', '021-luna-country-calibration-r2', null, 'Luna + correction per country', 'calibration'],
  ['R2', '022-bundle-luna-search-country', '102-search-food-drink-luna-r2', 'Bundle: Luna + food/drink search + country correction', 'bundle'],
  // R3 (17 October 2026): hotel references replaced by booking-platform prices; key chain rescored, factors refitted.
  ['R3', '014-v11-haiku-high-r2', null, 'v1.1 prompt, unchanged (Haiku)', 'baseline'],
  ['R3', '014-v11-haiku-high-r2-cal-region', null, 'Haiku + region correction', 'calibration'],
  ['R3', '101-v11-luna-r2-cal-region', '101-v11-luna-r2', 'Luna + region correction', 'model'],
  ['R3', '102-search-food-drink-luna-r2-cal-region', '102-search-food-drink-luna-r2', 'Luna + food/drink search', 'prompt'],
  ['R3', '022-bundle-luna-search-country', '102-search-food-drink-luna-r2', 'Bundle 022 (R3 rescore)', 'bundle'],
  ['R3', '023-bundle-slope', null, 'Bundle 022 + hostel slope correction', 'calibration'],
  // 100-city dev sample (Codex weekly budget): candidates judged against bundle 022 on the same cities.
  ['S100', '022-bundle-s100', null, 'Bundle 022 on the 100-city sample', 'baseline'],
  ['S100', '104-bundle-s100', '104-search-accommodation-luna-s100', 'Web search for accommodation too', 'prompt'],
  ['S100', '106-bundle-s100', '106-search-hostel-luna-s100', 'Web search for hostels only (whole-room wording)', 'prompt'],
];

// One-line description of what each experiment changed, shown in the register (keyed by judged iteration).
const WHAT = {
  '000-legacy-csv-baseline': 'The prices the app shipped with (v1 CSV), scored as a reference point.',
  '001-v11-haiku-baseline': 'The production v1.1 prompt unchanged, answered by Haiku: the starting point.',
  '006-calibrate-anchor': 'One correction factor per anchor, learnt from the other cities.',
  '001-v11-haiku-baseline-cal-region': 'Correction factors per anchor and world region.',
  '001-v11-haiku-baseline-cal-s5-region': 'Region factors pulled towards no correction when a region has few cities.',
  '001-v11-haiku-baseline-cal-region-h3': 'Region factors pulled towards the anchor-wide factor when a region has few cities.',
  '002-spec-definitions-cal-region': 'Prompt defines each item precisely (portion, venue type, serving size).',
  '007-comparable-context-cal-region': 'Prompt includes reference prices for three similar cities.',
  '003-current-prices-cal-region': 'Prompt stresses that prices must be current, not historical.',
  '004-local-currency-cal-region': 'Model answers in local currency; the app converts with a fixed exchange rate.',
  '005-anchor-basis-cal-region': 'Model names a typical local example for each item before pricing it.',
  '008-accommodation-definitions-cal-region': 'Stricter definitions of each accommodation tier.',
  '012-v11-haiku-effort-high-cal-region': 'Haiku at high reasoning effort instead of maximum, to cut cost.',
  '018-search-grounded-high-cal-region': 'Model may search the web for all prices.',
  '014-v11-haiku-high-r2': 'Unchanged v1.1 prompt on the larger 333-city panel (Haiku, high effort).',
  '014-v11-haiku-high-r2-cal': 'One correction factor per anchor.',
  '014-v11-haiku-high-r2-cal-region': 'Correction factors per anchor and region.',
  '014-v11-haiku-high-r2-cal-region-h3': 'Region factors pulled towards the anchor-wide factor.',
  '015-spec-definitions-r2-cal-region': 'Precise item definitions, retested on 333 cities.',
  '016-accommodation-definitions-r2-cal-region': 'Accommodation definitions, retested on 333 cities.',
  '017-country-calibration-r2': 'Correction per country, pulled towards its region when it has few cities.',
  '019-search-food-drink-r2-cal-region': 'Up to five web searches for food and drink prices only; hotels stay estimates.',
  '101-v11-luna-r2-cal-region': 'The production model, GPT-6 Luna at maximum effort, with region correction.',
  '020-luna-haiku-ensemble-r2-cal-region': 'Average of Luna and Haiku answers, then region correction.',
  '021-luna-country-calibration-r2': 'Luna with country-in-region correction.',
  '022-bundle-luna-search-country': 'Luna + food and drink search + country-in-region correction, registered as one package.',
  '102-search-food-drink-luna-r2-cal-region': 'Luna with food and drink search, region correction.',
  '201-v11-luna-test': 'Previous best (Luna + region correction) on the 142 held-out cities.',
  '023-bundle-slope': 'Fitted slope correction for hostels and 1-star on top of bundle 022 (their raw spread is too wide).',
  '022-bundle-s100': 'Bundle 022 on a fixed 100-city sample, corrections refitted on those cities only.',
  '104-bundle-s100': 'Up to four extra searches for hotel and hostel prices, plus bundle 022 correction.',
  '106-bundle-s100': 'Up to two hostel searches, private rooms priced for the whole room; hotels stay estimates.',
  '202-search-food-drink-luna-test': 'Bundle 022 on the 142 held-out cities, scored once.',
};
const it = id => path.join(hcRoot, 'iterations', id);
// R1/R2 rows show the scores and verdicts as judged then (saved as *-r2.json when R3 became primary).
const pick = (id, base, panel) => { const old = path.join(it(id), `${base}-r2.json`); return panel !== 'R3' && fs.existsSync(old) ? old : path.join(it(id), `${base}.json`); };
const loss = (id, panel) => { if (!id) return null; const f = pick(id, 'score-dev', panel); return fs.existsSync(f) ? readJson(f).groups?.all?.primaryLoss ?? null : null; };
const verdict = (id, panel) => { const f = pick(id, 'verdict', panel); return fs.existsSync(f) ? readJson(f) : null; };

const rows = E.map(([panel, judged, raw, label, kind], i) => {
  const v = verdict(judged, panel);
  const l = loss(judged, panel);
  return { n: i + 1, panel, id: judged, label, kind, error: l, raw: raw ? loss(raw, panel) : null,
    verdict: kind === 'reference' || kind === 'baseline' ? kind : (v ? v.verdict : (l === null ? 'pending' : 'unassessed')),
    against: v?.against ?? null, improvement: v?.bootstrap?.meanImprovement ?? null,
    ci: v ? [v.bootstrap.lower95, v.bootstrap.upper95] : null };
});
for (const r of rows) r.what = WHAT[r.id] ?? null;
// Held-out test check: one scoring per arm on the 142 sealed cities (confirmation-r3/result.json).
const conf = path.join(hcRoot, 'confirmation-r3', 'result.json');
if (fs.existsSync(conf)) {
  const c = readJson(conf);
  rows.push({ n: rows.length + 1, panel: 'Test', id: '201-v11-luna-test', label: 'Previous best: Luna + region correction', kind: 'baseline', error: c.incumbentLoss, raw: null, what: WHAT['201-v11-luna-test'], verdict: 'baseline', against: null, improvement: null, ci: null });
  rows.push({ n: rows.length + 1, panel: 'Test', id: '202-search-food-drink-luna-test', label: 'Bundle 022 on held-out cities', kind: 'bundle', error: c.bundleLoss, raw: null,
    what: WHAT['202-search-food-drink-luna-test'], verdict: c.confirmed ? 'accept' : 'reject', against: '201-v11-luna-test', improvement: c.bootstrap.meanImprovement, ci: [c.bootstrap.lower95, c.bootstrap.upper95] });
}
const panelOrder = ['R1', 'R2', 'R3', 'S100', 'Test'].filter(p => rows.some(r => r.panel === p));
// An accepted change that does not beat the best method already adopted in its panel is marked "not adopted".
for (const panel of panelOrder) {
  let best = null;
  for (const r of rows.filter(x => x.panel === panel)) {
    if (r.kind === 'baseline') best = r.error;
    else if (r.verdict === 'accept') { if (best !== null && r.error >= best) r.verdict = 'not_adopted'; else best = r.error; }
  }
}
const data = { updated: new Date().toISOString(), rows, panelOrder,
  panels: {
    R1: { cities: 54, label: 'R1 · 54 cities', desc: 'The first panel: 54 well-known cities. Food and drink from Numbeo, hostels from Hostelworld, hotels from KAYAK budget and mid-range ranges (via BudgetYourTrip). Screening with Claude Haiku.' },
    R2: { cities: 333, label: 'R2 · 333 cities', desc: 'R1 plus 279 smaller, harder cities from the app library. Same sources, with livingcost.org filling food gaps. Where the production model (GPT-6 Luna) and bundle 022 were chosen.' },
    R3: { cities: 333, label: 'R3 · booking hotel prices', desc: 'The same 333 cities with hotel references replaced by actual 3-star and basic-hotel prices from Booking.com and Trip.com (year-typical, taxes included). The current primary panel; key methods rescored with corrections refitted.' },
    S100: { cities: 100, label: 'S100 · R3 sample, 100 cities', desc: 'A fixed 100-city sample of R3, used where a run costs too much for all 333 cities. Each candidate is compared with bundle 022 on the same 100 cities, so its baseline differs from R3’s.' },
    Test: { cities: 142, label: 'Test · 142 held-out cities', desc: '142 cities set aside before any experiment and never used for tuning. Scored once per method to confirm the final choice, against R3 references.' } },
  headline: panelOrder.includes('R3') ? { panel: 'R3', label: 'Best, 333 cities (R3)' } : { panel: 'R2', label: 'Best, 333 cities' },
  note: 'Errors on different panels are not comparable. R2 adds 279 harder, smaller cities to the original 54. R3 is R2 with hotel references replaced by actual Booking.com and Trip.com 3-star prices, so the corrections are refitted. The held-out test scores the best method once on 142 cities no experiment used, against R3.' };
const tpl = fs.readFileSync(path.join(hcRoot, 'progress.template.html'), 'utf8');
fs.writeFileSync(path.join(hcRoot, 'progress.html'), tpl.replace('/*DATA*/null', JSON.stringify(data)));
console.log(`progress.html: ${rows.length} experiments, ${rows.filter(r => r.error !== null).length} scored`);
