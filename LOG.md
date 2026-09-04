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

---

## v6.1 retirement and v1.1 restart — 18 August 2026

The v6.1 research line was rejected for product cutover after its staged 121-city output and provider-heavy
collection process proved too large and operationally fragile for the original simple-refresh objective. The live
`data/reference/city_costs_app_aud.csv` and existing-city behavior remain v1; no holdout, staged CSV, bulk migration or
Phase 11 action is authorized. The complete v6.1 history is preserved on `feat/city-cost-methodology-v6` at
`city-cost-v6.1-research-final-2026-08-18`.

The replacement v1.1 workstream starts from `main`. It keeps all 19 planner tiers and the exact v1 formulas initially,
but asks the model for only the ten existing USD anchors in one schema-constrained call. Server-side code performs all
arithmetic and USD→AUD conversion from the checked-in FX snapshot, persists provenance, and supports an explicit v1
rollback. v1.1 applies to newly generated cities only; no benchmark, new collection panel, coefficient fitting or
existing-city migration is part of this restart. Progress is tracked in the root `PLAN.md`.

The clean branch foundation is pushed. The v1.1 anchor-only prompt, strict positive-anchor schema, deterministic
materializer, checked-in FX provenance and live-CSV write guard are implemented with golden tests. The generation
selector defaults to v1 until the persistence/API/UI integration and functional smoke pass; the retired v6 flag now
fails explicitly rather than activating v6.1.

The v1.1 integration phase is implemented and verified locally. v1 and v1.1 now use an explicit persistence adapter;
v1.1 rows use `llm_city_generation_v1_1` and retain the ten USD anchors, converted anchor values, formula/FX metadata,
request snapshot, model and reasoning effort. `/api/estimates` exposes a generic provenance object, `/dataset` shows
the methodology and anchor/FX details, and planner v1.1 creation uses the requested city plus canonical country data
without a separate metadata LLM call. The default remains v1 pending Phase 5 smoke and activation review.

The deterministic Phase 5 checkpoint is now complete on `feat/city-cost-methodology-v1-1`: formula and rounding
parity, one-call generation, no-partial-persistence behavior, explicit v1 rollback, historical v6 provenance parsing,
and the unchanged live CSV are covered by tests or `scripts/check-city-cost-v1-1.ts`. TypeScript, build, the full
Vitest suite (36 files / 160 tests), memory checks, and the v1.1 deterministic check pass. The three-city keyed
functional smoke (Tottori, Toowoomba, Brno) remains an owner-run operational check; v1 remains the default until it
passes. No existing city is automatically regenerated.

The current v1.1 handoff and loop are now `docs/dev/handoffs/city-cost-v1-1.md` and `LOOP-PROMPT-V1-1.md`; the old v4
handoff and source-access collection plan are explicitly superseded. The owner-key smoke remains pending. On 18 August
2026 Chrome was found with the Codex extension installed and enabled but without the required native-host registry
entry, so browser control could not reach the local app. No provider key was accessed and no smoke result was claimed.

The v1.1 contract audit also made the 19 persisted planner fields explicit: the 18 daily/accommodation derivations plus
the direct `drink_coffee` field, retained at cent precision. The materializer, deterministic check, and `/api/estimates`
now expose that field alongside the supporting direct drink anchors. This changes no v1 formula or live dataset value.

The documentation cleanup checkpoint also superseded the remaining v4/v5 collection-language ambiguity: retained
source-access and accommodation documents now open as historical evidence, and `data/reference/README.md` explicitly
separates historical inventory labels from the active v1.1 product plan. The Chrome bridge was retried after the owner
reinstalled the plugin, but the extension still has no Windows native-messaging registry entry, so the keyed smoke is
not yet run. No provider key was accessed, and the new-city default remains v1 pending that operational check.

The final local boundary audit found that v1.1's direct drink inputs were visible in the city/API data but absent from
the persisted source map. The v1.1 adapter now records the same source for local beer, imported beer, wine, cocktail,
and coffee while preserving the historical v1 map. Targeted generation/persistence tests, typecheck, and the
deterministic check pass; the keyed smoke remains the only unrun release step.

## OneDrive dev-server recovery guard — 18 August 2026

The resumed Chrome smoke exposed a local-environment failure rather than a product failure: `.next` had become a
OneDrive `ReparsePoint`, and a fresh Next dev process consumed roughly 1.2 GB of memory and hundreds of CPU seconds
without completing a request. The exact dev-server process was stopped and the generated `.next` directory was removed.
`scripts/prepare-next-dev.mjs` is now run by npm's `predev` lifecycle; it detects and removes only a reparse-point
`.next` cache before Next starts. The canonical instructions document the targeted recovery and a `.git`-excluding
OneDrive pinning command. No source, database, live CSV, browser storage, or provider key was changed.

## Browser-control diagnosis correction — 18 August 2026

The earlier native-host-missing observations above are retained as historical troubleshooting notes but are not the
current diagnosis. Chrome later connected successfully with plugin build `26.814.41407`, proving that extension or
registry repair is not the next action. A subsequent Codex in-app Browser retry failed earlier in its own trusted RPC
bootstrap, before browser or tab discovery; this is separate from the application and from the superseded Chrome
native-host diagnosis. The isolated v1.1 dev server on port 3001 still returned HTTP 200 for `/dataset`. No provider
key was accessed, no city generation was attempted, and the three-city smoke and v1.1 default activation remain open.

## Independent pre-activation verification during smoke deferral — 18 August 2026

The owner temporarily deferred the Tottori, Toowoomba, and Brno keyed smoke because secure remote-desktop access is
unavailable. This is a scheduling deferral, not a waiver: v1 remains the new-city default, no activation change was
made, and the smoke plus final post-activation baseline remain required.

Every independent release check was rerun from the canonical OneDrive repository path. `npx tsc --noEmit`, the
production build, 36 Vitest files / 160 tests, the documentation-memory check, and
`npm run methodology:v1.1:check` passed. The build emitted the existing handled `/api/export` dynamic-route
diagnostic and exited successfully. The deterministic check again reported 19 planner fields and live CSV SHA-256
`0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8`; the CSV still has 121 rows and Git blob
`63b13a8774c66999c5f99aade671ca357f65b949`.

The archived branch remains at `93d73d3845f3ccea17acafd069c14db2479f40a4` locally and on origin. The annotated tag
object `cfe5694dd02147ce4cceadce690ed429a318d1fd` remains local and remote and peels to
`335e61be7341bc791e1e7e5aa4be1645412e92d0`. The archived branch tip is not an ancestor of the product branch. The
only suspect v6 path in the product tree is the explicitly archived plan; executable references are limited to the
historical provenance parser and the retirement guard/tests. No provider key, city record, or live dataset changed.
## Owner-authorized v1.1 activation without smoke — 18 August 2026

The owner explicitly authorized the v1.1 new-city default while deferring the Tottori, Toowoomba, and Brno keyed
operational smoke because secure remote-desktop access is unavailable. This is a documented exception, not a smoke
result or accuracy claim. No provider key was accessed, no smoke city was generated, and no existing city was migrated.

The selector fallback is now v1.1. Explicit `CITY_COST_METHODOLOGY_VERSION=v1` remains operational and is covered by a
new regression; `CITY_COST_METHODOLOGY_V6=true` remains fail-closed. The v1.1 anchor-only contract, deterministic
formulas, 19 planner fields, checked-in FX, persistence/API/UI provenance, and live-CSV write guard are unchanged.

The complete post-activation baseline passed: TypeScript, production build, 36 Vitest files / 161 tests,
documentation-memory check, and `npm run methodology:v1.1:check`. The build emitted the existing handled
`/api/export` dynamic-route diagnostic and exited successfully. The deterministic check reported the unchanged
19-field boundary and live CSV SHA-256 `0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8`.

## Phase 7A performance-hardening checkpoint — 21 August 2026

The first authenticated browser pass exposed a runtime/payload failure rather than a methodology failure: `/dataset`
stayed on its loading state during a 10-second navigation window, and the port-owning dev process reached approximately
1.65 GB while the core routes were exercised. This was the release-blocking observation that started Phase 7A; it was
not treated as evidence against the v1.1 cost method.

The checkpoint bounded the planner and dataset/history initial DOM work. `/plan` now renders at most 12 leg cards before
an explicit reveal, while totals still use the complete plan. `/dataset` renders at most 25 city rows and 20 history rows
per page while retaining client-side search, editing, history, and provenance behavior. Planner and dataset-facing API
views omit fields not needed by their consumers. Regression coverage now exercises the country/city/estimate view shapes,
the page bounds, startup failure messaging, route readiness, and shell response budgets.

The first standalone production attempt opened port 3000 but returned HTTP 500 for every route. Its logs showed that a
direct standalone child did not load `.env.local`, causing the NextAuth secret warning, and that standalone tracing had
omitted the Windows `argon2` native prebuild. The startup wrapper now loads Next environment configuration; the build
explicitly traces argon2 prebuilds; and password code lazy-loads argon2 so unauthenticated cold routes do not pay the
native-module load cost. The focused auth/API/performance tests passed, and the final production build passed with the
existing handled `/api/export` dynamic-route diagnostic.

The final controlled production run used `npm start` with PID `43316` owning port 3000. Cold route readiness was `/`
2.714s, `/plan` 27.5ms, `/plan/compare` 52.3ms, `/track` 32.7ms, `/dataset` 56.7ms, `/estimates` 54.2ms, and
`/settings` 44.5ms. Warm readiness ranged from 55.8ms to 325.1ms; every route returned HTTP 200. The route-shell
performance check passed with 27–106ms responses and 26,826–26,852 bytes per shell. RSS was 59.6 MiB initially and
87.6 MiB after the route/performance pass, below the 512 MiB local budget. PID `43316` was stopped immediately after
testing; no app server remains running.

The complete post-hardening baseline then passed: TypeScript, the production build, 37 Vitest files / 171 tests, the
documentation memory check, and `npm run methodology:v1.1:check`.

The clean production baseline observed earlier was approximately 74 MB. The app-off system control closed port 3000 and
left no app-owned Node server; total CPU stayed around 6–8%, disk was near idle, and roughly 16.7 GB RAM remained
available. Separately, this exceptionally long resumed Codex/Windows Terminal session showed intermittent rendering
bursts while the app was off; restarting Chrome helped substantially but did not remove all lag. That is recorded as an
interactive-session observation, not attributed to Next.js or the browser application.

The current Chrome session reached the local app's login screen without an authenticated session. A temporary Playwright
development auth setup also failed to establish its local session, so the authenticated API timing and Chrome console/UI
render-bound pass remain open. No browser storage, provider key, owner-key city generation, live CSV, holdout, or v6/v6.1
path was accessed.

## Documentation and state verification checkpoint - 25 August 2026

A read-only state review found `main` and `origin/main` synchronized at `40f3c65`. The v1.1 baseline was rerun from
the current working tree: TypeScript, the production build, 37 Vitest files / 171 tests, the documentation memory
check, and `npm run methodology:v1.1:check` all passed. The build emitted the existing handled `/api/export`
dynamic-route diagnostic and exited successfully. The deterministic check confirmed 19 planner fields, 121 live CSV
rows across 58 countries, and live CSV SHA-256 `0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8`.

`npm run performance:check` passed when run against a temporary `npm start`; all seven route shells returned HTTP 200.
The temporary server was stopped afterward and port 3000 is closed. No authenticated Chrome route/console pass or
owner-key generation smoke was run, so those remain open.

The tracked product branch remains free of the retired v5/v6 experiment corpus. The three exact duplicate files under
`data/reference/v5/experiments/045-trip-activity-definitions/` were verified against the archived tag and moved to a
named quarantine outside the repository; no v5 files remain untracked in the working tree. No source, dataset, database,
browser-storage, or provider-key data was changed by this verification or cleanup.

## Authenticated performance continuation - 25 August 2026

The fresh CLI inherited the required Chrome trusted-code paths, but the Windows sandbox helper still failed because the
repository tree was owned by `Administrators`. After explicit owner approval, the repository root and descendants were
changed to the current Windows user. Normal sandboxed commands and Chrome control then started successfully. No file
content changed as part of that permission repair, and browser storage, cookie values, passwords, and provider keys were
not inspected.

The authenticated Chrome pass exposed a concrete standalone defect: route HTML returned HTTP 200 while required Next.js
client chunks returned HTTP 404, leaving `/plan` on its loading shell. The local production launcher now stages
`.next/static` and `public` beside the standalone server and records the staged build ID so unchanged assets are not
copied again. The route-shell performance checker now fetches every referenced static asset and fails on a missing or
non-200 asset. Focused regressions cover staging and the missing-asset failure.

The same pass found repeated expense-to-leg resolution across all three dashboard endpoints. A request-scoped resolver
now derives the itinerary once, indexes explicit leg IDs, and caches date matches. Fully warm authenticated dashboard API
durations fell to `1.12–1.65s`; the earlier warm range was approximately `6–21s`. Fresh-server dashboard requests still
took `6.42–7.12s`, so cold initialization remains explicit follow-up work rather than being reported as solved.

`/track` previously mounted all 973 expense rows. It now pages at 50 expenses while full filtered data continues to drive
the displayed count, AUD total, delete-all target set, and bulk-selection behavior. The final authenticated bounds were
12 of 67 planner legs, 25 city rows, 20 history rows, and 50 of 973 expenses. Dataset APIs completed in `1.47s` and
`2.21s`; settings requests in `88–131ms`; the saved-plan list in `74ms`. Fresh-server track APIs still took about `10.4s`
and remain part of the cold-readiness follow-up.

The final route-shell/static check passed all seven routes at `97–3697ms`, `26,826–26,852` bytes, and 12 referenced
static assets. Steady server RSS was `103.8 MiB`, below the `512 MiB` budget, and the exact test server was stopped.
Chrome rendered all seven routes without an application request failure. Intermittent Chrome-extension message-channel
errors appeared during some navigations without a corresponding app exception and are recorded separately as extension
noise.

The complete checkpoint baseline passed: `npx tsc --noEmit`, `npm run build`, 38 Vitest files / 175 tests,
`npm run docs:check-memory`, and `npm run methodology:v1.1:check`. The build emitted the existing handled `/api/export`
dynamic-route diagnostic and exited successfully. The deterministic methodology check again reported 19 planner fields
and live CSV SHA-256 `0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8`.

## Phase 7A cold-readiness completion - 25 August 2026

A repeat after the repository ownership and OneDrive pinning repair showed that the prior 6–10 second authenticated
cold timings were not the stable final runtime. Fresh standalone restarts followed by authenticated Chrome navigation
put complete dashboard data readiness at 1.96 seconds and track data readiness at 4.03 seconds. Both are within the
documented 5-second local budget; the earlier measurements remain retained as pre-repair evidence.

The remaining concrete payload issue was `/track`: it transferred a 456,140-byte full joined array of 973 expenses to
render 50 rows, plus a 45,078-byte full planner itinerary. The expense endpoint now exposes an explicit track view that
returns one 50-row joined page together with the exact full-filter count, included AUD total, and complete expense-ID set
for delete-all. A lightweight itinerary track view returns only assignment labels and derived dates. The process-cold
responses transferred 29,391 bytes and 7,350 bytes respectively, reductions of 93.6% and 83.7% without weakening auth
or changing complete-data totals.

Chrome verified page 2 as rows 51–100 of 973, filter changes resetting to page 1, and the empty Manual filter reporting
exactly 0 expenses and AUD 0. Focused tests cover full-set totals/IDs across page slicing. The complete baseline passed:
TypeScript, production build, 39 Vitest files / 177 tests, memory mirror check, and deterministic v1.1 verification. The
build retained the known handled `/api/export` dynamic-route diagnostic. The production server was stopped afterward;
no browser storage, cookies, passwords, or provider keys were inspected.
## Luna/max and generation-time FX owner-key smoke — 26 August 2026

The OpenAI default was updated to `gpt-5.6-luna` with `max` reasoning, and model refresh now resets both the discovered
model list and the configured model/reasoning defaults. The OpenAI transport moved to the Responses API because Luna
accepts `reasoning.effort: "max"` there; a regression covers the nested request shape and one-call boundary.

The first production attempt also exposed that the standalone bundle omitted the v1.1 prompt. The production launcher
and output trace now stage both active city-generation prompts, including when the build ID is unchanged, with a
regression for the missing-file case.

The owner rejected the stale 22 July runtime FX snapshot. v1.1 now uses the same city-generation call to perform one
web search and return the latest dated RBA USD/AUD observation alongside the ten holistic USD anchors. The server
accepts only a recent official `rba.gov.au` observation, derives AUD-per-USD (including quote inversion), applies every
tier formula deterministically, and fails before persistence for missing, stale, invalid, or non-RBA FX. The checked-in
snapshot remains historical reproducibility evidence, not a runtime fallback. OpenAI rejected Web Search combined with
legacy JSON mode, so web-enabled calls rely on the prompt plus strict server Zod validation; non-search JSON calls keep
JSON mode.

The Chrome owner-key smoke passed for Tottori, Toowoomba, and Brno. All three active rows are
`llm_city_generation_v1_1`, OpenAI `gpt-5.6-luna`, reasoning `max`, formula `v1-formulas-preserved-v1.1`, and use RBA FX
dated 25 August 2026 at approximately 1 USD = 1.40 AUD. Tottori's prior v6.1 estimate remained as history; Toowoomba and
Brno were added through the new-city flow. Failed preflight/provider attempts wrote no row. The provider key remained
browser-only and was not inspected, logged, copied, or persisted by Codex.

The authenticated `/api/estimates` cross-check reported 10 anchors and all 19 planner fields for each city, with exact
agreement on provider/model, reasoning, prompt, formula, methodology, source, FX rate/date/source, and history count.
The final baseline passed TypeScript, the production build, 40 Vitest files / 180 tests, the memory mirror, and the
deterministic v1.1 check. The live CSV hash remained
`0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8`.

## Planner and model-picker usability — 26 August 2026

The Add Itinerary Leg flow now uses a dark high-contrast treatment for keyboard-highlighted and selected cities. Its
footer groups explicit Cancel, Add City, and Add Leg actions, and successful existing-city or generated-city leg
creation expands the planner to show every leg immediately. Model suggestions in both the planner and dataset city
generation surfaces now use a two-column grid, reducing dialog height while retaining readable wrapped model names.

Focused Playwright coverage verified the dialog actions and exact selected-city background. Provider-specific mocked
model discovery verified Anthropic and Google Gemini model selection, two models sharing each row, and Refresh Models
resetting the chosen model to each provider's returned default. No provider key was read and no provider request was
made by these tests. The Playwright harness was also corrected to isolate its numeric development PIN from
`APP_SECRET`, keep NextAuth and the browser on one hostname, explicitly pass the authentication environment to its
dev server, and wait for the credentials response before navigating.

The checkpoint baseline passed: TypeScript, production build, 41 Vitest files / 184 tests, documentation memory
check, and deterministic v1.1 verification. The build retained the known handled `/api/export` dynamic-route
diagnostic. The focused browser runs passed the city-picker regression and the Anthropic/Google refresh regression.

## Model-grid density and dashboard chart key — 26 August 2026

Provider model suggestions now use four columns on desktop (with a two-column narrow-screen fallback) in both the
dataset and planner city-generation surfaces. The Refresh Models action spans the full grid row. The dashboard's
cumulative-spend legend and tooltip now define every data series: solid green actual spend, solid grey actual spend
recorded against a leg still marked planned, dashed green planned estimate, and dashed purple total trip budget. The
grey dashed background strokes remain Cartesian grid guides rather than a spend series.

Focused Playwright coverage passed the four-column Anthropic/Google Gemini model-refresh flow and a deterministic
dashboard render that checks the legend labels and dashed swatches. TypeScript, the production build, and the full
Vitest suite (41 files / 185 tests) also passed; the build retained the known handled `/api/export` dynamic-route
diagnostic. No provider key was read or used.

## Intercity transport model picker alignment - 26 August 2026

Single-leg and bulk intercity transport estimation now use the discovered provider model list (up to 16 suggestions)
instead of only the static known-model list. Both pickers show four models per desktop row with a two-column narrow
fallback, wrap long model IDs, and make Refresh Models reset the selected model to the provider default. Validation
now uses the discovered effective model set, so live provider-account models can be selected without a false warning.

The transport browser regression passed for both single-leg and bulk dialogs with Anthropic and Google Gemini fixtures,
including four-column geometry and default reset after refresh. TypeScript, the production build, and the full Vitest
suite (41 files / 186 tests) passed; the build retained the known handled /api/export dynamic-route diagnostic.

## Multi-file transaction import and transport effort controls - 26 August 2026

The Wise transaction importer now accepts one or more selected CSV files. The browser posts each file as a repeated
multipart `file` field, and the server parses each export independently before flattening the rows into the existing
normalization, AUD conversion, preview, and database-deduplication path. Independent parsing avoids treating later
CSV headers as transaction rows while retaining the existing single-file behavior.

The import screen now reports the selected file count and handles malformed or HTML API responses as an in-page error,
so a failed confirmation cannot surface the raw `JSON.parse` runtime exception. Focused parser, response, UI, and
Playwright coverage verifies two-file preview/confirmation submission and safe handling of invalid responses.

Single-leg and bulk intercity transport dialogs now expose the same provider/model-specific thinking-effort selector as
new-city generation. The selected effort is persisted per transport dialog, reset with Refresh Models, validated by the
transport route, and passed through OpenAI reasoning, Anthropic thinking, and Gemini thinking-budget request fields.
The model chooser occupies the full dialog width in both transport dialogs and in both new-city surfaces, so four
suggestions use the available row instead of half the panel.

## Concurrent bulk transport estimates - 26 August 2026

Bulk intercity transport estimation now fans out selected destination legs through a provider-aware concurrency limit
(OpenAI 4; Anthropic and Gemini 2) instead of awaiting each request with a fixed delay. Results are still ordered by
the selected itinerary legs while each successful or failed response remains attached to its own city. The existing
single-leg estimate and bulk apply paths are unchanged.

Focused Vitest coverage passed for the scheduler limits, completion-order updates, and bulk-dialog integration.

## Opt-in browser API-key saving - 26 August 2026

All OpenAI, Anthropic, and Gemini API-key inputs now share an opt-in browser-storage hook. Keys remain in memory for
the current session by default; checking “Save API key in this browser” persists them per provider and unchecking it
removes the persisted values. Legacy non-empty key storage is surfaced as an already-enabled preference so an existing
user choice is not silently lost, while an explicit opt-out never restores a stored key. No key is written to the
repository, server database, or logs.

Focused storage, UI-source, transport, and city-generation tests passed, together with TypeScript validation.

## Country-block comparison and effort layout - 26 August 2026

The dashboard Country Comparison response now follows the itinerary's uninterrupted country blocks. Consecutive legs
in one country share a row, while a later return receives a new row at its chronological position. Planned category
totals and resolved actual expenses stay attached to the same block; unmatched actual expenses remain in appended
country/unassigned rows. A stable block index makes repeated country labels safe in the table.

The city-generation and single/bulk transport dialogs now place model and provider-specific reasoning effort controls
side by side at desktop widths, stack them on narrow screens, and keep the four-column suggestion grid full width.
Focused block, UI-layout, provider request, and TypeScript checks passed.

## Transport accuracy smoke harness - 26 August 2026

Added `buildTransportAccuracyReport`, a repeatable directional comparison helper for fixed transport observations and
same-assumption reference quotes. It retains route/provider/model/search/fallback/citation provenance, computes per-
route absolute and relative error, median and range summaries, and flags missing modes or routes outside the chosen
tolerance. Deterministic tests cover domestic/international-style error cases and fallback provenance.
The mocked pipeline smoke exercises four route classes (short/long and domestic/international) through the OpenAI
adapter and carries every returned option, assumption, search query, and citation into the report.

The live smoke remains intentionally open until same-day operator or aggregator quotes are captured; the repository
does not invent observed fares or present the deterministic fixtures as accuracy evidence.

## Transport estimation documentation - 26 August 2026

Added `docs/product/transport-estimation.md` as the durable explanation of the intercity estimator: route context,
frozen prompt, OpenAI/Anthropic/Gemini grounding and strict fallback paths, schema validation and normalization,
review/apply behavior, and the one-time destination-leg allocation rule. The focused verification run passed 7 tests.
The four-route inputs remain synthetic contract fixtures; same-day independent quote capture is still required before
making an accuracy or tolerance claim.

## Live transport smoke and OpenAI web-search fix - 26 August 2026

The first authenticated Ho Chi Minh City → Can Tho planner smoke exposed an OpenAI Responses API incompatibility:
`text.format.type=json_object` cannot be combined with the web-search tool. The request correctly fell back, but did
not use web grounding. The browse request now relies on the prompt plus the existing parser/Zod validation and leaves
JSON mode to the strict fallback path; a regression assertion protects that request shape.

The rerun with OpenAI `gpt-5.6-luna` at Maximum effort used web search and returned two review-only options for two
travellers: standard coach A$24 and self-drive A$30. The UI showed Vexere and VietnamPlus citations, and neither option
was applied. A directional redBus comparison (Phuong Trang 185,000 VND per adult; 370,000 VND for two; A$19.76 at
18,722.73 VND/AUD) puts the coach option at A$4.24 absolute / 21.4% relative error, within a provisional 25%
tolerance. This is one route only, with a historical itinerary date, so the four-route same-day calibration remains
open.

Focused provider and accuracy tests passed 7/7; the full Vitest suite then passed 49 files / 214 tests. `npx tsc
--noEmit --incremental false` passed and `npm run build` completed successfully; the build emitted only the existing
handled dynamic-server diagnostic for `/api/export`.

## Webapp performance attribution and build-directory separation - 3 September 2026

The owner reported the app as extremely slow. The recorded Phase 7A evidence turned out to be invalid:
`scripts/check-webapp-performance.mjs:34` fetches every route with `redirect: 'follow'` and no session cookie, and
`src/middleware.ts` wraps all of them in `withAuth`, so each route 307s to `/login?callbackUrl=...` and the script
measured the login page seven times. The 26-byte spread across seven supposedly distinct page sizes is the length
delta of the `callbackUrl` value. Those numbers are retained as dated history and superseded, not deleted.

An authenticated baseline as `dev-local-user`, who owns all 1,300 expenses, 62 legs and 62 saved plans, measured
14.04 MB of JavaScript for `/` in development against 263 kB of production first-load JavaScript, a 53x difference,
with `/plan`, `/dataset` and `/track` at 57x, 62x and 63x. Route documents are ~28-30 KB empty shells; `/estimates`,
the only server-rendered page, ships 174 KB of real content. Warm API latency is 13-82 ms, so server compute is not a
bottleneck at current data volumes. `/api/countries` returns 166,194 bytes where `?includeCities=false` returns 5,508,
and `/settings` requests the larger form to populate one dropdown.

The reported ~7-second dashboard stall was reproduced deterministically by polling readiness over TCP so that no HTTP
request could warm a module: the first `/api/dashboard/summary` took 7,225 ms and the second 72 ms. Temporary
instrumentation attributed it precisely. `new Database()` costs 5.5 ms and the entire module-scope migration block in
`src/db/index.ts` costs 4.8 ms. Independent probing confirmed SQLite is not involved: opening the database 3.9 ms,
pragmas 1.6 ms, first query 0.1 ms, counting 1,300 expenses 0.1 ms. Webpack compilation accounted for 880 ms, leaving
roughly 6.3 seconds of Node instantiating the route's 925-module graph.

The planned remedy of gating that migration block behind `PRAGMA user_version` was therefore abandoned: it would
recover about five milliseconds. The dev-versus-production A/B on an identical cold request to `/login`, which is
`force-dynamic` and exercises the same auth and database graph without a session, gave 7.404 s in development against
2.659 s in production. The stall is inherent to development mode and is resolved by running a production build, not by
changing application code.

Two intermediate figures were measurement artifacts and are recorded so they are not reused: a 1,734 ms "module load"
was `tsx` compiling TypeScript rather than runtime cost, and an 830 ms "cold" dashboard reading came from a readiness
probe against `/login`, which imports auth and the database and so warmed the very thing being measured. Both are the
same error class as the original Phase 7A defect.

Development and production now build into separate directories. They previously shared `.next`, so each wiped the
other and forced a full cold recompile; a production build run against a live dev server surfaced in the browser as
`ChunkLoadError: Loading chunk app/layout failed (timeout)`, which presents as a broken app rather than a slow one
because a failed chunk load takes down the whole React tree. Development now uses `.next-dev` and production keeps
`.next`, with `scripts/prepare-next-dev.mjs`, `.gitignore` and the Next-managed `tsconfig.json` include paths
following. Verified that a cold dev start leaves `.next` untouched, that a production build run against a live dev
server preserves both trees, and that an authenticated walk of all seven core routes returns HTTP 200.

`NEXTAUTH_URL` was missing from `.env.local`, which explains the repeated `[next-auth][warn][NEXTAUTH_URL]`. A
`wal_checkpoint(TRUNCATE)` reclaimed `data/travel.db-wal` from 4.1 MB to 0 bytes; this is hygiene, not a speedup.
The repository is at `C:\Dev\holiday-spend` and is not inside OneDrive, so that section of the memory documents is
obsolete; an orphaned pre-move copy remains at `C:\Users\chawi\OneDrive\projects\holiday-spend`.

Duplicate requests visible in the development log are React StrictMode's intentional dev-only double-invoke.
`src/app/page.tsx:630` is a single `useEffect` with `[]` dependencies wrapping one `Promise.all`; this is not a defect
and must not be "fixed".

Baseline: TypeScript, production build, 49 Vitest files / 214 tests, memory mirror and the deterministic v1.1 check
all pass, with the live CSV hash unchanged.

## Production run mode enabled and verified - 3 September 2026

The app can now be run from a production build with the existing data. Under explicit owner authorization, a short
local development credential was set directly for `dev-local-user` and the address was marked verified. This
deliberately bypassed `validatePasswordStrength`, which requires at least ten characters and rejects all-digit values,
and used a throwaway script deleted immediately afterwards. The credential exists only in the gitignored, untracked
`data/travel.db`; no value was written to any tracked file. The committed `npm run auth:set-local-password` keeps the
strict policy and interactive prompt for normal use.

Signed in against `npm start`, all seven core routes returned HTTP 200: `/` 1.603 s at 27,311 bytes (first request,
including warm-up), `/plan` 0.569 s, `/plan/compare` 0.274 s, `/track` 0.265 s, `/dataset` 0.265 s, `/estimates`
0.271 s at 167,096 bytes, and `/settings` 0.239 s. Authenticated API latency was 0.218-0.263 s across the three
dashboard endpoints, `/api/itinerary` and the paginated `/api/expenses`. Against development this replaces a
7.4-second cold start and 14.04 MB of JavaScript for `/` with a 1.6-second first request and 263 kB.

Two diagnostic notes worth keeping. Earlier production sign-in attempts returned `CredentialsSignin` and created no
rate-limit row; a clean rebuild resolved it, so the cause was a stale standalone bundle rather than the credential,
which verified correctly against the stored hash throughout. Separately, `emailPasswordEnabled` was wrongly suspected
first. The login page renders `hasEmailPassword` from that same flag and was already rendering email and password
fields in production, which disproved the hypothesis before instrumentation confirmed the flag was true. Checking what
the page already showed would have been faster than reasoning about which branch returned null.

All instrumentation was reverted and the reported numbers come from a clean, uninstrumented build. Baseline:
TypeScript, production build, 49 Vitest files / 214 tests, and the memory mirror all pass.

## Dataset and settings payload reductions - 3 September 2026

`/settings` and `/track/add` were requesting the full nested country payload to read scalar fields: `/settings` needs
only country id and name for a dropdown, and `/track/add` only a currency code. Both now pass `?includeCities=false`,
which `/plan` already used, cutting each from **166,194 to 5,508 bytes**.

`/api/estimates?view=dataset` was assembling 203 full city rows, attaching the entire history array to each, sorting
them, and then discarding all of it to return two fields per row. The lightweight shape is now built directly, and the
summary derives from the query rows so both views agree.

The larger finding was that heavy provenance blobs accounted for **91%** of that response: 201,528 bytes across 203
`rows` plus 194,137 bytes across 59 `history` rows, against only 38,211 bytes of actual history fields. The dataset
page renders those blobs for one selected city at a time - the table never touches them, and history rows use just
`methodologyVersion` and `reasoningEffort`. Anchors, input snapshots, sources, FX, evidence grades, intervals,
collection telemetry and missingness are therefore omitted from list responses and served by a new `?cityId=` mode,
which the page fetches when a city is selected (about 25 KB). `toListProvenance` names the retained scalar fields
explicitly rather than deleting the heavy ones, so a future blob field cannot silently start shipping in the list.

`/api/countries` now groups cities with a `Map` instead of filtering all cities once per country. Navigation in
`DesktopSidebar` and `MobileNav` moved from `router.push` to `next/link`, restoring the viewport prefetching that
`router.push` disabled for every nav item; the pending-state spinner is preserved.

Measured on a production build, authenticated: `/api/estimates?view=dataset` fell from 434,234 to **132,011 bytes**,
and the `/dataset` initial JSON total from 600,428 to **298,205 bytes**, a 50.3% reduction.

The plan's sub-100 KB target for `/dataset` was not met and is not reachable this way. The remaining 166,194 bytes are
`/api/countries`, which supplies the dataset table itself; the page filters and sorts every row client-side, so further
reduction needs server-side search rather than a payload change. This is recorded rather than quietly dropped.

One process note. An intermediate build was reported as passing because the command piped `npm run build` through a
`grep` filter that matched "Compiled successfully" while hiding a subsequent ESLint failure, and the next `npm start`
then correctly refused to run with no complete build. The lint rule rejected the destructure-to-discard idiom, which
was replaced with an explicit field list - a better result anyway. Filtering build output can hide the failure it is
meant to summarise; this is the same error class as the Phase 7A harness measuring redirects.

Verification: 49 Vitest files / 217 tests pass, including three new route tests for the slim list shape, the
`?cityId=` full-provenance mode, and an unknown city. TypeScript, the production build, the memory mirror and the
deterministic v1.1 check all pass, and all seven core routes returned HTTP 200 authenticated.

## Planner and dashboard render hot paths - 3 September 2026

`canonicalCountryOptions` in `src/app/plan/page.tsx` was rebuilt on every render of the planner, including every
keystroke in any input on the page. `getSelectedCountryPreview` re-scanned every saved country for each of the 245
`KNOWN_COUNTRIES`, and `findKnownCountryMetadata` runs `slugifyId` - an NFKD normalise plus four regex replaces - on
every call. Measured at **5.037 ms per render**. Each saved country is now resolved once into a `Set` of canonical
ids and the result is memoized on `countries`, measured at **0.045 ms**, a **112x** improvement. Outputs were verified
byte-identical between the old and new implementations before the change was kept. The earlier "~28,400 operations"
figure in the plan was an estimate and is superseded by this measurement.

One shared `cityOptions` array is now built with `useMemo` and passed to every `LegCard` and the Add Leg dialog. Each
of up to twelve cards previously built its own ~200-object array inline during render, which also handed
`SearchableSelect` a new `options` identity every time and so permanently defeated the `useMemo` at
`src/components/ui/searchable-select.tsx:44`, re-sorting ~200 options with `localeCompare` per card per render. The
legs array passed to `BulkTransportEstimateDialog` is memoized for the same reason.

`TransportEstimateDialog` (675 lines) was mounted unconditionally inside every leg card - roughly a dozen instances -
for dialogs the user had not opened, each with its own hooks and a `localStorage` read. It,
`BulkTransportEstimateDialog` (785), `PlannerNewCityDialog` (516) and `CityGenerationPanel` (455) now load through
`next/dynamic` and mount on first open, latched so in-dialog state survives close and reopen. `CityGenerationPanel`
already rendered only for a selected city, so it needed the bundle split rather than a mount gate. First-load
JavaScript fell from 154 kB to **127 kB** on `/dataset` and from 177 kB to **169 kB** on `/plan`.

The dashboard derivation chain in `src/app/page.tsx` is memoized. `categoryChartData`, `barData`, `chartBurnData`,
`staggeredCountryBands` and the cumulative maxima recomputed on every render, so toggling `showCountryDailySpend`,
`categoryMode` or `expandedChart` re-mapped and re-sorted the whole category list, country list and burn series. These
had to move above the loading early-return, because hooks cannot be called after a conditional return.
`staggeredCountryBands` mattered most: a new array each render re-ran `BurnCountryHeaderStrip`'s `useLayoutEffect`,
which calls `getBoundingClientRect` per band and forces a synchronous layout during commit.

One earlier claim is corrected rather than left standing. Extracting the three inline chart render functions was
justified on the grounds that calling them as functions makes Recharts rebuild and re-measure its subtree. That is
overstated: React reconciles by element type, so the charts are not remounted. The real benefit is skipping the chart
subtree when unrelated state changes, which is worthwhile now that the data arrays are stable, but it is lower
priority than first recorded. That item and the `next/dynamic` split of the Recharts bundle on `/` remain open.

Verification: TypeScript, `next lint` with no warnings or errors, 49 Vitest files / 217 tests, a production build, the
memory mirror, and an authenticated production walk returning HTTP 200 for all eleven routes. The walk confirms server
shells and API responses, not post-hydration chart rendering; the dashboard is client-rendered and its shell returns
the loading state by design. A browser pass over `/` and `/plan` remains outstanding, as the Chrome extension was not
connected during this work.

## Browser verification of the render and payload work - 3 September 2026

The verification gap recorded against Phase 8 Step 4 is closed. Checked in Chrome against an authenticated production
build.

`/` renders after hydration with no console messages. Both bar charts and the cumulative line chart draw: 60
`.recharts-rectangle` nodes with non-zero widths across three `.recharts-bar` layers, plus three `.recharts-line`
series. An earlier screenshot appeared to show empty charts and was briefly treated as a possible regression; that was
an artifact of downscaling a 1709 px viewport into a 1400 px JPEG, which renders the 4 px-tall bars as almost nothing.
The owner pointed out the bars were visible, and inspecting the DOM confirmed it. The lesson is to check the DOM rather
than trust a compressed screenshot when the question is whether small elements rendered.

`/plan` renders 62 legs with the 12-leg initial bound intact and no console errors.
`BulkTransportEstimateDialog` loads from its `next/dynamic` chunk on first click and reports 61 estimatable legs with
3 selected by default, confirming both the mount-on-first-open latch and the memoized legs prop. The Add Leg dialog
opens and its city picker lists all 203 options in correct alphabetical order, confirming the shared `cityOptions`
array and that `SearchableSelect` still sorts.

`/dataset` renders with the provenance card populated, including the anchor grid and FX snapshot, which come only from
the on-demand fetch. The network trace shows exactly the intended two calls: `/api/estimates?view=dataset` for the
slim list, then `/api/estimates?cityId=medellin` on selection. This confirms the Step 3 design end to end in a browser
rather than only at the API level.

One pre-existing accessibility warning surfaced and is not caused by this work:
`Missing 'Description' or 'aria-describedby={undefined}' for {DialogContent}`, a Radix warning about the dialog
component itself. It is recorded for separate follow-up.

## Measurement harness corrected and a real baseline recorded - 3 September 2026

`scripts/check-webapp-performance.mjs` now authenticates and refuses to report numbers for a redirected route. The
defect it replaces: the script fetched every route with `redirect: 'follow'` and no session cookie, `src/middleware.ts`
wraps all of them in `withAuth`, so each route 307'd to `/login` and the script measured the login page seven times.
That is why a 5-second route budget and a 512 KiB shell budget never fired while the app was slow to use.

`assertNotRedirectedToLogin` fails whenever a response was redirected or lands on `/login`, and it runs whether or not
credentials are configured, because it is the assertion that makes every other number trustworthy. Sign-in goes through
the NextAuth credentials endpoint using `WEBAPP_AUTH_PIN` for a dev server or `WEBAPP_AUTH_EMAIL` and
`WEBAPP_AUTH_PASSWORD` for a production build, with a small cookie jar because Node's `fetch` does not persist cookies.
The harness also records decompressed JavaScript bytes per route and authenticated API latency and payload bytes,
samples each target three times by default and reports medians rather than a single reading, and accepts
`WEBAPP_REQUIRE_BUILD=false` so the same script can measure `npm run dev`.

Verified both ways against the running app. With credentials the check passes. With credentials removed - the exact
configuration that produced the invalid Phase 7A numbers - all seven routes report
`redirected to /login ... would describe the login page, not the route` and the run exits 1.

Corrected baseline, authenticated against a production build. Route shells respond in 4-12 ms.

| Route | Shell | JavaScript, decompressed | Files |
| --- | --- | --- | --- |
| `/` | 27,289 B | 1,068,839 B | 15 |
| `/plan/compare` | 28,397 B | 1,015,023 B | 14 |
| `/plan` | 27,943 B | 763,642 B | 17 |
| `/settings` | 27,594 B | 658,654 B | 16 |
| `/track` | 27,921 B | 653,380 B | 14 |
| `/dataset` | 27,734 B | 615,956 B | 15 |
| `/estimates` | 167,151 B | 518,309 B | 10 |

Authenticated API medians: `/api/countries?includeCities=false` 3 ms / 5,508 B; `/api/itinerary` 7 ms / 42,901 B;
`/api/expenses?view=track` 10 ms / 29,947 B; `/api/dashboard/summary` 13 ms / 757 B; `/api/dashboard/burn-rate`
15 ms / 79,776 B; `/api/estimates?view=dataset` 9 ms / 132,011 B.

Assets are gzipped but chunked with no `content-length`, so the recorded figure is the decompressed size, roughly four
times the transferred bytes and the amount the engine parses. An initial run used a 1 MiB budget and failed `/` at
1,068,839 B; the budget was raised to 1.25 MiB and the metric relabelled, because reporting decompressed bytes as
though they were transfer bytes would have been the same category of error the harness was being fixed to prevent.

New finding from the first honest run: `/plan/compare` is the second-heaviest route at 1,015,023 B and had not
appeared in any earlier analysis. It carries the comparison charts and should be included when the Recharts
dynamic-import item in Step 4 is addressed.

The Phase 7A numbers are retained in this log and in `PLAN.md` as dated history, marked superseded rather than
deleted.

Verification: TypeScript, `next lint` clean, 49 Vitest files / 220 tests including three new harness regression tests,
and the memory mirror.

## Test suite audit - 3 September 2026

The audit ran and removed no tests. The conclusion contradicts the plan that set it up, so the reasoning is recorded
here rather than the outcome alone.

Module reachability was computed transitively from the real entry points (`src/app`, `src/components`,
`src/middleware.ts`) instead of judging by file name. Sixteen of seventy `src/lib` modules are unreachable from the
running app, carrying roughly 2,400 lines of tests, and they matched the retired v3/v4/v5 research the plan targeted
for deletion.

They are not dead code. Each is a reader of retained methodology evidence. `data/reference/` still holds
`accommodation_property_panels_2026_2027.json` at 1.9 MB, `accommodation_reference_windows_2026_2027.json`,
`city_cost_collection_batches.json`, `city_cost_pilot_enrichment.json`,
`hanoi_accommodation_classification_reconciliation_2026.json`, and 42 files under `observations/`. Every unreachable
module parses or validates part of that corpus and its `npm run methodology:*` entry point still works;
`methodology:batches:validate` and `methodology:accommodation-windows:validate` were run and pass.
`CLAUDE.md` states that files under `data/reference/` must not be moved or renamed without updating their readers.

"Unreachable from the app" was therefore the wrong test for "useless". These modules are unreachable by design: they
are offline validators for evidence the project deliberately retains for audit and reproducibility. Deleting them
would have read as decisive cleanup while orphaning 2.2 MB of retained evidence and breaking the audit path that
several conventions exist to protect. Two further exclusions: `city-cost-v1-1-guard` is the live-CSV guard behind
`npm run methodology:v1.1:check`, and `transport-estimation-accuracy` is the harness for the still-deferred transport
accuracy task.

The suite also contains no tautological assertions and no tests that merely restate the implementation, so the
quality concern the audit was meant to address does not exist here.

The real dead weight was outside the tests. Four dependencies are declared but imported nowhere in the repository and
were removed: `swr`, `date-fns`, `shadcn` (a scaffolding CLI listed as a runtime dependency) and `tw-animate-css`
(absent from every stylesheet). Each was checked with `git grep` across the tree and against the lockfile, which
showed them as direct dependencies with no dependents. `src/app/fonts/GeistMonoVF.woff` (67,864 bytes) was removed as
well; only `GeistVF.woff` is loaded by `src/app/layout.tsx`.

`tests/playwright/performance-bounds.spec.ts` was renamed to `render-bounds.spec.ts`, with its describe block changed
to `initial render bounds`. Its three tests assert row counts and never a duration, so calling them "performance"
implied a timing guarantee they never made. That mattered little while no real timing check existed; it matters now
that `npm run performance:check` measures timings properly. The tests themselves are sound and were kept.

Counts are unchanged at 49 Vitest files / 220 tests. Verified with TypeScript, `next lint`, a clean production build
from an emptied `.next`, the memory mirror, and the deterministic v1.1 check with the live CSV hash unchanged at
`0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8`.

## Comparison charts split out of the plan-compare bundle - 3 September 2026

The corrected performance harness identified `/plan/compare` as the second-heaviest route at 1,015,023 bytes of
decompressed JavaScript, which no earlier analysis had noticed. The cause is three Recharts components that render
only once a comparison has been loaded but shipped in the route's first-load bundle regardless.

`ComparisonChart`, `ComparisonCountryChart` and `ComparisonCategoryChart` now load through `next/dynamic` behind
fixed-height placeholders that reserve 400 px, 360 px and 360 px respectively, matching their `ResponsiveContainer`
heights so the layout does not shift while the chunk loads. The route's decompressed JavaScript fell to
**538,967 bytes**, a 47% reduction, and its first-load figure from 236 kB to 104 kB.

One interaction is worth recording because it looks like a regression and is not. Recharts previously sat in a chunk
shared between `/` and `/plan/compare`. With compare no longer importing it, `/` carries it alone: that route's own
chunk grew from 26.4 kB to 147 kB while its first-load total moved only from 263 kB to 266 kB. Total bytes across the
app fell; they simply stopped being shared.

The equivalent split on `/` is deferred. Recharts is imported directly into `src/app/page.tsx` rather than through
extracted components, so splitting it means first extracting roughly 200 lines of chart JSX that closes over a dozen
values - the same refactor as the outstanding `React.memo` item, and the riskiest remaining change on a page whose
rendering was only just verified in a browser. The argument for doing it is that the dashboard charts cannot render
until three API calls return, so the bundle could load in parallel with those fetches; the argument against is that
they are core above-the-fold content, so the split trades bundle size for a visible loading placeholder. Recorded
rather than decided silently.

Verification: TypeScript, `next lint` clean, 49 Vitest files / 220 tests, production build, memory mirror, and an
authenticated `npm run performance:check` run against the production build.

## Production was reading a throwaway copy of the database - 3 September 2026

Found while preparing demo data for README screenshots: the production server did not read
`data/travel.db`. It read `.next/standalone/data/travel.db`, a full copy that `next build` traced into the bundle.

The mechanism is two innocuous pieces meeting. `.next/standalone/server.js` line 6 calls
`process.chdir(__dirname)`, which is standard Next behaviour for the standalone output. `src/db/index.ts` resolved the
database as `path.join(process.cwd(), 'data', 'travel.db')`. Under `npm run dev` those agree; under `npm start` the
working directory is the bundle, so the path resolved inside `.next/standalone`.

The consequences were real. Every write made through `npm start` went to a copy that the next `npm run build`
overwrote, so production changes were silently discarded. Comparing the copy against a backup of the real database
found one such loss: saved plan `61a46a0a-1c24-4104-8ed8-355f69a57908`, "Plan 2026-09-04", created at 16:26 that day
with a 37,994-byte snapshot, existed only in the bundled copy. It was extracted and merged back into the real
database, which now holds 63 saved plans against the 62 it had before. Expenses, legs and estimates had not diverged.

This also explains an earlier incident recorded as "a stale standalone bundle". Production sign-in returned
`CredentialsSignin` immediately after a password was written to the real database, then worked after a rebuild. The
cause was not stale code: the bundled database copy predated the password row, and the rebuild refreshed the copy.

Separately, the copy meant `next build` duplicated 3.4 MB of private financial data into build output. The repository
is public, and while `.next` is gitignored, build output should not carry a database at all.

The fix has two parts. `src/db/index.ts` now prefers `HOLIDAY_SPEND_DB_PATH`, which
`scripts/start-next-production.mjs` sets to the project-root path it already knows, falling back to the previous
cwd-based path so development, tests and scripts are unchanged. The launcher also deletes
`.next/standalone/data` before starting, since nothing should read it.

`experimental.outputFileTracingExcludes` was tried first and did not prevent the copy under either `'/*'` or `'**/*'`
keys. The second, broader pattern also stripped files the standalone server needs, producing `MODULE_NOT_FOUND` on
startup. That configuration was removed rather than left in place looking effective, and the deterministic removal in
the launcher replaced it.

Verified after the fix: the launcher reports removing the bundled copy, and production reports 63 saved plans
including the recovered one, matching the database on disk exactly. TypeScript, `next lint`, 49 Vitest files / 220
tests, the memory mirror and the deterministic v1.1 check all pass with the live CSV hash unchanged.

## Public-facing README with demo screenshots - 3 September 2026

`README.md` was rewritten for a reader arriving at the repository cold. It now opens with the problem the app
solves in plain terms, follows with what it does and screenshots of each main surface, explains the city-cost
methodology, and only then covers developer setup. Previously setup sat in the middle, above the product content,
and there were no images.

The repository is public, so screenshots could not use real data: the dashboard alone shows a full trip budget,
actual spending to date, and 1,300 expense records, and git history is permanent. A fictional six-leg Southeast
Asia and Japan trip was seeded instead, with 83 generated expenses totalling A$4,101 against an A$8,779 plan. The
real database was backed up twice and verified before seeding, then restored and confirmed byte-identical across
all 21 tables afterwards.

Two details were corrected during capture. The demo seed initially used `3-star` and `private_room` as tier keys
where the app expects `3star` and `privateRoom`, which left the accommodation dropdown blank in the first planner
screenshot. And screenshots taken immediately after navigation caught the charts mid-animation and appeared to show
empty plots; captures now wait for the bars to settle, and the DOM is checked rather than the image trusted.

The README also states that it is a personal project rather than a product seeking users, and that the screenshots
use fictional data. Every link and image path in it was verified to resolve, and the environment variables it names
were checked against `.env.example` — an initial draft told readers to set `APP_SECRET`, which that file does not
define; it names `NEXTAUTH_SECRET` and `AUTH_DEV_PIN`.

## Expense CSV export - 3 September 2026

The expenses screen had an Import button and no Export. A CSV endpoint already existed at
`/api/export?format=csv`, but it was reachable only from Settings and always returned every expense regardless of
what the user was looking at.

`/api/export` now accepts the same filters as `/api/expenses` - `cat`, `source`, `from`, `to`, `leg` and `tag` - and
`/track` has an Export button that passes whatever filters are currently applied, so the download matches the list on
screen. Settings passes no filters, so its full-trip export behaves exactly as before.

The CSV also now resolves `city` and `country` from each expense's itinerary leg. It previously emitted a bare
`leg_id`, which made the file unreadable in a spreadsheet without joining a second export.

URL building went into `buildExpenseExportHref` in `src/lib/expense-track-page.ts` rather than inline in the
component, matching that module's existing pure-helper pattern and making it testable. Four tests cover no filters,
all filters together, `'all'` treated as unset rather than a category literally named "all", and one-sided date
ranges.

Verified against the production build with the real 1,300-expense dataset: an unfiltered export parsed to exactly
1,300 rows with zero parse errors and a resolved city on every row; `cat=food` returned 88 rows all in that category;
a ten-day range returned 61. Checking with a CSV parser rather than counting newlines mattered here, because quoted
descriptions contain line breaks and `wc -l` under-counted by one.

The README also gained the dashboard's cumulative spend chart, captured from the same fictional demo trip. The real
database was restored afterwards and verified byte-identical across all 21 tables.

Verification: TypeScript, `next lint` clean, 49 Vitest files / 224 tests, production build, memory mirror, and the
deterministic v1.1 check with the live CSV hash unchanged.

## Indexes, a rejected cache, and corrected location documentation - 3 September 2026

The database declared no indexes beyond two on `auth_tokens`. Twelve were added in the runtime bootstrap:
`expenses(user_id, date)`, `expenses(leg_id)`, `itinerary_legs(user_id, sort_order)`, `itinerary_legs(city_id)`,
`itinerary_leg_transports(leg_id)`, `saved_plans(user_id)`, `cities(country_id)`,
`city_estimates(city_id, estimated_at)`, `city_price_inputs(city_id)`, `expense_tags(tag_id)`,
`fixed_costs(user_id)` and `tags(user_id)`. Each statement is wrapped so a missing table in a partially built test
database is never fatal.

Usage was verified with `EXPLAIN QUERY PLAN` rather than assumed. All seven representative queries now report
`SEARCH ... USING INDEX` where they previously reported a full table scan: expenses by user and date, expenses by
leg, legs by user and sort order, transports by leg, saved plans by user, cities by country, and estimates by city.

The motivation is correctness and headroom, not measured latency. Foreign keys are enforced but SQLite does not index
child FK columns automatically, so every delete on `user`, `cities` or `itinerary_legs` previously scanned each
referencing table in full. Warm API responses were already 3-15 ms at current volumes and remain so; this should not
be reported as a speedup.

The plan's proposed `tokenVersion` cache was rejected on measurement. The lookup takes **4.4 microseconds** - 0.013 ms
across a three-call dashboard load, or 0.145% of a single warm API response - because it is a primary-key lookup. A
TTL cache would trade delayed session revocation, a real security property, for a saving that does not register
against a 3 ms response. Recorded as rejected rather than left open as a future task.

Separately, `CLAUDE.md` stated "The repository lives inside OneDrive". That is false and had been for some time: the
working tree is `C:\Dev\holiday-spend` while OneDrive is `C:\Users\chawi\OneDrive`, and `.next`, `.next-dev`, `data/`
and `data/travel.db` carry no reparse points. The section was replaced with the verified current state and mirrored
into `AGENTS.md`.

An orphaned pre-move copy still exists at `C:\Users\chawi\OneDrive\projects\holiday-spend`, with no `.git` directory
and a dehydrated `scripts` reparse point. It is now documented as a trap not to open, since running it would reproduce
the historical Files-On-Demand failures.

`scripts/prepare-next-dev.mjs` was retained rather than deleted, with the reason stated in the memory documents: it
finds nothing to do on the current path, but is cheap, harmless, and would matter again if the repository moved back
under a synced root. The historical failure it guards against - a dehydrated `.next` causing a dev process to consume
roughly 1.2 GB without completing a request - is preserved as dated context rather than erased.

Verification: TypeScript, `next lint` clean, 49 Vitest files / 224 tests, production build, memory mirror, and the
deterministic v1.1 check with the live CSV hash unchanged. Fourteen indexes present; data intact at 1,300 expenses,
62 legs and 63 saved plans.

## Phase 7 workflow pass and two expense-update defects - 3 September 2026

The remaining Phase 7 checks are mutating, so they were run against a seeded fictional trip rather than the real
dataset. The real database was backed up twice and verified before seeding, restored afterwards, and confirmed
byte-identical across all 21 tables.

All seven routes render with zero console errors, navigated client-side through the `next/link` sidebar.
`/plan/compare` shows a graceful empty state when no snapshots exist. Adding a leg through the Add Leg dialog moved
the plan from 6 legs / 33 nights / $8,779 to 7 / 37 / $10,303 with dates auto-derived, and it survived a reload with
its tiers and $1,525 total intact; deleting it returned the totals exactly. Changing traveller count from 2 to 3
rescaled the trip from $10,303 to $15,474 - a factor of 1.502 rather than a flat 1.5, because accommodation does not
scale linearly - while the `cities` table was verified byte-identical before and after, confirming the "stored for
two people, scaled at runtime" invariant. Two snapshots compared correctly, with all three dynamically imported
charts rendering 19 bars and two line curves. On `/track`, exclude and re-include round-tripped exactly and delete
removed one row.

Two real defects surfaced in `PUT /api/expenses/[id]`, both now fixed.

The first is the more serious. The handler wrote the new `amount` but never recomputed `amountAud`. Every total in
the app sums `amountAud`, never `amount`, so an edited amount appeared in the expenses list and was silently absent
from the dashboard, country and category totals. It was reproduced directly: expense 2307 held `amount = 250`
alongside `amount_aud = 9.26`. The handler now recomputes the conversion whenever amount, currency or date changes,
and fails closed by storing `null` when a rate cannot be resolved, which the dashboard already excludes rather than
treating as zero.

The second is that the same handler used `set({ ...body })`, writing the entire request body to the row. A caller
could set any column, including reassigning the expense to another `userId`, flipping `isDeleted`, or changing `id`
and `source`. It is now validated against an explicit Zod schema of the nine fields the edit form exposes. A request
carrying `userId: "attacker"`, `isDeleted: 1` and `id: 99999` was verified to change only the amount.

Worth recording how the first defect was nearly missed. The edit appeared not to save at all - the totals did not
move and the dialog stayed open - and the obvious conclusion was a broken save or a failed synthetic input. The
network log showed `PUT /api/expenses/2307` returning 200, which ruled out both. Only then did checking the row
itself reveal that `amount` had changed while `amount_aud` had not. A test that had asserted "the save request
succeeds" would have passed throughout.

A third finding is recorded but not fixed: `DialogContent` is missing a `DialogTitle` and `aria-describedby`, which
Radix warns about at runtime and which affects screen-reader users on the planner dialogs. It is left for separate
follow-up rather than bundled into unrelated work.

Verification: TypeScript, `next lint` clean, 50 Vitest files / 228 tests including four new regression tests, the
memory mirror, and the deterministic v1.1 check with the live CSV hash unchanged.

## Phase 7 completed: tagging, reassignment, CSV import, failure states - 3 September 2026

The remaining Phase 7 checks were run against seeded demo data; the real database was backed up, restored afterwards
and verified byte-identical across all 21 tables.

Tagging works end to end: create, attach, filter and detach. A tag belonging to another user is refused - posting
`{ tagIds: [99] }` returned `added: 0` and wrote no `expense_tags` row, because the route resolves tag ownership
before inserting.

Leg reassignment attributes correctly. Moving a $103.81 expense from Bangkok to Kyoto moved Thailand's actual from
2014 to 1910 and gave Japan 104, exactly the expense amount, confirming that country totals follow the assigned leg
rather than the transaction date. A non-existent leg returns 404 and changes nothing.

Wise CSV import behaves correctly on the 408-row sample. Preview parsed 326 importable rows and 77 skipped, and wrote
nothing - the expense count stayed at 83. Confirming imported 326, giving 409. Re-importing the same file imported 0
and reported 326 duplicates, the count stayed at 409, and the database holds zero duplicate `wise_txn_id` values.

Failure and validation states leave no partial records. Across an invalid expense, a malformed JSON body, a reference
to a non-existent leg, and city generation with no provider key, the expense, city, leg and estimate counts were
identical before and after at 409, 203, 6 and 59.

One further defect surfaced and was fixed. `await request.json()` throws a `SyntaxError` on a malformed body, and 32
route handlers call it. `handleError` matched only `ZodError` and `AuthRequiredError`, so a bad request body fell
through to `Internal server error` with HTTP 500 - blaming the server for a client mistake and telling the caller
nothing useful. It is fixed once in `src/lib/api-helpers.ts`, covering all 32 routes: a `SyntaxError` whose message
names JSON now returns `400 Request body is not valid JSON.` The match is deliberately narrow so an unrelated
`SyntaxError` still returns 500 and a genuine server fault is not silently reclassified as a client error. Five tests
were added, and the behaviour was verified end to end against the production build.

Two request-shape errors during this pass were mine, not the app's, and are recorded so they are not mistaken for
findings: the tag attach endpoint takes `{ tagIds: [...] }` rather than `{ tagId }`, and the expenses list returns
its rows under `items`. Both initially looked like failures until the route and response were read.

Phase 7 is now complete. Suite is 51 files / 233 tests.

## Dialog accessibility fixed - 3 September 2026

The Radix warning recorded during the Phase 7 pass turned out to cover two distinct problems, both now fixed.

The command palette behind every `SearchableSelect` - the city pickers on `/plan` and `/dataset` - rendered a
`DialogContent` with no accessible name at all. Screen readers announced an unnamed dialog, and Radix logged
"`DialogContent` requires a `DialogTitle`" on every open. `CommandDialog` now accepts `title` and `description`
props rendered with `sr-only`, and `SearchableSelect` passes its own placeholder through, so the city picker
announces "Select a city" and describes itself as "Search cities...". The palette looks unchanged.

The second problem was wider and easy to dismiss as noise. No dialog in the app defined a `DialogDescription`, but
Radix still sets `aria-describedby` to an id it expects a description to own. All thirteen dialogs therefore pointed
assistive technology at an element that did not exist. A dangling reference is worse than no reference, so this was
worth fixing rather than silencing with `aria-describedby={undefined}`. Every `DialogContent` now has a matching
description: the expanded dashboard and comparison charts, the Add Itinerary Leg and Resolve Missing Cities dialogs,
Add Fixed Cost, Edit Expense, Create and Edit Tag, Save Plan Snapshot, Add New City With LLM, and both transport
estimate dialogs.

Verified in Chrome against a production build. The bulk transport dialog, the Add Itinerary Leg dialog and the city
picker all resolve both `aria-labelledby` and `aria-describedby` to real text, and the console is silent where it
previously logged a warning on every open.

One lint failure during the work is worth noting only because it shows the check earning its place: a description
containing "this expense's" tripped `react/no-unescaped-entities`. It was rephrased rather than escaped.

Verification: TypeScript, `next lint` clean, 51 Vitest files / 233 tests, production build, and the browser pass
above. No data was written; the database is unchanged at 1,300 expenses, 62 legs and 63 saved plans.

## Closing three prematurely-marked Phase 7 and Phase 9 gaps - 3 September 2026

Reviewing the plan's unchecked items showed 23 open boxes sitting under phases already marked COMPLETE. Most were
stale bookkeeping - work done during this session but never ticked - but three were real gaps, and the phases had been
marked complete without them. That is the same failure the Phase 7A numbers demonstrated: a progress document that
claims more than was verified.

Intercity transport add, edit and remove is now verified. Adding a row to the Chiang Mai leg created a transport row
and correctly left the total unchanged at $8,779, because a new row starts at zero cost. Setting mode "Train", note
"Overnight sleeper" and cost 120 moved the total to $8,899, exactly $120, and all three fields survived a reload.
Removing the row returned the total to $8,779 and left the original Bangkok-to-Chiang-Mai row and all six legs
intact. Chiang Mai's stored base costs were byte-identical throughout, confirming transport is held on the leg and
stays outside city-cost methodology.

`/dataset` is verified for row provenance and edit targeting. The table renders source badges separating
`base_csv_apr_2026`, `llm_city_generation` and `manual` rows, and the editor labels read as plain English rather than
column names. Saving an edit for `chiang-mai` changed exactly 1 of 203 cities, the correct one, and left `food_mid`
untouched, so a partial update does not clobber sibling fields.

The `/plan/compare` screenshot the README was missing has been captured and added, showing the same demo trip costed
for two travellers against three so the two cumulative lines visibly diverge. All six README images resolve.

The plan's checkboxes were then reconciled against reality: 19 items that were genuinely done are now ticked, leaving
four unchecked, all of them deliberately deferred with their reasoning recorded - the dashboard chart extraction and
Recharts split, server-rendering initial data (gated on the harness showing a gap it currently does not show), and
the transport-accuracy same-day quote capture.

Two automation notes, recorded because they cost time and are not app defects. Synthetic `input` events with a reset
`_valueTracker` do not reach this app's controlled inputs; real keystrokes through the browser tool do, which is how
the transport cost edit was confirmed. And number inputs do not support `setSelectionRange`, so clearing them needs
End plus Backspace rather than select-all.

Verification: TypeScript, `next lint` clean, 51 Vitest files / 233 tests, production build, memory mirror. The real
database was restored and verified byte-identical across all 21 tables at 1,300 expenses, 62 legs and 63 saved plans,
with `chiang-mai` back to its original 38.75.

## Write-route input validation audit - 3 September 2026

The two defects fixed in `PUT /api/expenses/[id]` were a pattern rather than one-offs, so every route that parses a
request body and writes was scanned. Four more had the same shape; one flagged route turned out to be fine.

`PUT /api/cities/[id]` was the serious one. It ran `db.update(cities).set(body)` with the raw request body, no
validation, and - because cities are shared reference data rather than per-user rows - no user scoping. Any
authenticated request could write any column on the dataset the entire app derives from. Two fields matter most:
`estimationSource` and `estimationId`, which would let a value falsely claim a provenance it does not have, and `id`,
which would orphan every reference to the row. The project's protections against exactly that outcome - the live-CSV
guard, the deterministic methodology check, and the rule that a modelled value must not be presented as an observed
source price - all sit on the generation path. This endpoint walked past all of them. It is now restricted to the 23
cost fields the dataset editor actually sends, which was confirmed safe because city generation writes directly
through `src/lib/city-generation-service.ts` rather than this route.

`PUT /api/itinerary/legs/[id]` spread the raw body, so a request could set `userId` and move a leg to another
account, or overwrite `intercityTransportCost` and `intercityTransportNote`, which the server derives from the
transport rows rather than accepting from the client. `PUT /api/fixed-costs/[id]` and `PUT /api/tags/[id]` also wrote
the raw body; their `WHERE` clauses scope the row to the caller so another user's row is unreachable, but a body
containing `userId` would still move the caller's own row to someone else.

`POST /api/itinerary/snapshot` was a false positive. It validates through `parseSnapshotImportRequest`, which applies
zod schemas in `src/lib/snapshot-import.ts`; the scan missed it because the schema lives in a lib module rather than
the route file. No change was made, and it is recorded here so the route is not re-flagged later.

Every schema uses `.strict()` rather than zod's default strip, so an unexpected field is refused with a message
naming it instead of being silently discarded. That makes adding a new editable field a deliberate act, matching the
project's fail-closed convention, and it means a client sending a stale field learns about it rather than having the
value quietly dropped.

Verified against a production build. Each route refuses a hostile body by name - for cities,
`Unrecognized keys: "estimationSource", "estimationId", "id", "name"` - while legitimate edits still succeed and
leave sibling fields untouched. Six regression tests cover provenance forgery, identity rewriting, empty updates,
cross-user reassignment, and the legitimate paths.

One note on the test fixture: the first run failed only on the success-path assertions, because the route selects
every column while the fixture table declared a handful. The four rejection assertions passed from the start. The
fixture now mirrors the real table.

Verification: TypeScript, `next lint` clean, 52 Vitest files / 239 tests, production build, memory mirror. The
verification made real writes, so the database was restored from backup and confirmed byte-identical across all 21
tables, with `lisbon` back to 139.5.

## Wise CSV import rate waterfall - 3 September 2026

Importing a Wise CSV resolved exchange rates one at a time. Each cache miss awaited its own HTTPS request to
Frankfurter inside a sequential `for` loop, so a cold import cost one round trip per distinct currency and date in
the file, serialised. The rates are knowable before any conversion happens, so they are now collected up front and
fetched concurrently.

Measured on the 408-row sample with `exchange_rates` emptied before each run so all three were identical: the
sequential baseline took **81.08 seconds** for 150 rate requests; the fix takes **6.96 seconds** for the same 150
requests, an 11.6x improvement.

An intermediate version is worth recording because it was slower and wasteful. Prefetching both the source and target
currency for every row issued 208 requests - 39% more than the sequential version had needed - for rates most rows
never used, and took 13.53 seconds. The resolver converts from the source currency when a row has one and only falls
back to the target currency if that fails, so narrowing the prefetch to mirror that first choice brought the count
back to exactly 150 and roughly halved the time again. Fetching more data in parallel is not automatically better
than fetching the right data.

Concurrency is bounded at eight using `runWithConcurrency`, the helper already written for bulk transport estimation,
rather than adding a second one. Frankfurter is a small free service, so the limit is deliberate rather than
incidental.

Behaviour is unchanged, verified rather than assumed: all 326 importable rows produce identical AUD amounts against
output captured from the original implementation, with the same 408 total, 326 to import, 77 skipped and 0
duplicates. Failure still fails closed - an unresolvable rate leaves `amountAud` null rather than substituting a
plausible value, which the dashboard already excludes rather than treating as zero.

Four regression tests cover fetching each currency and date once across many rows, issuing the requests concurrently
rather than serially, skipping lookups for rows already in AUD, and leaving a row unresolved when the lookup fails.

`getExchangeRate` still writes each rate to `exchange_rates`, so a second import over overlapping dates stays cheap.
The improvement is to the first cold import, which is the one a user actually waits on.

Two things were deliberately not changed and are recorded so they are not rediscovered as new: the import route still
runs one `SELECT` per parsed row for the duplicate check, and inserts rows one at a time without a surrounding
transaction. Both are cheap relative to the network waterfall that dominated, and neither registered once the rate
fetches ran in parallel.

Verification: TypeScript, `next lint` clean, 54 Vitest files / 243 tests, production build, memory mirror. The
measurements required real imports, so the database was restored from backup and confirmed byte-identical across all
21 tables.

## Dashboard chart extraction and Recharts split - 4 September 2026

`/` was the heaviest route in the app. Recharts was imported directly into `src/app/page.tsx`, so the whole charting
library loaded before anything on the dashboard could paint, including the four summary stat cards that need no charts
at all. The three charts were inline render functions in a 1,352-line file, which also meant all three re-rendered
whenever unrelated dashboard state changed.

This was deferred twice, with the analysis recorded, on the grounds that it was a three-file, roughly 600-line
reorganisation and the riskiest remaining change. The size estimate was about right. The obstacle was not.

The earlier analysis counted how many helpers were used both inside and outside the chart bodies and concluded that
most of them would need a shared module. That is the constraint for memoizing the charts, but it is not the constraint
for splitting the bundle. What a bundle split requires is narrower: nothing statically imported by `page.tsx` may
import Recharts. Every Recharts reference already sat inside the three renderer bodies, and no top-level helper touched
the library. So the shared helpers moved verbatim rather than being rewritten, and TypeScript passed on the first
attempt.

The result is `src/components/dashboard/dashboard-chart-parts.tsx`, which holds the shared types, constants, tick,
tooltip, legend and country-header-strip components and is deliberately Recharts-free - a Recharts import there would
silently undo the split, so the file says so - plus three `React.memo` components loaded with `next/dynamic` behind
fixed-height placeholders that reserve the same space, matching what `/plan/compare` already did.

| Measure | Before | After | Change |
| --- | --- | --- | --- |
| `/` first-load JS | 266 kB | **144 kB** | −46% |
| `/` route size | 147 kB | **24.8 kB** | −83% |
| `/` decompressed JS | 1,068,839 B | **636,953 B** | −431,886 B, −40% |
| `src/app/page.tsx` | 1,352 lines | 707 lines | −645 |

`/plan` is now the heaviest route at 764,620 bytes.

Verification was in an authenticated production browser session, and the method matters because a downscaled
screenshot previously hid bars that were four pixels tall and led to a wrong claim that charts were missing. Plotted
elements were counted in the DOM instead: 32 country bars, 7 category bars with their percentage labels, 3 burn lines
with 21 country reference areas and the budget ceiling reference line, the staggered three-row country header strip,
and live tooltips reading correct values on both the country chart and the burn chart. All six render paths were
exercised - inline and expanded for each of the three charts - because expanded passes a different set of props.

Two measurement mistakes are worth recording, both the same mistake. Reading `.recharts-wrapper svg` and then
`svg.recharts-surface` each returned a 14x14 legend icon rather than the plot, because the country chart is the only
one with a top-aligned legend and its icon precedes the plot in the DOM. That produced a false regression report of a
chart with zero bars. Selecting the first match from a container that holds several is not a safe default; the correct
count was 32.

One test moved with the code. `src/lib/planner-city-picker-ui.test.ts` reads the cumulative-spend legend definitions
out of a file by path and asserts each line's label and colour. The guarantee is unchanged - every plotted series has a
legend entry with a matching colour - so the test was repointed at the new file rather than deleted.

No console errors. The only console output was a Chrome-extension message-channel artefact that also appears on
`/plan`, `/dataset` and `/plan/compare` and predates the change by two hours.

Verification: TypeScript, `next lint` clean, 53 files / 243 tests, production build, memory mirror,
`methodology:v1.1:check` with the live CSV hash unchanged, and the authenticated performance harness.
