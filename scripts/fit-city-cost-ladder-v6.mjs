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
const DEVELOPMENT_LEDGER = 'data/reference/v6/ground-truth/development-ledger.json';
const FX_SNAPSHOT = 'data/reference/fx/city_cost_fx_aud_2026-07-22.json';

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
const ceilPct = (x) => Math.ceil(x);

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

// ─── development ground-truth panel ─────────────────────────────────────────
// M3 deliberately fits only the two relationships that the Booking.com v2
// development panel refuted. The confirmed 4-star and interpolated 1-star
// coefficients continue to come from the existing Expedia/v4 fit.

const developmentLedger = JSON.parse(fs.readFileSync(DEVELOPMENT_LEDGER, 'utf8'));
const developmentRows = new Map(
  developmentLedger.cities.map((city) => [
    city.city,
    Object.fromEntries(city.observations.filter((row) => row.status === 'found').map((row) => [row.measure, row])),
  ])
);

function developmentPairs(targetMeasure) {
  const out = [];
  for (const [city, rows] of developmentRows) {
    const anchor = rows.hotel_3star_room_2p;
    const target = rows[targetMeasure];
    if (!anchor || !target || anchor.currency !== 'AUD' || target.currency !== 'AUD') continue;
    out.push({ city, anchor: anchor.amount, target: target.amount, ratio: target.amount / anchor.amount, currency: 'AUD' });
  }
  return out.sort((x, y) => x.city.localeCompare(y.city));
}

const bookingPrivateFromThree = developmentPairs('hostel_private_room_2p');
const bookingDormFromThree = developmentPairs('hostel_dorm_bed_1p');

function intervalFromResiduals(ps) {
  const loo = scoreR0(ps);
  return loo ? ceilPct(loo.p90ApePct) : null;
}

// The existing Expedia panel contains 15 same-city 3-star observations for
// development cities. Four are the documented Expedia.com bare-dollar proxy;
// the source offset intentionally absorbs the shared displayed-dollar basis,
// while the provenance records that assumption. This is source calibration,
// not a new product-level price estimate.
const fxSnapshot = JSON.parse(fs.readFileSync(FX_SNAPSHOT, 'utf8'));
const usdAud = fxSnapshot.rates?.USD?.audPerUnit;
function sourceOffsetPairs() {
  const out = [];
  for (const [city, rows] of developmentRows) {
    const booking = rows.hotel_3star_room_2p;
    const expedia = hotelRows.get(`${city}|3_star`);
    if (!booking || !expedia || booking.currency !== 'AUD' || !Number.isFinite(usdAud)) continue;
    if (!(expedia.currency === 'USD' || expedia.currency === 'BARE_DOLLAR_PROXY')) continue;
    const expediaAud = expedia.value * usdAud;
    out.push({
      city,
      groundTruth: booking.amount,
      raw: expediaAud,
      ratio: booking.amount / expediaAud,
      rawCurrency: expedia.currency,
      panel: expedia.panel,
    });
  }
  return out.sort((x, y) => x.city.localeCompare(y.city));
}

const bookingToExpediaPairs = sourceOffsetPairs();
if (bookingToExpediaPairs.length < 12) {
  throw new Error(`Booking -> Expedia source offset needs at least 12 matched development cities; found ${bookingToExpediaPairs.length}.`);
}
const expediaToBookingOffset = median(bookingToExpediaPairs.map((p) => p.ratio));
const sourceOffsetResiduals = bookingToExpediaPairs.map((p) => Math.abs(p.raw * expediaToBookingOffset - p.groundTruth) / p.groundTruth * 100);
const sourceOffsetLooResiduals = bookingToExpediaPairs.map((p, index) => {
  const k = median(bookingToExpediaPairs.filter((_, i) => i !== index).map((q) => q.ratio));
  return Math.abs(p.raw * k - p.groundTruth) / p.groundTruth * 100;
});
const sourceOffsetStats = {
  n: bookingToExpediaPairs.length,
  matchedCities: bookingToExpediaPairs.map((p) => p.city),
  expediaToBookingMultiplier: round(expediaToBookingOffset, 4),
  bookingToExpediaMultiplier: round(1 / expediaToBookingOffset, 4),
  residuals: {
    minApePct: round(Math.min(...sourceOffsetResiduals), 2),
    medianApePct: round(median(sourceOffsetResiduals), 2),
    p90ApePct: round(quantile(sourceOffsetResiduals, 0.9), 2),
    maxApePct: round(Math.max(...sourceOffsetResiduals), 2),
  },
  leaveOneCityOut: {
    medianApePct: round(median(sourceOffsetLooResiduals), 2),
    p90ApePct: round(quantile(sourceOffsetLooResiduals, 0.9), 2),
    maxApePct: round(Math.max(...sourceOffsetLooResiduals), 2),
  },
  intervalPct: ceilPct(quantile(sourceOffsetLooResiduals, 0.9)),
  groundTruthSource: 'Booking.com v2 development panel, displayed AUD',
  productionSource: 'Expedia 3-star class-trend anchor',
  rawBasis: 'Expedia USD or documented bare-dollar proxy converted with the frozen USD→AUD snapshot; the offset absorbs the common source/display basis.',
  provenance: 'fitted_booking_ground_truth_v2_development',
};

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

function relation(key, ps, notes, intervalPct = null) {
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
    intervalPct,
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
const privateGroundTruthK = bookingPrivateFromThree.length ? median(bookingPrivateFromThree.map((p) => p.ratio)) : null;
const dormGroundTruthK = bookingDormFromThree.length ? median(bookingDormFromThree.map((p) => p.ratio)) : null;

// The development panel fit for the private rung is retained above as evidence,
// but it is no longer shipped. The one-time M3 holdout showed that the 0.7955
// development fit over-predicted every private row (median signed error +31.89%),
// implying a holdout ratio near 0.603. Roll back to the pre-holdout v4 blended
// coefficient through this generator; do not hand-edit the generated JSON.
const privateRoomRollback = {
  k: 0.5919,
  appliedTo: 'accom_3_star',
  grade: 'C',
  intervalPct: 35,
  provenance: 'v4_booking_blended_hostel_ratio',
  warning:
    'Rollback after the one-time M3 holdout score. The v4 hostel channel could not distinguish dorm bed from private room; this is the blended measure. Assigning it to private room is a modelling choice, not an observation. The Booking.com v2 development fit was 0.7955, but the holdout-informed rollback means the private rung is no longer an independent holdout test.',
  rollback: {
    status: 'holdout_informed_rollback',
    fitStatus: 'rollback_not_fit',
    priorDevelopmentFit: 0.7955,
    holdoutImpliedRatio: 0.603,
    reason:
      'The development panel skews toward major metros while the holdout skews smaller and more touristic; hostel private rooms can be boutique-priced in large cities and genuinely budget in small ones. Treat this as the primary M5 cost-banded R1 candidate.',
    scoreFile: 'data/reference/v6/ground-truth/holdout-scores.json',
    rescorePerformed: false,
  },
};

const postHoldoutDecisions = {
  privateRoomRollback: {
    fromDevelopmentFit: privateGroundTruthK ? round(privateGroundTruthK, 4) : null,
    shippedCoefficient: privateRoomRollback.k,
    holdoutImpliedRatio: privateRoomRollback.rollback.holdoutImpliedRatio,
    status: privateRoomRollback.rollback.status,
    fitStatus: privateRoomRollback.rollback.fitStatus,
    reason: privateRoomRollback.rollback.reason,
    scoreFile: privateRoomRollback.rollback.scoreFile,
    rescorePerformed: false,
  },
  gateContamination: {
    status: 'anchor_contaminated',
    reason:
      'The six-measure holdout has Booking observations but no paired Expedia 3-star production-anchor observation; downstream scores that use the observed 3-star row as prediction are not end-to-end tests.',
  },
};

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
    developmentGroundTruth: DEVELOPMENT_LEDGER,
    fxSnapshot: FX_SNAPSHOT,
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
    developmentGroundTruthRows: {
      privateRoom: bookingPrivateFromThree.length,
      dormBed: bookingDormFromThree.length,
    },
    sourceOffsetMatchedCities: bookingToExpediaPairs.length,
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
      'hostel_private_room_2p <- accom_3_star',
      bookingPrivateFromThree,
      'Development diagnostic fit only: 0.7955 from Booking.com v2 medians. The first-page top-picks estimator is a level-biased but ratio-valid panel; the post-holdout shipped rollback is recorded in postHoldoutDecisions and the source offset separately calibrates the Expedia anchor.',
      intervalFromResiduals(bookingPrivateFromThree)
    ),
    relation(
      'hostel_dorm_bed_1p <- accom_3_star',
      bookingDormFromThree,
      'Fitted on Booking.com v2 development medians paired within city. This replaces the stale 2023 Price of Travel coefficient; the product tier still applies the fixed x2 two-bed definition.',
      intervalFromResiduals(bookingDormFromThree)
    ),
  ],
  crossValidation,
  sourceCalibrationOffsets: {
    hotel_3star_room_2p: {
      direction: 'Booking -> Expedia',
      groundTruthSource: sourceOffsetStats.groundTruthSource,
      productionSource: sourceOffsetStats.productionSource,
      bookingToExpediaMultiplier: sourceOffsetStats.bookingToExpediaMultiplier,
      expediaToBookingMultiplier: sourceOffsetStats.expediaToBookingMultiplier,
      grade: 'B',
      intervalPct: sourceOffsetStats.intervalPct,
      fit: sourceOffsetStats,
    },
  },
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
      ...privateRoomRollback,
    },
    accom_shared_hostel_dorm: {
      k: dormGroundTruthK ? round(dormGroundTruthK, 4) : null,
      appliedTo: 'accom_3_star',
      multiplyBy: 2,
      grade: 'C',
      intervalPct: intervalFromResiduals(bookingDormFromThree),
      provenance: 'fitted_booking_ground_truth_v2_development',
      warning:
        'Fitted from the Booking.com v2 development panel; the stale 2023 Price of Travel coefficient is superseded. The x2 converts one dorm bed to the two-bed product estimand and is definitional, not fitted.',
    },
  },
  postHoldoutDecisions,
  limitations: [
    'Only R0 is fitted. v4 established that cost bands make both hotel relations worse on leave-one-out and holdout.',
    'accom_1_star is interpolated, not observed. It is the weakest value in the methodology.',
    'The dorm coefficient is fitted on Booking.com v2 development ratios. The private-room development fit is retained as diagnostic evidence, but the shipped coefficient is the pre-holdout v4 blended rollback after the one-time holdout exposed over-prediction; absolute levels remain subject to the first-page bias caveat and the Expedia source offset.',
    'Bare-dollar Expedia.com rows carry currency BARE_DOLLAR_PROXY and are only ever paired with each other.',
    'The 4-star and 1-star rungs remain unchanged and were confirmed against the 25-city Booking.com v2 panel; the dorm rung was refit on that development panel. The private-room rung is now holdout-informed and is no longer an independent test. The frozen score remains tied to the pre-rollback candidate hash; no second score is permitted.',
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
