// Cost per city at API list prices, for lanes answered on subscriptions (nothing was billed per token).
//   node lane-costs.mjs <prices.json> <lane-iteration>...
// prices.json: { "<model>": { "input": $/M, "output": $/M, "cache_read": $/M, "cache_write": $/M } } (models.dev values),
// plus "searchPerCall" ($ per web search call; both providers list $10 per 1,000).
// Two figures per city:
//  - test: what the test run itself would have cost through the API. claude -p records its own list-price total
//    (total_cost_usd), which includes the CLI's WebSearch helper model and its search fees. codex exec records
//    tokens only, priced here; its input includes Codex's own harness instructions.
//  - app (estimate): one app request with the provider's server-side search. Input = the prompt plus the search
//    results the answering model would read (claude -p: the WebSearch helper's input tokens; codex exec: uncached input
//    tokens), output = the answering model's output, plus one search fee per search call. No caching assumed.
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, mean, quantile } from './lib.mjs';

const [pricesFile, ...lanes] = process.argv.slice(2);
const prices = readJson(pricesFile);
const PROMPT_TOKENS = 2000;
const usd = (m, k, tokens) => (prices[m]?.[k] ?? NaN) * tokens / 1e6;
const rows = [];
for (const lane of lanes) {
  const dir = path.join(hcRoot, 'iterations', lane), cand = readJson(path.join(dir, 'candidate.json'));
  const model = cand.cliModel, test = [], app = [];
  for (const t of readJson(path.join(dir, 'freeze.json')).tasks) {
    const rf = path.join(dir, 'tasks', t.id, 'run.json');
    if (!fs.existsSync(path.join(dir, 'tasks', t.id, 'response.json')) || !fs.existsSync(rf)) continue;
    const run = readJson(rf), a = run.attempts?.at(-1) ?? {}, mu = a.modelUsage ?? {};
    const searches = (a.toolCalls ?? []).filter(c => c.name === 'WebSearch').length;
    if (run.runtime === 'codex exec') {
      const u = mu[model] ?? {}, uncached = (u.inputTokens ?? 0) - (u.cachedInputTokens ?? 0);
      test.push(usd(model, 'input', uncached) + usd(model, 'cache_read', u.cachedInputTokens ?? 0) + usd(model, 'output', u.outputTokens ?? 0) + searches * prices.searchPerCall);
      app.push(usd(model, 'input', uncached) + usd(model, 'output', u.outputTokens ?? 0) + searches * prices.searchPerCall);
    } else {
      // Older runs saved before the runtime field: claude -p.
      test.push(a.costUsdList ?? Object.values(mu).reduce((s, x) => s + (x.costUSD ?? 0), 0));
      const main = mu[model] ?? {}, helper = Object.entries(mu).filter(([m]) => m !== model).map(([, x]) => x);
      // When the answering model is the helper model (Haiku), the CLI merges both into one entry: take its input as is.
      const searchTokens = helper.length ? helper.reduce((s, x) => s + (x.inputTokens ?? 0) + (x.cacheReadInputTokens ?? 0), 0)
        : (main.inputTokens ?? 0) + (main.cacheReadInputTokens ?? 0);
      app.push(usd(model, 'input', PROMPT_TOKENS + searchTokens) + usd(model, 'output', main.outputTokens ?? 0) + searches * prices.searchPerCall);
    }
  }
  rows.push({ lane, model, effort: cand.effort, cities: test.length, testPerCity: mean(test), testTotal: test.reduce((s, x) => s + x, 0),
    appPerCity: mean(app), appP90: quantile(app, 0.9), app333: mean(app) * 333 });
}
console.log(JSON.stringify(rows, null, 2));
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '-');
console.error('lane | model/effort | cities | test $/city | test total $ | app $/city est (p90) | app 333 cities $');
for (const r of rows) console.error([r.lane, `${r.model}/${r.effort}`, r.cities, f(r.testPerCity), f(r.testTotal, 2), `${f(r.appPerCity)} (${f(r.appP90)})`, f(r.app333, 2)].join(' | '));
