// Shared helpers for the hill-climb program. See research/city-cost-accuracy/hillclimb/PROGRAM.md.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const hcRoot = path.join(repo, 'research/city-cost-accuracy/hillclimb');
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export const readJsonl = file => fs.existsSync(file)
  ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];

export const ANCHORS = ['beer', 'coffee', 'inexp_meal_1p', 'midrange_meal_2p', 'cocktail', 'wine_glass',
  'hostel_dorm_1p', 'hostel_private_2p', 'hotel_1star_2p', 'hotel_3star_2p'];

// Budget weights approximate each anchor's share of a mid-tier two-person day under the v1 formulas
// (3-star room, mid-range food, moderate drinks). They make the headline loss track the money a traveller
// actually spends rather than treating a coffee error like a hotel error. Fixed for the whole program.
export const BUDGET_WEIGHTS = { hotel_3star_2p: 0.40, hotel_1star_2p: 0.08, hostel_private_2p: 0.05,
  hostel_dorm_1p: 0.03, midrange_meal_2p: 0.16, inexp_meal_1p: 0.12, beer: 0.06, cocktail: 0.04,
  wine_glass: 0.03, coffee: 0.03 };

export const normalizeCity = name => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim(); // "Bali (Ubud)" -> "bali ubud", distinct from "Bali (Kuta)"

// Deterministic split. Test cities are sealed: only `score.mjs --test` reads them, and every read is logged.
export const splitOf = cityKey => (parseInt(sha256(`hillclimb-split-v1|${cityKey}`).slice(0, 8), 16) % 10) < 3
  ? 'test' : 'dev';

// HC_PANEL selects an alternate composed panel (e.g. references-sensitivity.jsonl) for sensitivity scoring.
export const panelFile = () => path.join(hcRoot, 'panel', process.env.HC_PANEL || 'references.jsonl');
export function loadPanel() {
  const file = panelFile();
  return readJsonl(file);
}

// One loss per city: weighted mean |ln(pred/ref)| over anchors that have both a reference and a prediction.
// A prediction missing for a referenced anchor costs ln(4), the same penalty the earlier program froze.
export const MISSING_PENALTY = Math.log(4);
export function cityLoss(refs, preds, weights = null) {
  let num = 0, den = 0;
  const perAnchor = {};
  for (const [anchor, ref] of Object.entries(refs)) {
    const w = weights ? (weights[anchor] ?? 0) : 1;
    if (!(w > 0)) continue;
    const p = preds?.[anchor];
    const loss = Number.isFinite(p) && p > 0 ? Math.abs(Math.log(p / ref)) : MISSING_PENALTY;
    perAnchor[anchor] = { ref, pred: p ?? null, logRatio: Number.isFinite(p) && p > 0 ? Math.log(p / ref) : null, loss };
    num += w * loss; den += w;
  }
  return den ? { loss: num / den, perAnchor } : null;
}

export const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
export function quantile(xs, q) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), i = (s.length - 1) * q, lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
}

// Paired city bootstrap of (baseline - candidate) loss; positive means the candidate is better.
export function pairedBootstrap(baseline, candidate, iterations = 10000, seed = 14102026) {
  const names = Object.keys(baseline).filter(n => n in candidate).sort();
  if (names.length < 2) throw Error('Need at least two paired cities');
  let state = seed >>> 0;
  const rand = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  const d = names.map(n => baseline[n] - candidate[n]);
  const samples = Array.from({ length: iterations }, () => mean(names.map(() => d[Math.floor(rand() * d.length)])));
  return { cities: names.length, meanImprovement: mean(d), lower95: quantile(samples, 0.025),
    upper95: quantile(samples, 0.975), wins: d.filter(x => x > 0).length, losses: d.filter(x => x < 0).length };
}
