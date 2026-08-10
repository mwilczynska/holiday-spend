// Fits the v6 accommodation ladder from evidence already collected by the v5
// experiment programme, and writes data/reference/v6/coefficients-v6.json.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS SCRIPT IS FOR
// ─────────────────────────────────────────────────────────────────────────────
//
// v6 measures one production accommodation level per city (`hotel_3star_room_2p`,
// from Expedia class-trend snippets) and derives the other tiers from fitted
// ratios or fixed basket definitions. This script generates the accommodation
// ladder plus every independent non-accommodation ratio that is needed to
// derive anchors absent from the production spine.
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
const V4_FOOD_DRINK = 'data/reference/dry-run/phase-0c-ratio-model-fit.json';
const DEVELOPMENT_LEDGER = 'data/reference/v6/ground-truth/development-ledger.json';
const FX_SNAPSHOT = 'data/reference/fx/city_cost_fx_aud_2026-07-22.json';

const checkOnly = process.argv.includes('--check');
const MIN_FITTED_RELATION_N = 8;

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
// The development ledger is the fitting panel for all non-accommodation
// derivations. Missing rows remain missing; the generator never turns a prior
// or a production-source value into independent ground truth.

const developmentLedger = JSON.parse(fs.readFileSync(DEVELOPMENT_LEDGER, 'utf8'));
const developmentRows = new Map(
  developmentLedger.cities.map((city) => [
    city.city,
    Object.fromEntries(city.observations.filter((row) => row.status === 'found').map((row) => [row.measure, row])),
  ])
);
const developmentBandByCity = new Map(developmentLedger.cities.map((city) => [city.city, city.band]));

const groundTruthFx = JSON.parse(fs.readFileSync(FX_SNAPSHOT, 'utf8'));
const audPerUnit = (currency) => groundTruthFx.rates?.[currency]?.audPerUnit;

function independentGroundTruthPairs(targetMeasure, anchorMeasure) {
  const out = [];
  for (const [city, rows] of developmentRows) {
    const target = rows[targetMeasure];
    const anchor = rows[anchorMeasure];
    const targetRate = target ? audPerUnit(target.currency) : null;
    const anchorRate = anchor ? audPerUnit(anchor.currency) : null;
    if (!target || !anchor || !Number.isFinite(targetRate) || !Number.isFinite(anchorRate)) continue;
    const targetAud = target.amount * targetRate;
    const anchorAud = anchor.amount * anchorRate;
    if (!(targetAud > 0) || !(anchorAud > 0)) continue;
    out.push({
      city,
      anchor: anchorAud,
      target: targetAud,
      ratio: targetAud / anchorAud,
      currency: 'AUD',
      targetCurrency: target.currency,
      anchorCurrency: anchor.currency,
      band: developmentBandByCity.get(city) ?? null,
    });
  }
  return out.sort((x, y) => x.city.localeCompare(y.city));
}

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

const independentHotelTwoFromThree = independentGroundTruthPairs('hotel_2star_room_2p', 'hotel_3star_room_2p');
const independentMidrangeFromInexpensive = independentGroundTruthPairs(
  'midrange_restaurant_meal_2p',
  'inexpensive_restaurant_meal_1p'
);
const independentMcMealFromInexpensive = independentGroundTruthPairs('mcmeal_combo', 'inexpensive_restaurant_meal_1p');
const independentStreetFromInexpensive = independentGroundTruthPairs('street_food_meal_1p', 'inexpensive_restaurant_meal_1p');
const independentCappuccinoFromBeer = independentGroundTruthPairs('cappuccino_1', 'domestic_draft_beer_1');
const independentAttractionFromInexpensive = independentGroundTruthPairs(
  'paid_attraction_adult_1',
  'inexpensive_restaurant_meal_1p'
);
const independentPremiumFromMidrange = independentGroundTruthPairs(
  'premium_restaurant_meal_2p',
  'midrange_restaurant_meal_2p'
);
const independentCocktailFromCappuccino = independentGroundTruthPairs('cocktail_1', 'cappuccino_1');
const independentWineFromCappuccino = independentGroundTruthPairs('wine_glass_1', 'cappuccino_1');

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

/** Leave-one-city-out scoring of the cost-banded R1 candidate. */
function scoreR1Band(ps) {
  if (ps.length < 3) return null;
  const errors = [];
  const signed = [];
  for (const [index, point] of ps.entries()) {
    const training = ps.filter((_, candidateIndex) => candidateIndex !== index);
    const sameBand = training.filter((candidate) => candidate.band && candidate.band === point.band);
    const k = median((sameBand.length >= 3 ? sameBand : training).map((candidate) => candidate.ratio));
    errors.push((Math.abs(point.anchor * k - point.target) / point.target) * 100);
    signed.push(Math.log((point.anchor * k) / point.target));
  }
  return {
    n: ps.length,
    medianApePct: round(median(errors), 2),
    p90ApePct: round(quantile(errors, 0.9), 2),
    maxApePct: round(Math.max(...errors), 2),
    medianSignedLogError: round(median(signed), 4),
  };
}

function fitR1Band(ps) {
  const loo = scoreR1Band(ps);
  if (!loo) return null;
  const global = median(ps.map((point) => point.ratio));
  const byBand = Object.fromEntries(
    [...new Set(ps.map((point) => point.band).filter(Boolean))]
      .sort()
      .map((band) => {
        const bandPoints = ps.filter((point) => point.band === band);
        return [band, bandPoints.length >= 3 ? round(median(bandPoints.map((point) => point.ratio)), 4) : null];
      })
  );
  return {
    form: 'R1_band',
    globalFallback: round(global, 4),
    byBand,
    leaveOneCityOut: loo,
    intervalPct: ceilPct(loo.p90ApePct),
    notes: 'Within-band median ratio when a band has at least three development cities; otherwise the leave-one-out prediction falls back to the training-panel global median.',
  };
}

function relation(key, ps, notes, intervalPct = null) {
  const ratios = ps.map((p) => p.ratio);
  return {
    key,
    n: ps.length,
    fitStatus: ps.length >= 3 ? 'fitted_r0' : 'not_fittable_n_lt_3',
    shippingEligible: ps.length >= MIN_FITTED_RELATION_N,
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

const independentRelations = [
  relation(
    'hotel_2star_room_2p <- hotel_3star_room_2p (independent Booking validation)',
    independentHotelTwoFromThree,
    'Independent Booking.com v2 development validation of the shipped accommodation coefficient. The production anchor remains Expedia; this fit is diagnostic and is not substituted into the accommodation spine.'
  ),
  relation(
    'midrange_restaurant_meal_2p <- inexpensive_restaurant_meal_1p',
    independentMidrangeFromInexpensive,
    'Fitted on independent official-menu development medians after FX conversion with the frozen snapshot. Both measures are in the same city and the ratio is the estimand.'
  ),
  relation(
    'mcmeal_combo <- inexpensive_restaurant_meal_1p',
    independentMcMealFromInexpensive,
    'Not fitted: the independent panel produced no city with both a compliant official McMeal and inexpensive meal row. McMeal remains a measured production anchor and diagnostic only; it is not the street-food ground-truth basis.'
  ),
  relation(
    'street_food_meal_1p <- inexpensive_restaurant_meal_1p',
    independentStreetFromInexpensive,
    'Fitted on independent official street-food and local prepared-meal medians after FX conversion with the frozen snapshot. McMeal remains a separate cross-check and is never used as the base.'
  ),
  relation(
    'cappuccino_1 <- domestic_draft_beer_1',
    independentCappuccinoFromBeer,
    'Fitted on the four independent cities with both compliant official cappuccino and domestic draft panels. This is a validation relation, not a production replacement for either measured anchor.'
  ),
  relation(
    'paid_attraction_adult_1 <- inexpensive_restaurant_meal_1p',
    independentAttractionFromInexpensive,
    'Fitted as an independent cross-check of the attraction anchor against the food level. The product does not derive attractions from food; the production activity proxy remains separately sourced.'
  ),
  relation(
    'premium_restaurant_meal_2p <- midrange_restaurant_meal_2p',
    independentPremiumFromMidrange,
    'Fitted on independent official-menu development medians. Only three cities supplied both compliant panels; the wide residual interval is retained.'
  ),
  relation(
    'cocktail_1 <- cappuccino_1',
    independentCocktailFromCappuccino,
    'Fitted on independent official menu medians. Cocktail remains laddered from the production cappuccino anchor; Expatistan is not used as primary ground truth.'
  ),
  relation(
    'wine_glass_1 <- cappuccino_1',
    independentWineFromCappuccino,
    'Fitted on independent official menu medians with the frozen 125–175 ml / 15 cl wine rule. Wine remains laddered from the production cappuccino anchor; Expatistan is not used as primary ground truth.'
  ),
];
for (const fit of independentRelations) {
  fit.intervalPct = fit.leaveOneCityOut ? ceilPct(fit.leaveOneCityOut.p90ApePct) : null;
}

const streetFit = independentRelations.find((fit) => fit.key === 'street_food_meal_1p <- inexpensive_restaurant_meal_1p');
if (!streetFit) throw new Error('The independent panel must include the street-food diagnostic relation.');
const streetR1 = fitR1Band(independentStreetFromInexpensive);
const observedStreetFit = {
  R0: {
    coefficient: streetFit.coefficient,
    leaveOneCityOut: streetFit.leaveOneCityOut,
    intervalPct: streetFit.intervalPct,
  },
  R1_band: streetR1,
};
// Six noisy pairs are evidence about the failure of a fitted street-food ratio,
// not enough evidence to ship one. The product receives the preregistered
// reasoned constant; the raw R0/R1 diagnostics remain in the generated report.
streetFit.candidateForms = observedStreetFit;
streetFit.selectedForm = 'reasoned_constant';
streetFit.observedFit = { ...streetFit };
streetFit.coefficient = 0.5;
streetFit.fitStatus = 'reasoned_constant_below_minimum_n';
streetFit.intervalPct = 35;
streetFit.notes = `The observed relation has n=${streetFit.n}; fitted ratios require n>=${MIN_FITTED_RELATION_N}. Street food is the same meal without table service, premises rent or waitstaff; a reasoned 0.5 constant is used and checked at basket level against BudgetYourTrip. The v1-derived 4.65/7.75=0.60 is incidental corroboration only.`;

function selectedStreetCoefficient(point) {
  return streetFit.selectedForm === 'R1_band' && point.band && Number.isFinite(streetFit.byBand?.[point.band])
    ? streetFit.byBand[point.band]
    : streetFit.coefficient;
}

function pearson(xs, ys) {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const numerator = xs.reduce((sum, value, index) => sum + (value - meanX) * (ys[index] - meanY), 0);
  const denominatorX = Math.sqrt(xs.reduce((sum, value) => sum + (value - meanX) ** 2, 0));
  const denominatorY = Math.sqrt(ys.reduce((sum, value) => sum + (value - meanY) ** 2, 0));
  return denominatorX && denominatorY ? numerator / (denominatorX * denominatorY) : null;
}

const streetFoodMcMealCrossCheck = [];
const observedFoodStreet = [];
for (const [city, rows] of developmentRows) {
  const street = rows.street_food_meal_1p;
  const inexpensive = rows.inexpensive_restaurant_meal_1p;
  const mcmeal = rows.mcmeal_combo;
  const streetRate = street ? audPerUnit(street.currency) : null;
  const inexpensiveRate = inexpensive ? audPerUnit(inexpensive.currency) : null;
  const mcmealRate = mcmeal ? audPerUnit(mcmeal.currency) : null;
  if (!street || !inexpensive || !Number.isFinite(streetRate) || !Number.isFinite(inexpensiveRate)) continue;
  const streetAud = street.amount * streetRate;
  const inexpensiveAud = inexpensive.amount * inexpensiveRate;
  observedFoodStreet.push({
    city,
    foodStreetAud: streetAud * 6,
    foodBudgetAud: streetAud * 4 + inexpensiveAud * 2,
  });
  if (!mcmeal || !Number.isFinite(mcmealRate)) continue;
  const point = { band: developmentBandByCity.get(city) ?? null };
  const predictedStreetAud = inexpensiveAud * selectedStreetCoefficient(point);
  const mcMealAud = mcmeal.amount * mcmealRate;
  const factor = mcMealAud / predictedStreetAud;
  streetFoodMcMealCrossCheck.push({
    city,
    fittedStreetAud: round(predictedStreetAud, 2),
    mcMealAud: round(mcMealAud, 2),
    mcMealToStreetFactor: round(factor, 3),
    absoluteDifferencePct: round(Math.abs(mcMealAud - predictedStreetAud) / predictedStreetAud * 100, 2),
    warning: factor > 2 || factor < 0.5,
  });
}
const observedFoodStreetCorrelation = pearson(
  observedFoodStreet.map((row) => row.foodStreetAud),
  observedFoodStreet.map((row) => row.foodBudgetAud)
);
const streetFoodDiagnostics = {
  mcMealCrossCheck: {
    thresholdFactor: 2,
    thresholdDescription: 'Flag when McMeal is more than 2x or less than 0.5x the fitted street-food prediction.',
    streetFoodCities: [...developmentRows].filter(([, rows]) => rows.street_food_meal_1p).map(([city]) => city).sort(),
    comparableCities: streetFoodMcMealCrossCheck.map((row) => row.city),
    note: 'McMeal-vs-street comparison is emitted only when street food, inexpensive meal and McMeal rows all have frozen-FX coverage. An empty comparable list is a coverage gap, not evidence of agreement.',
    cities: streetFoodMcMealCrossCheck,
    warningCount: streetFoodMcMealCrossCheck.filter((row) => row.warning).length,
  },
  foodStreetFoodVsBudget: {
    observedDevelopmentN: observedFoodStreet.length,
    observedPanelPearsonR: observedFoodStreetCorrelation === null ? null : round(observedFoodStreetCorrelation, 4),
    modeledPearsonR: 1,
    independentlyInformative: false,
    note: 'After fitting street food as a ratio of inexpensive restaurant meals, both shipped tiers are deterministic functions of the inexpensive anchor and have modeled correlation 1. Direct street-food rows restore independent validation evidence, but the two materialized tiers do not carry independent production signal.',
  },
};

// ─── v4 cross-validation ─────────────────────────────────────────────────────
// Independent Booking.com fit from the v4 programme. Different source, different
// estimator (first-page property median vs class-trend average), different year,
// largely different cities.

const v4 = JSON.parse(fs.readFileSync(V4_ACCOM, 'utf8'));
const v4FoodDrink = JSON.parse(fs.readFileSync(V4_FOOD_DRINK, 'utf8'));
const v4Ratio = (label) => {
  const r = v4.relations.find((x) => x.label === label);
  return r ? { median: round(r.ratio.median, 4), n: r.n, source: 'booking.com first-page property median' } : null;
};
const v4FoodDrinkRatio = (key) => {
  const r = v4FoodDrink.relations.find((x) => x.key === key);
  if (!r) return null;
  const selected = r.selection?.selected ?? 'R0';
  const selectedFit = r.fittedFullSample?.[selected];
  const coefficient = selectedFit?.k ?? selectedFit?.global;
  return {
    selected,
    coefficient: Number.isFinite(coefficient) ? round(coefficient, 4) : null,
    n: r.n,
    source: 'v4 Numbeo ratio fit',
    leaveOneOut: r.leaveOneOut?.[selected] ?? null,
    bands: selectedFit?.byBand ?? null,
  };
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

function independentRelation(key) {
  return independentRelations.find((fit) => fit.key === key) ?? null;
}

function crossSourceRow(relationKey, v4Key, note = null) {
  const fit = independentRelation(relationKey);
  const v4Reference = typeof v4Key === 'string' && v4Key.startsWith('accom_')
    ? v4Ratio(v4Key === 'accom_2_star' ? 'hotel_2star / hotel_3star' : 'hotel_4star / hotel_3star')
    : v4FoodDrinkRatio(v4Key);
  const agreementPct = fit?.coefficient !== null && v4Reference?.coefficient !== undefined
    ? round(Math.abs(fit.coefficient - v4Reference.coefficient) / v4Reference.coefficient * 100, 2)
    : fit?.coefficient !== null && v4Reference?.median !== undefined
      ? round(Math.abs(fit.coefficient - v4Reference.median) / v4Reference.median * 100, 2)
      : null;
  return {
    relation: relationKey,
    v6Independent: fit?.coefficient ?? null,
    v6FitStatus: fit?.fitStatus ?? 'not_present',
    v6N: fit?.n ?? 0,
    v4Reference: v4Reference ?? null,
    agreementPct,
    note,
  };
}

const independentCrossValidation = [
  crossSourceRow('hotel_2star_room_2p <- hotel_3star_room_2p (independent Booking validation)', 'accom_2_star'),
  crossSourceRow('midrange_restaurant_meal_2p <- inexpensive_restaurant_meal_1p', 'midrange~inexpensive'),
  crossSourceRow('mcmeal_combo <- inexpensive_restaurant_meal_1p', 'mcmeal~inexpensive'),
  crossSourceRow('street_food_meal_1p <- inexpensive_restaurant_meal_1p', null, 'No direct v4 street-food ratio; v4 McMeal evidence remains a diagnostic cross-check and is not the fitted basis.'),
  crossSourceRow('cappuccino_1 <- domestic_draft_beer_1', 'cappuccino~beer'),
  crossSourceRow('paid_attraction_adult_1 <- inexpensive_restaurant_meal_1p', 'attraction~inexpensive'),
  crossSourceRow('premium_restaurant_meal_2p <- midrange_restaurant_meal_2p', null, 'No direct v4 premium-meal relation; v4 used a fixed 1.50 food-high-end assertion.'),
  crossSourceRow('cocktail_1 <- cappuccino_1', null, 'No direct v4 cocktail-to-cappuccino relation; v4 cocktail evidence was not accepted as a fitted coefficient.'),
  crossSourceRow('wine_glass_1 <- cappuccino_1', null, 'No direct v4 wine-glass-to-cappuccino relation; v4 rejected wine-glass calibration.'),
];

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
const premiumObservedFit = independentRelation('premium_restaurant_meal_2p <- midrange_restaurant_meal_2p');
const cocktailFit = independentRelation('cocktail_1 <- cappuccino_1');
const wineFit = independentRelation('wine_glass_1 <- cappuccino_1');
if (!premiumObservedFit?.coefficient || !cocktailFit?.coefficient) {
  throw new Error('The independent panel must include premium and cocktail diagnostics before M3 can proceed.');
}
const premiumFit = premiumObservedFit.n >= MIN_FITTED_RELATION_N
  ? premiumObservedFit
  : {
      ...premiumObservedFit,
      coefficient: 1.5,
      fitStatus: 'reasoned_constant_below_minimum_n',
      intervalPct: 45,
      notes: `The observed premium relation has n=${premiumObservedFit.n}; fitted ratios require n>=${MIN_FITTED_RELATION_N}. Use the documented v4 food-high-end basket convention of 1.5x midrange only as a reasoned fallback, not as a fitted result; the n=3 fit's ±12% interval is rejected as false confidence.`,
    };

// This is a generated coverage map, not a second source of arithmetic. It makes
// the all-19 contract auditable: every product tier is either a measured anchor,
// a deterministic identity/basket, or a named fitted relation.
const derivationRules = {
  accom_shared_hostel_dorm: {
    type: 'fitted_ratio_plus_definition',
    inputs: ['hotel_3star_room_2p'],
    coefficientKey: 'accom_shared_hostel_dorm',
    definition: 'two dorm beds from one fitted one-person dorm-bed ratio',
    validation: 'development_fitted_and_original_holdout_revealed_once',
  },
  accom_hostel_private_room: {
    type: 'fitted_ratio_with_recorded_rollback',
    inputs: ['hotel_3star_room_2p'],
    coefficientKey: 'accom_hostel_private_room',
    validation: 'development_fit_and_superseded_candidate_holdout_only; current_rollback_not_retestable',
  },
  accom_1_star: {
    type: 'interpolated_ratio',
    inputs: ['accom_hostel_private_room', 'accom_2_star'],
    coefficientKey: 'accom_1_star',
    validation: 'development_and_original_holdout_revealed_once; no_direct_one_star_observation',
  },
  accom_2_star: {
    type: 'fitted_ratio',
    inputs: ['hotel_3star_room_2p'],
    coefficientKey: 'accom_2_star',
    validation: 'development_independent_booking_diagnostic; fresh_holdout_measure_required',
  },
  accom_3_star: {
    type: 'measured_production_anchor',
    inputs: ['hotel_3star_room_2p'],
    source: 'Expedia production extractor',
    validation: 'original_holdout_contaminated_without_paired_expedia_observation',
  },
  accom_4_star: {
    type: 'fitted_ratio',
    inputs: ['hotel_3star_room_2p'],
    coefficientKey: 'accom_4_star',
    validation: 'development_fitted_and_original_holdout_revealed_once',
  },
  food_street_food: {
    type: 'reasoned_constant',
    inputs: ['inexpensive_restaurant_meal_1p'],
    coefficientKey: 'street_food_meal_1p',
    definition: 'street-food meal is 0.5 times the inexpensive restaurant meal; the source street-food anchor remains visible in validation evidence',
    validation: 'development_basket_cross_check; fitted_relation_not_eligible_below_minimum_n',
  },
  food_budget: {
    type: 'fixed_basket',
    inputs: ['street_food_meal_1p', 'inexpensive_restaurant_meal_1p'],
    validation: 'direct_inputs_holdout_required',
  },
  food_mid_range: {
    type: 'fixed_basket',
    inputs: ['street_food_meal_1p', 'inexpensive_restaurant_meal_1p', 'midrange_restaurant_meal_2p'],
    validation: 'direct_inputs_holdout_required',
  },
  food_high_end: {
    type: 'fixed_basket_with_reasoned_premium_constant',
    inputs: ['inexpensive_restaurant_meal_1p', 'midrange_restaurant_meal_2p', 'premium_restaurant_meal_2p'],
    coefficientKey: 'premium_restaurant_meal_2p',
    validation: 'premium_direct_panel_n3_below_minimum; independent validation required',
  },
  drink_coffee: {
    type: 'measured_production_anchor',
    inputs: ['cappuccino_1'],
    source: 'Numbeo production extractor',
    validation: 'fresh_independent_holdout_measure_required',
  },
  drinks_none: {
    type: 'fixed_basket',
    inputs: ['cappuccino_1'],
    validation: 'direct_input_holdout_required',
  },
  drinks_light: {
    type: 'fixed_basket',
    inputs: ['cappuccino_1', 'domestic_draft_beer_1'],
    validation: 'direct_inputs_holdout_required',
  },
  drinks_moderate: {
    type: 'fixed_basket_with_fitted_cocktail_ratio',
    inputs: ['cappuccino_1', 'domestic_draft_beer_1', 'cocktail_1'],
    coefficientKey: 'cocktail_1',
    validation: 'cocktail_fresh_holdout_measure_required',
  },
  drinks_heavy: {
    type: 'fixed_basket_without_wine_glass',
    inputs: ['cappuccino_1', 'domestic_draft_beer_1', 'cocktail_1'],
    coefficientKey: 'cocktail_1',
    validation: 'wine_glass_not_evaluable; intentionally excluded after rejected bottle calibration',
  },
  activities_free: {
    type: 'definitional',
    inputs: [],
    validation: 'not_applicable',
  },
  activities_budget: {
    type: 'measured_production_anchor',
    inputs: ['paid_attraction_adult_1'],
    source: 'BudgetYourTrip production extractor',
    validation: 'original_holdout_revealed_once',
  },
  activities_mid_range: {
    type: 'measured_production_anchor_unvalidated',
    inputs: ['half_day_group_activity_adult_1'],
    source: 'BudgetYourTrip production extractor',
    validation: 'blocked_as_independent_ground_truth; BudgetYourTrip is production source; runtime grade C ±35%',
  },
  activities_high_end: {
    type: 'measured_production_anchor_unvalidated',
    inputs: ['full_day_premium_activity_adult_1'],
    source: 'BudgetYourTrip production extractor',
    validation: 'blocked_as_independent_ground_truth; BudgetYourTrip is production source; runtime grade C ±35%',
  },
};

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
  schemaVersion: 'city-cost-v6-ladder-fit-v2',
  methodologyVersion: 'v6.0',
  description:
    'All generated v6 ladder coefficients and independent development-panel ratio fits. Fixed basket ' +
    'definitions remain in the deterministic materializer. Regenerate with: node scripts/fit-city-cost-ladder-v6.mjs',
  minimumFittedRelationN: MIN_FITTED_RELATION_N,
  generatedFrom: {
    expediaPanels: EXPEDIA_PANELS,
    dormPanels: DORM_PANELS,
    v4CrossValidation: V4_ACCOM,
    v4FoodDrinkCrossValidation: V4_FOOD_DRINK,
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
      hotelTwoStar: independentHotelTwoFromThree.length,
      independentRelations: independentRelations.reduce((acc, fit) => ({ ...acc, [fit.key]: fit.n }), {}),
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
    ...independentRelations,
  ],
  derivationRules,
  streetFoodDiagnostics,
  crossValidation: [...crossValidation, ...independentCrossValidation],
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
      developmentGroundTruthValidation: independentRelation('hotel_2star_room_2p <- hotel_3star_room_2p (independent Booking validation)'),
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
    premium_restaurant_meal_2p: {
      k: premiumFit.coefficient,
      appliedTo: 'midrange_restaurant_meal_2p',
      grade: premiumFit.n >= MIN_FITTED_RELATION_N ? 'C' : 'D',
      intervalPct: premiumFit.intervalPct,
      provenance: premiumFit.n >= MIN_FITTED_RELATION_N ? 'fitted_independent_official_menu_panel_r0' : 'reasoned_v4_food_high_end_constant_below_minimum_n',
      developmentGroundTruthValidation: { observedFit: premiumObservedFit, shippedForm: premiumFit },
      warning: premiumFit.n >= MIN_FITTED_RELATION_N ? null : 'Only three development cities supplied both compliant independent premium and midrange menu panels. The apparent ±12% fitted interval is rejected; this grade-D reasoned fallback is not a validation result.',
    },
    street_food_meal_1p: {
      k: streetFit.coefficient,
      ...(streetFit.selectedForm === 'R1_band' ? { byBand: streetFit.byBand } : {}),
      appliedTo: 'inexpensive_restaurant_meal_1p',
      grade: 'C',
      intervalPct: streetFit.intervalPct,
      provenance: 'reasoned_constant_street_food_half_inexpensive_below_minimum_n',
      developmentGroundTruthValidation: streetFit,
      warning: 'The prior McMeal 1:1 identity proxy and the noisy n=6 fitted relation are superseded. McMeal remains a Numbeo cross-check only; the shipped 0.5 reasoned constant is checked at basket level against BudgetYourTrip.',
    },
    cocktail_1: {
      k: cocktailFit.coefficient,
      appliedTo: 'cappuccino_1',
      grade: 'C',
      intervalPct: cocktailFit.intervalPct,
      provenance: 'fitted_independent_official_menu_panel_r0',
      developmentGroundTruthValidation: cocktailFit,
      warning: 'Production does not measure cocktail_1. It remains laddered from the measured cappuccino anchor and is independently validated from official menus; no Expatistan primary ground truth is used.',
    },
  },
  postHoldoutDecisions,
  limitations: [
    `Fitted relations require n>=${MIN_FITTED_RELATION_N}. The street-food n=6 relation and premium n=3 relation are retained as diagnostics but ship documented reasoned fallbacks; the former uses 0.5x inexpensive meal and the latter uses the v4 1.5x food-high-end convention with grade D.`,
    'Wine glass is intentionally excluded from drinks_heavy after the rejected Expatistan bottle-to-glass route; its raw menu diagnostic is retained but no wine coefficient is shipped.',
    `The minimum fitted relation sample size is n=${MIN_FITTED_RELATION_N}. The beer/cappuccino diagnostic has n=4 and LOO medAPE 82.87%, so it is not promoted to a coefficient; the n=5 wine diagnostic is likewise not promoted.`,
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
  if (r.key === 'street_food_meal_1p <- inexpensive_restaurant_meal_1p') {
    console.log(`    candidate R1 band: LOO medAPE ${r.candidateForms.R1_band.leaveOneCityOut.medianApePct}% p90 ${r.candidateForms.R1_band.leaveOneCityOut.p90ApePct}%; selected ${r.selectedForm}`);
  }
}
for (const cv of crossValidation) {
  if (cv.agreementPct === null) continue;
  console.log(
    `  cross-check ${cv.relation}: v6 ${cv.v6Expedia} vs v4 ${cv.v4Booking.median} -> ${cv.agreementPct}% apart`
  );
}
