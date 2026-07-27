#!/usr/bin/env node
// Stage A analysis for city-cost methodology v4 accommodation.
//
// Answers three questions from already-captured stage1 evidence, with no new fetches:
//   Q1 depth   - does a first-page read of N properties reproduce the full-inventory median?
//   Q2 ratio   - how stable is the star-class ratio across cities, platforms and estimators?
//   Q3 headline- how far is the platform headline from the property-list median?
//
// Usage: node scripts/analyze-accommodation-stage1.mjs [--json]

import fs from 'node:fs';
import path from 'node:path';

const STAGE1 = path.join('data', 'reference', 'dry-run', 'stage1');
const OUT = path.join('data', 'reference', 'dry-run', 'phase-0g-stage1-analysis.json');

const read = (f) => JSON.parse(fs.readFileSync(path.join(STAGE1, f), 'utf8'));

const median = (xs) => {
  if (!xs || xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (x, d = 3) => (x == null ? null : Number(x.toFixed(d)));

// ---------------------------------------------------------------- Q1: depth
// The Copenhagen 4-star capture is stored in page order under the default sort,
// so median(prices.slice(0, n)) is exactly what a collector reading only the
// first n properties would report. This is the Haiku-feasibility test.
function depthCurve(prices, label) {
  const full = median(prices);
  const rows = [];
  for (const n of [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, prices.length]) {
    if (n > prices.length) continue;
    const m = median(prices.slice(0, n));
    rows.push({ n, median: round(m, 2), errPct: round(((m - full) / full) * 100, 1) });
  }
  return { label, propertyCount: prices.length, fullMedian: round(full, 2), curve: rows };
}

// Sensitivity of the first-n median to WHICH n properties are read: the default
// sort is commercial, so a collector that reads a different slice sees a
// different number. Sliding windows measure that exposure directly.
function windowSpread(prices, size) {
  const meds = [];
  for (let i = 0; i + size <= prices.length; i += 1) meds.push(median(prices.slice(i, i + size)));
  const full = median(prices);
  return {
    windowSize: size,
    windows: meds.length,
    minMedian: round(Math.min(...meds), 2),
    maxMedian: round(Math.max(...meds), 2),
    spreadX: round(Math.max(...meds) / Math.min(...meds), 3),
    worstErrPct: round(Math.max(...meds.map((m) => Math.abs((m - full) / full))) * 100, 1),
  };
}

// --------------------------------------------------------------- Q2: ratios
function ratioRows() {
  const rows = [];
  const push = (city, platform, basis, s4, s3, s2) => {
    if (s4 && s3) rows.push({ city, platform, basis, pair: '4/3', ratio: round(s4 / s3) });
    if (s3 && s2) rows.push({ city, platform, basis, pair: '3/2', ratio: round(s3 / s2) });
  };

  const cph4 = read('copenhagen-booking-4star.json');
  const cph3 = read('copenhagen-booking-3star.json');
  push('Copenhagen', 'booking', 'full-list, date-controlled',
    median(cph4.prices), median(cph3.prices), null);

  for (const f of ['lisbon-firstpage.json', 'bangkok-firstpage.json']) {
    const j = read(f);
    push(j.city, 'booking', 'first-page list median',
      j.booking.s4?.listMedian, j.booking.s3?.listMedian, j.booking.s2?.listMedian);
    push(j.city, 'booking', 'headline average',
      j.booking.s4?.headline ?? j.booking.s4?.headlineGeneral,
      j.booking.s3?.headline ?? j.booking.s3?.headlineGeneral, null);
    if (j.trip?.s4?.fromMedian && j.trip?.s3?.fromMedian) {
      push(j.city, 'trip', 'from-price median', j.trip.s4.fromMedian, j.trip.s3.fromMedian, null);
    }
  }

  const w2 = read('wave2-firstpage.json');
  for (const [city, c] of Object.entries(w2.cities)) {
    push(city, 'booking', 'first-page list median', c.listMedians.s4, c.listMedians.s3, c.listMedians.s2);
    push(city, 'booking', 'headline average', c.headlines?.s4, c.headlines?.s3, null);
  }
  return rows;
}

// ------------------------------------------------------------- Q3: headline
function headlineGap() {
  const rows = [];
  const add = (city, star, headline, listMedian) => {
    if (headline && listMedian) {
      rows.push({ city, star, headline, listMedian: round(listMedian, 2), headlineOverListX: round(headline / listMedian) });
    }
  };
  for (const f of ['lisbon-firstpage.json', 'bangkok-firstpage.json']) {
    const j = read(f);
    for (const s of ['s4', 's3']) {
      add(j.city, s, j.booking[s]?.headline ?? j.booking[s]?.headlineGeneral, j.booking[s]?.listMedian);
    }
  }
  const w2 = read('wave2-firstpage.json');
  for (const [city, c] of Object.entries(w2.cities)) {
    for (const s of ['s4', 's3']) add(city, s, c.headlines?.[s], c.listMedians?.[s]);
  }
  return rows;
}

// ------------------------------------------------------------------- report
const cph4 = read('copenhagen-booking-4star.json');
const cph3 = read('copenhagen-booking-3star.json');

const result = {
  schemaVersion: 'city-cost-v4-stage1-analysis-v1',
  generatedAt: new Date().toISOString(),
  q1_depth: {
    note: 'Prices are stored in page order under the platform default sort, so the first-n median is exactly what a shallow collector would report.',
    curves: [depthCurve(cph4.prices, 'Copenhagen 4-star, booking, date-controlled'),
             depthCurve(cph3.prices, 'Copenhagen 3-star, booking, date-controlled (25 of 44 retrievable)')],
    windowSpread: [windowSpread(cph4.prices, 10), windowSpread(cph4.prices, 20), windowSpread(cph4.prices, 30)],
  },
  q2_ratios: ratioRows(),
  q3_headline: headlineGap(),
};

// Ratio dispersion by pair and by estimator basis.
const byPair = {};
for (const r of result.q2_ratios) {
  const k = `${r.pair}|${r.basis}`;
  (byPair[k] ??= []).push(r.ratio);
}
result.q2_summary = Object.entries(byPair).map(([k, v]) => {
  const [pair, basis] = k.split('|');
  return { pair, basis, n: v.length, median: round(median(v)), min: round(Math.min(...v)), max: round(Math.max(...v)), spreadX: round(Math.max(...v) / Math.min(...v)) };
}).sort((a, b) => a.pair.localeCompare(b.pair) || a.basis.localeCompare(b.basis));

fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('Q1  DEPTH — first-n median vs full-inventory median\n');
  for (const c of result.q1_depth.curves) {
    console.log(`  ${c.label}  (n=${c.propertyCount}, full median ${c.fullMedian})`);
    console.log(`    ${c.curve.map((r) => `n=${r.n}:${r.errPct > 0 ? '+' : ''}${r.errPct}%`).join('  ')}\n`);
  }
  console.log('  Which 10 you read matters this much:');
  for (const w of result.q1_depth.windowSpread) {
    console.log(`    window ${w.windowSize}: medians ${w.minMedian}-${w.maxMedian} (${w.spreadX}x), worst error ${w.worstErrPct}%`);
  }
  console.log('\nQ2  RATIO STABILITY by estimator\n');
  for (const s of result.q2_summary) {
    console.log(`  ${s.pair}  ${s.basis.padEnd(26)} n=${s.n}  median ${s.median}  range ${s.min}-${s.max}  spread ${s.spreadX}x`);
  }
  console.log('\nQ3  HEADLINE vs LIST MEDIAN\n');
  for (const h of result.q3_headline) {
    console.log(`  ${h.city.padEnd(12)} ${h.star}  headline ${String(h.headline).padStart(5)}  list median ${String(h.listMedian).padStart(7)}  = ${h.headlineOverListX}x`);
  }
  console.log(`\nwrote ${OUT}`);
}
