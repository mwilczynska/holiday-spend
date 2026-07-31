# Holiday Spend — Project Log

Historical record. What was built, what was tried, what it produced, and where the evidence lives.

This file is append-mostly. It is **not** the place for current plans — see [PLAN.md](PLAN.md).
For what the project *is*, see [CLAUDE.md](CLAUDE.md).

- [Part 1 — City cost methodology](#part-1--city-cost-methodology-history) — the four versions, their results, why each was replaced
- [Part 2 — Datasets and artifacts](#part-2--datasets-and-artifacts)
- [Part 3 — Scripts](#part-3--scripts)
- [Part 4 — Shipped feature history](#part-4--shipped-feature-history)

---

# Part 1 — City cost methodology history

The app needs, for each city, **19 cost values**: six accommodation tiers (hostel dorm through 4-star),
four food, five drinks, four activities. All for two travellers, per night for accommodation and per day
otherwise, in AUD.

Four methodology versions have been attempted. **v1 is what still ships.** v3 was abandoned. v4 is
researched but not integrated.

| Version | Approach | Status | Verdict |
| --- | --- | --- | --- |
| v1 | LLM recalls 10 anchors, asserted multipliers derive 19 tiers | **In production** | Structurally defective but not disproven |
| v2.1 | v1 plus hybrid/Xotelo accommodation lookup | Removed | Code deleted; only the doc baseline remains |
| v3 | Observed-first: direct source-attributed observation of every measure | **Abandoned** 25–27 Jul 2026 | Stalled at 22.8% coverage, zero complete cities |
| v4 | Measure price *level* cheaply, model tier *structure* | **Research complete, unintegrated** | 18–22% median APE; accommodation level unresolved |

---

## v1 — Anchors and asserted multipliers (shipping)

**What it does.** `docs/prompts/llm_prompt_new_cities_1.md` asks a model for ten anchor prices, then
fixed multipliers derive all 19 tiers. Still the live path behind `/dataset` city generation and the
121-row canonical CSV.

**Four defects, three structural:**

| Defect | Evidence |
| --- | --- |
| Anchors come from model memory, not a live source | `src/lib/city-llm-client.ts` posts a chat completion with **no `tools` array**, while the prompt instructs the model to "research Numbeo" pages it cannot fetch |
| Multipliers asserted globally | `street_food = inexpensive_meal × 0.60` everywhere, regardless of region |
| An additive constant that does not scale | `activities_blended = (inexpensive_meal + 10.0) / 2` — negligible in Zurich, dominant in Hanoi |
| The model also did arithmetic and FX | Three error sources compounded |

**The audit that condemned it, and its limits.** `data/reference/accuracy_audit.csv` reported
**17.5% MAPE and −16.3% bias** and triggered the full rebuild. Re-examined, it is **nine observations
across three cities**, six benchmarked against Numbeo. Its headline bias is largely one city: Lisbon's
stored cappuccino was €1.50 against a reference €2.57 (−49%). Prague and Hanoi sat within 0–15%.

> **The conclusion drawn was too strong for the evidence.** The architecture was not disproven; the
> *inputs* were stale and the multipliers were never calibrated. v4 acts on that re-reading.

**A measurable fingerprint of the defect.** Counting *distinct values* of each ladder ratio across all
121 production rows separates observation from assertion:

| Ratio | Median | IQR | Distinct values across 121 cities |
| --- | --- | --- | --- |
| `dorm / 3★` | 0.400 | 0.400–0.455 | 47 |
| `private / 3★` | 0.550 | 0.509–0.582 | 37 |
| `1★ / 3★` | 0.509 | 0.489–0.542 | 30 |
| `2★ / 3★` | 0.754 | 0.744–0.771 | 35 |
| **`4★ / 3★`** | **1.800** | **1.800–1.800** | **1** |
| **`food_high_end / food_mid_range`** | **1.500** | **1.500–1.500** | **1** |

Two ratios are constant to the last decimal in every one of 121 cities. `accom_4_star` contains **no
city-specific information at all** beyond its 3-star value. Consequence: the incumbent 4-star column
cannot serve as validation data for any 4-star model — it would only confirm that 1.8 reproduces 1.8.

---

## v2.1 — Hybrid / Xotelo accommodation (removed)

Added an external accommodation lookup on top of v1. The code was deleted in the cleanup pass
(legacy `/api/cities/estimate`, the hybrid/Xotelo library, anchor-input components). Only the doc
baseline survives, in `docs/product/archive/methodology-v2-v3.md`, which still describes "Version 2.1 baseline +
Version 3 redesign" and still backs the `/estimates` page.

---

## v3 — Observed-first (abandoned 25–27 July 2026)

**The design.** Direct, source-attributed observation of 17 measures across a deterministic 36-city
pilot, with pre-registered acceptance gates, frozen FX, seasonal accommodation panels drawn from
official registers, and a fail-closed publication rule. Eight gated phases (6A–6H) ending in a
validated 121-city recollection.

**Where it reached, and stopped:**

| Metric | Result |
| --- | --- |
| Tier cells materialized | **156 of 684 (22.8%)** |
| Complete cities | **zero** |
| Eligible accommodation measures | **zero** |
| Accepted observations retained | 176 across 32 cities |
| Estimated cost to finish the 121-city set | **~17,300 lookups**, recurring every refresh |

**Why it failed — the central design lesson:**

> **Tiers are conjunctions of measures.** `food_mid_range` requires street-food *and* inexpensive-meal
> *and* mid-range-meal prices. A city missing one input yields no cell for any tier naming it.

Under conjunctive baskets, breadth is the wrong collection shape. Four measures stood at zero
observations; `street_food_meal_1p` alone blocked three tiers across all 36 cities — **108 cells from
one absent item**. 28 of 36 cities sat at exactly five of seventeen measures. 132 of 171 observations
(77%) came from a single channel, so cross-channel disagreement was uncomputable rather than merely
unmeasured.

### What v3 produced that remains useful

Despite the abandonment, v3 generated the evidence base v4 now runs on:

- **176 retained observations** (`data/reference/observations/`) — reused directly as v4 modelling data
- **Copenhagen accommodation ground truth** — DKK 1,417.43, median of five accepted direct-property
  4-star quotes at a fixed 90-day lead. Still the **only** accommodation ground truth in existence, and
  the anchor for every accommodation bias claim in v4
- **Frozen FX snapshot** at `data/reference/fx/city_cost_fx_aud_2026-07-22.json`, 23 currencies with
  source attribution per rate
- **Five frozen property frames** (Barcelona, Copenhagen, Da Nang, Lisbon, Prague) — the provenance
  model that v4 quote records still follow
- **Tourism/population enrichment** for the 36-city pilot: 18 measured tourism-intensity records
  (14 strict, 4 relaxed), 18 structured rejections, 29 matched UN WUP populations

### The amendments, and what each concluded

Six amendments were issued during the 25 July re-scope before the whole programme was dropped. They are
recorded because several conclusions carried into v4:

| Amendment | Conclusion |
| --- | --- |
| A / B | Three independent venues per venue-priced measure, two per activity product — raised honest completion cost from ~198 to ~530 observations |
| C | Accommodation seasonality moved into a model: 3 index cities under the full contract, others one anchor season, cutting per-city quotes 90 → 18 |
| D | Destinations with no retrievable public evidence are **structurally unobservable** — they leave the collection denominator entirely, and are the case a fallback model exists to serve |
| E1 | Within-venue selection rule: median of the venue's standard section, excluding premium/reserve/low-ABV/zero-proof. Without it, selection moved a measure ~2.5× |
| E2 / E3 | Delivery-platform menus authorised as a source type, then found **structurally unretrievable** — seven platforms tested, none exposes prices in server-rendered HTML |
| F | Street food settled by calibrated ratio rather than collection, superseding E2/E3 |

**Cost of the venue channel, measured:** roughly **one accepted observation per six web calls**. Completing
the non-accommodation set at the Amendment B threshold implied ~4,000 calls — the same order-of-magnitude
wall that forced the accommodation re-scope.

**A regional bias was found and not resolved (Amendment E4).** Official priced venue menus were readily
found in Vancouver and Hanoi but not Lisbon. That bias correlates with region — one of the model's own
stratification variables.

### The accommodation source reversal (27 July 2026)

v3 excluded Booking.com and Hostelworld as extraction sources on a reading of their terms, routing
accommodation through official registers plus direct property pages instead.

**That exclusion was reversed by owner decision.** Booking.com and Trip.com became the primary
accommodation channels. The driving evidence: the register-first path produced **five accepted quotes in
one city across five frozen frames**, while a single public Booking.com class page returned ten named
properties whose median sat 13.4% from Copenhagen's ground truth.

Binding constraints retained: signed out, no member/login rates, no bypassing blocks or CAPTCHAs,
browsing pace with checkpointing, blocks recorded as missing observations. Hostelworld's exclusion was
**not** reversed and would need the same explicit decision.

Superseded text was marked rather than deleted, across `docs/dev/plans/city-cost-source-access.md`,
`observed-first-methodology.md`, `docs/product/archive/methodology-v2-v3.md`, and `phase-6-rescope-2026-07-25.md`.

---

## v4 — Measure level, model structure (current design)

**Status: research complete, app integration not started.**

Authoritative document: **`docs/product/methodology-v4.md`** (1,703 lines). §9.1 is the source of truth
for the extraction prompt; `docs/prompts/llm_prompt_city_anchors_v4.md` is *generated* from it and must
never be edited directly.

### The core insight

v3 treated three different properties as if all required direct observation per city per refresh:

| Property | Stability | Correct treatment |
| --- | --- | --- |
| **Level** — the absolute price in a city | Drifts slowly | Measure it, cheaply |
| **Structure** — ratios between tiers | Very stable | Model it, calibrated from data |
| **Drift** — change over time | Continuous | Re-measure levels; leave structure alone |

> **Measure what is cheap to measure. Model only the gaps. Never assert a constant.**

The second architectural move: **the LLM is a structured extractor, never an estimator.** It searches,
reads, and reports numbers with sources and an explicit basis. All arithmetic, FX and tier derivation
happen server-side as a pure function.

### The sample

Expanded in two deliberate stages to a **closed frame of 99 cities** — every city in the 121-city
production dataset was attempted, so no further collection from this source is possible.

| Stage | Outcome |
| --- | --- |
| Base | 58 cities pooled from v3 observations + expanded fetches |
| Stage 1 | 27 further cities, band-stratified from the production frame → 85 pooled |
| Stage 2 | All 27 remaining cities attempted → **14 retained, 6 rejected on the contributor floor, 7 with no source page** |

**Final: 99 cities.** `mcmeal` at 68 (bands 17/23/28), the other three relationships at 97 (23/35/39).

**Contributor floor, stated:** at least 10 contributors and an update within 12 months. Krabi at 9 falls
just below and is rejected — the alternative was undocumented case-by-case discretion.

**Attrition is a cliff, not a slope.** Retained cities have a median of 63 contributors; rejected ones
have between 2 and 9. Almost nothing sits in between. Public price coverage is close to **binary by
destination type**. The low band stays thinnest and **cannot be fixed** — only 4 of 13 unpooled low-band
cities were retained, and that is exactly the band where `mcmeal`'s coefficient does its work.

### Model results

Four candidate forms: R0 (one global ratio), R1 (cost-banded), R2 (power law), R3 (banded elasticity).
Median APE as **leave-one-out / holdout**:

| Relation | n | R0 | R1 | R2 | R3 | Selected |
| --- | --- | --- | --- | --- | --- | --- |
| `midrange ~ inexpensive` | 97 | 21.3 / 26.3 | 20.3 / 27.3 | 21.3 / 20.3 | 21.1 / 24.8 | **R0** |
| `mcmeal ~ inexpensive` | 68 | 43.2 / 34.9 | **22.0 / 21.9** | 34.8 / 25.5 | 23.1 / 23.0 | **R1** |
| `cappuccino ~ beer` | 97 | 25.4 / 25.9 | **18.2 / 20.9** | 25.7 / 23.4 | 20.2 / 23.2 | **R1** |
| `attraction ~ inexpensive` | 29 | 47.2 / 54.7 | 50.8 / 51.0 | 55.4 / 47.3 | 57.6 / 53.7 | **none** |

**Shipped model forms:**

```
midrange ~ inexpensive     R0    T = 5.7388 · A
mcmeal   ~ inexpensive     R1    k_low 1.7260   k_mid 1.0898   k_high 0.6452
cappuccino ~ beer          R1    k_low 1.1304   k_mid 1.0614   k_high 0.6629
attraction ~ inexpensive   —     no model; collect directly or publish missing
```

**Selection rule, reached through two forced corrections:**

> A richer model must beat R0 by at least **10% relative on *both*** leave-one-out and the fixed holdout
> to qualify. Among qualifiers, take the fewest parameters within 10% of the best leave-one-out score.

*Correction 1* — the rule originally required both schemes to name the identical winner. Once R3 existed
that misfired: for `cappuccino`, LOO preferred R1 and holdout preferred R3, returning "no agreement, keep
R0" even though both ranked R0 last by seven points. R1 and R3 are two expressions of one decision — band
or don't band. *Correction 2* — a bare inequality escalated `midrange` to a 2-parameter model on a
**0.02-point** LOO difference. The 10% margin removes escalation-on-noise and changes nothing else.

**R3 was fitted and won nothing** — qualified twice across two sample sizes, selected zero times. All its
band elasticities sit at ≈1, so it reproduces R1 with three redundant parameters. Rejected on evidence.

### Three findings worth preserving

**1. One relationship genuinely needs bands.** `mcmeal ~ inexpensive` runs **1.73 (low) → 1.09 (mid) →
0.65 (high)**, a 2.7× monotonic decline: in high-cost cities a fast-food combo is cheaper than a cheap
restaurant meal, in low-cost cities nearly twice as dear, because international fast-food pricing is far
less locally elastic. R0 here is not merely noisier but **biased by +0.185 log (~20% high)**. A single
global constant would be wrong by ~2× in one direction, systematically.

The conclusion survived being doubted — at n=29 the reading was "R1 overfits"; that was withdrawn at
n=54 and confirmed at n=68 where the two validation schemes coincide (22.0 vs 21.9).

**2. A negative result: activities cannot be derived from food prices.** The `attraction ~ inexpensive`
ratio spans **0.025 to 6.0 — a 242× range** — with every model at 47–58% median APE and p90 reaching
227%. Adding bands made it *worse*. Two independent signals: the R1 band coefficients are
1.055 / 1.027 / 1.082 (three numbers that are effectively one), and R0's bias is **+0.007** while its
median error is 47%. Unbiased and wildly imprecise is the signature of predicting from an unrelated
variable. **This is the absence of a relationship, not a weak one.** Activities are collected directly or
published missing.

**3. Thin sources add variance without bias.** Ten of the 99 pooled cities carry a low contributor count
or estimated-data warning. Re-running the entire fit without them leaves every selection stable and moves
coefficients by 0.2–6.1% — but improves accuracy on every relationship (`midrange` 21.3 → 15.9). That is
a *product* decision, not a modelling one: a low-confidence city should carry a wider published interval,
not a different model.

### Measured contract performance

Eleven end-to-end runs across five cities, executed by a small fast model (Haiku 4.5) with no knowledge
of the methodology beyond the prompt:

| `directLookup` outcome | Runs | Median error, food & drink | Exact matches |
| --- | --- | --- | --- |
| **`accepted`** | 6 | **0.0%** | **29 / 29** |
| `no_page` (source rate-limited) | 4 | 10.4–19.2% | 2 / 18 |

**Every food and drink measure was reproduced exactly whenever the direct lookup succeeded, and none was
when it failed.** So `directLookup.outcome` is a **trust flag**, not telemetry. This was measured partly
by accident — the anchor source began returning 429 then 503 mid-testing, converting four runs into an
unplanned measurement of the search-only fallback.

**Naming URL templates was the single highest-value change.** Prague went from 0, 1, 2, 2, 2 accommodation
classes across five runs to 5, 5, 4 across three. The variance was never model noise; it was a missing
address. A k-sample analysis showed usability rising 0% → 30% → 100% across k=1…5 — all of which became
unnecessary at k=1 once six URLs were named.

### The accommodation problem — unresolved, and self-contradictory in the docs

Two same-day commits reached **opposite conclusions** about which figure to read from a Booking.com
class page. This is the most important open inconsistency in the methodology:

| Document | Commit | Position |
| --- | --- | --- |
| `docs/product/methodology-v4.md` §9.4.4 | `7db267f` | **"Headline averages are adopted, on stability."** Property medians rejected as unstable (21% swing between runs) |
| `docs/dev/plans/accommodation-collection-v4.md` | `5c57719` (later) | **"Never read the headline average."** Erratic in both directions; Bangkok's 4-star headline prints *below* its 3-star |

The later document supersedes on ordering, but **this has not been explicitly reconciled** and both remain
in the repo as active guidance. See PLAN.md.

**What each measured:**

*methodology-v4.md §9.4.4* — against Copenhagen's DKK 1,417.43 ground truth: headline average +54.4%
(identical across every run), property median −30.2% / −15.5% (21% swing). Adopted headline on stability,
recording the +54% inflation as a **known bias rather than a correction**, because one city cannot support
a correction factor.

*accommodation-collection-v4.md* — Copenhagen's full-inventory read of 108 four-star properties in page
order showed the first-page estimator is biased for *levels*: sliding a 10-property window gives medians
from **275 to 1085, a 3.945× spread and 160.2% worst-case error**, because the commercial sort *orders*
price along the page. The headline is erratic rather than merely inflated: 0.451× the list median in
Hanoi, 1.834× in Vancouver.

**What both agree on — the class ladder transfers.** Fitted across 16 cities:

| Relation | n | Median ratio | IQR | R0 LOO / holdout |
| --- | --- | --- | --- | --- |
| `4star / 3star` | 16 | **1.297** | 1.257–1.555 | 12.6% / 16.9% |
| `2star / 3star` | 16 | **0.734** | 0.679–0.903 | 15.8% / 14.1% |
| `hostel / 3star` | 13 | **0.592** | 0.517–0.647 | 16.6% / 36.6% |

Cost bands make both hotel relations worse on LOO *and* holdout, so the one-parameter form stands.
Copenhagen's independent full-inventory date-controlled read gives 1.527, inside the observed range —
**a ladder fitted on the biased estimator transfers to an unbiased one**, because the estimator's bias is
largely common to both classes and cancels in their ratio.

**The incumbent 1.800 is refuted.** Applied to these anchors it overpredicts **14 of 16 cities, median
absolute error 38.8%**, reaching +80.1% in San Francisco. The observed IQR does not contain 1.800.

**Hostels yield one blended measure, not two.** The hostels page never states dorm bed versus private
room, and the mix differs by city. But a property carries the same price on the hostels page and on
whichever star-class page also lists it — verified across five cities and eight properties — so both
sides of the ratio share one unnamed unit. The ladder is internally coherent:
`2star/3star × hostel/2star = 0.5926` against a directly fitted `hostel/3star` of `0.5919`.

**`accom_shared_hostel_dorm` and `accom_hostel_private_room` must not both be derived from this channel.**
Separating them needs occupancy-controlled search (browser) or a unit-labelling channel such as
Hostelworld. The incumbent hostel values are **unverified rather than refuted** — both are pass-throughs
of recalled anchors, not asserted multipliers, and the observed blended 0.592 sits between them, which is
what a dorm/private blend should do.

**An untested candidate, deliberately not adopted.** The class page carries both the headline and the
property list, so their geometric mean costs nothing extra. Against Copenhagen it landed **+3.9% and
+14.2%** where the individual bases were +54% and −15/−30%. Recorded but **not adopted** — one city is
exactly the evidence base that produced an earlier wrong reversal.

**Why more ground truth is hard.** An attempt to collect direct quotes for Prague, Hanoi and Lisbon
returned **zero usable quotes from 11 Lisbon attempts**: 4 domains did not resolve, 2 returned 403, plus
empty JS responses, SSL failures, connection refused, 404, and one site showing no price without its
booking engine. **A plain page fetch cannot obtain a dated quote from a hotel's own site.** This needs
browser automation or manual collection — not a prompt or budget problem.

### Contract-design traps found the hard way

Each cost real time to discover and generalises beyond this project:

- **A model's stated reason for a failure is a hypothesis, not evidence.** Runs reported Booking.com as
  "blocking automated access" while other runs read it fine, and reported `no_page` on a source returning
  HTTP 429. Both were believed for a revision or two. Verification was usually one command.
- **Most "model unreliability" was contract defects.** A single-currency rule made the model discard
  usable prices; a dated-search preference asked for something the tool class cannot do; a ratio envelope
  derived from the dataset being *replaced* rejected correct observations for four cities. In each case
  the model obeyed correctly and the instruction was wrong.
- **Do not ask a model to grade its own work.** `overallConfidence` and `ladderStep` were wrong in every
  run, always flatteringly, even when spelled out as arithmetic. Both removed, now derived server-side.
- **A contract that fights the shape of its sources will lose.** A single-basis rule across accommodation
  achieved **3/11 compliance, and all three were accidents**. Hostel pages publish property lists; hotel
  pages publish averages. The rule now matches that rather than overriding it.
- **Check the underlying record, not your own summary.** A basis ranking was built on a "5.8% from ground
  truth" figure that turned out to be a travel blog's "from" price.

### Known limitations carried forward

1. Accuracy is **18–22% median, not the 15% targeted**, and rose as the sample expanded (n=58 figures
   were optimistic, not better). Recommendation: publish a **≤25%** gate and state achieved figures.
2. The sample frame is **closed**; the low band is its thinnest part and cannot be improved.
3. **The fitted relationships are proxies.** All four were fitted on measures the sample carries, not on
   the four measures actually shipped as modelled. They settle model *form*, not coefficient values.
   ~160 paired observations across 20 cities are still required.
4. Accommodation carries a **~50% upward bias on hotel classes** established in **one city**.
5. Activity tiers have no derivation path.
6. Band assignment for new cities agrees with the production band only **63%** of the time, though never
   by more than one band across 70 tested cities.
7. Rate limiting: ~40 rapid fetches trigger 429 escalating to 503, cleared only by changing IP. Batch
   builds need 10–15 cities/day with checkpointing. **On a rate-limited response, defer the city — never
   fall through to search.** That difference is exact values versus 10–19% error.

---

# Part 2 — Datasets and artifacts

All paths relative to repo root. **Everything under `data/reference/` is read by scripts — do not move.**

## Canonical production data

| Path | What it is | Size |
| --- | --- | --- |
| `data/reference/city_costs_app_aud.csv` | **The live dataset.** 121 cities, 58 countries, AUD for 2 people. Seeded by `src/db/seed.ts`. Tagged `base_csv_apr_2026` | 121 rows |
| `data/travel.db` | SQLite runtime DB (gitignored) | — |
| `src/lib/data/country-metadata.generated.json` | Canonical country metadata, generated | — |
| `src/lib/data/curated-models.generated.json` | LLM model snapshot, tier-3 discovery fallback | — |

## v4 evidence (`data/reference/dry-run/`)

The active methodology's evidence base.

| Path | What it is |
| --- | --- |
| `phase-0a-numbeo-anchors.json` | Anchors for 5 dry-run cities with per-city quality metadata |
| `phase-0b-accommodation-search.json` | Accommodation reconnaissance, 5 cities, all tiers |
| `phase-0c-ratio-model-fit.json` | **Fitted models and validation results** — the output of `fit-city-cost-ratios.mjs` |
| `phase-0d-numbeo-expanded-sample.json` | Anchors for 22 further cities across 9 regions |
| `phase-0e-stage1-numbeo-sample.json` | Stage 1: 27 cities, plus 4 rejections and 5 no-source outcomes |
| `phase-0e-stage1-selection.json` | The deterministic band-stratified draw rule, 32 cities |
| `phase-0f-stage2-numbeo-sample.json` | Stage 2 census: 14 retained, 6 rejected, 7 no-source — **closes the frame** |
| `phase-0g-stage1-analysis.json` | First-page estimator depth/ratio/headline analysis |
| `phase-0h-accommodation-class-ratios.json` | **The fitted star ladder** — 1.297, 0.734, 0.592, with the incumbent 1.800 comparison |

### Accommodation raw captures (`data/reference/dry-run/stage1/`)

| Path | What it is |
| --- | --- |
| `copenhagen-booking-4star.json` | **108 four-star prices in page order** — the only full-inventory read in existence, and the basis for every first-page bias figure |
| `copenhagen-booking-3star.json` | 25 prices plus a repeat read, showing inter-read volatility |
| `stage-b-class-pages.json` | Class-page captures across 12 cities, the ladder-fitting input |
| `wave2-firstpage.json` | Second wave of first-page captures |
| `bangkok-firstpage.json` | Retained for the **class-inversion anomaly** — 4-star headline below 3-star |
| `lisbon-firstpage.json` | First-page capture |

## v3 evidence (retained — v4 runs on it)

| Path | What it is |
| --- | --- |
| `data/reference/observations/` | **176 accepted observations** across 32 cities, JSONL plus per-batch reports. Reused as v4 modelling data |
| `data/reference/observations/accommodation-copenhagen-shoulder-2026-07-24.jsonl` | **The only accommodation ground truth.** 5 direct 4-star quotes, median DKK 1,417.43, 90-day lead |
| `data/reference/city_cost_collection_batches.json` | Extraction-batch manifest — the join key for observations |
| `data/reference/fx/city_cost_fx_aud_2026-07-22.json` | **Frozen FX snapshot**, 23 currencies, source-attributed per rate |
| `data/reference/city_cost_collection_pilot.json` | The deterministic 36-city pilot selection |
| `data/reference/city_cost_pilot_enrichment.json` | Population + tourism-intensity predictors, schema v4 with strict/relaxed grading |
| `data/reference/city_cost_pilot_enrichment_inputs.json` | Hand-curated enrichment inputs |
| `data/reference/materialized/city_costs_v3_alpha.json` | v3 materialized output — 166/665 cells, fail-closed |
| `data/reference/materialized/city_cost_pilot_profile.json` | Coverage/missingness profile: 151/684 cells, zero complete cities |
| `data/reference/accuracy_audit.csv` | **The 9-observation audit** that triggered the rebuild |

## v3 accommodation panels (superseded, retained as provenance model)

The register-first path that produced five quotes in one city. Superseded by the Booking.com channel but
retained — it is the provenance model v4 quote records still follow.

| Path | What it is |
| --- | --- |
| `data/reference/accommodation_property_panels_2026_2027.json` | Five frozen frames (Barcelona, Copenhagen, Da Nang, Lisbon, Prague). **1.9 MB — the largest artifact** |
| `data/reference/accommodation_reference_windows_2026_2027.json` | 27 pre-registered 90-day low/shoulder/high windows across 9 cities |
| `data/reference/accommodation_quote_attempts/` | Append-only ledger: quotes, no-availability, and technical failures kept separate |
| `data/reference/accommodation_website_verifications/` | Barcelona 4-star website outcomes per rank |
| `data/reference/hanoi_accommodation_classification_reconciliation_2026.json` | 330 records pending status reconciliation — **never unblocked** |

## Not project data

| Path | What it is |
| --- | --- |
| `.local/data-0ace327c-…-batch-0000.zip` | **A Claude conversation export** (`conversations.json`, `users.json`), 562 KB. Was sitting untracked in `docs/product/`; moved to the gitignored `.local/` on 31 Jul 2026. Not project material — delete when convenient |

---

# Part 3 — Scripts

## v4 methodology (`npm run methodology:v4:*`)

| Command | Script | Purpose |
| --- | --- | --- |
| `:fit-ratios` | `fit-city-cost-ratios.mjs` | **Ratio model fitting and validation.** Fully deterministic — holdout is a fixed alphabetical rule. Verified 31 Jul 2026: re-running reproduces `phase-0c-ratio-model-fit.json` **byte-identically**, and with it every figure in methodology-v4.md §6–§7 |
| `:fit-accommodation-ladder` | `fit-accommodation-class-ratios.mjs` | Fits the star ladder and the incumbent-1.800 comparison |
| `:analyze-accommodation` | `analyze-accommodation-stage1.mjs` | First-page estimator depth, ratio and headline analysis |
| `:score-prompt` | `score-anchor-prompt-test.mjs` | Scores prompt output against ground truth. Needs `TEST_DIR` |
| `:combine-samples` | `combine-anchor-samples.mjs` | k-sample combination and coverage analysis. Needs `TEST_DIR` |
| `:score-accommodation-bias` | `score-accommodation-bias.mjs` | Headline-vs-direct-quote bias; **refuses to correct on under 3 cities** |

> The two accommodation scripts embed a `generatedAt` timestamp, so their artifacts differ by that one
> line on re-run while every computed value reproduces exactly. Verified 31 Jul 2026.

## v3 methodology (`npm run methodology:*`)

Retained for reproducibility of the v3 artifacts. See `package.json` for the full alias list —
`:audit`, `:pilot`, `:pilot:enrich`, `:pilot:profile`, `:research`, `:batches:validate`,
`:observations:validate`, `:materialize:v3`, and the `:accommodation-*` panel builders and validators.

## App tooling

| Command | Purpose |
| --- | --- |
| `npm run docs:sync-memory` / `:check-memory` | Mirror and verify `AGENTS.md` against `CLAUDE.md` |
| `npm run country-metadata:generate` | Regenerate canonical country metadata |
| `npm run models:refresh` / `:check` | Refresh the curated LLM model snapshot |
| `npm run db:seed` / `db:push` | Seed from CSV / push schema |

---

# Part 4 — Shipped feature history

## Phase 1 — Core foundations
Next.js scaffold, auth, layout shell, schema, DB setup. Itinerary builder with tiered budgeting and live
totals. Fixed-cost management. Base dashboard navigation and summaries.

## Phase 2 — Expense tracking
Expense CRUD, quick-add, tagging. Wise CSV import with preview/confirm, supporting both
transaction-history and balance-statement export formats. Second-pass AUD conversion for merged non-AUD
rows. Verified against three real export files.

## Phase 3 — Dashboard and comparison
Summary cards, planned-vs-actual country comparison, category charts, cumulative spend/burn views.

## Phase 4 — Deploy / export / provider plumbing
Docker and nginx artifacts, export endpoints, LLM provider plumbing.

## Phase 5 — City cost system migration
Replaced the old seed dataset with the 121-row CSV. Added `country-metadata.ts` and CSV-backed seed
mapping. **Removed transport estimation from the city methodology** — it is now a separate intercity
feature with its own prompt, provider adapters and planner UI. Split `/estimates` (methodology) from
`/dataset` (the editable library). Added server-side city generation with user-supplied provider keys.

## Phase 6 — Observed-first methodology
See [Part 1 — v3](#v3--observed-first-abandoned-2527-july-2026). Abandoned 25–27 July 2026.

## Auth and accounts
Native email/password accounts **alongside** Google OAuth, using dedicated `user_passwords`,
`auth_tokens` and `auth_rate_limits` tables with `argon2id` hashing. Public flows for signup,
check-email, verify-email, forgot-password, reset-password, resend-verification. Resend-backed delivery
with a dev fallback logging links to console. **Google and email/password accounts are not auto-linked
on matching email** — the login page shows provider-specific guidance instead. Account management at
`/settings/account`. `ensureUserRow` no longer upserts on every sign-in, which had been clobbering
user-edited display names.

## Saved plans and comparison
Moved saved plans from browser `localStorage` into a user-owned `saved_plans` table. CRUD at
`/api/saved-plans`, comparison at `POST /api/saved-plans/compare`. `/plan/compare` is a first-class page
with its own sidebar entry.

**One canonical allocation engine** backs summary totals, cumulative series, and country/category
groupings, so all four reconcile by construction. This fixed a real bug: `nights`-based totals versus
inclusive date enumeration caused chart overcounting when explicit date spans exceeded `nights`.

Compare-page analytics: responsive summary rail for 2–5 plans, planned-by-country chart with `Totals` and
`Per Day` modes (defaulting to `Per Day`, ranked by max daily spend), planned-by-category grouped
horizontal bars that stay aligned between inline and expanded states, and a centralized palette in
`src/lib/comparison-colors.ts` fixed to blue → purple → teal → yellow → green.

## Planner refinements
Repeatable per-leg intercity transport replacing the single always-open field. LLM-backed transport
estimation per leg plus a bulk `Estimate Missing Transport` flow. Traveller count persisted in
`user_preferences.planner_group_size`; city base costs stay stored for 2 and are scaled at runtime.
Legacy `splitPct` removed entirely. Info popovers render through a portal with measured viewport
clamping so tall cards are not cut off at the page bottom. New-city typing lag fixed by moving dialog
state out of the page root.

## Dashboard refinements
Simplified from 14 summary cards to 11 — removed `Required Daily Pace`, `Planned Legs`, `Fixed Costs`,
`Planned Avg So Far`; added `Planned $/day`. Actual-spend handling tightened so missing AUD conversions
do not pollute totals. Spend views constrained to the trip window. Burn-chart country labels moved into a
measured header strip above the plot so wrapped names cannot collide with spend lines; the old 30%
y-axis buffer removed.

## LLM provider plumbing
Three providers (OpenAI, Anthropic, Gemini). Shared config in `src/lib/city-generation-config.ts`.
**Three-tier model discovery**: live provider API → no-key aggregator (OpenRouter, then models.dev) →
generated curated snapshot. Aggregator fetches read the body as text, inspect content-type, and parse
inside a try/catch, so gateway HTML surfaces as a friendly warning rather than a raw parse error.
Provider-specific fixes: OpenAI switches `max_tokens`/`max_completion_tokens` by model family; Gemini
sets `thinkingBudget: 0` to reduce truncated JSON. API keys live only in browser `localStorage`, with
explicit clear controls.

## Cleanup passes
Removed `/settings/cities`, the saved-plan localStorage shim, the legacy `/api/cities/estimate` route,
the hybrid/Xotelo library, inactive anchor-input components, `seed-data/cities.json`, stale `xotelo`
references, and the repo-managed nginx artifact. Reorganized docs into `docs/dev/plans`,
`docs/dev/handoffs`, `docs/ops`, `docs/product`, `docs/prompts`, and `data/reference`.

---

## Where documents live

Superseded material sits under `archive/` folders and carries a `> **SUPERSEDED**` / `**ABANDONED**` /
`**COMPLETE**` banner naming what replaced it. **If a document has no banner, it is current.**

### Current

| Path | Covers |
| --- | --- |
| `docs/product/methodology-v4.md` | **The active methodology.** §9.1 is the prompt's source of truth |
| `docs/dev/plans/accommodation-collection-v4.md` | v4 accommodation channel and class ladder — **conflicts with methodology-v4 §9.4.4, see PLAN.md D1** |
| `docs/dev/plans/city-cost-source-access.md` | Source-access rules, including the Booking.com reversal. Only the source rules are current; its v3 collection programme is not |
| `docs/dev/handoffs/city-cost-v4.md` | The most recent handoff |
| `data/reference/README.md` | **Full dataset inventory** — what is live, what is historical, and what reads each file |
| `scripts/README.md` | **Full script inventory**, split live versus v3 |
| `docs/prompts/README.md` | Prompt status. Banners must never be added inside prompt files — several are read verbatim and sent to a model |

### Archived

| Path | Covers |
| --- | --- |
| `docs/dev/archive/README.md` | Index of everything archived and why |
| `docs/dev/archive/plans/observed-first-methodology.md` | The full v3 programme design |
| `docs/dev/archive/plans/phase-6-rescope-2026-07-25.md` | Amendments A–F |
| `docs/dev/archive/PLAN-v4-early-draft.md` | Early v4 draft, superseded by `docs/product/methodology-v4.md`; its figures come from a 58-city sample since closed at 99 |
| `docs/product/archive/methodology-v2-v3.md` | v2.1/v3 public methodology — its text still matches the un-rewritten `/estimates` page |
| `docs/product/archive/estimates-page-v3-draft.md` | An `/estimates` draft that was never wired up |
| `docs/dev/archive/plans/`, `docs/dev/archive/handoffs/` | Completed app workstreams and their handoffs |
| `docs/dev/archive/PLAN-initial-spec.md` | The original project spec |
