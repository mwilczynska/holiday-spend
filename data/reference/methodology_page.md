# Methodology

**How the cost estimates are built, and what we know about how accurate they are.**

---

## 1. Summary

This app estimates holiday costs across **121 cities** in 68 countries, decomposed into four spend categories (accommodation, food, drinks, activities), each with 3–6 quality tiers, scalable to group sizes of 1–5 people. That is **17 tier values per city**, or roughly 2,057 individual cost estimates.

Collecting 2,057 prices by direct lookup is not feasible to maintain, and would be brittle: the moment one source changes its definitions or goes stale, coverage fragments. Instead the database is built on an **anchor-and-derive architecture** — a small set of directly-observable prices per city, plus a set of transformation rules calibrated on a reference sample.

This page documents the architecture, the derivation rules, and — most importantly — **what we have actually measured about accuracy, and what we have not.**

### Headline accuracy position

| Measure | Value | What it means |
|---|---|---|
| Internal consistency (ratio CV) | 0–21% | Derivation rules behave stably across cities |
| External accuracy — median APE | **14.3%** | Half of audited anchors land within ~14% of reference |
| External accuracy — MAPE | **17.5%** | Mean absolute percentage error |
| **Systematic bias** | **−16.3%** | **The database under-estimates prices** |
| Audit sample size | n = 9 anchors, 3 cities | **Indicative only — not a validated study** |

The bias figure is the important one, and Section 7 explains what causes it and what we're doing about it.

---

## 2. The Estimation Problem

Three properties make this harder than it looks.

**Data density is wildly uneven.** Bangkok has thousands of crowd-sourced price observations. Pu Luong, Don Det, and Santa Fe (Bantayan Island) have effectively none. Any method that only works where data is dense will cover perhaps 30% of the cities travellers actually visit — and it will systematically exclude the cheap, off-grid places where accurate budgeting matters most.

**The tiers are not directly observable.** There is no data source anywhere that publishes "daily food budget for two people eating mid-range in Kanazawa." The tiers are *constructs* — deliberately defined spending styles. They must be built from primitives.

**Cross-city comparability is the whole point.** The app's value is telling you that six nights in Osaka costs roughly what eleven nights in Hanoi costs. That comparison is only meaningful if the same construction rules were applied to both. A database assembled from heterogeneous per-city guesses would produce numbers that look plausible individually but rank incorrectly against each other.

This last point drives the entire design: **consistency of construction is prioritised over per-city precision.** A systematic 15% error that applies uniformly still produces correct relative rankings and correct trip-shape decisions. A random ±15% error that varies city-to-city does not.

---

## 3. Architecture: Anchor-and-Derive

```
┌─────────────────────┐
│  10 ANCHOR PRICES   │  Directly observable, widely published
│  per city           │  beer, coffee, meals, hostel bed, hotel rates
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  DERIVATION RULES   │  Deterministic transformations
│  (calibrated)       │  baskets, ratios, interpolation
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  17 TIER VALUES     │  Base case: 2 people
│  per city           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  SCALING MODEL      │  Applied at runtime for N = 1…5
└─────────────────────┘
```

The design decision is to **push all cross-city variation into the anchors** and keep the transformation rules fixed. This has three consequences worth stating explicitly:

1. **Auditability.** Every tier value traces back to a named anchor via a printed formula. There are no unexplainable numbers.
2. **Cheap updates.** Refreshing a city means re-pulling 10 numbers, not 17. Refreshing the whole database is 1,210 lookups, not 2,057.
3. **Isolated failure.** If a tier looks wrong, the fault is in one of three places: the anchor, the rule, or the tier definition. Each is separately testable.

The cost of this design is that **any bias in the anchors propagates deterministically into the tiers.** Section 7.3 quantifies that propagation.

---

## 4. Anchor Definitions and Data Provenance

### 4.1 The ten anchors

| # | Anchor | Definition | Reference source |
|---|--------|-----------|------------------|
| 1 | `beer` | Domestic draft beer, 1 pint, restaurant | Numbeo |
| 2 | `coffee` | Cappuccino, regular size | Numbeo |
| 3 | `inexp_meal_1p` | Meal, inexpensive restaurant, 1 person | Numbeo |
| 4 | `midrange_meal_2p` | Mid-range restaurant, 3 courses, 2 people, no drinks | Numbeo |
| 5 | `cocktail` | Standard cocktail, bar or restaurant | Numbeo / derived |
| 6 | `wine_glass` | Glass of wine, restaurant | Numbeo / derived |
| 7 | `hostel_dorm_1p` | One dorm bed per night, well-reviewed hostel | Hostelworld |
| 8 | `hostel_private_2p` | Private hostel/guesthouse room, 2 people | Hostelworld / Booking |
| 9 | `hotel_1star_2p` | Basic hotel or guesthouse room, 2 people | Booking |
| 10 | `hotel_3star_2p` | 3-star hotel room, 2 people | Booking |

Anchors 1–4 were chosen because they are the four highest-coverage restaurant fields in Numbeo's schema, present for essentially every city with any contributor activity. Anchors 7–10 span the accommodation range at points where listing density is highest.

### 4.2 Provenance tiers — an honest accounting

Not every anchor in the current database was retrieved from a live source. This matters for interpreting the accuracy figures, so it is stated plainly.

| Tier | Definition | Approx. share of database |
|---|---|---|
| **A — Retrieved** | Pulled from a named source, date-stamped | ~10% of cities |
| **B — Regionally interpolated** | Scaled from a nearby Tier-A city using a relative cost index | — |
| **C — Model-estimated** | Generated by a language model from general knowledge of regional price levels, cross-checked against published backpacker daily-budget indexes for plausibility | **~90% of cities** |

**The current database is predominantly Tier C.** The derivation architecture, the scaling model, and the internal-consistency results are all valid and independently useful — but the anchor inputs are, for most cities, model estimates rather than retrieved observations. Section 7 measures what that costs in accuracy. Section 11 sets out the remediation plan.

This is disclosed rather than buried because a cost database that overstates its own provenance is worse than useless: it invites confident decisions on soft numbers.

### 4.3 Fallback rules

Where an anchor is genuinely unavailable:

- **Cocktail missing** → `beer × 2.5`
- **Wine glass missing** → `beer × 1.5`
- **No hostel sector** (small rural towns) → `hostel_dorm_1p = hotel_1star_2p / 2`; `hostel_private_2p = hotel_1star_2p`
- **No city-level data** → nearest city with data, scaled by relative cost-of-living index, then adjusted 10–30% downward for remoteness

These ratios were derived from the subset of cities where both values were observable. They are crude but stable, and each application is flagged in the provenance field.

---

## 5. Derivation Rules

All rules produce values for **two people**. Group scaling is applied separately at runtime (Section 6).

### 5.1 Accommodation — per night

```
shared_hostel_dorm   = hostel_dorm_1p × 2
hostel_private_room  = hostel_private_2p              [direct]
1_star               = hotel_1star_2p                 [direct]
2_star               = (hotel_1star_2p + hotel_3star_2p) / 2
3_star               = hotel_3star_2p                 [direct]
4_star               = hotel_3star_2p × 1.80
```

Three of six tiers are direct lookups. 2-star is linear interpolation between its neighbours. The 4-star multiplier of 1.80 was fitted on the calibration sample.

**Known weakness:** the 4-star multiplier is a global constant, but the 3★→4★ gradient is genuinely steeper in cities with a large luxury segment (Dubai, Singapore, New York) than in cities without one. This is the single largest un-modelled structural effect in the accommodation block.

### 5.2 Food — per day

```
street_food_meal = inexp_meal_1p × 0.60

street_food = street_food_meal × 3 × 2
budget      = (street_food_meal × 2 + inexp_meal_1p) × 2
mid_range   = (street_food_meal + inexp_meal_1p + midrange_meal_2p/2) × 2
high_end    = mid_range × 1.50
```

Each tier is an explicit three-meal day, priced from two anchors. The 0.60 street-food coefficient represents the discount of informal vending against the cheapest sit-down restaurant.

**In cities without a street-food sector** (most of Western Europe, North America, Japan outside festival contexts), this tier is interpreted as cheap takeaway, bakery, konbini, or counter-service. The formula still holds; only the label changes.

### 5.3 Drinks — per day

```
light    = 2·coffee + 2·beer
moderate = 2·coffee + 4·beer + 2·cocktail
heavy    = 2·coffee + 6·beer + 4·cocktail + 2·wine_glass
```

This is the most defensible block in the model: each tier is a **literal basket**, summed from observable unit prices, with no fitted coefficients whatsoever. Error here is purely inherited from anchor error — there is no model error to add. It is also the block whose semantics the user can verify directly against their own drinking habits.

### 5.4 Activities — per day

```
blended   = (inexp_meal_1p + 10.00) / 2       # USD

free      = 0
budget    = blended × 2
mid_range = blended × 5.5
high_end  = blended × 12
```

Activities are the weakest-grounded category, because there is no equivalent of Numbeo for "cost of a day tour." The blended factor is a deliberate compromise between two failure modes observed during development:

| Approach | Bangkok high-end | Copenhagen high-end | Verdict |
|---|---|---|---|
| Pure local scaling (`inexp_meal × 15`) | A$43/day | A$535/day | Both wrong |
| Pure global constant | Same everywhere | Same everywhere | Ignores real variation |
| **Blended (adopted)** | **A$135/day** | **A$298/day** | Plausible both ends |

The rationale is that activity pricing has both a local labour component (guides, transport, entry fees) and a globally-traded component (dive gear, ski lifts, permits, insurance). A A$43/day "high-end" tier in Bangkok was falsifiable on its face — a single cooking class costs more than that.

**This block should be read as an informed prior, not a measurement.** It is the highest-priority target for replacement with real data (Section 11).

---

## 6. Group Scaling Model

The database stores 2-person values. Scaling to N ∈ {1…5} happens at runtime, because scaling behaviour differs fundamentally by category.

### Accommodation — dorm beds (per-bed pricing)
```
scaled = base_2p × (N / 2)
```
Linear. Dorm beds are sold individually.

### Accommodation — all private rooms (private/1★/2★/3★/4★)
```
rooms  = ceil(N / 2)
scaled = base_2p × rooms
```

| N | Rooms | Multiplier |
|---|---|---|
| 1 | 1 | ×1.0 |
| 2 | 1 | ×1.0 |
| 3 | 2 | ×2.0 |
| 4 | 2 | ×2.0 |
| 5 | 3 | ×3.0 |

This is the only genuinely **non-linear, discontinuous** part of the model, and it is the one users notice most. Hotels price by room, not by head: a solo traveller pays the full double rate, and the third person in a group triggers a full second room. The step function is the correct model of the underlying market, and it produces the app's most counter-intuitive but most useful output — the sharp cost jump from 2 to 3 travellers.

**Simplification:** the model assumes standard double occupancy and ignores triple rooms, family rooms, and extra-bed surcharges, which exist in much of Asia and Southern Europe and would soften the step. This makes the model **conservative** (over-estimating) for groups of 3 and 5.

### Food — with sharing discount
```
sharing_discount = 1 − 0.05 × max(0, N − 2)
scaled = base_2p × (N / 2) × sharing_discount
```

| N | Raw | Discount | Effective |
|---|---|---|---|
| 1 | 0.50 | — | ×0.500 |
| 2 | 1.00 | — | ×1.000 |
| 3 | 1.50 | 5% | ×1.425 |
| 4 | 2.00 | 10% | ×1.800 |
| 5 | 2.50 | 15% | ×2.125 |

Groups share plates, sides, and starters; per-head cost falls modestly with party size. The 5%-per-head coefficient is a judgement call, capped at 15%. It is small enough to be defensible and large enough to matter over a long trip.

### Drinks and activities
```
scaled = base_2p × (N / 2)
```
Strictly linear. Both are individually consumed and individually ticketed.

### Reference implementation
```python
import math

def scale_cost(base_2p: float, n_people: int, category: str) -> float:
    """Scale a 2-person base cost to a group of N."""
    if category == "accom_dorm":
        return base_2p * (n_people / 2)
    if category == "accom_room":
        return base_2p * math.ceil(n_people / 2)
    if category == "food":
        discount = 1.0 - 0.05 * max(0, n_people - 2)
        return base_2p * (n_people / 2) * discount
    return base_2p * (n_people / 2)          # drinks, activities
```

---

## 7. Validation

This is the section that matters, and it requires one distinction up front.

> **Internal consistency** asks: *do the derivation rules behave stably across cities?*
> **External accuracy** asks: *are the resulting numbers actually correct?*
>
> These are different questions. A model can be perfectly self-consistent and uniformly wrong. Most of the validation originally performed on this database measured the first, and was initially over-interpreted as evidence for the second.

### 7.1 Internal consistency

For each derived ratio, the coefficient of variation (CV = σ/μ) was computed across a 20-city calibration sample spanning the full cost spectrum. Low CV means the rule produces proportionally similar results everywhere — i.e. it is not silently doing something different in Copenhagen than in Hanoi.

| Ratio | Mean | CV | Reading |
|---|---|---|---|
| Food high-end / mid-range | 1.50 | 0.0% | Fixed coefficient — trivially stable |
| Activities high-end / budget | 6.00 | 0.0% | Fixed coefficient — trivially stable |
| Drinks heavy / light | 5.69 | **11.5%** | Genuinely stable; varies only via local beer:cocktail spread |
| Hostel private / dorm | 1.38 | **13.7%** | Genuinely stable |
| Food mid-range / street food | 2.62 | **21.3%** | Structurally variable — see below |

Two of these are uninformative by construction: where a rule is a fixed multiplier, CV is necessarily zero and tells you nothing. The informative results are the three that emerge from data.

The **food mid/street ratio at 21.3%** is the interesting one. That variance is not noise — it is signal. In Southeast Asia, street food runs 3–4× cheaper than restaurant dining; in Western Europe the gap compresses to roughly 2×, because the informal sector is smaller and more regulated. A rule that forced this ratio constant would be *less* accurate, not more. The variance is the model correctly tracking a real structural difference between food economies.

**What this section does not establish:** nothing here says the prices are right. CV measures the stability of ratios between derived tiers. If every anchor in the database were 30% too low, every ratio above would be unchanged and every CV would be identical. Internal consistency is necessary but nowhere near sufficient.

### 7.2 External accuracy audit

To measure actual accuracy, database values were compared against independently-retrieved reference prices for three cities chosen to span the cost range and the provenance tiers.

**Sample:** 9 anchor comparisons across Lisbon, Prague, and Hanoi. Reference data retrieved July 2026 from Numbeo, HikersBay, and World-Prices. FX converted at rates implied by the source pages (EUR→USD 1.144; CZK→USD 0.0469).

| City | Anchor | Reference | Database | Error |
|---|---|---|---|---|
| Lisbon | Inexpensive meal | $17.16 | $11.00 | **−35.9%** |
| Lisbon | Mid-range meal (2p) | $62.92 | $50.00 | **−20.5%** |
| Lisbon | Draft beer | $3.43 | $3.00 | −12.6% |
| Lisbon | Cappuccino | $2.94 | $1.50 | **−49.0%** |
| Prague | Cappuccino | $3.77 | $3.20 | −15.1% |
| Prague | Draft beer | $2.81 | $2.80 | −0.5% |
| Prague | Inexpensive meal | $9.38 | $9.00 | −4.1% |
| Hanoi | Cappuccino | $1.75 | $1.50 | −14.3% |
| Hanoi | Inexpensive meal | $1.90 | $2.00 | +5.3% |

**Aggregate:**

| Statistic | Value |
|---|---|
| Median absolute percentage error | **14.3%** |
| Mean absolute percentage error (MAPE) | **17.5%** |
| Mean signed error (bias) | **−16.3%** |
| Median signed error | −14.3% |
| Within ±15% | 56% |
| Within ±25% | 78% |
| Worst case | −49.0% (Lisbon cappuccino) |

**By city:**

| City | n | Median APE | Bias |
|---|---|---|---|
| Prague | 3 | 4.1% | −6.6% |
| Hanoi | 2 | 9.8% | −4.5% |
| **Lisbon** | 4 | **28.2%** | **−29.5%** |

### 7.3 Interpreting the audit

Three findings, in order of importance.

**Finding 1 — There is a systematic downward bias, not random error.**

Eight of nine comparisons are negative. Mean signed error is −16.3%, and median signed error (−14.3%) is nearly identical to median *absolute* error (14.3%) — the signature of a one-directional shift rather than symmetric noise. This is the most consequential result on this page: the database does not scatter around the truth, it sits below it.

The likely mechanism is a **training-data recency gap**. Tier-C anchors were generated by a language model whose price intuitions were formed on data predating the 2023–2026 inflation cycle. Prices have moved; the estimates have not.

This diagnosis is testable and the audit supports it: the bias is largest exactly where consumer inflation has been steepest. Portugal and Spain have seen substantial hospitality-price growth driven by tourism demand recovery. Vietnam has not. Lisbon shows −29.5% bias; Hanoi shows −4.5%.

**Finding 2 — A systematic bias is far less damaging to this product than random error would be.**

The app's primary outputs are *comparative* — which destination fits the budget, how long the money lasts, how the trip changes if you upgrade a tier. A uniform multiplicative bias leaves all of those rankings intact. It shifts the absolute total without reordering anything.

But the bias is **not** uniform — it is region-dependent, running roughly −30% in Southern Europe and −5% in Southeast Asia. That differential *does* distort cross-region comparison, and it distorts it in a specific, correctable direction: **European destinations currently look cheaper relative to Asian ones than they truly are.** A user comparing Lisbon against Hanoi is being given a materially misleading contrast.

**Finding 3 — Error propagates linearly and predictably into tiers.**

Because every derivation rule is a linear combination of anchors, anchor error passes through analytically. Worked example on the drinks basket:

| City | Reference basket | Database basket | Propagated error |
|---|---|---|---|
| Lisbon | $12.74 | $9.00 | **−29.4%** |
| Prague | $13.17 | $12.00 | −8.9% |

The propagated tier error tracks the weighted mean of its component anchor errors, exactly as the linear structure predicts. This is a genuine architectural benefit: **error is traceable and correctable at the anchor layer.** Fix the ten anchors and all seventeen tiers correct themselves, with no re-fitting.

### 7.4 What this audit is not

Stated plainly, so no one over-reads it:

- **n = 9 is a spot check, not a study.** No confidence intervals are quoted because none would be meaningful at this sample size.
- **Three cities cannot characterise 121.** Africa, Latin America, North America, Oceania, and East Asia are entirely unsampled. Southeast Asia — 44 cities, 36% of the database — rests on two data points.
- **Accommodation is completely unaudited.** All nine comparisons are food and drink anchors. Accommodation is the largest line item in almost every itinerary, and nothing here says anything about it.
- **Activities are unaudited and, unlike the other blocks, have no clean external reference to audit against.**
- **Reference sources are themselves crowd-sourced** and carry their own error, unquantified here. Numbeo's own published ranges are wide — Lisbon's inexpensive meal spans €12–20 around a €15 median.
- **Tiers were audited only via propagation**, never directly. No one has checked whether two people eating "mid-range" in Kyoto actually spend the modelled amount.

### 7.5 Designed validation protocol

The following is specified and ready to execute. It is documented here because a methodology page should state the standard it is working toward, not only the standard it has reached.

**Stratified sampling.** 30 cities, stratified by region (9 strata) and cost quartile, sampled proportional to database composition. Gives ~10 cities in SEA, ~7 in Europe, and non-zero coverage everywhere.

**Blind anchor re-collection.** All 10 anchors re-retrieved per sampled city from primary sources, date-stamped, by a process with no sight of existing database values. Prevents anchoring bias in the audit itself.

**Metrics.** Per-anchor and per-tier APE; MAPE and median APE with bootstrap 95% CIs; signed bias overall and by region, anchor type, and provenance tier; Spearman rank correlation between database and reference city orderings (the metric that actually matters for a comparison tool).

**Provenance-stratified analysis.** Tier-A vs Tier-B vs Tier-C error compared directly. This is the decisive experiment: it quantifies exactly what model-estimated anchors cost in accuracy versus retrieved ones, and tells us whether Tier C is usable with correction or must be replaced outright.

**Tier-level ground truth.** For 5 cities, construct tier values by hand from actual menus, listings, and ticket prices, independent of the anchor pipeline. Tests the *derivation rules* rather than the inputs — the one thing propagation analysis cannot do.

**Acceptance thresholds.** Target median APE ≤ 15% and |bias| ≤ 5% per region. Any region breaching either gets re-anchored before publication.

---

## 8. Error Budget

Decomposing total error by source, with current status:

| Source | Est. contribution | Measured? | Mitigation |
|---|---|---|---|
| Anchor staleness / recency bias | **Dominant (≈16% systematic)** | Yes, n=9 | Re-anchor to live sources |
| Anchor sampling error (crowd-sourced variance) | Moderate | No | Multi-source triangulation |
| FX translation | Low (~2–5%) | No | Live rate at query time |
| Derivation rule error (fixed coefficients) | Moderate, unquantified | No | Tier-level ground truth |
| Activities model | **Potentially large** | No | Replace with real ticket data |
| Seasonality (unmodelled) | Large for accommodation (30–100% peak) | No | Seasonal multiplier layer |
| Group scaling assumptions | Low, conservative direction | No | Triple-room modelling |

The honest reading: one error source is measured, one is bounded by construction, and five are not yet quantified. Total uncertainty on any single tier value is therefore **wider than the 17.5% MAPE figure suggests** — that figure covers only the anchor layer for food and drink.

---

## 9. Limitations and Known Failure Modes

1. **Systematic under-estimation, regionally uneven.** −16% overall, ≈−30% in Southern Europe, ≈−5% in Southeast Asia. Europe currently looks cheaper than it is, relative to Asia.
2. **Provenance is predominantly model-estimated.** ~90% of cities are Tier C.
3. **Accommodation is entirely unvalidated** despite being the largest line item.
4. **Activities are an informed prior, not a measurement.**
5. **No seasonality.** All values are shoulder-season. Peak periods (New Year, Golden Week, Songkran, European August) can move accommodation 30–100%.
6. **Fixed 4-star multiplier** under-models cities with deep luxury segments.
7. **No intra-city variation.** One number per city; central Tokyo and outer Tokyo are not distinguished.
8. **Remote destinations are least reliable and most needed.** Pu Luong, Don Det, Santa Fe are Tier B/C by necessity — exactly where travellers have least prior intuition.
9. **Static FX.** The 1.55 USD→AUD rate is a snapshot; it should be live.
10. **Reference sources carry unquantified error of their own.**

---

## 10. Reproducibility

The pipeline is fully deterministic and re-runnable:

```
anchors (dict, 121 × 10)
    → derive_tiers_base2()          # pure function, no fitted state
    → tier values (121 × 17, USD)
    → FX conversion
    → tier values (121 × 17, AUD)
    → app CSV
```

Every published number can be recomputed from the anchor table and the formulas in Section 5. No hidden state, no manual overrides, no unexplainable values.

**Extension to new cities** uses a structured prompt that enforces the same anchor definitions, source hierarchy, derivation formulas, and fallback rules, and requires a self-reported provenance tier. New entries are therefore generated by the same process as existing ones — which means they inherit the same known bias, and the same correction will apply to them.

---

## 11. Remediation Roadmap

Ordered by expected accuracy gain per unit of effort.

**1. Re-anchor to live sources (highest priority).**
Replace Tier-C anchors with retrieved values, prioritising the 30 highest-traffic cities and the regions with largest measured bias. Directly addresses the dominant error term.

**2. Apply an interim regional bias correction.**
Until re-anchoring completes, apply an empirically-derived per-region multiplicative correction. Crude, but a measured +30% on Southern European anchors is strictly better than a known −30% error, and it can ship immediately.

**3. Execute the Section 7.5 validation protocol.**
Converts the current n=9 spot check into a defensible accuracy claim with confidence intervals, and settles whether Tier C is salvageable with correction.

**4. Audit accommodation.**
Largest line item, currently zero coverage.

**5. Replace the activities model with observed data.**
Scrape representative ticket and tour prices per city. Removes the model's least-grounded block.

**6. Add a seasonality layer.**
Month-level multipliers on accommodation, calibrated per city or per region.

**7. Publish per-value confidence intervals.**
Once the error distribution is characterised, surface uncertainty in the UI rather than presenting point estimates as exact. A range is more honest and more useful than a false-precision number.

---

## 12. Design Note

The most useful thing this exercise produced was not the database. It was the discovery, on measurement, that the validation originally performed had answered a different question from the one that mattered.

Coefficient-of-variation analysis across the calibration sample returned reassuring numbers — 11.5%, 13.7%, several at zero — and those numbers were initially read as evidence the estimates were sound. They were not. They demonstrated that the *derivation rules* were stable, which is a real and necessary property, and which is entirely compatible with every underlying price being wrong in the same direction. It took an external comparison against retrieved reference data to surface a −16% systematic bias that no amount of internal consistency checking could ever have exposed.

That distinction — between a model that is coherent and a model that is correct — is the one worth carrying forward. Self-consistency is cheap to measure and easy to mistake for accuracy. Ground truth is expensive, sparse, and the only thing that actually settles the question.

---

*Cost data compiled from Numbeo, Hostelworld, Booking.com, HikersBay, World-Prices, Price of Travel, and BudgetYourTrip. All figures in AUD unless stated. Accuracy figures reflect an n=9 indicative audit and should be read as preliminary.*
