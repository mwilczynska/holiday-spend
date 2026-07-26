// Scores JSON produced by the city-cost-anchors-v4 prompt against retained
// ground truth, for the five test cities.
//
// Ground truth for measures 1-5 is the anchor sample the 99-city fit was built
// on, so this measures whether the prompt reproduces the dataset we already
// trust. Accommodation and activity ground truth comes from the v3 observation
// store and, for Copenhagen, its five accepted direct 4-star quotes.
//
// Error is reported as signed percentage and as log ratio, matching the
// methodology's metric choices: price error is multiplicative, so log ratio is
// symmetric for reciprocal misses.

import fs from 'node:fs';

const DIR = process.env.TEST_DIR;

// A measure may legitimately be reported in a currency other than the city's
// own — booking sites render prices in the viewer's currency, and the contract
// deliberately allows this rather than discarding the price. Ground truth is
// held in the city's currency, so a comparison must convert first. Scoring
// without this step reported a +2.4% error as -84.4%.
const FX = JSON.parse(
  fs.readFileSync('data/reference/fx/city_cost_fx_aud_2026-07-22.json', 'utf8')
).rates;

function toCityCurrency(value, from, to) {
  if (!from || from === to) return { value, converted: false };
  const a = FX[from]?.audPerUnit;
  const b = FX[to]?.audPerUnit;
  if (!a || !b) return { value: null, converted: false, unconvertible: `${from}->${to}` };
  return { value: (value * a) / b, converted: true, rate: `${from}->${to}` };
}
const CITIES = [
  { city: 'Lisbon', file: 'test-lisbon.json', currency: 'EUR' },
  { city: 'Copenhagen', file: 'test-copenhagen.json', currency: 'DKK' },
  { city: 'Hanoi', file: 'test-hanoi.json', currency: 'VND' },
  { city: 'Prague', file: 'test-prague.json', currency: 'CZK' },
  { city: 'Chiang Mai', file: 'test-chiang-mai.json', currency: 'THB' },
];

// Retained ground truth, local currency. Sources noted per block.
const TRUTH = {
  // Anchor samples used by the 99-city fit (phase-0a / phase-0e).
  Lisbon: {
    inexpensive_restaurant_meal_1p: 15, midrange_restaurant_meal_2p: 55,
    mcmeal_combo: 10, domestic_draft_beer_1: 3, cappuccino_1: 2.58,
    paid_attraction_adult_1: 27,
  },
  Copenhagen: {
    inexpensive_restaurant_meal_1p: 150, midrange_restaurant_meal_2p: 800,
    mcmeal_combo: 90, domestic_draft_beer_1: 60, cappuccino_1: 45.45,
    paid_attraction_adult_1: 140,
    // Median of five accepted direct-property 4-star quotes, shoulder season,
    // 90-day lead. The strongest accommodation ground truth in the project.
    hotel_4star_room_2p: 1417.43,
  },
  Hanoi: {
    inexpensive_restaurant_meal_1p: 50000, midrange_restaurant_meal_2p: 550000,
    mcmeal_combo: 114500, domestic_draft_beer_1: 28163.5, cappuccino_1: 48817.05,
    paid_attraction_adult_1: 100000,
  },
  Prague: {
    // Prague has no anchor-sample row; food/drink truth is the v3 store.
    inexpensive_restaurant_meal_1p: 230, midrange_restaurant_meal_2p: 1100,
    domestic_draft_beer_1: 65, cappuccino_1: 80.29,
    paid_attraction_adult_1: 450,
  },
  'Chiang Mai': {
    inexpensive_restaurant_meal_1p: 70, midrange_restaurant_meal_2p: 650,
    mcmeal_combo: 192.5, domestic_draft_beer_1: 80, cappuccino_1: 57.33,
  },
};

const ALL_MEASURES = [
  'inexpensive_restaurant_meal_1p', 'midrange_restaurant_meal_2p', 'mcmeal_combo',
  'domestic_draft_beer_1', 'cappuccino_1',
  'hostel_dorm_bed_1p', 'hostel_private_room_2p',
  'hotel_1star_room_2p', 'hotel_2star_room_2p', 'hotel_3star_room_2p', 'hotel_4star_room_2p',
  'paid_attraction_adult_1', 'half_day_group_activity_adult_1', 'full_day_premium_activity_adult_1',
];

// Ladder ratio envelope from the incumbent dataset's varying rungs (§7.7).
const ENVELOPE = {
  hostel_dorm_bed_1p: [0.20, 0.60],
  hostel_private_room_2p: [0.35, 0.75],
  hotel_1star_room_2p: [0.35, 0.70],
  hotel_2star_room_2p: [0.60, 0.85],
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const report = { cities: [], overall: {} };
const allErrors = [];

for (const spec of CITIES) {
  const path = `${DIR}/${spec.file}`;
  if (!fs.existsSync(path)) {
    report.cities.push({ city: spec.city, error: 'no output file' });
    continue;
  }
  let j;
  try {
    j = JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (err) {
    report.cities.push({ city: spec.city, error: 'invalid JSON: ' + err.message });
    continue;
  }

  const entry = { city: spec.city, schema: {}, directLookup: {}, measures: {}, gates: {} };

  // ---- schema conformance ----
  const m = j.measures ?? {};
  entry.schema = {
    currencyReported: j.localCurrency ?? null,
    currencyCorrect: j.localCurrency === spec.currency,
    allMeasureKeysPresent: ALL_MEASURES.every((k) => k in m),
    missingKeys: ALL_MEASURES.filter((k) => !(k in m)),
    hasDirectLookupBlock: Boolean(j.directLookup),
    // Fields deliberately removed from the contract; presence means the model
    // volunteered a self-assessment it was told not to.
    strayFields: ['overallConfidence', 'confidenceReason'].filter((f) => f in j)
      .concat(Object.entries(m).filter(([, v]) => v && 'ladderStep' in v).length ? ['ladderStep'] : []),
    statusCounts: ['found', 'not_found', 'class_absent'].reduce((a, s) => {
      a[s] = Object.values(m).filter((v) => v && v.status === s).length;
      return a;
    }, {}),
  };

  // ---- did B0 run? ----
  const dl = j.directLookup ?? {};
  entry.directLookup = {
    outcome: dl.outcome ?? null,
    attemptedSlugs: dl.attemptedSlugs ?? null,
    resolvedUrl: dl.resolvedUrl ?? null,
    contributors: dl.sourceQuality?.contributors ?? null,
    lastUpdate: dl.sourceQuality?.lastUpdate ?? null,
  };

  // ---- accuracy against ground truth ----
  const truth = TRUTH[spec.city] ?? {};
  for (const [measure, actual] of Object.entries(truth)) {
    const got = m[measure];
    if (!got || got.status !== 'found' || typeof got.value !== 'number') {
      entry.measures[measure] = { truth: actual, status: got?.status ?? 'absent-from-output', pctError: null };
      continue;
    }
    const conv = toCityCurrency(got.value, got.currency ?? spec.currency, spec.currency);
    if (conv.value === null) {
      entry.measures[measure] = {
        truth: actual, predicted: got.value, reportedCurrency: got.currency,
        status: 'unscoreable', reason: `no FX rate for ${conv.unconvertible}`, pctError: null,
      };
      continue;
    }
    const pct = ((conv.value - actual) / actual) * 100;
    const logRatio = Math.log(conv.value / actual);
    entry.measures[measure] = {
      truth: actual, predicted: got.value, reportedCurrency: got.currency ?? spec.currency,
      predictedInCityCurrency: conv.converted ? +conv.value.toFixed(2) : undefined,
      converted: conv.converted, basis: got.basis ?? null,
      pctError: +pct.toFixed(1), logRatio: +logRatio.toFixed(4),
      within10: Math.abs(pct) <= 10, within25: Math.abs(pct) <= 25,
    };
    allErrors.push({ city: spec.city, measure, pct, logRatio });
  }

  // ---- gate checks the pipeline would apply ----
  const val = (k) => (m[k]?.status === 'found' ? m[k].value : null);
  const ladder = ['hostel_dorm_bed_1p', 'hostel_private_room_2p', 'hotel_1star_room_2p',
    'hotel_2star_room_2p', 'hotel_3star_room_2p', 'hotel_4star_room_2p'].map((k) => [k, val(k)]);
  const present = ladder.filter(([, v]) => v !== null);
  let monotonic = true;
  for (let i = 1; i < present.length; i++) if (present[i][1] < present[i - 1][1]) monotonic = false;
  const three = val('hotel_3star_room_2p');
  const ratioFails = [];
  if (three) {
    for (const [k, [lo, hi]] of Object.entries(ENVELOPE)) {
      const v = val(k);
      if (v === null) continue;
      const r = v / three;
      if (r < lo || r > hi) ratioFails.push({ measure: k, ratio: +r.toFixed(3), envelope: [lo, hi] });
    }
  }
  const rangeFails = Object.entries(m)
    .filter(([, v]) => v && v.status === 'found' && typeof v.reportedLow === 'number' && typeof v.reportedHigh === 'number'
      && (v.value < v.reportedLow || v.value > v.reportedHigh))
    .map(([k, v]) => ({ measure: k, value: v.value, range: [v.reportedLow, v.reportedHigh] }));
  const absentNoEvidence = Object.entries(m)
    .filter(([, v]) => v && v.status === 'class_absent' && !(v.enumeratingSources?.length))
    .map(([k]) => k);

  // Passing the gates is necessary but NOT sufficient. A record with no
  // accommodation values passes every gate vacuously — there is nothing to be
  // non-monotonic or out of envelope. Usability is the real test: enough
  // classes priced to publish, including the 3-star anchor the derivation of
  // §9.2.1 needs to fill the rest.
  const pricedClasses = present.length;
  const gatesPass = monotonic && ratioFails.length === 0 && rangeFails.length === 0
    && absentNoEvidence.length === 0;
  const usable = gatesPass && pricedClasses >= 3 && three !== null;

  entry.gates = {
    monotonic,
    ladderAsReturned: Object.fromEntries(ladder),
    accommodationClassesPriced: pricedClasses,
    hasThreeStarAnchor: three !== null,
    ratioEnvelopeFailures: ratioFails,
    valueOutsideOwnRange: rangeFails,
    classAbsentWithoutEnumeratingSource: absentNoEvidence,
    gatesPass,
    vacuousPass: gatesPass && !usable,
    usable,
  };

  report.cities.push(entry);
}

// ---- overall ----
const foodDrink = allErrors.filter((e) => ['inexpensive_restaurant_meal_1p', 'midrange_restaurant_meal_2p',
  'mcmeal_combo', 'domestic_draft_beer_1', 'cappuccino_1'].includes(e.measure));
const other = allErrors.filter((e) => !foodDrink.includes(e));
const summarise = (xs) => xs.length ? {
  n: xs.length,
  medianAbsPctError: +median(xs.map((e) => Math.abs(e.pct))).toFixed(1),
  medianSignedLogError: +median(xs.map((e) => e.logRatio)).toFixed(4),
  exactMatches: xs.filter((e) => Math.abs(e.pct) < 0.5).length,
  within10pct: xs.filter((e) => Math.abs(e.pct) <= 10).length,
  within25pct: xs.filter((e) => Math.abs(e.pct) <= 25).length,
  worst: xs.slice().sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 3)
    .map((e) => `${e.city}/${e.measure} ${e.pct > 0 ? '+' : ''}${e.pct.toFixed(0)}%`),
} : { n: 0 };

report.overall = {
  foodAndDrink: summarise(foodDrink),
  accommodationAndActivities: summarise(other),
  citiesPassingGates: report.cities.filter((c) => c.gates?.gatesPass).length,
  citiesPassingVacuously: report.cities.filter((c) => c.gates?.vacuousPass).length,
  citiesUsable: report.cities.filter((c) => c.gates?.usable).length,
  citiesTotal: report.cities.length,
};

fs.writeFileSync(`${DIR}/scoring-report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
