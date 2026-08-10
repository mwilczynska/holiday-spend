# City Cost v6 Data Dictionary

**Status:** Frozen for v6. Amend only through a dated decision recorded in `PLAN.md` **and** in this file,
**before** the locked holdout in `validation-manifest-v6.json` is used.

**Read this first if you are:** deciding whether a collected value may be used, deciding what grade a
value carries, or implementing the derivation path.

---

## 0. What changed from v5, and what did not

**The product estimands are UNCHANGED.** Every one of the 19 values means exactly what it meant in
`data/reference/v5/data-dictionary-v5.md`. v6 does not redefine what a three-star room is.

**What changed is evidence admissibility.** v5 admitted an observation only when the source stated its
occupancy basis, tax treatment, price statistic and reference period in the same evidence. Public
commercial sources do not systematically publish that metadata, so v5 rejected almost everything it
collected — 95 experiments, zero product mappings. See `docs/dev/plans/city-cost-methodology-v6.md` §1.

v6 replaces the binary admit/reject rule with a **four-level evidence grade**. Every value is produced;
every value states how well it is known. Nothing is presented as more certain than it is.

> **The v5 rule that survives unchanged:** a modelled or imputed value must never be presentable as
> observed evidence. v6 enforces this *harder* than v5 did, because the grade travels with the value into
> the UI instead of being discarded at the storage boundary.

---

## 1. Shared rules

These are inherited from v5 verbatim except where marked **[v6]**.

- City values are base costs for **two travellers**, ultimately in **AUD**.
- Accommodation is **per room/bed night**; food, drinks and activities are **per day**.
- Source facts are retained in the **source currency**. FX conversion happens **once**, in deterministic
  code, from a dated versioned rate table. The LLM never converts currency.
- For dated Booking.com ground truth, a price is the lowest rate quoted to a logged-out visitor with no
  membership for the stated unit. Public promotional deals available to any visitor are included; member-only
  or account-gated rates are excluded. A strikethrough or "original" marketing price is never the amount.
- **[v6] Tax treatment no longer gates admissibility.** Where a source states its tax basis, record it.
  Where it does not, record `taxStatus: unknown` and let the source-level calibration offset (§4) absorb
  the systematic component. v5 rejected these rows; v6 uses them at grade B.
- When multiple compatible observations exist, the city point estimate is their **median**.
- "Current" means the retrieval/reference date recorded with the observation.
- `not_found`, `blocked`, `stale` and `class_absent` remain **distinct states**. Absence requires positive
  enumerating evidence; failure to find a page is not absence. **A blocked page is never recorded as
  missing data.**
- `activities_free = 0` is definitional and requires no observation.
- **[v6]** A value is never blank in the shipped dataset. Where no evidence exists, it is produced at
  grade D from a regional/band prior and labelled as such. See §3.

---

## 2. Product fields

Unchanged from v5. The `Derived how` column is new and states the v6 production path for each field.

| Field | Frozen estimand | Derived how (v6) | Typical grade |
| --- | --- | --- | --- |
| `accom_shared_hostel_dorm` | Two separately purchasable dorm beds in an eligible hostel, one night | `2 × 0.2955 × accom_3_star` | C |
| `accom_hostel_private_room` | One private hostel room for two, one night | `0.5919 × accom_3_star` (v4 blended rollback; primary M5 cost-banded R1 candidate) | C |
| `accom_1_star` | Standard room for two, one-star class, one night | `0.6663 × accom_3_star` (retained interpolated rung) | C |
| `accom_2_star` | Standard room for two, two-star class, one night | `0.7500 × accom_3_star` | C |
| `accom_3_star` | Standard room for two, three-star class, one night | **MEASURED** — Expedia class-trend snippet | B |
| `accom_4_star` | Standard room for two, four-star class, one night | `1.3372 × accom_3_star` | C |
| `food_street_food` | Six standard low-cost prepared meals for two over one day | `6 × street_food_meal_1p` | A/C |
| `food_budget` | Four street meals + two inexpensive-restaurant meals for two, one day | basket | A |
| `food_mid_range` | Two street + two inexpensive + one mid-range shared meal, one day | basket | A |
| `food_high_end` | Two inexpensive + one mid-range + one premium shared meal, one day | basket | A/C |
| `drink_coffee` | One regular cappuccino | **MEASURED** — Numbeo | A |
| `drinks_none` | Two cappuccinos, no alcohol | basket | A |
| `drinks_light` | Two cappuccinos + two domestic draft beers | basket | A |
| `drinks_moderate` | Two cappuccinos + four beers + two standard cocktails | basket | A/B |
| `drinks_heavy` | Two cappuccinos + six beers + four cocktails + two wine glasses | basket | B/C |
| `activities_free` | No paid activity spending | `0` | definitional |
| `activities_budget` | Two adult tickets to a standard low-cost paid attraction | `2 ×` BudgetYourTrip budget tier | B |
| `activities_mid_range` | Two adult places on a half-day group activity | `2 ×` BudgetYourTrip mid tier | B |
| `activities_high_end` | Two adult places on a full-day premium activity | `2 ×` BudgetYourTrip luxury tier | B |

**The activity fields carry a known semantic gap.** BudgetYourTrip publishes *reported daily entertainment
spend by traveller tier*, not *the price of a ticket / half-day group activity / full-day premium
activity*. Experiments 037, 045, 044, 046, 050, 071 and 089 all failed to find a definition-matched
activity source. v6 ships the proxy at grade B with the mismatch recorded here rather than blocking, and
M5 revisits it. **Do not describe these three values as observed ticket prices.**

---

## 3. Evidence grades **[v6, new]**

Every materialized value carries exactly one grade. The grade determines the published interval and the
UI treatment. Grades are assigned by deterministic code, never by the LLM.

| Grade | Meaning | Interval | Assigned when |
| --- | --- | --- | --- |
| **A** | **Observed.** Direct source observation this refresh, definition-compatible, basis stated by the source | ±10% | Numbeo food/drink rows with exact city, row label, value, currency and canonical URL |
| **B** | **Source proxy.** Directly observed, but occupancy / tax / statistic partly unstated. Corrected by a fitted source offset (§4) | ±20% | Expedia 3-star trends, BudgetYourTrip activity tiers, Expatistan drink rows |
| **C** | **Laddered.** Derived from a measured anchor in the same city via a validated ratio | ±25% (wider where the coefficient is weak — see `coefficients-v6.json`) | All non-3-star accommodation; food/drink measures filled by a v4 relation |
| **D** | **Regional prior.** No anchor for this city; value is the regional and cost-band median | ±45% | Sparse cities — Don Det, Kyoto and Fukuoka class, where every source returns `not_found` |
| **definitional** | True by definition | n/a | `activities_free = 0` |

**Grade D is what makes 100% coverage honest.** v5 had no grade D, so a sparse city blocked the whole
methodology. v6 gives it a wide, clearly-labelled number.

**Grade propagation through a basket:** a basket takes the **worst** grade among its inputs, and its
interval is the quadrature sum of its input intervals weighted by each input's contribution to the total.
A basket is never graded better than its weakest ingredient.

**Grade is not confidence-from-the-model.** v4 established that a model's self-reported confidence is
wrong in every run and always flatteringly (`overallConfidence`, `ladderStep` — both removed). Grade is
assigned by code from the evidence path, never asked for.

---

## 4. Source calibration offsets **[v6, new]**

A grade-B value is corrected before use:

```
value_calibrated = value_raw × offset[source, measure]
```

Rules that keep this from becoming v1's asserted-constant mistake:

1. An offset is **fitted once** against the 40-city ground-truth panel (`validation-manifest-v6.json`),
   never against the shipping CSV and never against another model's output.
2. An offset may only ship where it is fitted on **≥12 cities** *and* reduces held-out median APE
   relative to the uncalibrated value. Otherwise the offset is `1.0` and the dispersion still widens the
   interval.
3. The **residual dispersion becomes the published interval** for that source/measure. An offset that
   corrects the median but leaves wide scatter must not narrow the interval.
4. Every offset is versioned and recorded with its fit date, sample and residual statistics.

The frozen M3 candidate records both directions in `data/reference/v6/coefficients-v6.json`: the calibration
target is Booking.com development ground truth and the production anchor is Expedia. The runtime
Expedia → Booking multiplier is `0.9361` with a `±41%` leave-one-city-out p90 residual interval, fitted on
15 matched development cities. Gate 8 is not evaluable on the holdout because it contains no paired Expedia
anchor rows, so it remains unvalidated as an independent holdout result. Experiment
`data/reference/v6/experiments/001-expedia-production-anchor/` did, however, replay the production Expedia
extractor on those 15 unsealed development cities: median APE 8.36% and median signed error +7.08% under
the frozen offset. This validates the production path, not an independent holdout.

---

## 5. Model and missingness rules

Inherited from v5, with one relaxation marked **[v6]**.

- Derivation may use only **named observed inputs and versioned coefficients**.
- A model must **never** be fitted on values created by the same model family, on asserted constants in
  the shipping CSV, or on incompatible source bases.
- **[v6]** A model **may** be fitted on rows whose occupancy or tax basis is unstated, provided the
  relationship is a **within-city ratio between two rows from the same source**, so the unstated basis is
  common to both sides and cancels. This is the specific relaxation that unblocks the ladder. It does
  **not** license comparing an unstated-basis row with a stated-basis row from a different source.
- A genuinely absent class is not silently filled with a neighbouring class. It is produced at grade D
  from the regional prior and labelled.

---

## 6. Dated decisions

### 9 August 2026 — v6 adoption

The evidence-admissibility rule is replaced by the grade ladder (§3) and source calibration (§4). Product
estimands are unchanged. Rationale, and the 95 experiments that motivated it, are in
`docs/dev/plans/city-cost-methodology-v6.md` §1.

### 9 August 2026 — same-source ratio fitting

Ratio coefficients are fitted on the **same source that supplies the production anchor** (Expedia), so
that estimator bias cancels in the division. The v4 Booking.com fit is retained as *independent
cross-validation* — it agrees to 2.17% and 3.08% on the two hotel relations — but is **not** the shipped
coefficient. Mixing a Booking-fitted ratio with an Expedia-measured anchor would reintroduce the bias the
design removes. See `scripts/fit-city-cost-ladder-v6.mjs`.

### Inherited from v5, 31 July 2026 — one-bed dorm boundary

The shared-dorm product estimand remains two beds for two travellers, while the collection contract may
retain an explicit one-adult bed/night observation and apply the fixed factor of two in deterministic
code. This changes the input unit, not the estimand, and introduces no fitted parameter.

### Inherited from v5, 1 August 2026 — occupancy evidence levels

`explicit_two_adult` remains directly product-compatible. `source_defined_double_occupancy` and
`unknown_source_default` were **ineligible** under v5; under v6 they are **grade B** inputs subject to §4.
A room price is still never multiplied by two merely because the product serves two travellers — room
prices are not per-person beds.
