// Shared helpers for correction analyses on model lanes: dev references (grades A-C), lane answers, residuals,
// Luna's country-in-region fit (k = 3) and scoring. Corrected anchors come from the app's production table.
import fs from 'node:fs';
import path from 'node:path';
import { hcRoot, readJson, loadPanel, cityLoss, mean, BUDGET_WEIGHTS, ANCHORS } from './lib.mjs';

export function createCorrectionContext(appRepo, { split = 'dev' } = {}) {
  const table = readJson(path.join(appRepo, 'src/lib/data/city-cost-corrections-v1-2.json'));
  const corrected = table.correctedAnchors;
  const refs = new Map(), meta = new Map();
  for (const r of loadPanel().filter(r => r.split === split && ['A', 'B', 'C'].includes(r.grade))) {
    if (!refs.has(r.cityKey)) refs.set(r.cityKey, {});
    (refs.get(r.cityKey)[r.anchor] ??= []).push(Math.log(r.valueUsd));
    if (!meta.has(r.cityKey)) meta.set(r.cityKey, { country: r.country, region: r.region });
  }
  const ref = new Map([...refs].map(([k, a]) => [k, Object.fromEntries(Object.entries(a).map(([an, l]) => [an, Math.exp(mean(l))]))]));
  const parse = raw => { try { return JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } } };

  function answers(iteration) {
    const dir = path.join(hcRoot, 'iterations', iteration), out = new Map();
    for (const t of readJson(path.join(dir, 'freeze.json')).tasks) {
      if (t.repeat !== 1 || !ref.has(t.cityKey)) continue;
      const f = path.join(dir, 'tasks', t.id, 'response.json');
      if (!fs.existsSync(f)) continue;
      const a = parse(fs.readFileSync(f, 'utf8'))?.anchors_usd;
      if (a && ANCHORS.every(k => Number.isFinite(a[k]) && a[k] > 0)) out.set(t.cityKey, Object.fromEntries(ANCHORS.map(k => [k, a[k]])));
    }
    return out;
  }
  // residual = log reference - log prediction
  const residual = (ans, k, a) => (ref.get(k)?.[a] && ans.get(k)?.[a] ? Math.log(ref.get(k)[a] / ans.get(k)[a]) : null);
  // Country-in-region offsets (k = 3) fitted on `train` cities of one lane; returns (cityKey, anchor) => log offset.
  function fitCountryInRegion(ans, train) {
    const g = {}, reg = {}, cty = {};
    for (const k of train) for (const a of corrected) {
      const r = residual(ans, k, a); if (r === null) continue;
      const { region, country } = meta.get(k);
      (g[a] ??= []).push(r); ((reg[a] ??= {})[region] ??= []).push(r); ((cty[a] ??= {})[country] ??= []).push(r);
    }
    return (k, a) => {
      if (!g[a]) return 0;
      const gm = mean(g[a]), { region, country } = meta.get(k);
      const rm = reg[a][region] ? mean(reg[a][region]) : gm, cr = cty[a][country];
      if (!cr) return rm;
      const w = cr.length / (cr.length + 3);
      return w * mean(cr) + (1 - w) * rm;
    };
  }
  const loss = (ans, k, off) => cityLoss(ref.get(k), Object.fromEntries(ANCHORS.map(a => [a, corrected.includes(a) ? ans.get(k)[a] * Math.exp(off(k, a)) : ans.get(k)[a]])), BUDGET_WEIGHTS).loss;
  return { table, corrected, ref, meta, answers, residual, fitCountryInRegion, loss };
}
