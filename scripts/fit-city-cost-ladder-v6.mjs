// Fits the v6 accommodation ladder from evidence already collected by the v5
// experiment programme, and writes data/reference/v6/coefficients-v6.json.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS SCRIPT IS FOR
// ─────────────────────────────────────────────────────────────────────────────
//
// v6 measures ONE accommodation level per city (`hotel_3star_room_2p`, from
// Expedia class-trend snippets) and derives the other five accommodation tiers
// from it by fitted ratio. This script fits those ratios and scores them.
//
// It reads ONLY evidence that already exists in the repo. It makes no network
// calls and no model calls. Running it is free and instantaneous.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY RATIOS AND NOT LEVELS
// ─────────────────────────────────────────────────────────────────────────────
//
// v4 established (docs/product/methodology-v4.md, LOG.md "v4") that a first-page
// commercial hotel listing is badly biased for LEVELS -- sliding a 10-property
// window over Copenhagen's 108 four-star properties gives medians from 275 to
// 1085, a 3.945x spread -- because the commercial sort orders price along the
// page. But the same page's RATIO between two classes transfers cleanly, because
// the estimator's bias is largely common to both classes and cancels in the
// division.
//
// This is the whole reason "measure level, model structure" works, and it is why
// v6 fits the ratio on the SAME SOURCE that supplies the production anchor.
// Expedia's bias cancels against itself. Mixing a Booking-fitted ratio with an
// Expedia-measured anchor would reintroduce the bias this design removes.
//
// The v4 Booking.com fit is therefore used as INDEPENDENT CROSS-VALIDATION, not
// as the shipped coefficient. That the two agree to ~2-3% across different
// sources, estimators, years and city samples is the strongest generalisation
// evidence in the programme -- stronger than a larger single-source sample.
//
// ─────────────────────────────────────────────────────────────────────────────
// MODEL FORM
// ─────────────────────────────────────────────────────────────────────────────
//
//   R0   target = k * anchor      (1 parameter, k = median of per-city ratios)
//
// Only R0 is fitted. v4 tested R1 (cost-banded), R2 (power law) and R3 (banded
// elasticity) on exactly these accommodation relations and found bands made both
// hotel relations WORSE on leave-one-out and holdout (methodology-v4.md; LOG.md
// "What both agree on"). Re-testing richer forms here would repeat settled work.
// If a future cycle wants to revisit it, see scripts/fit-city-cost-ratios.mjs,
// which implements R0-R3 for the food/drink relations.
//
// ─────────────────────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────────────────────
//
// Leave-one-CITY-out. For each city, k is refitted from the other cities, then
// used to predict that city's target from its anchor. This is the honest
// small-sample estimator; a fixed holdout at n=18 would be noise.
//
// ─────────────────────────────────────────────────────────────────────────────
// USAGE
// ─────────────────────────────────────────────────────────────────────────────
//
//   node scripts/fit-city-cost-ladder-v6.mjs             # fit and write
//   node scripts/fit-city-cost-ladder-v6.mjs --check     # verify, exit 1 on drift
//
// --check regenerates the report in memory and compares it byte-for-byte with
// the committed file. Use it in verification runs to prove the coefficients on
// disk are exactly what this evidence produces.

import fs from 'node:fs';
import path from 'node:path';

const EXPERIMENTS = 'data/reference/v5/experiments';
const OUT = 'data/reference/v6/coefficients-v6.json';
const V4_ACCOM = 'data/reference/dry-run/phase-0h-accommodation-class-ratios.json';

const checkOnly = process.argv.includes('--check');

// ─── source panels ───────────────────────────────────────────────────────────
// Every v5 experiment directory that ran an Expedia hotel-class panel. Listed
// explicitly rather than pattern-matched so that adding a panel is a deliberate,
// reviewable act.
const EXPEDIA_PANELS = [
  '028-expedia-class-trends',
  '029-expedia-class-panel',
  '059-expedia-class-panel',
  '060-expedia-four-star-gap-panel',
  '061-expedia-paired-panel',
  '062-expedia-three-star-gap-panel',
  '063-expedia-paired-panel-2',
  '065-expedia-one-star-paired-panel',
  '075-expedia-gap-panel',
  '078-expedia-matched-panel',
  '085-expedia-query-contract',
  '086-expedia-locale-currency-proxy',
  '087-expedia-locale-proxy-broad-panel',
  '088-expedia-targeted-23-panel',
];

// Price of Travel Hostel Index: one-person shared-dorm bed, taxes included.
// Experiment 072 returned 12/12 strict rows. The index window is mid-April 2023,
// which is STALE -- see the caveat attached to the dorm coefficient below.
const DORM_PANELS = ['072-priceoftravel-hostel-index-dorm'];

const CLASS_KEYS = {
  hotel_2star_room_2p: '2_star',
  hotel_3star_room_2p: '3_star',
  hotel_4star_room_2p: '4_star',
  hotel_1star_room_2p: '1_star',
};

// ─── helpers ─────────────────────────────────────────────────────────────────

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
};

const round = (x, dp) => Number(x.toFixed(dp));

/** Read every per-city response JSON in a panel directory. */
function readPanel(dir) {
  const full = path.join(EXPERIMENTS, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith('.json'))
    // Skip the panel's own bookkeeping files; keep only city responses.
    .filter((f) => !/telemetry|audit|results|inputs|manifest/.test(f))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(full, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ─── collect hotel class rows ────────────────────────────────────────────────
// One row per (city, class). First panel to supply a city/class wins, so panels
// are deduplicated in the listed order and a later re-test never silently
// overwrites an earlier accepted row.

const hotelRows = new Map(); // "City|class" -> row

for (const dir of EXPEDIA_PANELS) {
  for (const doc of readPanel(dir)) {
    if (!doc.city || !doc.measures) continue;
    for (const [key, cls] of Object.entries(CLASS_KEYS)) {
      const m = doc.measures[key];
      if (!m || !/^found/.test(String(m.status ?? ''))) continue;
      const value = Number(m.value);
      if (!Number.isFinite(value) || value <= 0) continue;
      const id = `${doc.city}|${cls}`;
      if (hotelRows.has(id)) continue;
      hotelRows.set(id, {
        city: doc.city,
        class: cls,
        value,
        // Experiment 086 preserved Expedia.com bare-dollar values as
        // `currency: null` rather than inferring USD in the prompt. Those rows
        // are source-locale proxies and may only be compared with each other,
        // never with a named-currency row.
        currency: m.currency ?? 'BARE_DOLLAR_PROXY',
        panel: dir,
      });
    }
  }
}

// ─── collect dorm rows ───────────────────────────────────────────────────────

const dormRows = new Map(); // "City" -> row
for (const dir of DORM_PANELS) {
  for (const doc of readPanel(dir)) {
    const m = doc.measure;
    if (!doc.city || !m || !/^found/.test(String(m.status ?? ''))) continue;
    const value = Number(m.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (dormRows.has(doc.city)) continue;
    dormRows.set(doc.city, { city: doc.city, value, currency: m.currency ?? null, panel: dir });
  }
}

// ─── pair, fit, score ────────────────────────────────────────────────────────

/**
 * Build same-currency (anchor, target) city pairs.
 *
 * The same-currency rule is load-bearing. A ratio is only currency-free when
 * both sides are denominated identically; pairing a USD 3-star with a EUR 4-star
 * would silently fold an FX rate into the coefficient.
 */
function pairs(anchorClass, targetClass) {
  const byCity = new Map();
  for (const row of hotelRows.values()) {
    if (!byCity.has(row.city)) byCity.set(row.city, {});
    byCity.get(row.city)[row.class] = row;
  }
  const out = [];
  for (const [city, classes] of byCity) {
    const a = classes[anchorClass];
    const t = classes[targetClass];
    if (!a || !t) continue;
    if (a.currency !== t.currency) continue;
    out.push({ city, anchor: a.value, target: t.value, ratio: t.value / a.value, currency: a.currency });
  }
  return out.sort((x, y) => x.city.localeCompare(y.city));
}

/** Cross-source dorm pairs: PoT dorm bed vs Expedia 3-star, same currency. */
function dormPairs() {
  const out = [];
  for (const [city, dorm] of dormRows) {
    const hotel = hotelRows.get(`${city}|3_star`);
    if (!hotel) continue;
    if (dorm.currency !== hotel.currency) continue;
    out.push({
      city,
      anchor: hotel.value,
      target: dorm.value,
      ratio: dorm.value / hotel.value,
      currency: hotel.currency,
    });
  }
  return out.sort((x, y) => x.city.localeCompare(y.city));
}

/** Leave-one-city-out scoring of the R0 (global median ratio) form. */
function scoreR0(ps) {
  if (ps.length < 3) return null;
  const apes = ps.map((p, i) => {
    const k = median(ps.filter((_, j) => j !== i).map((q) => q.ratio));
    return (Math.abs(p.anchor * k - p.target) / p.target) * 100;
  });
  // Signed log error detects systematic bias that an absolute metric hides.
  const signed = ps.map((p, i) => {
    const k = median(ps.filter((_, j) => j !== i).map((q) => q.ratio));
    return Math.log((p.anchor * k) / p.target);
  });
  return {
    n: ps.length,
    medianApePct: round(median(apes), 2),
    p90ApePct: round(quantile(apes, 0.9), 2),
    maxApePct: round(Math.max(...apes), 2),
    medianSignedLogError: round(median(signed), 4),
  };
}

function relation(key, ps, notes) {
  const ratios = ps.map((p) => p.ratio);
  return {
    key,
    n: ps.length,
    coefficient: ps.length ? round(median(ratios), 4) : null,
    dispersion: ps.length
      ? {
          min: round(Math.min(...ratios), 4),
          q25: round(quantile(ratios, 0.25), 4),
          q75: round(quantile(ratios, 0.75), 4),
          max: round(Math.max(...ratios), 4),
        }
      : null,
    leaveOneCityOut: scoreR0(ps),
    cities: ps.map((p) => p.city),
    notes,
  };
}

const twoFromThree = pairs('3_star', '2_star');
const fourFromThree = pairs('3_star', '4_star');
const dormFromThree = dormPairs();

// ─── v4 cross-validation ─────────────────────────────────────────────────────
// Independent Booking.com fit from the v4 programme. Different source, different
// estimator (first-page property median vs class-trend average), different year,
// largely different cities.

const v4 = JSON.parse(fs.readFileSync(V4_ACCOM, 'utf8'));
const v4Ratio = (label) => {
  const r = v4.relations.find((x) => x.label === label);
  return r ? { median: round(r.ratio.median, 4), n: r.n, source: 'booking.com first-page property median' } : null;
};

const crossValidation = [
  {
    relation: 'accom_2_star <- accom_3_star',
    v6Expedia: twoFromThree.length ? round(median(twoFromThree.map((p) => p.ratio)), 4) : null,
    v4Booking: v4Ratio('hotel_2star / hotel_3star'),
  },
  {
    relation: 'accom_4_star <- accom_3_star',
    v6Expedia: fourFromThree.length ? round(median(fourFromThree.map((p) => p.ratio)), 4) : null,
    v4Booking: v4Ratio('hotel_4star / hotel_3star'),
  },
].map((row) => ({
  ...row,
  agreementPct:
    row.v6Expedia && row.v4Booking
      ? round((Math.abs(row.v6Expedia - row.v4Booking.median) / row.v4Booking.median) * 100, 2)
      : null,
}));

// ─── derived coefficients that are NOT directly fitted ───────────────────────

const hostelBlended = v4Ratio('hostel_blended / hotel_3star');
if (!hostelBlended) {
  // Fail loudly rather than silently emitting null coefficients. A renamed v4
  // relation label must be noticed, not absorbed.
  console.error(
    `Could not find relation 'hostel_blended / hotel_3star' in ${V4_ACCOM}.\n` +
      `Available labels: ${v4.relations.map((r) => r.label).join(', ')}`
  );
  process.exit(1);
}

// accom_1_star has ZERO direct observations. Fifteen v5 experiments targeted it
// (030-034, 038, 041-043, 049, 065-069) across roughly 150 one-city calls and
// produced no usable row; the pooled Expedia panels contain 0 one-star rows out
// of 101. See docs/dev/plans/city-cost-methodology-v6.md section 1.
//
// v6 therefore INTERPOLATES it rather than continuing to search. A one-star
// hotel room sits between a hostel private room and a two-star room, so the
// coefficient is the geometric mean of those two bracketing coefficients.
// Geometric (not arithmetic) because these are multiplicative ratios.
//
// This is the weakest number in the ladder. It ships at grade C with the widest
// interval and is the first target of milestone M5.
const twoStarK = twoFromThree.length ? median(twoFromThree.map((p) => p.ratio)) : null;
const oneStarK =
  twoStarK && hostelBlended ? Math.sqrt(hostelBlended.median * twoStarK) : null;

// ─── report ──────────────────────────────────────────────────────────────────

const report = {
  schemaVersion: 'city-cost-v6-ladder-fit-v1',
  methodologyVersion: 'v6.0',
  description:
    'Accommodation ladder coefficients for city cost methodology v6. Every tier is derived from the ' +
    'single measured anchor hotel_3star_room_2p. Regenerate with: node scripts/fit-city-cost-ladder-v6.mjs',
  generatedFrom: {
    expediaPanels: EXPEDIA_PANELS,
    dormPanels: DORM_PANELS,
    v4CrossValidation: V4_ACCOM,
  },
  productionAnchor: {
    measure: 'hotel_3star_room_2p',
    source: 'Expedia class-trend search snippets',
    basis: 'explicit two adults, tax-excluded nightly base-rate trend',
    rationale:
      'The ladder is fitted on the same source that supplies the anchor so that the estimator bias ' +
      'cancels in the ratio. Mixing a Booking-fitted ratio with an Expedia-measured anchor would ' +
      'reintroduce the bias this design removes.',
  },
  pooledEvidence: {
    hotelRows: hotelRows.size,
    hotelCities: new Set([...hotelRows.values()].map((r) => r.city)).size,
    rowsByClass: ['1_star', '2_star', '3_star', '4_star'].reduce((acc, cls) => {
      acc[cls] = [...hotelRows.values()].filter((r) => r.class === cls).length;
      return acc;
    }, {}),
    dormRows: dormRows.size,
    citiesWithThreeStarAnchor: [...hotelRows.values()].filter((r) => r.class === '3_star').length,
  },
  relations: [
    relation(
      'accom_2_star <- accom_3_star',
      twoFromThree,
      'Fitted. Same-currency Expedia pairs, R0 global median ratio.'
    ),
    relation(
      'accom_4_star <- accom_3_star',
      fourFromThree,
      'Fitted. Same-currency Expedia pairs, R0 global median ratio.'
    ),
    relation(
      'hostel_dorm_bed_1p <- accom_3_star',
      dormFromThree,
      'Fitted cross-source: Price of Travel Hostel Index dorm bed vs Expedia 3-star. ' +
        'CAVEAT: the index reference window is mid-April 2023 while the Expedia anchor is current, ' +
        'so this ratio conflates the class relationship with three years of real price drift. ' +
        'Ships at grade C with a wide interval. Improving it is milestone M5.'
    ),
  ],
  crossValidation,
  shippedCoefficients: {
    // Consumed by the v6 derivation path. Every entry states its own grade and
    // provenance so no caller can treat a modelled value as observed.
    accom_2_star: {
      k: twoStarK ? round(twoStarK, 4) : null,
      appliedTo: 'accom_3_star',
      grade: 'C',
      intervalPct: 25,
      provenance: 'fitted_expedia_r0',
    },
    accom_4_star: {
      k: fourFromThree.length ? round(median(fourFromThree.map((p) => p.ratio)), 4) : null,
      appliedTo: 'accom_3_star',
      grade: 'C',
      intervalPct: 25,
      provenance: 'fitted_expedia_r0',
    },
    accom_1_star: {
      k: oneStarK ? round(oneStarK, 4) : null,
      appliedTo: 'accom_3_star',
      grade: 'C',
      intervalPct: 45,
      provenance: 'interpolated_geometric_mean_of_hostel_and_two_star',
      warning:
        'NO DIRECT EVIDENCE. Zero one-star rows in 101 pooled Expedia rows; 15 v5 experiments failed ' +
        'to obtain any. This is the weakest coefficient in v6. See product decision 1 in ' +
        'docs/dev/plans/city-cost-methodology-v6.md section 8.',
    },
    accom_hostel_private_room: {
      k: hostelBlended ? hostelBlended.median : null,
      appliedTo: 'accom_3_star',
      grade: 'C',
      intervalPct: 35,
      provenance: 'v4_booking_blended_hostel_ratio',
      warning:
        'The v4 hostel channel could not distinguish dorm bed from private room; this is the blended ' +
        'measure. Assigning it to private room is a modelling choice, not an observation.',
    },
    accom_shared_hostel_dorm: {
      k: dormFromThree.length ? round(median(dormFromThree.map((p) => p.ratio)), 4) : null,
      appliedTo: 'accom_3_star',
      multiplyBy: 2,
      grade: 'C',
      intervalPct: 40,
      provenance: 'fitted_priceoftravel_2023_index_vs_current_expedia',
      warning:
        'Cross-source and cross-year. The x2 converts one dorm bed to the two-bed product estimand ' +
        'and is definitional, not fitted.',
    },
  },
  limitations: [
    'Only R0 is fitted. v4 established that cost bands make both hotel relations worse on leave-one-out and holdout.',
    'accom_1_star is interpolated, not observed. It is the weakest value in the methodology.',
    'The dorm coefficient mixes a 2023 index with a current anchor.',
    'Bare-dollar Expedia.com rows carry currency BARE_DOLLAR_PROXY and are only ever paired with each other.',
    'These coefficients are fitted on source evidence, not validated against independent ground truth. ' +
      'That validation is milestone M3 and requires the 40-city panel described in ' +
      'docs/dev/plans/city-cost-methodology-v6.md section 5.',
  ],
};

const serialized = JSON.stringify(report, null, 2) + '\n';

if (checkOnly) {
  if (!fs.existsSync(OUT)) {
    console.error(`${OUT} does not exist. Run: node scripts/fit-city-cost-ladder-v6.mjs`);
    process.exit(1);
  }
  if (fs.readFileSync(OUT, 'utf8') !== serialized) {
    console.error(`${OUT} is out of date. Run: node scripts/fit-city-cost-ladder-v6.mjs`);
    process.exit(1);
  }
  console.log(`${OUT} is up to date`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, serialized);

console.log(`Wrote ${OUT}`);
console.log(
  `  pooled ${report.pooledEvidence.hotelRows} hotel rows across ${report.pooledEvidence.hotelCities} cities`
);
for (const r of report.relations) {
  const loo = r.leaveOneCityOut;
  console.log(
    `  ${r.key.padEnd(38)} n=${String(r.n).padStart(2)}  k=${r.coefficient ?? 'n/a'}` +
      (loo ? `  LOO medAPE ${loo.medianApePct}%  p90 ${loo.p90ApePct}%` : '  (not scored, n<3)')
  );
}
for (const cv of crossValidation) {
  if (cv.agreementPct === null) continue;
  console.log(
    `  cross-check ${cv.relation}: v6 ${cv.v6Expedia} vs v4 ${cv.v4Booking.median} -> ${cv.agreementPct}% apart`
  );
}
