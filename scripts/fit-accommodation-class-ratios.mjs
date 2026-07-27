#!/usr/bin/env node
// Stage D: fit the accommodation star-class ratio ladder.
//
// The product question is "measure one class cheaply, model the rest". So the
// anchor is the 3-star class median and the targets are 4-star and 2-star.
// Every relationship is a within-city ratio, so currency and city price level
// cancel and no FX is involved.
//
// Models, matching the convention already used by fit-city-cost-ratios.mjs:
//   R0  T = k . A                 1 parameter, one global ratio
//   R1  T = k_band . A            3 parameters, band cut on the anchor level
//
// Evaluation is leave-one-city-out plus a deterministic 25% holdout. A more
// complex form is adopted only when BOTH agree, which is the rule Phase 0d
// adopted after model selection proved unstable at n=29.

import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join('data', 'reference', 'dry-run', 'stage1');
const OUT = path.join('data', 'reference', 'dry-run', 'phase-0h-accommodation-class-ratios.json');
const MIN_BAND_N = 4; // relaxed from the food model's 8: only 17 cities exist here

const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (x, d = 4) => (x == null || Number.isNaN(x) ? null : Number(x.toFixed(d)));

// A room night below this cannot be a real two-adult booking and is treated as
// a display defect rather than evidence. Nairobi returned 2.33 and 9.29 USD.
const IMPLAUSIBLE_FLOOR = 12;
const clean = (xs) => (xs ?? []).filter((x) => typeof x === 'number' && x >= IMPLAUSIBLE_FLOOR);

// ------------------------------------------------------------ assemble cities
function loadCities() {
  const out = {};
  const put = (city, s4, s3, s2, hostel, source) => {
    const c4 = clean(s4); const c3 = clean(s3); const c2 = clean(s2); const ch = clean(hostel);
    if (c3.length < 4) return; // no usable anchor
    const prev = out[city];
    out[city] = {
      source,
      n: { s4: c4.length, s3: c3.length, s2: c2.length, hostel: ch.length },
      med: { s4: median(c4), s3: median(c3), s2: median(c2), hostel: median(ch) ?? prev?.med?.hostel ?? null },
    };
  };

  const b = read('stage-b-class-pages.json');
  for (const [city, c] of Object.entries(b.cities)) {
    put(city, c.prices.s4, c.prices.s3, c.prices.s2, c.prices.hostel, 'stage-b class page');
  }
  const hostelOf = (city) => b.cities[city]?.prices?.hostel;
  for (const f of ['lisbon-firstpage.json', 'bangkok-firstpage.json']) {
    const j = read(f);
    put(j.city, j.booking.s4?.prices, j.booking.s3?.prices, j.booking.s2?.prices, hostelOf(j.city), 'stage-a class page');
  }
  const w2 = read('wave2-firstpage.json');
  for (const [city, c] of Object.entries(w2.cities)) {
    put(city, c.prices.s4, c.prices.s3, c.prices.s2, hostelOf(city), 'stage-a class page');
  }
  // Copenhagen is the only full-inventory, date-controlled read. It is held
  // out of the fit and used as the independent level check, because its
  // estimator differs from every other city's.
  const cph = {
    s4: median(read('copenhagen-booking-4star.json').prices),
    s3: median(read('copenhagen-booking-3star.json').prices),
  };
  return { cities: out, copenhagenFullInventory: cph };
}

// ------------------------------------------------------------------- modelling
const ape = (pred, act) => Math.abs(pred - act) / act;

function fitR0(rows) { return median(rows.map((r) => r.ratio)); }

function bandOf(anchor, cuts) { return anchor < cuts[0] ? 'low' : anchor < cuts[1] ? 'mid' : 'high'; }

function fitR1(rows, cuts) {
  const k = {};
  for (const band of ['low', 'mid', 'high']) {
    const sub = rows.filter((r) => bandOf(r.anchor, cuts) === band);
    // Fall back to the global ratio when a band is too thin to estimate.
    k[band] = sub.length >= MIN_BAND_N ? median(sub.map((r) => r.ratio)) : fitR0(rows);
    k[`${band}_n`] = sub.length;
  }
  return k;
}

function evaluate(rows, cuts) {
  const loo = { R0: [], R1: [] };
  for (let i = 0; i < rows.length; i += 1) {
    const train = rows.filter((_, j) => j !== i);
    const t = rows[i];
    loo.R0.push(ape(fitR0(train) * t.anchor, t.target));
    loo.R1.push(ape(fitR1(train, cuts)[bandOf(t.anchor, cuts)] * t.anchor, t.target));
  }
  // Deterministic holdout: every 4th city by name order.
  const sorted = [...rows].sort((a, b) => a.city.localeCompare(b.city));
  const hold = sorted.filter((_, i) => i % 4 === 1);
  const train = sorted.filter((_, i) => i % 4 !== 1);
  const ho = { R0: [], R1: [] };
  for (const t of hold) {
    ho.R0.push(ape(fitR0(train) * t.anchor, t.target));
    ho.R1.push(ape(fitR1(train, cuts)[bandOf(t.anchor, cuts)] * t.anchor, t.target));
  }
  const pct = (xs) => round(median(xs) * 100, 1);
  return {
    n: rows.length,
    holdoutCities: hold.map((h) => h.city),
    R0: { loo: pct(loo.R0), holdout: pct(ho.R0) },
    R1: { loo: pct(loo.R1), holdout: pct(ho.R1) },
  };
}

function relation(cities, targetKey, anchorKey, label) {
  const rows = Object.entries(cities)
    .filter(([, c]) => c.med[targetKey] && c.med[anchorKey])
    .map(([city, c]) => ({ city, anchor: c.med[anchorKey], target: c.med[targetKey], ratio: c.med[targetKey] / c.med[anchorKey] }));
  if (rows.length < 6) return { label, n: rows.length, verdict: 'too few cities to fit' };

  const anchors = rows.map((r) => r.anchor).sort((a, b) => a - b);
  const cuts = [anchors[Math.floor(anchors.length / 3)], anchors[Math.floor((2 * anchors.length) / 3)]];
  const ratios = rows.map((r) => r.ratio).sort((a, b) => a - b);
  const perf = evaluate(rows, cuts);

  // Adopt R1 only when leave-one-out AND holdout both improve materially (10%).
  const better = (a, b) => a.loo < b.loo * 0.9 && a.holdout < b.holdout * 0.9;
  const selected = better(perf.R1, perf.R0) ? 'R1' : 'R0';

  return {
    label,
    n: rows.length,
    ratio: { median: round(fitR0(rows)), min: round(ratios[0]), max: round(ratios.at(-1)), spreadX: round(ratios.at(-1) / ratios[0], 2),
             iqr: [round(ratios[Math.floor(ratios.length * 0.25)]), round(ratios[Math.floor(ratios.length * 0.75)])] },
    bandCuts: cuts.map((c) => round(c, 2)),
    R1coefficients: fitR1(rows, cuts),
    performance: perf,
    selected,
    perCity: rows.sort((a, b) => a.ratio - b.ratio).map((r) => ({ city: r.city, anchor: round(r.anchor, 2), target: round(r.target, 2), ratio: round(r.ratio, 3) })),
  };
}

// ---------------------------------------------------------------------- run
const { cities, copenhagenFullInventory } = loadCities();
const result = {
  schemaVersion: 'city-cost-v4-accommodation-ratios-v1',
  generatedAt: new Date().toISOString(),
  estimator: 'median of the first-page booking.com star-class property list, signed out, undated, implausible values below USD 12 dropped',
  cityCount: Object.keys(cities).length,
  relations: [
    relation(cities, 's4', 's3', 'hotel_4star / hotel_3star'),
    relation(cities, 's2', 's3', 'hotel_2star / hotel_3star'),
    relation(cities, 'hostel', 's3', 'hostel_blended / hotel_3star'),
    relation(cities, 'hostel', 's2', 'hostel_blended / hotel_2star'),
  ],
  hostelCaveat: {
    unit: 'unknown and city-dependent: the hostels page never states dorm bed versus private room, and Dubai names bed-space units at USD 14-17 while Lisbon lists USD 67-109',
    whyTheRatioIsStillValid: 'a property carries the same price on the hostels page and on whichever star-class page also lists it, verified across five cities and eight properties, so both sides of the ratio share one unit even though that unit is unnamed',
    notSeparable: 'this fits ONE blended hostel measure. accom_shared_hostel_dorm and accom_hostel_private_room cannot be separated on this channel and must not both be derived from it.',
  },
  independentCheck: {
    city: 'Copenhagen',
    basis: 'full-inventory, date-controlled browser read (108 four-star, 25 three-star), AUD',
    s4: round(copenhagenFullInventory.s4, 2),
    s3: round(copenhagenFullInventory.s3, 2),
    ratio: round(copenhagenFullInventory.s4 / copenhagenFullInventory.s3, 3),
    note: 'Held out of the fit because its estimator is full-inventory rather than first-page. Used to ask whether the ladder fitted on a biased estimator transfers to an unbiased one.',
  },
  incumbentComparison: { assertedFourOverThree: 1.8, source: 'docs/prompts/llm_prompt_new_cities_1.md, applied to all 121 rows of city_costs_app_aud.csv' },
};

fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

for (const r of result.relations) {
  console.log(`\n=== ${r.label}  (n=${r.n}) ===`);
  if (r.verdict) { console.log(`  ${r.verdict}`); continue; }
  console.log(`  ratio  median ${r.ratio.median}   IQR ${r.ratio.iqr[0]}-${r.ratio.iqr[1]}   full range ${r.ratio.min}-${r.ratio.max}  (${r.ratio.spreadX}x)`);
  console.log(`  R0  LOO ${r.performance.R0.loo}%  holdout ${r.performance.R0.holdout}%`);
  console.log(`  R1  LOO ${r.performance.R1.loo}%  holdout ${r.performance.R1.holdout}%   bands n=${r.R1coefficients.low_n}/${r.R1coefficients.mid_n}/${r.R1coefficients.high_n}`);
  console.log(`  selected: ${r.selected}`);
  console.log(`  per city: ${r.perCity.map((c) => `${c.city} ${c.ratio}`).join('  ')}`);
}
const ic = result.independentCheck;
console.log(`\nIndependent check — Copenhagen full inventory: 4star ${ic.s4} / 3star ${ic.s3} = ${ic.ratio}`);
console.log(`Incumbent dataset asserts ${result.incumbentComparison.assertedFourOverThree} for all 121 cities.`);
console.log(`\nwrote ${OUT}`);
