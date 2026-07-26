# City Cost Estimation — Methodology

**Version 4 · July 2026 · Status: collection contract tested end to end; app integration not yet built**

This document describes how Holiday Spend estimates the cost of travelling in a city: what is measured, where the numbers come from, which models were considered, which were chosen, and what the measured error is. It is written to be auditable — every accuracy claim below traces to a reproducible script and a stored artifact.

**What is established, in one paragraph.** Food and drink prices are reproduced **exactly** — 29 of 29 measures across six runs — whenever a direct source lookup succeeds, and are 10–19% wrong when it fails, so the lookup's success flag is a trust marker rather than telemetry. Accommodation is collected reproducibly from named URL templates, but carries a **~50% upward bias on hotel classes** measured against direct property quotes in one city. Tier ratios are modelled from a closed 99-city sample with model forms settled and stable, though the shipped coefficients still require their own calibration (§7.8). Activity prices have no derivation path and must be collected or published missing.

---

## 1. The problem

The app plans multi-city trips and needs, for each city, **19 cost values**: six accommodation tiers (hostel dorm through 4-star), four food tiers, five drinks tiers, and four activity tiers. All are quoted for two travellers, per night for accommodation and per day otherwise, in AUD.

Three constraints shape everything that follows:

1. **Accuracy needs to be reasonable, not exact.** A traveller deciding between Lisbon and Copenhagen needs the right order of magnitude and the right ranking, not a quote.
2. **Refresh must be cheap.** Prices drift. A method costing thousands of lookups per refresh will never be re-run, and a stale dataset is worse than an approximate one.
3. **Users add cities on demand.** The 122nd city must cost roughly what the first 121 cost each, not require a research programme.

Constraint 2 and 3 rule out approaches that are accurate but unrepeatable. This is a *cost-per-refresh* problem as much as an accuracy problem.

### Estimand

For each city and each tier, the target is the **typical amount two travellers actually spend**, not the cheapest advertised rate. This distinction matters more than it first appears — see §5.3.

---

## 2. Why the previous approaches were replaced

### 2.1 Version 1: anchors and asserted multipliers

v1 asked a language model for ten anchor prices, then applied fixed multipliers to derive all 19 tiers. It had four defects, three of them structural:

| Defect | Evidence |
| --- | --- |
| Anchors came from model memory, not a live source | The request body contained no search tool; the prompt instructed the model to "research Numbeo" pages it could not fetch |
| Multipliers were asserted globally | e.g. `street_food = inexpensive_meal × 0.60` everywhere |
| An additive constant that does not scale | `activities_blended = (inexpensive_meal + 10.0) / 2` — negligible in Zurich, dominant in Hanoi |
| The model also did arithmetic and currency conversion | Three error sources compounded |

### 2.2 The audit that condemned it — and its limits

An accuracy audit reported **17.5% MAPE and −16.3% bias**, and triggered a full rebuild. Re-examined, that audit is **nine observations across three cities**, six of which benchmark against Numbeo. Its headline bias is largely one city: Lisbon's stored cappuccino was €1.50 against a reference €2.57 (−49%), and its cheap meal −36%. Prague and Hanoi sat within 0–15%.

**The conclusion drawn was too strong for the evidence.** The architecture was not disproven; the *inputs* were stale, and the multipliers were never calibrated. That reading is what v4 acts on.

### 2.3 Version 3: observed-first, and why it stalled

v3 attempted direct source-attributed observation of 17 measures across a 36-city pilot, with pre-registered acceptance gates and seasonal accommodation panels. After substantial collection it reached **156 of 684 tier cells (22.8%) and zero complete cities**.

The cause was structural, and worth stating because it is the central design lesson:

> **Tiers are conjunctions of measures.** `food_mid_range` requires street-food *and* inexpensive-meal *and* mid-range-meal prices. A city missing one input yields no cell for any tier naming it.

Under conjunctive baskets, breadth is the wrong collection shape. Four measures stood at zero observations, and `street_food_meal_1p` alone blocked three tiers across all 36 cities — 108 cells from one absent item. Completing the pilot needed ~1,100 further data points; the full 121-city set needed ~17,300 lookups, and that cost recurred at every refresh.

---

## 3. Design principles

The failure above is a symptom of conflating three properties that behave very differently:

| Property | Stability | Correct treatment |
| --- | --- | --- |
| **Level** — the absolute price in a city | Drifts slowly | Measure it, cheaply |
| **Structure** — ratios between tiers | Very stable | Model it, calibrated from data |
| **Drift** — change over time | Continuous | Re-measure levels periodically; leave structure alone |

v3 treated all three as requiring direct observation, per city, per refresh. v4 measures level, models structure, and refreshes only level.

**Measure what is cheap to measure. Model only the gaps. Never assert a constant.**

---

## 4. Evidence gathered

All collection is by page fetch or web search. No paid data APIs.

| Artifact | Content |
| --- | --- |
| `phase-0a-numbeo-anchors.json` | Anchors for 5 dry-run cities, with per-city quality metadata |
| `phase-0b-accommodation-search.json` | Accommodation reconnaissance, 5 cities, all tiers |
| `phase-0d-numbeo-expanded-sample.json` | Anchors for 22 further cities spanning 9 regions |
| `phase-0e-stage1-numbeo-sample.json` | **Stage 1 expansion**: 27 further cities, band-stratified, plus 4 rejections and 5 no-source outcomes |
| `phase-0f-stage2-numbeo-sample.json` | **Stage 2 census attempt**: all 27 remaining production cities attempted — 14 retained, 6 rejected, 7 with no source page |
| `city_cost_collection_batches.json` | 176 retained observations from the v3 programme, reused as modelling data |
| `phase-0c-ratio-model-fit.json` | Fitted models and validation results |

**Pooled modelling sample: 99 cities across all nine regions**, each carrying between two and six directly observed price measures in local currency. Every city in the 121-city production dataset has now been attempted, so the sample frame is closed: no further collection is possible from this source.

### 4.0 Sample expansion, in two stages

The sample was expanded in a deliberate stage, for a reason worth stating: the headline pool size was misleading. Three relationships had 56 cities; `mcmeal_combo` — the one relationship where cost bands demonstrably matter — had **27**, giving bands of about nine cities each. That was the binding constraint, and it is invisible if you only read the pool total.

Two design choices governed the draw:

1. **New cities rather than backfilling.** One page fetch returns all five measures, so adding an unpooled city lifts `mcmeal` *and* the other three relationships for the same cost, where backfilling `mcmeal` onto an existing city lifts one. Cost per unit of information, not city count, is the quantity to optimise.
2. **Band-stratified, from the production frame.** All 58 pooled cities already sat in the 121-city production dataset, and 63 remained unpooled — but those 63 were low-heavy (31/17/15). An unstratified draw would have deepened the band already best covered. The draw is deterministic and recorded in `phase-0e-stage1-selection.json`.

Stage 1 reached **85 pooled cities**, with `mcmeal` at 54 (bands of 14/19/21) and the other three at 83. That made R3 fittable for the first time (§6.2), but left one relationship unsettled: `midrange ~ inexpensive` selected R1 on the full sample and R0 with thin-source cities excluded.

**Stage 2 attempted every remaining city**, closing the frame. Outcomes across all 27:

| Outcome | n | Cities |
| --- | --- | --- |
| Retained | 14 | Osaka, Kyoto, Florence, Athens, Munich, Reykjavik, Busan, Belgrade, Buenos Aires, Tel Aviv, Penang, Cebu, Koh Samui, Bali (Ubud) |
| Rejected on the contributor floor | 6 | Krabi (9), Langkawi (5), Phu Quoc (2), Palawan/El Nido (3), Bali/Kuta (2), Nikko (no entry) |
| No source page at all | 7 | Cat Ba, Ninh Binh, Sa Pa, Don Det, Bagan, Siargao, Santa Fe (Bantayan) |

Final sample: **99 cities**, `mcmeal` at 68 (bands of 17/23/28), the other three at 97 (23/35/39), holdouts of 17–24.

**A stated contributor floor.** Stage 1 rejected cities at 5 and 6 contributors without recording a threshold, leaving the boundary undefined. Stage 2 fixes it: **at least 10 contributors and an update within 12 months**, applied to both stages. Krabi at 9 falls just below and is rejected — the alternative was an undocumented case-by-case judgement, which is exactly the kind of unrecorded discretion this methodology exists to remove.

**Attrition is a cliff, not a slope.** The retained cities have a median of 63 contributors; the rejected ones have between 2 and 9. Almost nothing sits in between. Public price coverage is close to **binary by destination type** — established cities have usable pages, and small island or village destinations have none, or a page with single-digit contributors. Combined with Stage 1's 55% low-band failure rate, this is the empirical case for §9: the fallback cannot be a thinner version of the same source, because no such thing exists.

**The low band stays thinnest, and cannot be fixed.** Of 13 unpooled low-band cities, only 4 were retained. That band is where `mcmeal`'s coefficient does its work, and no further collection can improve it — the remaining destinations have no public aggregation to collect.

**One recovered gap.** Ubud was recorded in the v3 programme as a fail-closed source gap, on the basis that the only page inspected had an unlabelled currency scale. The country-suffixed slug returns labelled IDR prices. The gap was a slug-resolution failure, not an absence of evidence.

**One operational finding.** The anchor source returned HTTP 429 after roughly 40 fetches in quick succession. A 121-city refresh must be paced or checkpointed rather than issued as a burst — a constraint on refresh *design*, not on feasibility.

### 4.1 Per-city quality signal, obtained free

The primary anchor source publishes, on the same page as the prices, a contributor count and last-update date. This is a per-city reliability measure at zero marginal cost, and it discriminates sharply:

| City | Contributors | Window | Last update | Warning |
| --- | --- | --- | --- | --- |
| Lisbon | 230 | 12 months | same day | — |
| Copenhagen | 154 | 12 months | 6 days | — |
| Chiang Rai | **19** | **18 months** | **4 months** | *"Some data are estimated due to a low number of contributors"* |

Cities below a contributor floor are flagged and fall back to a lower cascade level rather than publishing a thin crowd median as fact.

### 4.2 Coverage findings

Reconnaissance deliberately included **Don Det**, a Mekong island village with no entry in any structured accommodation source and no page in the primary anchor source. It returned specific, named-property prices via search (budget bungalows 30,000–50,000 LAK; a named property at $50).

This matters because the dataset is **44 of 121 cities in Southeast Asia**, and its 20 cheapest cities are exactly this kind of destination. A method that works only for major cities would fail on more than a third of the portfolio.

Hostel dorm and private-room prices were obtainable for four of five cities — a gap that eliminated an otherwise-attractive hotel API, which has no property-type field and therefore cannot represent hostels at all.

---

## 5. Statistical method

### 5.1 Modelling ratios, not prices

Every relationship modelled is a **within-city ratio** of two prices in the same local currency. Currency cancels exactly, so **no FX conversion enters the model** and no exchange-rate error propagates into the fitted coefficients. FX is applied once, afterwards, at presentation.

This also makes cities comparable without normalising for price level: a ratio is dimensionless.

### 5.2 Error metrics, and why these

| Metric | Purpose | Why not the alternative |
| --- | --- | --- |
| **Median absolute percentage error** | Typical error magnitude | The mean is dominated by a few large percentage misses on cheap items |
| **Median signed log error**, `median ln(pred/actual)` | Bias | Percentage error is asymmetric: predicting double is +100%, predicting half is −50%. Log error is symmetric for reciprocal errors, which is the correct treatment for multiplicative price error |
| **p90 absolute percentage error** | Tail behaviour | Distinguishes "usually good, occasionally awful" from "uniformly mediocre" — different problems with different fixes |

**Bias and variance are not equally harmful here.** A trip total sums many tiers across many cities. Unbiased noise partly cancels in that sum; systematic bias compounds. Reported per-tier error therefore overstates the error on the number a user actually sees, provided bias is near zero — which §7 confirms it is.

### 5.3 The estimand trap

Accommodation figures from different sources disagreed by up to **4×** for the same city and star class (one source reported Hanoi 4-star at $100, another at $25). Investigation showed these were not errors but *different estimands*: "from" prices, blended annual averages, seasonal figures, and city-versus-metro boundaries, none labelled.

Two consequences:

1. **A number whose basis is unknown is unusable**, regardless of how easily obtained. Collection therefore requires an explicit basis per figure, and rejects figures lacking one.
2. **A price-sanity check must compare like with like.** An initial check appeared to fail by 47% — a shoulder-season median of five specific central 4-star properties against an undated, blended, city-wide average. The gate was measuring basis mismatch, not source error, and was restated.

### 5.4 Validation design

Two independent schemes, deliberately:

- **Leave-one-city-out.** Each city is predicted from a model fitted on all others. Uses the full sample; the primary estimate at these sample sizes.
- **Fixed 25% holdout.** Every fourth city alphabetically, held out entirely. A clean out-of-sample check, but noisy at 6–14 cities.

Running both is the point. **When they disagree, the difference between models is smaller than the noise in detecting it** — which is itself the finding, and the basis of the selection rule in §7.

### 5.5 Cost bands

Where models allow a regional effect, cities are grouped into three cost bands by tercile of an existing currency-normalised food tier.

**The terciles are cut on all 121 production rows, not on the pooled sample** — at AUD 46.50 and 101.68. This matters for a reason that only appears once a sample is expanded in stages: cutting on the sample would move the thresholds every time a city is added, so a coefficient fitted at n=58 would not be comparable to one fitted at n=85. Fixing the cuts on the production distribution makes stages comparable and makes the bands mean the same thing for a user-added city as for a pilot city.

A city with no production row is **excluded from banded models rather than defaulted into `mid`**. Silently defaulting would inflate the middle band with cities of unknown cost level, biasing the one coefficient most likely to look reasonable.

Geographic region is deliberately *not* used: Europe spans Sofia and Copenhagen, so region is a poor proxy for price level. Banding on measured cost is more honest and more predictive.

---

## 6. Models considered

### 6.1 Notation

Every model predicts one unobserved price in a city from one observed price **in that same city**. All quantities are per-city.

| Symbol | Name | Definition |
| --- | --- | --- |
| `i` | City index | One of the *n* cities carrying both prices of the relationship being fitted |
| `A_i` | **Anchor** | The *observed* price used as the predictor, in city `i`'s local currency. Always a measure obtained directly (§7.2) — e.g. `domestic_draft_beer_1` |
| `T_i` | **Target** | The price being predicted, same city, same currency — e.g. `cocktail_1` |
| `T̂_i` | Prediction | The model's estimate of `T_i` |
| `r_i` | **Observed ratio** | `T_i / A_i`. Dimensionless: currency cancels because both prices are in city `i`'s currency |
| `band(i)` | **Cost band** | `low`, `mid` or `high` — city `i`'s tercile of the currency-normalised cost index (§5.5) |
| `k` | Global ratio coefficient | One constant, shared by all cities (R0) |
| `k_band` | Band ratio coefficient | Three constants, one per cost band, so `k_low`, `k_mid`, `k_high` (R1) |
| `a` | Log-scale intercept | Sets the overall price level in R2. `e^a` is the predicted target when the anchor is 1 unit |
| `b` | **Elasticity** | The power in R2. `b = 1` means strict proportionality; `b > 1` means the target rises *faster* than the anchor as cities get dearer |
| `n` | Sample size | Cities with both `A` and `T` observed. Differs per relationship — a city missing either is excluded from that fit only |

**Read `T ~ A` as "target predicted from anchor".** So `cappuccino ~ beer` means beer is observed and cappuccino is predicted.

### 6.2 Model forms

Four forms, in increasing complexity:

```
R0    T̂_i = k · A_i                            1 parameter
R1    T̂_i = k_band(i) · A_i                    3 parameters
R2    ln T̂_i = a + b · ln A_i                  2 parameters
R3    ln T̂_i = a_band(i) + b_band(i) · ln A_i  6 parameters   (specified, not fitted)
```

What each one assumes:

| Form | Assumption about the ratio `T/A` | Fails when |
| --- | --- | --- |
| **R0** | The ratio is **one number worldwide**. A cocktail costs `k` times a beer in every city on earth | The ratio varies systematically with price level |
| **R1** | The ratio is **constant within a cost band** but differs between bands. Three numbers, not one | The ratio varies continuously rather than in three steps, or bands are the wrong grouping |
| **R2** | The ratio **drifts smoothly with price level**. Rearranged: `T̂/A = e^a · A^(b−1)`, so the implied ratio depends on `A` itself unless `b = 1` | The drift is not log-linear |
| **R3** | Both a level shift and a different drift rate per band | Any of the above, at 6 parameters on ≤56 cities |

**The nesting structure matters for interpretation.** R2 nests R0: when `b = 1`, R2 collapses to `T̂ = e^a · A`, i.e. R0 with `k = e^a`. R3 nests R1 the same way: when every `b_band = 1`, R3 collapses to R1. So the two "power law" forms only earn their keep if the fitted elasticities depart from 1 — and §7.4 shows they do not.

**R3 is fitted.** An earlier version of this document declined to fit it, on the grounds that three bands of ~9 cities could not support 6 parameters. The Stage 1 sample expansion (§4) lifted the bands to 14–32 cities, and R3 is now estimated directly rather than dismissed. A band below 8 cities falls back to the global log-log line rather than fitting two parameters on a handful of rows.

### 6.3 Estimation

| Form | Method | Why |
| --- | --- | --- |
| R0 | `k = exp( mean_i [ ln(T_i / A_i) ] )` — the **geometric mean** of observed ratios | The arithmetic mean of ratios is asymmetric: a city at ratio 2.0 and one at 0.5 average to 1.25, not 1.0. The geometric mean returns 1.0, the correct centre for multiplicative quantities |
| R1 | Same, computed **within each band**; a band with fewer than 3 cities falls back to the global `k` | Prevents a two-city band from producing a coefficient with no support |
| R2 | Ordinary least squares of `ln T` on `ln A` | Fitting in logs makes the error multiplicative rather than additive, so a 20% miss on a ₫50,000 meal and on a €15 meal count equally |

Working in logs throughout is not cosmetic. Price errors are proportional, not absolute — nobody cares that Copenhagen is off by €4 and Hanoi by ₫4,000 in the same units. Every estimator and every metric (§5.2) is therefore log-based.

### 6.4 Fitted coefficients on the full pool

Fitted on the closed 99-city sample (§4), band cuts at AUD 46.50 / 101.68:

| Relation `T ~ A` | n | R0: `k` | R1: `k_low / k_mid / k_high` | R2: `a`, `b` |
| --- | --- | --- | --- | --- |
| `midrange ~ inexpensive` | 97 | 5.7388 | 7.4176 / 5.9851 / 4.7503 | 1.5110, 1.0446 |
| `mcmeal ~ inexpensive` | 68 | 0.9852 | 1.7260 / 1.0898 / 0.6452 | −0.3713, 1.0694 |
| `cappuccino ~ beer` | 97 | 0.8916 | 1.1304 / 1.0614 / 0.6629 | −0.3068, 1.0431 |
| `attraction ~ inexpensive` | 29 | 1.0571 | 1.0552 / 1.0270 / 1.0818 | 0.5111, 0.9183 |

**Reading a row.** Take `cappuccino ~ beer`. R0 says a cappuccino costs 0.8916 × the price of a draft beer, everywhere. R1 says 1.13× in cheap cities, 1.06× in mid, but only 0.66× in expensive ones — coffee is relatively dearer where drinks are cheap. R2 says `ln(cappuccino) = −0.3068 + 1.0431 × ln(beer)`, i.e. `cappuccino = 0.7358 × beer^1.0431`.

Three structural readings fall straight out of the table, and each is confirmed by the performance results in §7.4:

- **`mcmeal` is the outlier.** Its R1 coefficients run 1.73 → 1.09 → 0.65, a **2.7× monotonic decline** across bands, while its R0 constant sits at 0.9852 — almost exactly the midpoint of a relationship that has no midpoint. §7.5 develops this.
- **Every R3 band elasticity is ≈ 1.** Since R3 collapses to R1 at `b = 1`, its three extra parameters are estimating departures from proportionality that are **not there**. That is the mechanistic reason R3 wins nothing in §7.4 — not sample size. R3's coefficients are omitted from the table above because it is selected nowhere; they are in the fit artifact.
- **`attraction` has no band structure at all**: 1.055 / 1.027 / 1.082, three coefficients that are effectively one number. Compare `mcmeal`'s 2.7× spread. This is visible in the coefficients before any error metric is computed.

---

## 7. Results

This section gives the complete specification: every tier the app publishes, the exact arithmetic producing it, where each input comes from, and the measured error of every modelled step.

### 7.1 The 19 published tiers and their formulas

Each tier is a **basket** — a fixed, published quantity bundle for **two travellers**, per night for accommodation and per day otherwise. The basket composition is a product decision, held fixed across all cities so that cities are comparable; only the input prices vary.

**Accommodation** — per night, two travellers sharing:

| Tier | Formula | Inputs |
| --- | --- | --- |
| `accom_shared_hostel_dorm` | `2 × hostel_dorm_bed_1p` | 1 |
| `accom_hostel_private_room` | `hostel_private_room_2p` | 1 |
| `accom_1_star` | `hotel_1star_room_2p` | 1 |
| `accom_2_star` | `hotel_2star_room_2p` | 1 |
| `accom_3_star` | `hotel_3star_room_2p` | 1 |
| `accom_4_star` | `hotel_4star_room_2p` | 1 |

Accommodation is the only category where a tier is a single measure. Two people in a dorm buy two beds; two people in a room buy one room — that is the whole of the arithmetic. This makes accommodation the category where **collection difficulty, not derivation, is the entire problem**.

**Food** — per day, two travellers, three meals each. The tiers differ by how the six meals are allocated between street food, cheap restaurants, and better restaurants:

| Tier | Formula | Meal mix (per day, both travellers) |
| --- | --- | --- |
| `food_street_food` | `6 × street_food_meal_1p` | 6 street |
| `food_budget` | `4 × street_food_meal_1p + 2 × inexpensive_restaurant_meal_1p` | 4 street, 2 cheap restaurant |
| `food_mid_range` | `2 × street_food_meal_1p + 2 × inexpensive_restaurant_meal_1p + midrange_restaurant_meal_2p` | 2 street, 2 cheap, 1 shared mid-range dinner |
| `food_high_end` | `2 × inexpensive_restaurant_meal_1p + midrange_restaurant_meal_2p + premium_restaurant_meal_2p` | 2 cheap, 1 mid-range, 1 premium dinner |

This is where v3's conjunctive-basket problem bites: `street_food_meal_1p` appears in three of the four tiers, so a city missing it publishes only `food_high_end`.

**Drinks** — per day, two travellers, by drinking intensity:

| Tier | Formula |
| --- | --- |
| `drink_coffee` | `cappuccino_1` *(unit price, not a basket)* |
| `drinks_none` | `2 × cappuccino_1` |
| `drinks_light` | `2 × cappuccino_1 + 2 × domestic_draft_beer_1` |
| `drinks_moderate` | `2 × cappuccino_1 + 4 × domestic_draft_beer_1 + 2 × cocktail_1` |
| `drinks_heavy` | `2 × cappuccino_1 + 6 × domestic_draft_beer_1 + 4 × cocktail_1 + 2 × wine_glass_1` |

The coffee term is constant across all four intensity tiers — "none" means no alcohol, not no drinks.

**Activities** — per day, two travellers:

| Tier | Formula |
| --- | --- |
| `activities_free` | `0` |
| `activities_budget` | `2 × paid_attraction_adult_1` |
| `activities_mid_range` | `2 × half_day_group_activity_adult_1` |
| `activities_high_end` | `2 × full_day_premium_activity_adult_1` |

`activities_free` is a definitional zero and requires no evidence. The other three are each a single measure doubled, so — like accommodation — the difficulty is entirely in collection.

### 7.2 The 18 input measures and how each is obtained

The 19 tiers reduce to **18 distinct price measures**. This is the number that actually drives cost, and the split between them is the core result:

| Measure | Category | How obtained | Status |
| --- | --- | --- | --- |
| `inexpensive_restaurant_meal_1p` | Food | Anchor-source page fetch | **Measured** |
| `midrange_restaurant_meal_2p` | Food | Anchor-source page fetch | **Measured** |
| `mcmeal_combo` | Food (auxiliary) | Anchor-source page fetch | **Measured** |
| `street_food_meal_1p` | Food | Ratio from `mcmeal_combo` | **Modelled** |
| `premium_restaurant_meal_2p` | Food | Ratio from `midrange_restaurant_meal_2p` | **Modelled** |
| `cappuccino_1` | Drinks | Anchor-source page fetch | **Measured** |
| `domestic_draft_beer_1` | Drinks | Anchor-source page fetch | **Measured** |
| `cocktail_1` | Drinks | Ratio from `domestic_draft_beer_1` | **Modelled** |
| `wine_glass_1` | Drinks | Ratio from `domestic_draft_beer_1` | **Modelled** |
| `hostel_dorm_bed_1p` | Accommodation | Search extraction | **Measured** |
| `hostel_private_room_2p` | Accommodation | Search extraction | **Measured** |
| `hotel_1star_room_2p` | Accommodation | Search extraction | **Measured** |
| `hotel_2star_room_2p` | Accommodation | Search extraction | **Measured** |
| `hotel_3star_room_2p` | Accommodation | Search extraction | **Measured** |
| `hotel_4star_room_2p` | Accommodation | Search extraction | **Measured** |
| `paid_attraction_adult_1` | Activities | Official venue sites | **Measured** |
| `half_day_group_activity_adult_1` | Activities | Direct collection | **No derivation path** (§7.6) |
| `full_day_premium_activity_adult_1` | Activities | Direct collection | **No derivation path** (§7.6) |

**14 of 18 measures are observed directly. Four are modelled.** `mcmeal_combo` is collected but never published — it exists solely as the anchor for street food, chosen because §7.5 shows it carries information no other anchor does.

`street_food_meal_1p` is the single highest-value modelled measure: it appears in three tiers, and its absence was what stalled v3.

### 7.3 The four modelled measures — equations as shipped

Each modelled measure takes the form of §6, with the model form chosen by the rule in §7.4.

**M1 — Street food**

```
street_food_meal_1p = k_band × mcmeal_combo
```

Anchored on the fast-food combo rather than the cheap restaurant meal, because §7.5 establishes that the fast-food price carries the band signal a restaurant meal does not.

**M2 — Premium restaurant meal**

```
premium_restaurant_meal_2p = k × midrange_restaurant_meal_2p        (R0, single global constant)
```

**M3 — Cocktail** and **M4 — Wine by the glass**

```
cocktail_1   = k_band × domestic_draft_beer_1
wine_glass_1 = k_band × domestic_draft_beer_1
```

Both anchored on draft beer, the only alcohol price the anchor source publishes for every city.

**Status of the coefficients — stated precisely.** The pooled 58-city sample carries `mcmeal_combo`, `inexpensive`, `midrange`, `beer`, `cappuccino` and `paid_attraction`. It does **not** carry `street_food`, `premium`, `cocktail` or `wine_glass` at usable density — those are precisely the measures v3 failed to collect. So the four relationships in §6 were fitted as **structural proxies**, matched to the shipped ratios by the property being tested:

| Shipped model | Proxy fitted | What the proxy establishes |
| --- | --- | --- |
| M1 `street ~ mcmeal` | `mcmeal ~ inexpensive` | Whether a cheap-food ratio needs cost bands. **Yes, decisively** |
| M2 `premium ~ midrange` | `midrange ~ inexpensive` | Whether a restaurant-tier step ratio needs bands. **No** |
| M3/M4 `cocktail ~ beer`, `wine ~ beer` | `cappuccino ~ beer` | Whether a same-venue drink ratio needs bands. **Yes** |
| ~~activities~~ | `attraction ~ inexpensive` | Whether activities derive from food at all. **No** (§7.6) |

**The proxies settle the model form, not the coefficient values.** The numeric constants in §6 are not the shipped constants; the shipped constants require the calibration sample in §7.8. Publishing them as if they were final would be the exact error §2.1 condemns in v1 — asserting a multiplier — dressed in better statistics.

### 7.4 Model performance and selection

Median APE %, reported as **leave-one-out / holdout**. Bias is median signed log error (leave-one-out). Best figure per relationship in bold.

| Relation | n | Holdout n | R0 | R1 | R2 | R3 | Selected |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `midrange ~ inexpensive` | 97 | 24 | 21.3 / 26.3 | **20.3** / 27.3 | 21.3 / **20.3** | 21.1 / 24.8 | **R0** |
| `mcmeal ~ inexpensive` | 68 | 17 | 43.2 / 34.9 | **22.0 / 21.9** | 34.8 / 25.5 | 23.1 / 23.0 | **R1** |
| `cappuccino ~ beer` | 97 | 24 | 25.4 / 25.9 | **18.2** / **20.9** | 25.7 / 23.4 | 20.2 / 23.2 | **R1** |
| `attraction ~ inexpensive` | 29 | 7 | **47.2** / 54.7 | 50.8 / 51.0 | 55.4 / **47.3** | 57.6 / 53.7 | **none** |

Bias, as median signed log error under leave-one-out:

| Relation | R0 | R1 | R2 | R3 |
| --- | --- | --- | --- | --- |
| `midrange ~ inexpensive` | +0.074 | **+0.010** | +0.052 | +0.035 |
| `mcmeal ~ inexpensive` | **+0.185** | −0.012 | +0.168 | −0.006 |
| `cappuccino ~ beer` | −0.008 | +0.013 | +0.024 | −0.007 |
| `attraction ~ inexpensive` | +0.007 | −0.025 | −0.025 | −0.012 |

#### Selection rule and reasoning

> **A richer model must beat R0 by at least 10% relative on *both* leave-one-out and the fixed holdout to qualify. Among qualifiers, take the fewest parameters within 10% of the best leave-one-out score.**

The rule reached this form through two corrections, both worth recording because each was forced by data rather than argued in advance.

**Correction 1 — require escalation, not identity.** The rule originally asked both schemes to name the *identical* winning model. Once R3 was added that test misfired: for `cappuccino ~ beer`, leave-one-out preferred R1 and the holdout preferred R3, so a literal reading returned "no agreement, keep R0" — even though both schemes ranked R0 last by seven points. R1 and R3 are two expressions of one decision, *band or don't band*. The schemes agreed on what mattered and differed on noise.

**Correction 2 — require a *material* margin.** At the closed 99-city sample, `midrange ~ inexpensive` had R2 ahead of R0 by **0.02 points** on leave-one-out (21.27 against 21.29). A bare-inequality test escalated to a 2-parameter model on that. Requiring a 10% relative improvement on both schemes removes the escalation-on-noise failure and changes nothing elsewhere: `mcmeal`'s R1 improves on R0 by 49% and `cappuccino`'s by 28%. Those are not close calls.

Applying it:

| Relation | Qualified over R0 | Chosen | Reasoning |
| --- | --- | --- | --- |
| `midrange ~ inexpensive` | *(none)* | **R0** | All four forms sit within 1.0 point on leave-one-out (20.3–21.3). At n=97 this is no longer a sample-size problem — there is no detectable difference between the forms, so parsimony decides |
| `mcmeal ~ inexpensive` | R1, R2, R3 | **R1** | Both schemes agree decisively and now *coincide*: 22.0 / 21.9 against R0's 43.2 / 34.9. R0 is not merely noisier but **biased by +0.185 in log terms (~20% high)**, which the banded forms remove entirely |
| `cappuccino ~ beer` | R1, R3 | **R1** | R1 is best on both schemes and simpler than R3. R2 fails to qualify, confirming the effect is a band step rather than a smooth drift |
| `attraction ~ inexpensive` | *(none)* | **none** | No form qualifies, and R0 itself is at 47% error. See §7.6 |

**R3 was fitted and won nothing.** It qualified twice across two sample sizes and was selected zero times. §6.4 gives the mechanism: all its band elasticities sit at ≈1, so it reproduces R1 with three redundant parameters. The form is now rejected on evidence, not on a sample-size argument.

#### The parameters are now settled

At n=85 one relationship was unresolved — `midrange ~ inexpensive` selected R1 on the full sample and R0 on the strict one. **At the closed sample all four selections agree between full and strict samples**, which is the condition that was missing:

| Relation | Full sample (n) | Strict sample (n) | Agree |
| --- | --- | --- | --- |
| `midrange ~ inexpensive` | R0 (97) | R0 (87) | yes |
| `mcmeal ~ inexpensive` | R1 (68) | R1 (58) | yes |
| `cappuccino ~ beer` | R1 (97) | R1 (87) | yes |
| `attraction ~ inexpensive` | none (29) | none (29) | yes |

**Shipped model forms and coefficients:**

```
midrange ~ inexpensive     R0    T = 5.7388 · A
mcmeal   ~ inexpensive     R1    k_low 1.7260   k_mid 1.0898   k_high 0.6452
cappuccino ~ beer          R1    k_low 1.1304   k_mid 1.0614   k_high 0.6629
attraction ~ inexpensive   —     no model; collect directly or publish missing
```

The `mcmeal` and `cappuccino` band coefficients move by under 4% when thin-source cities are dropped (1.726 → 1.730 and 1.130 → 1.199 on the low band), so they are not artefacts of weak sources. These are the model forms the shipped ratios of §7.3 adopt; their *coefficients* still require the calibration of §7.8, because the fitted relationships are proxies.

#### Sensitivity to thin sources

Ten of the 99 pooled cities carry a low contributor count, an 18-month contributor window, or an explicit estimated-data warning. Rather than applying a hard floor — which would discard exactly the low-band cities `mcmeal` most needs — the entire fit is re-run without them:

| Relation | Full sample | Strict sample | `k_low` full → strict |
| --- | --- | --- | --- |
| `midrange ~ inexpensive` | R0, 21.3 | R0, 15.9 | — (R0 both) |
| `mcmeal ~ inexpensive` | R1, 22.0 | R1, 18.8 | 1.726 → 1.730 |
| `cappuccino ~ beer` | R1, 18.2 | R1, 17.6 | 1.130 → 1.199 |
| `attraction ~ inexpensive` | none | none | — |

**Every selection is stable, and the coefficients barely move** — 0.2% on `mcmeal`'s low band, 6.1% on `cappuccino`'s. Thin sources are not distorting the model, which retrospectively justifies retaining them rather than applying a floor.

One asymmetry is worth noting. Dropping thin cities improves accuracy on every relationship, most sharply on `midrange ~ inexpensive` (21.3 → 15.9, a 25% reduction). Thin sources therefore add **variance without bias**: they do not move the fitted structure, but they do widen the errors. That points at a product decision rather than a modelling one — a city flagged low-confidence should carry a wider published uncertainty band, not a different model.

### 7.5 Why one relationship genuinely needs bands

The `mcmeal ~ inexpensive` band coefficients run **1.73 (low-cost) → 1.09 (mid) → 0.65 (high-cost)** — a 2.7× monotonic decline. In high-cost cities a fast-food combo is cheaper than a cheap restaurant meal; in low-cost cities it is nearly twice as dear, because international fast-food pricing is far less locally elastic than independent restaurant pricing.

The evidence trail is worth stating, because the conclusion survived being doubted:

| Sample | Evidence |
| --- | --- |
| n=5 | Europe 0.60–0.67 against Southeast Asia 2.18–2.57 — noticed, but 5 cities |
| n=29 | R1 won leave-one-out, lost the holdout; conclusion drawn was "R1 overfits" |
| n=27 (this measure) | Both schemes agreed on R1; the n=29 reading was withdrawn |
| n=54 | Coefficients monotonic across bands; R0 shown to be *biased* rather than merely noisy |
| **n=68 (closed sample)** | **The two validation schemes now coincide — 22.0 leave-one-out against 21.9 holdout — against R0's 43.2 / 34.9. R0's bias is +0.185 log (~20% high); R1's is −0.012. Selection is unchanged when thin sources are dropped** |

**A single global constant here would be wrong by a factor of ~2 in one direction or the other, and systematically so.** Bias is the point: §5.2 notes that unbiased noise partly cancels across an itinerary total while bias compounds. `mcmeal` is the one relationship where the simple model is biased, which is why it earns its parameters and `attraction` — bias +0.007, pure variance — cannot be rescued by them.

The stability check is that the coefficients became *cleaner* with more data, not noisier. At n=27 the `cappuccino ~ beer` bands were 1.03 / 1.14 / 0.63, non-monotonic in the low-to-mid step. At n=83 they were 1.16 / 1.08 / 0.66 and at n=97 they are 1.13 / 1.06 / 0.66 — monotonic, and now barely moving between stages. Ordering that an earlier sample got wrong resolved itself as n grew, and then stopped changing. That is what a real effect does.

### 7.6 A negative result, reported

**Activity prices cannot be derived from food prices.** The `attraction ~ inexpensive` ratio spans **0.025 to 6.0 — a 242× range** — with every model between 47% and 58% median APE and p90 reaching 227%. Adding bands made it *worse* (50.8 against R0's 47.2), and adding a fourth form made it worse again (57.6).

Two independent signals say the same thing, and the first needs no error metric at all:

1. **The R1 band coefficients are 1.055 / 1.027 / 1.082** — three numbers that are effectively one. Where `mcmeal` separates 3.0× across bands, `attraction` separates 1.05×. There is no structure for a band to capture.
2. **R0's bias is +0.007** — essentially zero — while its median error is 47%. Unbiased and wildly imprecise is the signature of predicting from an unrelated variable: you recover the average and nothing else.

This is not a weak relationship; it is the absence of one. A museum admission price is set by an institution's funding model and has no stable relationship to local meal costs.

**Consequence:** two planned ratios are removed from the design. Activity prices are collected directly or the tier is published as missing. Reporting this is more useful than shipping a 50%-error model with a plausible-looking coefficient.

### 7.7 Accommodation: no formula, and why

All six accommodation tiers are measured directly. No star class is derived from another. This is deliberate, and an audit of the incumbent 121-city dataset shows why.

Computing each ladder ratio across all 121 cities and counting **distinct values** separates observation from assertion:

| Ratio | Median | IQR | Distinct values across 121 cities |
| --- | --- | --- | --- |
| `dorm / 3★` | 0.400 | 0.400 – 0.455 | 47 |
| `private / 3★` | 0.550 | 0.509 – 0.582 | 37 |
| `1★ / 3★` | 0.509 | 0.489 – 0.542 | 30 |
| `2★ / 3★` | 0.754 | 0.744 – 0.771 | 35 |
| **`4★ / 3★`** | **1.800** | **1.800 – 1.800** | **1** |
| **`food_high_end / food_mid_range`** | **1.500** | **1.500 – 1.500** | **1** |

Two of these are constant to the last decimal place in every one of 121 cities. A ratio that never varies across Sofia, Tokyo and Havana is not a measurement — it is a hard-coded multiplier. `accom_4_star` in the incumbent dataset contains **no city-specific information at all** beyond its 3-star value.

Three consequences follow:

1. **The incumbent 4-star column cannot be used as validation data** for a 4-star model. It would only confirm that 1.8 reproduces 1.8. The same applies to `food_high_end`, which is why M2 in §7.3 is fitted against a proxy rather than against the existing dataset.
2. **The "ratio envelope" sanity check of §8.2 is valid only for the four ladder rungs that genuinely vary.** For those, the IQRs above become the acceptance bounds; for `4★/3★` there is nothing to bound against.
3. It confirms the §2.2 re-reading: v1's defect was asserted structure, and it is still measurable in the shipped data years later.

The accommodation cascade therefore ends in **missing**, not in a derived value, for any star class that cannot be observed — with one exception, ranked last: a ratio fallback within the four varying rungs, flagged `modelled` and separable in every downstream count.

### 7.8 What remains to be calibrated before shipping

The evidence above settles model *form*. Shipping requires coefficients fitted on the shipped relationships themselves.

| Requirement | Size | Purpose |
| --- | --- | --- |
| Paired `street_food` + `mcmeal` observations | 20 cities across the three bands | Fit M1 |
| Paired `premium` + `midrange` | 20 cities | Fit M2 |
| Paired `cocktail`, `wine_glass` + `beer` | 20 cities | Fit M3, M4 |
| Direct `half_day`, `full_day` | ongoing | No model exists (§7.6) |

**~160 observations, one-off**, spanning all nine regions and the full cost range, with 25% held out per relationship. Against v3's ~17,300-lookup recurring build, this is the whole calibration cost — and it does not recur, because §3 refreshes level and leaves structure alone.

Until it is done, the four modelled measures carry the §6 proxy coefficients and are labelled provisional in the data card.

### 7.9 Accuracy gates

The design set a ≤15% target for food and drinks. **No relationship meets it.** The selected models land at 18.2% (`cappuccino`), 21.3% (`midrange`) and 22.0% (`mcmeal`) on leave-one-out.

The trajectory across sample sizes is the important part, because it shows the figure is now stable rather than still moving:

| Sample | `midrange` | `mcmeal` | `cappuccino` |
| --- | --- | --- | --- |
| n=58 | 18.7 | 18.1 | 18.6 |
| n=85 | 21.3 | 21.7 | 16.8 |
| **n=99 (closed)** | **21.3** | **22.0** | **18.2** |

The n=58 figures were **optimistic, not better**. Expansion added long-tail and thin-source cities the narrower sample did not contain, and moved the band cuts onto the full production distribution. Measured error rising as a sample expands is the expected direction when the original sample was easier than the target population — and the sample is now closed, so this is the honest number rather than a waypoint.

**Recommendation: publish the gate at ≤25% median APE for food and drinks**, and state the achieved figures alongside it. A single anchor does not reach 15%, and no further collection from this source can change that. The alternative — adding a second predictor — is a design change, not a data problem, and should be evaluated on its own rather than used to keep an unmet target alive.

Mitigating context: bias for every selected model is under 1.5% in log terms (+0.010, −0.012, +0.013), so error is variance rather than systematic skew and partly cancels across a multi-city itinerary total. The one relationship where the simple model *was* biased, `mcmeal` at +0.185, is precisely where a banded model was adopted.

### 7.10 Worked example, end to end

Two cities at opposite ends of the cost range, using the R1 `mcmeal ~ inexpensive` model — the one relationship where a shipped-form model is fitted on real paired data.

**Lisbon** (high band, `food_mid_range` = AUD 132.06). Observed `inexpensive` = €15.00.

```
predicted mcmeal = k_high × A = 0.6452 × 15.00 = €9.68
observed  mcmeal =                              €10.00
error = −3.2%
```

**Hanoi** (low band, `food_mid_range` = AUD 40.92). Observed `inexpensive` = ₫50,000.

```
predicted mcmeal = k_low × A = 1.7260 × 50,000 = ₫86,300
observed  mcmeal =                               ₫114,500
error = −24.6%
```

Both are in-sample, so they illustrate mechanism rather than accuracy — but the pair is instructive. Lisbon lands within 3%; Hanoi misses by 25%, above the 22.0% median. **The cheap band is the harder band**, because international fast-food pricing is set globally while local restaurant pricing is not, so their ratio is least stable exactly where the gap between them is widest.

Note also what a single global constant would have done. R0's `k = 0.9852` predicts €14.78 for Lisbon (+48%) and ₫49,260 for Hanoi (−57%) — errors of opposite sign, which is the signature §7.5 describes and the reason M1 carries bands.

Then FX is applied once, at presentation, and the basket assembled:

```
food_street_food = 6 × street_food_meal_1p × AUD/local
```

The model produced one number. Everything after it is arithmetic.

---

## 8. Architecture

### 8.1 Source cascade

Each measure resolves through an ordered cascade. **The level used is recorded per measure per city**, no level is skipped silently, and the bottom of every cascade is "missing" rather than "guessed".

| Category | Level 1 | Level 2 | Level 3 | Level 4 |
| --- | --- | --- | --- | --- |
| Food, drinks | Direct template lookup (§9.1, `B0`) | Web-search extraction | Country-level fallback | Missing |
| Accommodation | Web-search extraction | Country-level fallback | Calibrated ratio | Missing |
| Activities | Official venue sites | Web-search extraction | *(no ratio — see §7.6)* | Missing |

### 8.2 Determinism from a non-deterministic input

Web search cannot be made deterministic. It does not need to be — determinism is achieved at three layers, confining non-determinism to a single moment:

| Layer | Deterministic? | Mechanism |
| --- | --- | --- |
| Collection | No — *bounded* instead | Versioned prompt, rigid schema, hard validation gates, 3-sample median |
| Derivation | **Yes, exactly** | Pure function from anchors to 19 tiers, computed server-side |
| The dataset | **Yes, by persistence** | Anchors stored with provenance; a city never changes until a deliberate refresh |

**The language model is a structured extractor, never an estimator.** It searches, reads, and reports numbers with their sources. It performs no arithmetic, no currency conversion, and never emits a tier. This single constraint removes three of v1's four defects.

**Validation gates**, applied in code, rejecting rather than averaging:

- **Monotonicity:** `dorm < private ≤ 1★ ≤ 2★ ≤ 3★ ≤ 4★`. The contradictory Hanoi figure (4-star below 3-star) fails here.
- ~~**Ratio bounds** taken from the existing dataset's internal structure as a sanity envelope~~ — **withdrawn.** The claim that its relative structure was its one reliable property did not survive contact with observed data (§9.2.2).
- **Stated basis** per figure, or reject (§5.3).
- **Source date** present and within a freshness window.

**Three-sample median per city, with dispersion retained.** Dispersion is the accommodation confidence signal, playing the role the contributor count plays for food and drinks.

### 8.3 Cost

| Operation | Cost |
| --- | --- |
| Add one city | 1 prompt run — roughly 20–45 web calls, ~75k tokens, 5–10 minutes |
| Full 121-city build | ~121 prompt runs, paced across days (see below) |
| One-off ratio calibration | ~160 observations |

Against v3's ~17,300 lookups per full build, recurring at every refresh.

**Pacing is a real constraint on the batch build, and only on the batch build.** The anchor source rate-limits by IP: roughly 40 rapid fetches triggered HTTP 429, escalating to 503, and it cleared only on an address change. A 121-city build should therefore run **10–15 cities per day, checkpointed and resumable**, completing in about ten days.

For steady-state use — a household adding a few cities a month — the limit is never approached, so no pacing is needed.

One rule matters more than the pacing itself: **on a rate-limited response, defer the city; never fall through to search.** §9.4.1 measures that difference as exact values versus 10–19% error, and nothing in the published output distinguishes the two except `directLookup.outcome`.

---

## 9. Adding a new city

A user can add any city on demand. The whole of that operation is one prompt, reproduced below, followed by deterministic code.

**Why this path is primary, not a fallback.** The crowd-sourced cost-of-living page used for the pilot is itself an aggregation of publicly posted prices. When it exists, it does the searching for us, consistently across cities. When it does not exist, **the underlying prices usually still do** — a café lists its coffee, a hotel publishes a rate. A missing page means the *aggregation* is absent, not the evidence. And missingness is severely non-random: of cities attempted in Stage 1, the page was unusable for 9% of high-band, 14% of mid-band and **55% of low-band** destinations. Since the dataset is 44 of 121 cities in Southeast Asia, directed search is the main route for a large slice of the portfolio.

**The prompt asks for 14 measures, not 18.** Four — street food, premium restaurant meal, cocktail, wine by the glass — are supplied by the fitted models of §7.3 and are deliberately absent from the search list. That is the return on §6 and §7: it removes `street_food_meal_1p`, the measure whose absence stalled v3 across all 36 pilot cities.

**Five of the remaining fourteen are a lookup, not a search.** The food and drink measures are published together in one fixed table at a predictable URL, so the prompt opens with a direct-lookup step (`B0`) that constructs the URL, reads five labelled rows, records the page's contributor count and update date, and applies the §4.0 acceptance floor. Only if that page is missing, thin or stale does the model fall through to open-web search. §9.1.1 explains why this ordering matters more than it appears to.

**The model extracts; it never estimates.** No arithmetic, no currency conversion, no tier, no answering from memory. Everything downstream — banding, model application, FX, basket assembly — is a pure function (§9.2). This is the constraint that lets a non-deterministic search sit underneath a deterministic dataset.

The prompt is versioned as `city-cost-anchors-v4` and stored at `docs/prompts/llm_prompt_city_anchors_v4.md`. It is self-contained: it assumes no knowledge of this application, this methodology, or the models its output feeds.

### 9.1 The prompt

````text
You are a price researcher. Your job is to find REAL, PUBLISHED prices for one
city by searching the web, and to report them with their sources.

CITY: {{city}}, {{country}}
TODAY'S DATE: {{today}}

════════════════════════════════════════════════════════════════════════
ABSOLUTE RULES — these override everything else
════════════════════════════════════════════════════════════════════════

1. You are an EXTRACTOR, not an estimator. Every number you report must
   appear on a web page you actually retrieved. Never report a price from
   memory, from general knowledge, or from what seems reasonable.

2. Never infer a price from a nearby city, a national average, or another
   price in this list. If you cannot find it, report it as not found. A
   missing value is a correct answer. An invented value is a serious error.

2b. There are THREE possible outcomes per measure, not two:
      "found"         — you retrieved a published price.
      "not_found"     — the thing exists in this city, but you could not
                        find a published price for it.
      "class_absent"  — the thing does not exist in this city at all.
    These are not interchangeable. "class_absent" is a claim about the
    city, and it requires positive evidence (see rule 2c). "not_found" is
    a claim about your search. When in doubt, use "not_found".

3. Do NO arithmetic. Do not multiply, average across categories, convert
   currencies, or combine prices. Report each figure as published.
   The ONE exception is the explicit median rule in section C below.

4. Report every price EXACTLY AS THE SOURCE STATES IT, in whatever
   currency the source displays, and name that currency in the measure's
   "currency" field. Never convert between currencies yourself.

   A foreign-currency price is FULLY USABLE. Booking sites routinely show
   prices in the viewer's currency rather than the destination's, so a
   hotel in Prague may be priced in USD or EUR, and a hostel listing may
   default to some unrelated currency entirely. That is fine. Report the
   number you saw and the currency it was in. Conversion happens later,
   from a dated exchange-rate snapshot, and is not your job.

   DISCARDING A PRICE BECAUSE THE PAGE SHOWED THE WRONG CURRENCY IS AN
   ERROR. In testing this single mistake caused three of one city's four
   accommodation failures: usable prices were found and thrown away.
   If the page shows a price, you have found the price.

   The one exception is measures 1-5 from section B0. That page displays
   one consistent currency for the whole city, so all five come from it
   in the same currency.

2c. To report "class_absent" you must cite a source that ENUMERATES the
    market and shows this class is not in it. Exactly two things qualify:

      (i)  An official register or directory that lists what the city
           DOES have — a national hotel classification register, a hotel
           association directory, or a tourist board accommodation list.

      (ii) A booking aggregator's search result WITH THE FILTER FOR THAT
           CLASS APPLIED, returning zero properties. You must have
           actually applied the filter and seen an empty result.

    These do NOT qualify, and citing them is an error:
      - A "best hotels in X" or "top 10" page. That is marketing copy.
      - A page that simply does not mention the class. Silence is not
        absence.
      - A summary that bundles classes ("budget 2-3 star from $125").
        That means the classes were merged for display, not that one is
        missing.
      - Your own searches returning nothing. That is "not_found".

    It must be HARDER for you to claim absence than to claim not-found.
    If you cannot produce a qualifying source, use "not_found".

    Note that some countries have no official star register at all. In
    those, only evidence type (ii) is available to you. Use it.

    This distinction matters because the two answers are handled in
    opposite ways downstream. A "not_found" price may be estimated from
    the other prices you did find. A "class_absent" one must never be,
    because estimating it would invent a price for something the city
    does not have. Choosing the wrong one silently corrupts the result.

5. Keep searching until you find the value, exhaust the ladder given for
   that measure, or establish absence under rule 2c. Do not stop at the
   first empty page. Do not stop early because other measures succeeded.
   Each of the 14 measures gets its own full effort.

6. Do sections B0 and B0b before section B. Eleven of the fourteen
   measures are published at predictable URLs. Fetching them is a lookup,
   not a search, and it is far more reliable than anything you will find
   by searching. Skipping them and searching instead is the single most
   expensive mistake you can make here — in testing it was the
   difference between exact values and errors of 10 to 80 percent.

════════════════════════════════════════════════════════════════════════
A. WHAT TO FIND — 14 measures, defined exactly
════════════════════════════════════════════════════════════════════════

FOOD
  1. inexpensive_restaurant_meal_1p
     One main meal for one person at an inexpensive, everyday restaurant
     that locals use. Not a tourist-district venue, not fast food.
     Excludes drinks, tips and service charges.

  2. midrange_restaurant_meal_2p
     A three-course meal for TWO people at a mid-range restaurant.
     Total for both people. Excludes drinks.

  3. mcmeal_combo
     A McDonald's combo meal (burger, fries, drink) or, if there is no
     McDonald's in this city, the equivalent combo at the largest
     international fast-food chain present. Name the chain in the notes.

DRINKS
  4. domestic_draft_beer_1
     One 0.5 litre draught beer of a domestic/local brand, bought in a
     bar or restaurant. Not a supermarket price, not an import.
     If the local standard serving differs (e.g. 0.33 L or a pint),
     report the price AS SOLD and state the actual volume in the notes.
     Do not rescale it yourself.

  5. cappuccino_1
     One regular cappuccino in a café. Not a supermarket price.

ACCOMMODATION — all are the total price for ONE NIGHT for TWO PEOPLE,
except the dorm bed which is per bed. Include unavoidable taxes and
mandatory fees. Exclude optional extras.

  Date basis — READ THIS BEFORE YOU START.

  What we want is a TYPICAL nightly rate for the class, not a quote for
  specific dates. Use a published typical or average nightly rate for
  that class in this city, set the basis to aggregator_average, and note
  the period it covers if the source states one.

  DO NOT attempt a live dated booking search. Booking sites require
  interactive date selection and do not publish static rates for future
  dates, so that route cannot succeed with the tools you have. In testing,
  models that tried it concluded "prices are dynamic, not available" and
  abandoned measures for which a published average was sitting on the
  same site. A published average is the CORRECT answer here, not a
  compromise.

  If you do happen to retrieve a real dated per-night price for a named
  property, that is welcome — report it with basis
  exact_published_price and give the dates in the notes. But never
  abandon a measure because you could not get dated pricing.

  6.  hostel_dorm_bed_1p       One bed in a shared dormitory, one night.
  7.  hostel_private_room_2p   A private double/twin room IN A HOSTEL —
      a budget room in a backpacker property, typically with a shared
      bathroom. This is NOT a boutique hostel's premium ensuite suite,
      and NOT a budget hotel room. It must come in ABOVE the dorm bed
      and BELOW the cheapest hotel class this city has. As a guide it
      usually sits around half the 3-star hotel price. If your figure is
      near or above the 3-star price, you have priced the wrong product
      — go back and find the standard private room, not the best one.
  8.  hotel_1star_room_2p      Double room, 1-star hotel.
  9.  hotel_2star_room_2p      Double room, 2-star hotel.
  10. hotel_3star_room_2p      Double room, 3-star hotel.
  11. hotel_4star_room_2p      Double room, 4-star hotel.

  IMPORTANT — star classes are frequently absent by design, not by
  accident. Many developed cities have essentially no 1-star or 2-star
  hotels: that segment is served by motels, backpackers, budget chains or
  serviced apartments, which sit outside the star ladder. Others operate
  no official star system at all. Do not treat an empty result for a star
  class as a search failure by default. Check an official classification
  register or hotel-association directory for this city and, if it shows
  no properties in that class, report "class_absent" under rule 2c. If
  you cannot find such a register, report "not_found".

  If this destination has no star-rating system at all and its
  accommodation is guesthouses or bungalows, set hasStarRatingSystem to
  false, report measures 8-11 as "class_absent" citing that fact, and
  instead fill the unstarred_budget_2p / unstarred_midrange_2p /
  unstarred_luxury_2p fields described in section D.

ACTIVITIES — per adult, one person.
  12. paid_attraction_adult_1
      Standard full-price adult admission to a well-known paid attraction
      in this city (museum, gallery, monument, temple, park). Name it.
      Not a discounted, combined, resident or child ticket.

  13. half_day_group_activity_adult_1
      A typical half-day (roughly 3-5 hour) organised group tour or
      activity, per adult. Name the operator and the activity.

  14. full_day_premium_activity_adult_1
      A typical full-day (roughly 6-10 hour) premium organised activity,
      per adult. Name the operator and the activity.

════════════════════════════════════════════════════════════════════════
B0. START HERE — the direct lookup for measures 1 to 5
════════════════════════════════════════════════════════════════════════

Measures 1-5 (the food and drink prices) are published together, in one
table, on one page, in a predictable place. DO THIS FIRST. Do not start
searching until this has been tried and has failed.

STEP 1 — Build the URL.
  https://www.numbeo.com/cost-of-living/in/<SLUG>

  Replace spaces with hyphens. Try the plain city name FIRST:
      Sydney, Aomori, Phuket, Cartagena, Ho-Chi-Minh-City
  If that returns "Cannot find city id", retry with the country appended:
      Ubud-Indonesia, Hiroshima-Japan, Krakow-Poland, Chiang-Rai-Thailand

  The rule runs BOTH ways and you must try both. The suffix is needed for
  ambiguous names and BREAKS unambiguous ones — "Aomori-Japan",
  "Cartagena-Colombia" and "Phuket-Thailand" all fail where the plain
  name works. The site's own error page names the correct target, so read
  it and follow the suggestion rather than guessing again.

STEP 2 — Read these five rows from the "Restaurants" table.
  They are always labelled the same way:
    "Meal, Inexpensive Restaurant"                     -> measure 1
    "Meal for 2 People, Mid-range Restaurant,
     Three-course"                                     -> measure 2
    "McMeal at McDonalds (or Equivalent Combo Meal)"    -> measure 3
    "Domestic Beer (0.5 liter draught)"                -> measure 4
    "Cappuccino (regular)"                             -> measure 5
  Take the main figure for each, in the currency the page displays.
  Set basis to "aggregator_median" for all five.

STEP 3 — Read the page's quality line and record it.
  The page states how many entries were made in the past 12 (or 18)
  months by how many contributors, gives a "Last update" date, and
  sometimes shows "Some data are estimated due to a low number of
  contributors". Put all of this in sourceQuality (see section D).

STEP 3b — DISTINGUISH "NO PAGE" FROM "FETCH FAILED". Read this carefully;
  getting it wrong is the most damaging mistake possible in this task.

  A page genuinely does not exist ONLY if you see the site's own error
  text, which reads like:
      "Cannot find city id for X"
      "Our system cannot find city named with 'X'"
  That is a real answer from the site. Accept it.

  Anything else is a FETCH FAILURE, not an absent page. That includes:
  a timeout, an empty response, a network error, HTTP 429 (too many
  requests), HTTP 403, a truncated page, or a page that loads without the
  Restaurants table.

  ON A FETCH FAILURE YOU MUST RETRY. Wait briefly and fetch the same URL
  again, up to three attempts in total, before drawing any conclusion.
  This source rate-limits, so a failed fetch is commonly just a failed
  fetch. Only after three failures may you record
  outcome "no_page" — and if that happens, say in rejectionReason that
  the page could not be retrieved rather than that it does not exist.

  Why this matters: in testing, two cities whose pages certainly exist
  (325 and 154 contributors) were recorded as "no_page" after a single
  failed attempt. Both then fell through to searching, and their food
  prices came back wrong by up to 82% instead of exactly right. This one
  mistake is worth more error than every other issue in this task
  combined. RETRY BEFORE YOU GIVE UP.

STEP 4 — Decide whether to accept it.
  ACCEPT if: at least 10 contributors AND last update within 12 months.
  REJECT and fall through to the section B ladders if: fewer than 10
  contributors, OR the last update is more than 12 months old, OR the
  page exists but reports zero recent entries, OR any of the five rows
  is absent.
  A page can also genuinely not exist, per step 3b. That is common for
  villages, islands and small towns, and is not a failure — fall through
  to section B.

  If you accept the page, measures 1-5 are DONE. Do not search for them
  again and do not try to improve on them. This source applies one
  consistent method across every city, which is exactly what makes the
  numbers comparable between cities.

Measures 12-14 (attractions and activities) are NOT on this page and have
no equivalent single source. Go to section B for those.

Measures 6-11 (accommodation) have their own direct lookups. Go to B0b.

════════════════════════════════════════════════════════════════════════
B0b. THEN HERE — direct lookups for accommodation, measures 6 to 11
════════════════════════════════════════════════════════════════════════

Accommodation prices are ALSO published at predictable URLs. Fetch these
before searching. Searching for them instead produces wildly inconsistent
results: in testing, five identical runs found between 0 and 2 of the six
classes each, because search results are a lottery and these pages are
not.

Build the URLs with the two-letter lowercase country code and the
lowercase city name.

  HOTELS, 1 to 4 star — try both sites, they differ in coverage:

    https://www.booking.com/onestar/city/<cc>/<city>.html
    https://www.booking.com/twostars/city/<cc>/<city>.html
    https://www.booking.com/threestars/city/<cc>/<city>.html
    https://www.booking.com/fourstars/city/<cc>/<city>.html

    https://us.trip.com/hotels/star2/city/<cc>/<city>.html
    https://us.trip.com/hotels/star3/city/<cc>/<city>.html
    https://us.trip.com/hotels/star4/city/<cc>/<city>.html

    Examples that work: booking.com/threestars/city/cz/prague.html,
    booking.com/twostars/city/vn/hanoi.html,
    booking.com/threestars/city/dk/copenhagen.html,
    us.trip.com/hotels/star3/city/cz/prague.html

    Note trip.com has no star1 page — it 404s. That is expected.

  HOSTELS — dorm beds and private rooms:

    https://www.hostelworld.com/hostels/<region>/<country>/<city>/
    https://www.hostelworld.com/hostels/<region>/<country>/<city>/f/private-rooms/

    where <region> is europe, asia, africa, north-america,
    south-america or oceania, and <country> is the full lowercase
    country name with hyphens.
    Example: hostelworld.com/hostels/europe/czech-republic/prague/

HOW TO READ THESE PAGES

  Read each page the way that page publishes prices. The two page types
  differ, and that is expected — do not try to force them into one
  format.

  HOTELS (measures 8-11), from booking.com or trip.com:
    Take the HEADLINE AVERAGE the page states — booking.com says "On
    average, a 3-star hotel in X costs $N per night", trip.com gives a
    weekday average. Set basis to aggregator_average.
    If the page also states a price range, put it in reportedLow and
    reportedHigh, but still report the average as the value.
    If no headline average is given, take the median of at least three
    named properties instead and set basis to median_of_three_venues.

  HOSTELS (measures 6-7), from hostelworld.com:
    These pages list properties and no aggregate. Take the MEDIAN of at
    least five listed hostels, set basis to median_of_three_venues, and
    name at least three of them in sources.

  It is normal and correct for the hostel measures and the hotel
  measures to end up on different bases. Do not change one to match the
  other.

  Within the four hotel classes, however, use the same approach for all
  of them wherever possible. Mixing a headline average for one star
  class with a property median for the next produces nonsense — in
  testing it gave a 2-star hotel priced at 23% of a 3-star, and a 4-star
  only 10% above a 3-star. Neither is a real market.

  3. EXCLUDE HOSTELS FROM HOTEL CLASSES. The 1-star and 2-star pages mix
     in hostels and backpacker properties — real examples seen include
     "Hostel Elf", "Plus Prague", "Charles Bridge Hostel", "Travel&Joy
     Backpackers". Drop any property whose name contains hostel,
     backpacker, hoteles, or dorm before taking a median. Leaving them
     in makes the 1-star and 2-star classes collapse toward the hostel
     price, which is wrong.

  4. IGNORE IMPLAUSIBLE LOW VALUES on hostel pages. Real examples seen:
     a dorm bed at EUR 0.60 and a private room at EUR 2.62 in a city
     where the typical dorm is EUR 12-20. These are artefacts, not
     prices. Take the median of at least five listed hostels and
     disregard anything below a quarter of that median.

  5. These pages quote in the VIEWER's currency, usually USD or EUR, not
     the city's. That is fine and expected — report the number and name
     its currency, per absolute rule 4.

  If a class's page 404s or is genuinely blocked after retrying per step
  3b, fall through to the section B ladder for that class only. Do not
  abandon the other classes.

════════════════════════════════════════════════════════════════════════
B. WHERE TO LOOK — search ladders, in order
════════════════════════════════════════════════════════════════════════

Use these for measures 12-14 always, and for measures 1-11 ONLY where
the direct lookup in section B0 or B0b failed for that specific measure.

Work down each ladder. Stop as soon as a step yields a usable figure.
Record which step you used.

Measures 1, 2 (restaurant meals) — fallback only, see B0 first
  1. Menus on the websites of THREE individual restaurants in the city
     (apply the median rule, section C)
  2. An online food-delivery platform's listed menu prices for this city,
     THREE vendors (median rule)
  3. Another cost-of-living aggregator with a per-city page
  4. A local food blog, expat guide or news article that lists prices AND
     states when it was written

Measure 3 (fast food combo) — fallback only, see B0 first
  1. The chain's own website or app menu for this country
  2. Another cost-of-living aggregator with a per-city page
  3. A local price-listing article that states its date
  4. The chain's published price in the nearest city in the SAME country
     — if you use this, set granularity to "country_level"

Measures 4, 5 (beer, cappuccino) — fallback only, see B0 first
  1. Menus on the websites of THREE bars or cafés in the city
     (apply the median rule, section C)
  2. Another cost-of-living aggregator with a per-city page
  3. A local guide or article that states its date

  A note on fallback quality for measures 1-5. If B0 failed, you are
  reconstructing by hand what that page would have given you. Prefer a
  median of three real venues over any single blog figure. Content-farm
  pages with titles like "Cost of living in X 2026" and no stated
  methodology or date are the weakest option here, not the first one —
  they rank well in search results and that is not evidence.

Measures 6-11 (accommodation)
  1. A major booking aggregator's PUBLISHED TYPICAL OR AVERAGE nightly
     rate for that star class in this city, or its star-filtered result
     list read as displayed. Try several — they differ in coverage by
     region:
       booking.com, trip.com, agoda.com, expedia.com, hotels.com,
       kayak.com, traveloka.com (SE Asia), makemytrip.com (South Asia),
       ctrip.com (China), despegar.com (Latin America),
       hostelworld.com (dorm and hostel private rooms only)
     Read the prices off the FILTERED RESULT LIST — the individual
     properties returned — not off the page's headline or marketing copy.
     Take at least three properties in that class and apply the median
     rule (section C).
  2. Individual properties' OWN websites, taking whatever nightly rate
     they display. Check at least three properties per class.
  3. The official tourist board or destination-marketing site, if it
     publishes rates
  4. A travel-cost aggregator that publishes typical nightly rates by
     accommodation class for this city
  5. A recent, dated travel guide that states nightly rates by class

  HOW TO USE AN AGGREGATOR PROPERLY — read this before step 1.

  a. A city landing page ("10 Best Sydney Hotels") is MARKETING, not a
     price list. It is not usable at step 1. Apply the star filter and
     read the resulting property list.

  b. Aggregators often BUNDLE budget classes in their marketing copy,
     e.g. "budget 2-3 star from AU$125". A bundled band is NOT a price
     for either class. Apply the star filter to separate them.

     If you cannot separate them, the answer is "not_found". Do NOT
     report a bundled figure as the price of one of the classes it
     covers. This is a hard rule, not a preference: a "2-3 star" figure
     reported as the 2-star price lands within a couple of percent of
     the 3-star price, which is commercially impossible and gets the
     whole record rejected. A not_found here is cheap — the class is
     estimated from the classes you DID price.

  c. If a filter for a class returns properties, that class EXISTS, even
     if no summary page mentions it. Price it from those properties.

  d. If a filter for a class returns properties but you cannot read
     nightly rates from them, that is "not_found", NOT "class_absent" —
     you have just proven the class exists.

  e. "From AU$49" on a filter page is a lowest_from_price, which is a
     weak basis. Prefer the median of three actual properties. Only fall
     back to a "from" price if you cannot get three, and label the basis
     honestly.

Measures 12-14 (attractions and activities)
  1. The attraction's or operator's OWN official website
  2. The official city or national tourist board website
  3. A licensed operator's public booking page
  4. A dated travel guide or article listing the price

If a ladder is exhausted, report the measure as not found and list every
source you tried in triedSources. Exhausting a ladder is a valid,
useful result. Do not substitute a guess for it.

════════════════════════════════════════════════════════════════════════
C. THE MEDIAN RULE — how to handle multiple venues
════════════════════════════════════════════════════════════════════════

Where a ladder step says "THREE venues", find three genuinely different
establishments of the described type, take the MIDDLE of the three prices
(the median), and report:
  - that median as the value
  - the lowest and highest of the three in reportedLow / reportedHigh
  - all three venue names and URLs in sources

Check the spread before reporting a median. If the highest of your three
is more than TWICE the lowest, you have probably mixed different products
— a suburban property with a city-centre one, or a peak-season rate with
an off-season one. Look for a fourth and fifth venue of the same type and
take the median of those; if the spread stays that wide, report the median
anyway but put the full range in reportedLow/reportedHigh and say in the
notes that the class is highly dispersed. Never present a median of three
wildly different prices as though it were a precise figure.

Within a single venue's menu, if there are several qualifying items,
take the median of the standard section. Exclude premium, reserve,
tasting, low-alcohol and zero-alcohol variants. Say in the notes which
section you used and its price range.

This rule exists because picking a different venue or a different item
can change a price by more than a factor of two. The median of a named
set is the answer; "a price someone charges" is not.

════════════════════════════════════════════════════════════════════════
D. OUTPUT — return ONLY this JSON, no commentary
════════════════════════════════════════════════════════════════════════

{
  "city": "string",
  "country": "string",
  "localCurrency": "ISO 4217 code, e.g. VND, EUR, THB",
  "searchedOn": "YYYY-MM-DD",
  "accommodationDateWindow": "YYYY-MM-DD to YYYY-MM-DD",
  "hasStarRatingSystem": true,
  "directLookup": {
    "attemptedSlugs": ["Sydney", "Sydney-Australia"],
    "resolvedUrl": "string or null",
    "outcome": "accepted | rejected_thin | rejected_stale | no_page | rows_missing",
    "sourceQuality": {
      "contributors": 0,
      "contributorWindowMonths": 12,
      "entriesInWindow": 0,
      "lastUpdate": "YYYY-MM-DD",
      "estimatedDataWarning": false
    },
    "rejectionReason": "string or null"
  },
  "measures": {
    "<measure_name>": {
      "status": "found",
      "value": 0,
      "currency": "ISO 4217 code",
      "basis": "one of: exact_published_price | median_of_three_venues |
                aggregator_median | aggregator_average | lowest_from_price
                | published_range_midpoint",
      "granularity": "city | country_level",
      "sources": [
        { "name": "string", "url": "string", "datePublished": "YYYY-MM-DD or null" }
      ],
      "reportedLow": null,
      "reportedHigh": null,
      "notes": "string or null"
    },
    "<measure_name>": {
      "status": "not_found",
      "ladderExhausted": true,
      "triedSources": [ { "name": "string", "url": "string", "outcome": "string" } ],
      "reason": "string"
    },
    "<measure_name>": {
      "status": "class_absent",
      "enumeratingSources": [
        { "name": "string", "url": "string", "whatItLists": "string" }
      ],
      "reason": "string",
      "servedInsteadBy": "string or null"
    }
  },
  "unstarredAccommodation": {
    "unstarred_budget_2p": null,
    "unstarred_midrange_2p": null,
    "unstarred_luxury_2p": null
  }
}

Do NOT include a confidence field. Confidence is computed from your
statuses and sources after you return; assessing your own work is not
part of this task.

Field rules:
  - "directLookup" is mandatory. It records what happened in section B0,
    including when the page did not exist. List every slug you tried.
    Its sourceQuality block is required when outcome is "accepted" or a
    "rejected_*" value, and may be null for "no_page".
  - Every one of the 14 measure names must be present as a key, with a
    "status" of exactly "found", "not_found" or "class_absent".
  - "basis" is mandatory when status is "found". If you cannot tell
    whether a source's figure is a lowest price, a median or an average,
    set status to "not_found". An unlabelled number is unusable. This is
    not optional: prices published on different bases for the same city
    and hotel class have been observed to differ by a factor of four.
  - "enumeratingSources" is mandatory and must be non-empty when status
    is "class_absent". A "class_absent" entry without one is invalid and
    will be rejected. If you have none, the correct status is
    "not_found".
  - "servedInsteadBy" names what the city offers in place of the absent
    class, if you can tell — for example "motels and backpacker hostels"
    or "serviced apartments". Use null if unclear.
  - "class_absent" applies to accommodation classes and, rarely, to
    measure 3 where no international fast-food chain operates. It is
    never valid for restaurant meals, coffee, beer or attractions: every
    city has those.
  - "datePublished" is null only if the page genuinely shows no date. Say
    so in notes.
  - Every "url" must be the ACTUAL address of a page you retrieved. Never
    write a placeholder, an example domain, or a made-up search URL. If
    you cannot give the real URL for a figure, you cannot use that figure
    — drop it, and if that leaves you short, the measure is "not_found".
    An unverifiable source is worse than a missing one, because it looks
    checkable and is not.
  - "currency" is per measure and does NOT have to match localCurrency.
    Different measures may legitimately arrive in different currencies
    (see absolute rule 4).
  - If you give reportedLow and reportedHigh, the value must lie between
    them.
  - Do not add fields that are not in this schema. In particular, do not
    grade your own confidence or report which ladder step you used —
    both are worked out from your sources afterwards.

════════════════════════════════════════════════════════════════════════
E. SELF-CHECK — run these before you return anything
════════════════════════════════════════════════════════════════════════

Check each one. If a check fails, GO BACK AND FIX IT rather than
returning a value you know is wrong.

1. ACCOMMODATION ORDER — this check is mandatory and has failed in real
   runs. Prices must rise across the ladder:
     dorm bed < hostel private room <= 1-star <= 2-star <= 3-star <= 4-star
   skipping any class that is not_found or class_absent.

   If the order is violated, you have priced the wrong product somewhere
   — most often a premium or peak-season version of a budget class. Do
   this, in order:
     a. Go back and find the standard version of that product and
        re-price it.
     b. If you still cannot produce an ordered ladder, set the offending
        measure to "not_found" and say in the reason what you found and
        why you rejected it.

   Do NOT try to force the gaps between classes to any particular size.
   Report the prices you find. Real markets vary a lot in how far apart
   their hostel, budget-hotel and mid-range tiers sit, and that variation
   is information we want rather than error to be smoothed away. Ordering
   is the only structural rule here.

2. VALUE INSIDE ITS OWN RANGE. If you give reportedLow and reportedHigh,
   the value must lie between them. If your value is 11 and your range
   is 6-10, one of the three is wrong.
   FIX THE CONFLICT — do not delete the range to make the check pass.
   Omitting reportedLow/reportedHigh when you actually saw a range is a
   failure, not a fix. The range is evidence and we need it.

3. NO STALE SOURCES. Every source must be under 24 months old, or the
   measure is not_found. A price from six years ago is not evidence of
   today's price.

4. SERVING SIZE STATED. For beer, if what you priced is not 0.5 litre,
   the actual volume must be in the notes. Do not silently mix a pint
   and a half-litre.

5. BASIS — DECIDE IT MECHANICALLY, NOT BY IMPRESSION.
   Answer this in order and take the first that applies. Do not pick the
   most impressive-sounding label.

     Did you read ONE specific price for ONE specific named product on
     the seller's own page?              -> exact_published_price
     Did you find THREE separate venues and take the middle price?
                                         -> median_of_three_venues
     Did a source state a range, and you took its midpoint?
                                         -> published_range_midpoint
     Did a source publish an average across many properties or venues?
                                         -> aggregator_average
     Did a source publish a median?      -> aggregator_median
     Did you take a "from $X" / "starting at" figure?
                                         -> lowest_from_price

   Common mistakes, all seen in real runs:
     - A price range of $45-80 whose midpoint you took is
       published_range_midpoint, NOT median_of_three_venues. Three
       venues means three venues, each with its own price and URL.
     - A booking site's "average price per night for 3-star hotels" is
       aggregator_average, NOT exact_published_price. You did not price
       a specific hotel.
     - If a source says "$127-150" and you report 150, that is the TOP
       of the range, not lowest_from_price. Either take the midpoint and
       label it published_range_midpoint, or explain the choice.
   The basis field is used downstream to decide whether a number is
   usable at all. Mislabelling it is as damaging as a wrong price.

6. ONE BASIS ACROSS THE FOUR HOTEL CLASSES. List the basis of
   hotel_1star, hotel_2star, hotel_3star and hotel_4star. They should
   all be the same. If one differs, re-read it the same way as the
   others, or set it to not_found.
   The hostel measures may use a different basis from the hotels. That
   is expected and correct — hostel pages publish property lists and
   hotel pages publish averages.

7. NO BUNDLED CLASSES. For each accommodation class, check that the
   figure describes THAT class alone. If your source said "2-3 star" or
   "budget/mid-range" or any other merged band, set the measure to
   not_found. Two adjacent hotel classes priced within a few percent of
   each other is the signature of this mistake.

8. CLASS_ABSENT AUDIT. For each class_absent entry, re-read rule 2c and
   confirm your source is type (i) or type (ii). If it is a "best hotels"
   page or a bundled summary, change the status to "not_found".

9. SOURCES MUST BE THE ONES YOU USED. Every URL in "sources" must be a
   page you actually retrieved and read the number from. Do not list a
   site you tried and abandoned, and do not list a plausible-looking URL
   you did not open. The source list is the only record of where a
   number came from, and it is checked afterwards — a blog cited where a
   booking aggregator was required will be scored as a blog, so listing
   one gains you nothing and costs accuracy.

10. NO CURRENCY-DRIVEN ABANDONMENT. Re-read every not_found. If your
   reason mentions that a page showed USD, EUR or any other currency
   instead of the local one, that is NOT a valid reason. Go back, take
   the number as displayed, and record its actual currency. See rule 4.

11. NO PLACEHOLDER URLS. Search your own output for "example.com" or any
   invented address. Every url must be a page you actually opened. If a
   figure has no real URL, remove that source; if that drops you below
   three venues, either find another or report not_found.

12. NOT_FOUND IS FINE. If you end with two or three measures at
   not_found, that is a good outcome, not a failure. Downstream code
   handles a missing accommodation class by estimating it from the other
   classes. What it cannot handle is a confident wrong number. Never
   soften a not_found into a guess, and never stretch a definition to
   fill a slot.

════════════════════════════════════════════════════════════════════════
F. WORKED EXAMPLES — one of each status
════════════════════════════════════════════════════════════════════════

"cappuccino_1": {
  "status": "found",
  "value": 45000,
  "currency": "VND",
  "basis": "median_of_three_venues",
  "granularity": "city",
  "sources": [
    { "name": "Café A", "url": "https://example-a.vn/menu", "datePublished": "2026-06-01" },
    { "name": "Café B", "url": "https://example-b.vn/menu", "datePublished": null },
    { "name": "Café C", "url": "https://example-c.vn/drinks", "datePublished": "2026-05-14" }
  ],
  "reportedLow": 39000,
  "reportedHigh": 52000,
  "notes": "Regular cappuccino from each café's standard hot coffee section.
            Café B's menu page shows no date."
}

"hotel_1star_room_2p": {
  "status": "class_absent",
  "enumeratingSources": [
    { "name": "National hotel classification register",
      "url": "https://example-register.gov/city-listing",
      "whatItLists": "All classified hotels in the city by star rating.
                      Lists 0 at 1 star, 14 at 2 star, 96 at 3 star." }
  ],
  "reason": "The official register enumerates every classified hotel in the
             city and contains no 1-star property.",
  "servedInsteadBy": "Motels, backpacker hostels and budget chain hotels,
                      which are not star-classified in this market."
}

"half_day_group_activity_adult_1": {
  "status": "not_found",
  "ladderExhausted": true,
  "triedSources": [
    { "name": "City tourist board", "url": "https://example.org/tours",
      "outcome": "Lists operators but publishes no prices" },
    { "name": "Operator X", "url": "https://example-x.com",
      "outcome": "Booking widget only; no price shown without a date query" }
  ],
  "reason": "Half-day tours clearly operate here, but no operator publishes
             a price on a retrievable page."
}
````

### 9.1.1 Why lookup-before-search is the highest-value line in the prompt

This ordering was added after observing an asymmetry that is easy to miss.

Building the 99-city sample of §4 required roughly 60 page fetches against the template URL, each asking a small, fast model to read five labelled rows. **Not one extraction failed.** Every failure was a 404 or a page with single-digit contributors — source availability, never comprehension.

Over the same period, the same class of model running the open-web prompt on Sydney produced, across three attempts: an inverted accommodation ladder twice, a fabricated market-absence claim, a self-check passed by deleting the evidence that failed it, and a confidence grade contradicting the record it described.

**Same model class. Near-perfect on one framing, repeatedly wrong on the other.** The difference is not capability, it is task structure:

| | Direct lookup | Open-web search |
| --- | --- | --- |
| URL | Constructed from a template | Must be discovered |
| Page schema | Identical across every city | Bespoke per source |
| Estimand | Defined by the source's own column heading | Model must judge what qualifies |
| Aggregation | Already performed and documented | Model must perform it |
| Failure mode | Unambiguous — table present or 404 | "Did I search hard enough?" is a judgement |

A lookup asks the model to read. A search asks it to define an estimand, choose sources, aggregate, and grade its own provenance — four judgements, each of which the Sydney runs got wrong at least once.

The evidence that this was worth fixing is in what the search path actually chose. Given "find a cost-of-living aggregator page for this city", the model returned `costliving.net`, `world-prices.com` and `firebirdtours.com` — undated content-farm pages — while the template URL returns a page with 250+ contributors and a stated update date. It was not searching badly; it was being asked to find something it had not been told the address of.

**The wider principle: convert search into lookup wherever a stable source exists, and reserve open-web search for what genuinely has no canonical address.** Here that leaves accommodation and activities, which have no equivalent single source — and which are, correspondingly, where the remaining difficulty sits.

### 9.2 What happens to the output

Every step after the prompt is deterministic code. The model's output is never edited by hand.

| Step | Action |
| --- | --- |
| 1 | **Validate.** Reject and retry if: accommodation is non-monotonic (`dorm < private ≤ 1★ ≤ 2★ ≤ 3★ ≤ 4★`); a `basis` is absent; a source URL is a placeholder; or a value falls outside its own reported range. The ladder *ratio* envelope is suspended — see §9.2.2 |
| 2 | **Score the sources.** Each measure's ladder step is derived from its source domains, not from the model's claim (§9.2.2). Confidence is then computed from statuses and derived steps |
| 3 | **Median of three runs.** The prompt is run three times and the per-measure median taken, retaining dispersion. Dispersion is the confidence signal for a searched city, playing the role the contributor count plays for a page-sourced one |
| 4 | **Band.** From `inexpensive_restaurant_meal_1p` converted to AUD, cut at AUD 8.02 / 24.47 (§9.3) |
| 5 | **Derive.** Apply M1–M4 (§7.3) for street food, premium meal, cocktail and wine. Then resolve unfound accommodation by status (§9.2.1) |
| 6 | **Convert.** Frozen dated FX snapshot, applied once |
| 7 | **Materialise.** The 19 tier formulas of §7.1 — a pure function |
| 8 | **Persist.** Measures, basis, sources, dispersion, band and model versions are stored. The city never changes again until a deliberate refresh, and re-deriving from stored measures is byte-identical |

Each tier is labelled with the **weakest** basis among its inputs — `observed`, `modelled`, `country_level`, `missing` or `not_available_here` — so a single modelled input can never be presented as observed. Supersession is automatic: a later direct observation outranks a modelled one with no manual cleanup.

#### 9.2.1 Why a missing price and an absent class are handled oppositely

A live test on Sydney returned every measure except the 1-star hotel. That exposed a defect in the first version of this contract: it had only two outcomes, so it could not distinguish *"I could not find it"* from *"it does not exist here"*. For Sydney it is the latter — Australia's budget segment is motels and backpackers, which sit outside star classification entirely.

The distinction is not cosmetic, because the two cases have **opposite correct actions on identical-looking JSON**:

| Status | Action | Rationale |
| --- | --- | --- |
| `not_found` | Derive from the 3-star price using the §7.7 ladder envelope (`1★/3★` median 0.509, IQR 0.489–0.542). Label the tier `modelled` | The class exists; only the observation is missing. This is the level-3 cascade step of §8.1 |
| `class_absent` | Publish the tier as `not_available_here`. **Never derive it** | Deriving would invent a nightly rate for a hotel class the city does not have. That is a fabricated number wearing a model's credibility |

Collapsing both to `missing` — the previous behaviour — is the safe error for Sydney and the wrong one for a city where the class exists and the search merely fell short, since it discards a defensible modelled value and removes a tier the user could have planned with.

The contract therefore makes absence **harder to claim than not-found**: `class_absent` requires an `enumeratingSources` entry — a register or directory that lists what the city *does* have — and an entry lacking one is rejected at validation and retried. Without that asymmetry a fast model would reach for `class_absent` as the cheap way to stop searching, and the distinction would be worse than useless.

A secondary benefit falls out: a city returning `class_absent` for both 1-star and 2-star is signalling that it may need the unstarred budget/mid/luxury ladder — a cleaner trigger than asking the model to judge the market's rating system in the abstract.

#### 9.2.2 The model does not assess its own work

Three live Sydney runs produced a consistent pattern: **the prices converged and the self-assessment did not.** The hostel private room moved 205 → 110 and activities became genuine three-operator medians, while `ladderStep`, `overallConfidence` and `basis` were wrong in every run, always in the flattering direction. One run stated *"only hotel_1star is class_absent"* in its confidence justification while the field itself read `not_found` — the model describing a record it had not written.

More prompt rules did not fix this. The confidence rule was already spelled out as arithmetic (`A = not_found count`, `B = found-at-step-≥3 count`) and the model still returned `A=0, B=0` when both were 1.

The contract therefore stops asking for anything it can compute:

| Field | Before | Now |
| --- | --- | --- |
| `overallConfidence` | Self-graded against a counting rule | **Removed.** Computed server-side from statuses and derived source scores |
| `ladderStep` | Self-reported | **Removed.** Derived from source domains — a booking aggregator scores as a booking aggregator, a travel blog as a travel blog, regardless of the claim |
| `basis` | Self-reported | **Retained**, because it cannot be derived — but cross-checked against the free-text notes, where "midpoint of published range" alongside a claimed `median_of_three_venues` is a detectable contradiction |

The principle generalises beyond this prompt: **never ask a model to report something you can observe yourself.** A self-reported provenance grade is an unverifiable claim occupying a field that a URL check answers definitively. Removing the field removes the failure mode, and shortens the prompt.

What remains asked of the model is what it demonstrably does well: find published prices, and say where it found them.

### 9.2.2 A withdrawn gate: the accommodation ratio envelope

The validation gates originally included a ratio envelope for the accommodation ladder, taken from the incumbent 121-city dataset on the reasoning that its absolute values were stale but its *relative* structure was sound. **That reasoning was wrong, and live collection disproved it.**

Observed ratios to the 3-star price, from four cities collected under this contract:

| Ratio | Lisbon | Hanoi | Chiang Mai | Copenhagen | Observed median | Incumbent median |
| --- | --- | --- | --- | --- | --- | --- |
| `dorm/3★` | 0.131 | 0.205 | 0.270 | 0.129 | **0.168** | 0.400 |
| `private/3★` | 0.438 | 0.411 | 0.595 | 0.321 | **0.424** | 0.550 |
| `1★/3★` | 0.381 | 0.488 | — | 0.321 | **0.381** | 0.509 |
| `2★/3★` | 0.481 | 0.539 | 0.695 | 0.464 | **0.510** | 0.754 |

**Every observed median sits below the incumbent median, in the same direction, across four cities on three continents.** `2★/3★` is 0.51 observed against 0.754 asserted — a 48% gap. Four independent cities agreeing on direction is not sampling noise.

The interpretation is that the incumbent dataset **compresses the budget end**, pricing hostels and 1-star hotels far closer to 3-star than markets actually do. That is consistent with §7.7: its accommodation ladder is substantially asserted rather than observed, and `4★/3★` is exactly 1.800 in all 121 rows.

The error in method is worth naming precisely, because it is subtle and self-inflicted. §7.7 of this document establishes that the incumbent ladder is hard-coded. §8.2 then used that same ladder's structure as an acceptance gate. **A gate derived from the artefact under replacement will reject the evidence that contradicts the artefact** — which is exactly what happened, for four cities running, in the direction of preserving a fabricated ratio.

**Action taken:** the ratio envelope is suspended. Only monotonicity is enforced on accommodation, because ordering is a market fact rather than a dataset artefact. Four cities is far too few to *set* a replacement envelope, but ample to establish the existing one is wrong — and a wrong gate is worse than no gate, because it silently discards correct observations while appearing rigorous.

A replacement envelope must be estimated from observed collection once enough cities have complete ladders, and must not be seeded from the incumbent dataset at all.

### 9.3 Assigning the cost band

The banded models need `band(i)`, but §5.5 defines bands by tercile of a production dataset column and **a new city has no production row**. Banding is therefore done on a directly measured anchor: `inexpensive_restaurant_meal_1p` in AUD, cut at **8.02 / 24.47** (terciles of the closed sample). It is chosen as the level-1 target with the highest capture rate, and it already anchors two of the three fitted relationships.

Tested against the production band on the 70 pooled cities where both are computable: **63% agree exactly, and not one disagreement spans two bands** — no city called `high` by one rule is called `low` by the other. At the smaller Stage 1 sample agreement was 74%, so this is the weaker and more honest figure.

37% one-band disagreement is a real limitation, and it is listed as such. Three things bound its impact:

1. **The production column is not ground truth.** §7.7 shows it descends from asserted multipliers, so disagreement does not establish which rule is wrong — and a directly measured band has the better claim of the two.
2. **The models being banded are three-level step functions.** A one-band error moves a prediction by one coefficient step — for `mcmeal`, 1.73 against 1.09 — not to an arbitrary value.
3. **The error is bounded in direction.** Zero two-band disagreements across 70 cities, in both samples tested, means the worst case is an adjacent step.

A city that cannot be banded is excluded from banded models, never defaulted to `mid`. FX coverage currently spans 23 currencies, leaving 29 of the 99 pooled cities unbandable by this rule — a straightforward gap to close, but open today.

### 9.4 Measured performance

The contract has been run end to end. Eleven runs across five cities, executed by a small, fast model (Haiku 4.5) with no knowledge of this methodology beyond the prompt itself, scored against retained ground truth.

#### 9.4.1 The headline result

| `directLookup` outcome | Runs | Median absolute error, food and drink | Exact matches |
| --- | --- | --- | --- |
| **`accepted`** | 6 | **0.0%** | **29 / 29** |
| `no_page` (source rate-limited) | 4 | 10.4 – 19.2% | 2 / 18 |

**Every food and drink measure was reproduced exactly whenever the direct lookup succeeded, and none was when it failed.** The contributor counts and update dates returned matched independent fetches in every case.

This is the empirical justification for §9.1.1. It was obtained partly by accident: the anchor source began returning HTTP 429 and then 503 partway through testing, which converted four runs into an unplanned measurement of the search-only fallback. The block was IP-based and cleared on an address change, confirming the cause.

#### 9.4.2 Accommodation, validated against direct quotes

Copenhagen is the one city holding accommodation ground truth collected to the estimand this contract specifies: **DKK 1,417.43**, the median of five accepted direct-property 4-star quotes at a fixed 90-day lead.

| Measure | Ground truth | Returned | Error |
| --- | --- | --- | --- |
| `hotel_4star_room_2p` | 1,417.43 | 1,500 | **+5.8%** |
| `paid_attraction_adult_1` | 140 | 150 | +7.1% |

The same city produced a **47.5%** discrepancy in the original reconnaissance, which §5.3 attributed to basis mismatch rather than source error. Fixing the basis collapsed the gap to 5.8%, which confirms that diagnosis empirically rather than by argument.

#### 9.4.3 Accommodation was high-variance, and why

Before the accommodation URL templates existed, the same prompt on the same city returned **6/6 classes on one run and 0/6 on another**. Five Prague runs gave 0, 1, 2, 2 and 2 classes.

The variance had a specific cause, and it was not model unreliability. The contract told the model to *find* booking aggregators; search results are a lottery, and each run independently won or lost that draw per source. Runs that failed then reported the sites as *"blocking automated access"* and *"requiring JavaScript rendering"* — while another run read the same site successfully. **The model's stated reason for a failure is a hypothesis, not evidence**, and it was believed for two revisions.

An enumeration of every URL that had ever yielded an accommodation price revealed stable templates — `booking.com/{onestar,twostars,threestars,fourstars}/city/<cc>/<city>.html`, `us.trip.com/hotels/star<N>/city/<cc>/<city>.html`, and hostelworld's city and private-room paths. Direct fetches confirmed all of them resolve. Naming them in the contract (§9.1, `B0b`) resolved the variance, as §9.4.4 records.

The wider point is the same one §9.1.1 makes for food and drink: **when output is unstable, check whether the model is being asked to find something it could simply be told.** Repetition was buying coverage that an address list gave for free — a k-sample analysis showed usability rising 0% → 30% → 100% across k=1…5, all of which became unnecessary at k=1 once six URLs were named.

Three further defects were found and fixed, all of them defects in this contract rather than in the model:

1. **A single-currency rule.** The contract originally required every price in the city's own currency. Booking sites render prices in the viewer's currency, so the model correctly obeyed and discarded usable evidence — three of one city's four accommodation failures traced to this. Prices are now taken as displayed with their currency named, and converted server-side.
2. **A dated-search preference.** The contract preferred a live 90-day-lead booking query. That is impossible for this tool class, and models attempted it and then abandoned measures for which a published average sat on the same page. Published typical rates are now the primary basis, not the fallback.
3. **A false `no_page` on a rate limit.** The anchor source began returning HTTP 429 and then 503, and the contract had no way to distinguish a fetch failure from an absent page. Two cities whose pages certainly exist were recorded as `no_page` and fell through to search. A retry step now separates the site's own "Cannot find city id" text from any other failure.

#### 9.4.4 Accommodation basis, and a known systematic bias

Naming the accommodation URL templates (§9.1, `B0b`) took Prague from **0/6, 1/6, 2/6, 2/6, 2/6** accommodation classes across five runs to **5/6, 5/6, 4/6** — three usable records from three attempts, with 3-star and 4-star byte-identical each time. The variance was never model noise; it was a missing address.

That left one question: which figure on those pages to take. Three candidate bases were tested against Copenhagen's 4-star ground truth of **DKK 1,417.43** — the median of five accepted direct-property quotes at a fixed 90-day lead:

| Basis | Result | vs truth | Stability |
| --- | --- | --- | --- |
| Headline average | 2,189 | **+54.4%** | identical across every run |
| Median of listed properties | 990 / 1,198 | −30.2% / −15.5% | 21% swing between runs |
| Published range midpoint | never produced for this class | — | untested |

**Headline averages are adopted**, on stability. The alternative is both more biased in the other direction and less reproducible, and the listed prices are "From $X" lowest-available rates rather than typical ones — a different quantity, not a better measurement of the same one.

The **+54% inflation is real and is recorded as a known bias rather than corrected**, because one city of ground truth cannot support a correction factor. It has a plausible mechanism: a blended aggregate over all dates and the full property set is pulled up by peak dates and premium inventory, and is therefore not §1's estimand of what two travellers typically spend. Establishing whether ~50% holds across cities requires direct-quote ground truth in several more, which is the single highest-value validation still outstanding.

**A correction worth recording.** An earlier revision of this contract ranked property medians first, citing a Copenhagen result 5.8% from ground truth. On inspection that figure came from a *"from 1,500+ DKK"* line on a travel blog, labelled `lowest_from_price` — a coincidence, not a method. The ranking was built on a misattributed number and has been reverted. The error was reading a summary rather than the underlying record.

**An untested candidate: the geometric mean of the two bases.** The aggregator's class page carries *both* figures — the headline average and the list of named properties — so both bases are available from a single fetch, at no additional cost. If they bracket the truth for the reasons above, their geometric mean is the natural estimator, since a midpoint between multiplicative bounds belongs in log space.

The available evidence, against Copenhagen's DKK 1,417.43:

| | Headline | Property median | Geometric mean |
| --- | --- | --- | --- |
| Copenhagen, run 1 | +54.4% | −30.2% | **+3.9%** |
| Copenhagen, run 2 | +54.4% | −15.5% | **+14.2%** |

The headline-to-median ratio also looks stable across cities: **1.69 in Prague, 1.83–2.21 in Copenhagen**, which is what a systematic basis difference would produce rather than two unrelated numbers.

This is a **hypothesis with a mechanism, not a validated result** — one city, two runs. It is recorded here rather than adopted, because adopting a promising number on one city's evidence is precisely the error corrected in the paragraph above. It is also a *derivation* change rather than a collection change: no new sources, no extra requests, so it can be tested retrospectively against any city where direct quotes are later obtained.

#### 9.4.5 An unenforceable rule, withdrawn

The contract briefly required a single basis across all six accommodation classes, after mixed bases produced a 2-star priced at 23% of a 3-star. The rule was stated, then restated, then given its own self-check. **Compliance across eleven runs was 3/11 — and all three compliant runs were accidents**, using one basis because only one was available.

The failure was completely consistent: **hostels by property median, hotels by headline average, every time.** That is not disobedience. Hostelworld publishes property lists with no aggregate; booking.com publishes an aggregate. The rule asked the model to override each source's own format, and no wording made that reliable.

The rule is therefore withdrawn and replaced with one that matches how the sources actually publish: hotels take the headline average, hostels take a property median, and the two are *expected* to differ. Consistency is still required within the four hotel classes, where it is achievable because those four pages share a format.

The general lesson is worth stating: **a contract that fights the shape of its sources will lose, however firmly it is worded.** Three revisions and eleven runs were spent discovering that the constraint had to move into the source model rather than the instructions.

#### 9.4.6 Remaining known defects

- **`paid_attraction_adult_1` has no fixed estimand.** The contract asks for "a well-known paid attraction", and Lisbon legitimately offers €15 to €25 depending on which. Errors of 0%, −30% and −44% across cities reflect different attractions being priced, not measurement error. The measure needs a naming rule or exclusion from scored validation.
- **Placeholder source URLs** appeared once, in two entries of one run, inside an accepted `sources` array. Now explicitly banned and self-checked, but the failure rate was low enough that it may recur undetected.
- **Three venues is too few for a dispersed class.** One 2-star sample spanned 396–1,267 CZK, a 3.2× range, and the model itself flagged it. A spread guard now applies.

#### 9.4.7 Why more accommodation ground truth is hard to get

Validating the ~50% hotel bias needs direct-property quotes in several more cities. An attempt to collect them for Prague, Hanoi and Lisbon returned **zero usable quotes from 11 Lisbon attempts**, and the failure modes say why this is structural rather than a matter of effort:

| Failure | Count |
| --- | --- |
| Domain does not resolve | 4 |
| HTTP 403 Forbidden | 2 |
| Empty response — dynamic JavaScript | 1 |
| SSL verification failed | 1 |
| Connection refused | 1 |
| HTTP 404 | 1 |
| Site shows no price without using its booking engine | 1 |

Individual hotel booking engines require date-picker interaction and are frequently bot-protected. **A plain page fetch cannot obtain a dated quote from a hotel's own site.** This is the same wall that made the dated-search route unworkable (§9.4.3), reached from the other direction.

Copenhagen's five accepted quotes came from the v3 programme's interactive collection, at roughly 50% yield across ten rank-ordered attempts. Reproducing that in three more cities needs either browser automation or manual collection — it is not a prompt or budget problem.

That places a real ceiling on this validation: the bias figure will stay at one city until someone collects quotes by a different mechanism, and §9.4.4's geometric-mean candidate stays untested until then.

#### 9.4.8 What is not yet validated

The measured error remains a **lower bound** on production error. Every test city has an anchor page; the cities where this path matters most — §9.1's 55% of low-band destinations — do not, and have no ground truth by construction.

---

## 10. Limitations

Stated plainly, because a methodology that hides these cannot be audited.

1. **Accuracy is 18–22% median, not the 15% targeted**, and the figure rose as the sample expanded. Published error must reflect the measurement, not the aspiration — and not the most favourable sample. The recommendation is a published gate of ≤25% (§7.9).
2. **Holdout samples are 7–24 cities.** Those estimates carry real noise, which is why leave-one-out is primary and why the selection rule requires a model to beat the baseline materially on both.
3. **The sample frame is closed and the low band is the thinnest part of it.** All 121 production cities have been attempted; only 4 of 13 unpooled low-band candidates were retained. No further collection from this source can improve the band where `mcmeal`'s coefficient does most of its work.
4. **The fitted relationships are proxies (§7.3).** All four were fitted on measures the sample carries, not on the four measures actually shipped as modelled. They settle model *form* — bands or no bands — and not coefficient values. The ~160-observation calibration of §7.8 must be completed before any coefficient is published as final.
5. **One dominant source for food and drink anchors**, so cross-source disagreement cannot be computed for those measures. The contributor count mitigates but does not solve this.
6. **Activity tiers have no derivation path** and currently rest on direct collection covering a minority of cities.
7. **The star ladder does not map everywhere.** Destinations like Don Det have guesthouses with no star classification and need a budget/mid/luxury mapping instead.
8. **Structure is assumed stable between refreshes.** Ratios are re-fitted annually; if relative prices shift faster than that, error grows silently between fits.
9. **Accommodation carries a known ~50% upward bias on hotel classes** (§9.4.4), established against direct-property quotes in one city. It is recorded rather than corrected, because one city cannot support a correction factor. Obtaining direct-quote ground truth in several more cities is the highest-value validation outstanding.
10. **Food and drink is exact where the direct lookup succeeds and 10–19% wrong where it does not** (§9.4.1). `directLookup.outcome` is therefore a trust flag on a city's food prices, not telemetry, and a city built on the fallback path must be labelled and re-attempted rather than published as equivalent.
11. **Band assignment for new cities agrees with the production band only 63% of the time** (§9.3), though never by more than one band across 70 tested cities. FX coverage spans 23 currencies against 99 pooled cities, so 29 cannot yet be banded at all.

---

## 11. Ongoing validation

The app records actual spend by city and category. Because the accommodation estimand is *what travellers actually pay* rather than advertised rates, planned-versus-actual residuals measure the same quantity the model predicts, and feed the annual re-fit. This converts routine use into a continuous, zero-cost accuracy signal.

---

## Reproducibility

| Artifact | Path |
| --- | --- |
| **The extraction prompt** | `docs/prompts/llm_prompt_city_anchors_v4.md` — generated from §9.1, never edited directly |
| Model fitting and validation | `scripts/fit-city-cost-ratios.mjs` |
| Fitted models and results | `data/reference/dry-run/phase-0c-ratio-model-fit.json` |
| Anchor samples | `data/reference/dry-run/phase-0d-numbeo-expanded-sample.json`, `phase-0e-stage1-numbeo-sample.json`, `phase-0f-stage2-numbeo-sample.json` |
| Stage 1 selection rule | `data/reference/dry-run/phase-0e-stage1-selection.json` |
| Dry-run evidence | `data/reference/dry-run/phase-0a-*.json`, `phase-0b-*.json` |
| Retained v3 observations | `data/reference/observations/` |
| Copenhagen accommodation ground truth | `data/reference/observations/accommodation-copenhagen-shoulder-2026-07-24.jsonl` |
| Prompt-output scoring | `scripts/score-anchor-prompt-test.mjs` |
| Multi-sample combination | `scripts/combine-anchor-samples.mjs` |
| Accommodation bias comparison | `scripts/score-accommodation-bias.mjs` |

**The prompt file is generated, not authored.** §9.1 of this document is the source of truth; the standalone file is extracted from its fenced block so the two cannot drift. Edit the methodology, then regenerate.

The fitting script is deterministic: the holdout split is a fixed alphabetical rule, and re-running reproduces every figure in §6 and §7 exactly. The scoring scripts take a `TEST_DIR` environment variable pointing at a directory of prompt outputs.

claude --resume 8246b550-fed3-456c-91ed-ce2595bc4016