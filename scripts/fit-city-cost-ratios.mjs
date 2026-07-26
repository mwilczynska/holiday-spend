// Fits and validates the v4 ratio models on real retrieved observations.
//
// Every relationship modelled here is a within-city ratio, so local currency
// cancels and no FX conversion is involved.
//
// Model forms, simplest first:
//   R0  target = k * anchor                       (1 param, global)
//   R1  target = k_band * anchor                  (one k per cost band)
//   R2  log(target) = a + b*log(anchor)           (power law, 2 params)
//
// Evaluation is leave-one-city-out (primary, since n is small) plus a fixed
// deterministic 25% holdout (secondary, as a clean out-of-sample check).

import fs from 'node:fs';

const OBS_MANIFEST = 'data/reference/city_cost_collection_batches.json';
const CSV = 'data/reference/city_costs_app_aud.csv';

// ---------- load observations ----------
const manifest = JSON.parse(fs.readFileSync(OBS_MANIFEST, 'utf8'));
const rows = [];
for (const batch of manifest.batches)
  for (const file of batch.observationFiles)
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean))
      rows.push(JSON.parse(line));

const accepted = rows.filter((r) => r.reviewerStatus === 'accepted');
const byCity = {};
for (const r of accepted) {
  byCity[r.city] ??= { city: r.city, region: r.region, currency: r.currency, m: {} };
  byCity[r.city].m[r.measure] ??= r.priceAmount;
}

// Merge in the expanded Numbeo sample. It carries mcmeal_combo, which the
// Phase 6 store does not, and adds cities the store never covered. Where a city
// appears in both, the store value is kept and only missing measures are filled,
// so no source silently overwrites another.
const EXPANDED = 'data/reference/dry-run/phase-0d-numbeo-expanded-sample.json';
// Stage 1 expansion. Same schema, drawn band-stratified from the production
// dataset rows not yet pooled. Its purpose is mcmeal_combo density.
const STAGE1 = 'data/reference/dry-run/phase-0e-stage1-numbeo-sample.json';
// Stage 2 attempts every remaining unpooled production city, completing the
// census attempt. See the artifact's findings for the contributor floor.
const STAGE2 = 'data/reference/dry-run/phase-0f-stage2-numbeo-sample.json';
const FIELD_TO_MEASURE = {
  inexp: 'inexpensive_restaurant_meal_1p',
  midrange: 'midrange_restaurant_meal_2p',
  mcmeal: 'mcmeal_combo',
  beer: 'domestic_draft_beer_1',
  cappuccino: 'cappuccino_1',
};
for (const file of [EXPANDED, STAGE1, STAGE2]) {
  for (const row of JSON.parse(fs.readFileSync(file, 'utf8')).cities) {
    byCity[row.city] ??= { city: row.city, region: row.region, currency: row.currency, m: {} };
    byCity[row.city].lowConfidence ||= row.lowConfidence === true;
    // A substituted city is banded on the production row it stands in for.
    if (row.bandProxyCity) byCity[row.city].bandProxyCity = row.bandProxyCity;
    for (const [field, measure] of Object.entries(FIELD_TO_MEASURE)) {
      if (row[field] !== undefined) byCity[row.city].m[measure] ??= row[field];
    }
  }
}

// A city qualifies for a relationship if it has both measures of that pair.
// Requiring all measures everywhere would discard usable rows.
const cities = Object.values(byCity).sort((a, b) => a.city.localeCompare(b.city));

// ---------- cost bands from the AUD dataset ----------
// Region is not a cost level: Europe spans Sofia and Copenhagen. Band on the
// currency-normalised AUD food tier from the existing 121-city dataset instead.
const [header, ...csvRows] = fs.readFileSync(CSV, 'utf8').trim().split(/\r?\n/);
const H = header.split(',');
const audByCity = {};
for (const line of csvRows) {
  const c = line.split(',');
  audByCity[c[H.indexOf('city')]] = Number(c[H.indexOf('food_mid_range')]);
}
// Band thresholds are terciles of the whole 121-city production dataset, not of
// the pooled sample. Using the sample would make the cuts move every time a city
// is added, so coefficients from different stages would not be comparable.
const allAud = Object.values(audByCity)
  .filter(Number.isFinite)
  .sort((a, b) => a - b);
const t1 = allAud[Math.floor(allAud.length / 3)];
const t2 = allAud[Math.floor((2 * allAud.length) / 3)];
const unbanded = [];
for (const c of cities) {
  const aud = audByCity[c.bandProxyCity ?? c.city];
  if (!Number.isFinite(aud)) unbanded.push(c.city);
  // No silent default: a city with no production row is excluded from banded
  // models rather than being dropped into 'mid', which would bias that band.
  c.band = !Number.isFinite(aud) ? null : aud <= t1 ? 'low' : aud <= t2 ? 'mid' : 'high';
  c.aud = aud;
}

// ---------- model fitting ----------
const gm = (xs) => Math.exp(xs.reduce((s, x) => s + Math.log(x), 0) / xs.length);

function fitR0(train, A, T) {
  return { k: gm(train.map((c) => c.m[T] / c.m[A])) };
}
function fitR1(train, A, T) {
  const global = gm(train.map((c) => c.m[T] / c.m[A]));
  const byBand = {};
  for (const band of ['low', 'mid', 'high']) {
    const g = train.filter((c) => c.band === band);
    byBand[band] = g.length >= 3 ? gm(g.map((c) => c.m[T] / c.m[A])) : global;
  }
  return { byBand, global };
}
function fitR2(train, A, T) {
  const x = train.map((c) => Math.log(c.m[A]));
  const y = train.map((c) => Math.log(c.m[T]));
  const mx = x.reduce((s, v) => s + v, 0) / x.length;
  const my = y.reduce((s, v) => s + v, 0) / y.length;
  let cov = 0, varx = 0;
  for (let i = 0; i < x.length; i++) { cov += (x[i] - mx) * (y[i] - my); varx += (x[i] - mx) ** 2; }
  const b = varx === 0 ? 0 : cov / varx;
  return { a: my - b * mx, b };
}
// R3: a separate log-log line per band. Only fittable now that Stage 1 has
// lifted the per-band counts; a band under MIN_BAND_N falls back to the global
// line rather than fitting two parameters on a handful of cities.
const MIN_BAND_N = 8;
function fitR3(train, A, T) {
  const global = fitR2(train, A, T);
  const byBand = {};
  for (const band of ['low', 'mid', 'high']) {
    const g = train.filter((c) => c.band === band);
    byBand[band] = g.length >= MIN_BAND_N ? fitR2(g, A, T) : global;
  }
  return { byBand, global };
}

const predR0 = (f, c, A) => f.k * c.m[A];
const predR1 = (f, c, A) => (f.byBand[c.band] ?? f.global) * c.m[A];
const predR2 = (f, c, A) => Math.exp(f.a + f.b * Math.log(c.m[A]));
const predR3 = (f, c, A) => {
  const line = f.byBand[c.band] ?? f.global;
  return Math.exp(line.a + line.b * Math.log(c.m[A]));
};

const MODELS = [
  { name: 'R0', params: 1, fit: fitR0, pred: predR0 },
  { name: 'R1', params: 3, fit: fitR1, pred: predR1 },
  { name: 'R2', params: 2, fit: fitR2, pred: predR2 },
  { name: 'R3', params: 6, fit: fitR3, pred: predR3 },
];

// ---------- metrics ----------
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
function score(preds) {
  const ape = preds.map((p) => Math.abs(p.pred - p.actual) / p.actual * 100);
  const sle = preds.map((p) => Math.log(p.pred / p.actual));
  return {
    medianApePct: +median(ape).toFixed(2),
    medianSignedLogError: +median(sle).toFixed(4),
    p90ApePct: +[...ape].sort((a, b) => a - b)[Math.floor(0.9 * (ape.length - 1))].toFixed(2),
    n: preds.length,
  };
}

const RELATIONS = [
  { key: 'midrange~inexpensive', A: 'inexpensive_restaurant_meal_1p', T: 'midrange_restaurant_meal_2p',
    proxyFor: 'premium_restaurant_meal_2p ~ midrange_restaurant_meal_2p' },
  { key: 'mcmeal~inexpensive', A: 'inexpensive_restaurant_meal_1p', T: 'mcmeal_combo',
    proxyFor: 'street_food_meal_1p ~ mcmeal_combo (the band-separation question)' },
  { key: 'cappuccino~beer', A: 'domestic_draft_beer_1', T: 'cappuccino_1',
    proxyFor: 'cocktail_1 and wine_glass_1 ~ domestic_draft_beer_1' },
  { key: 'attraction~inexpensive', A: 'inexpensive_restaurant_meal_1p', T: 'paid_attraction_adult_1',
    proxyFor: 'half_day and full_day activity ~ paid_attraction_adult_1' },
];

const report = {
  schemaVersion: 'city-cost-v4-ratio-fit-v2',
  generatedFrom: {
    observations: OBS_MANIFEST,
    costBandSource: CSV,
    anchorSamples: [EXPANDED, STAGE1, STAGE2],
  },
  cityCountTotal: cities.length,
  lowConfidenceCityCount: cities.filter((c) => c.lowConfidence).length,
  unbandedExcluded: unbanded,
  bandThresholdsAud: { lowMax: +t1.toFixed(2), midMax: +t2.toFixed(2), basis: 'terciles of all 121 production rows' },
  relations: [],
  sensitivityExcludingLowConfidence: [],
};

function runRelation(rel, universe) {
  // Per-relationship subset: cities carrying both measures of this pair and a
  // band, so every model form is compared on exactly the same rows.
  const pool = universe.filter(
    (c) => c.m[rel.A] !== undefined && c.m[rel.T] !== undefined && c.band !== null
  );
  // Deterministic 25% holdout: every 4th city by alphabetical order.
  const holdout = pool.filter((_, i) => i % 4 === 3);
  const trainFixed = pool.filter((_, i) => i % 4 !== 3);

  const entry = {
    ...rel, n: pool.length,
    bands: { low: pool.filter(c=>c.band==='low').length, mid: pool.filter(c=>c.band==='mid').length, high: pool.filter(c=>c.band==='high').length },
    holdoutCities: holdout.map((c) => c.city),
    observedRatio: {}, leaveOneOut: {}, fixedHoldout: {},
  };
  const cities_ = pool;

  const ratios = cities_.map((c) => c.m[rel.T] / c.m[rel.A]);
  entry.observedRatio = {
    min: +Math.min(...ratios).toFixed(3),
    median: +median(ratios).toFixed(3),
    max: +Math.max(...ratios).toFixed(3),
    geometricMean: +gm(ratios).toFixed(3),
    spreadFactor: +(Math.max(...ratios) / Math.min(...ratios)).toFixed(2),
    byBand: Object.fromEntries(['low', 'mid', 'high'].map((b) => {
      const g = cities_.filter((c) => c.band === b);
      return [b, g.length ? +gm(g.map((c) => c.m[rel.T] / c.m[rel.A])).toFixed(3) : null];
    })),
  };

  for (const model of MODELS) {
    // leave-one-city-out
    const loo = cities_.map((held) => {
      const train = cities_.filter((c) => c.city !== held.city);
      return { city: held.city, pred: model.pred(model.fit(train, rel.A, rel.T), held, rel.A), actual: held.m[rel.T] };
    });
    entry.leaveOneOut[model.name] = { params: model.params, ...score(loo) };

    // fixed 25% holdout
    const f = model.fit(trainFixed, rel.A, rel.T);
    const preds = holdout.map((c) => ({ city: c.city, pred: model.pred(f, c, rel.A), actual: c.m[rel.T] }));
    entry.fixedHoldout[model.name] = { params: model.params, ...score(preds) };
  }

  // Fitted coefficients on the FULL pool, for publication as the shipped equation.
  entry.fittedFullSample = Object.fromEntries(
    MODELS.map((m) => [m.name, m.fit(cities_, rel.A, rel.T)])
  );

  // Selection rule: escalate beyond R0 only when leave-one-out AND the fixed
  // holdout both prefer the richer model. A model winning one scheme alone is
  // the n=29 trap and is not adopted.
  // A richer model qualifies only if BOTH schemes rank it better than R0. That
  // is the escalation test. Asking the two schemes to name the identical model
  // is too strict: R1 and R3 are variants of one decision (band or not), and
  // when both schemes beat R0 with different banded forms they are agreeing on
  // the decision that matters while disagreeing on noise.
  // Beating R0 is not enough: the margin must be MATERIAL. At n=97 the
  // midrange relationship had R2 ahead of R0 by 0.02 points on leave-one-out,
  // which is noise, and a bare-inequality test escalated to a 2-parameter
  // model on it. Require a 10% relative improvement on both schemes.
  const MATERIAL = 0.9;
  const base = { loo: entry.leaveOneOut.R0.medianApePct, ho: entry.fixedHoldout.R0.medianApePct };
  const qualified = MODELS.filter(
    (m) =>
      m.name !== 'R0' &&
      entry.leaveOneOut[m.name].medianApePct < base.loo * MATERIAL &&
      entry.fixedHoldout[m.name].medianApePct < base.ho * MATERIAL
  );
  // Among qualifiers, take the fewest parameters within 10% of the best
  // leave-one-out score, so a 6-parameter model is not adopted over a
  // 3-parameter one for a fraction of a point.
  let selected = 'R0';
  if (qualified.length) {
    const bestLoo = Math.min(...qualified.map((m) => entry.leaveOneOut[m.name].medianApePct));
    selected = qualified
      .filter((m) => entry.leaveOneOut[m.name].medianApePct <= bestLoo * 1.1)
      .sort((a, b) => a.params - b.params)[0].name;
  }
  entry.selection = {
    bestByLoo: Object.entries(entry.leaveOneOut).sort((a, b) => a[1].medianApePct - b[1].medianApePct)[0][0],
    bestByHoldout: Object.entries(entry.fixedHoldout).sort((a, b) => a[1].medianApePct - b[1].medianApePct)[0][0],
    qualifiedOverR0: qualified.map((m) => m.name),
    selected,
    rule: 'A richer model must beat R0 by at least 10% relative on BOTH leave-one-out and the fixed holdout to qualify; among qualifiers take the fewest parameters within 10% of the best leave-one-out score.',
    materialityThreshold: MATERIAL,
  };
  return entry;
}

const banded = cities.filter((c) => c.band !== null);
for (const rel of RELATIONS) {
  report.relations.push(runRelation(rel, banded));
  // Sensitivity: do thin-source cities move the answer? Reported, not assumed.
  const strict = banded.filter((c) => !c.lowConfidence);
  const s = runRelation(rel, strict);
  report.sensitivityExcludingLowConfidence.push({
    key: rel.key,
    n: s.n,
    selected: s.selection.selected,
    leaveOneOut: s.leaveOneOut,
    fittedFullSample: s.fittedFullSample,
  });
}

fs.mkdirSync('data/reference/dry-run', { recursive: true });
fs.writeFileSync('data/reference/dry-run/phase-0c-ratio-model-fit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
