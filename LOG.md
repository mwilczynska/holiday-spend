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

# Part 5 — City cost methodology v5 workstream

## Experiment 000 — deterministic baseline reassessment (31 July 2026)

The first v5 experiment audited the retained v3/v4 evidence without treating the asserted production CSV
as ground truth. It read 176 accepted observation rows with zero duplicate observation IDs and found
evidence for **99 cities across all nine regions**. The generated report reproduced byte-identically on a
second run.

Direct evidence counts were: inexpensive meal 99, mid-range meal 97, fast-food combo 68, beer 97,
cappuccino 97, paid attraction 29, half-day activity 3, full-day activity 2, and direct 4-star
accommodation 1. Dorm, private-hostel, 1-star, 2-star, and 3-star accommodation had **zero** direct
observations. Street food, premium meal, cocktail, and wine were absent at the density needed to calibrate
their proposed v4 proxy coefficients.

The v4 proxy partition reaches 68 cities for the street/budget/mid-range food path, 97 for high-end food,
and 97 for coffee/beer drink baskets. Those are input-availability counts, not shipped-target validation.
The baseline is therefore **retained as reusable evidence but rejected as a complete production method**.
It has no target-model one-call result because this baseline audit predates the delegated Luna prompt tests.
Provider credentials are not required for those prompt-feasibility experiments; exact production-provider
telemetry and the locked holdout remain separate gates. The machine-readable report and verdict are in
`data/reference/v5/experiments/000-baseline-reassessment/`.

## Experiment 002 — accommodation ladder reassessment (31 July 2026)

The retained Booking.com class-page evidence was re-audited independently. The 4-star/3-star and
2-star/3-star global ratios use 16 cities; the blended-hostel relations use 13. The v5 requirement is at
least 30 complete matched cities and 10 locked holdout cities for a multi-tier claim, so these figures are
candidate evidence rather than final calibration.

The only full-inventory check shows a **3.945×** sliding-window spread for a 10-property first-page read.
Headline/list ratios vary from **0.451× to 1.834×** across the retained city captures. The hostel page
contains one blended unit and does not identify dorm beds versus private rooms. The candidate is therefore
**rejected as a final v5 accommodation method but retained as evidence**. The machine-readable report is
`data/reference/v5/experiments/002-accommodation-ladder/results.json`.

## Experiment 003 — deterministic derivation contract (31 July 2026)

The isolated `src/lib/city-cost-methodology-v5.ts` function accepts only post-FX anchors and provenance
metadata. It materializes all 19 product tiers with fixed basket quantities, records parent anchors and
formulas, and fails closed when an input is missing, blocked, not found, or class-absent. Direct one-anchor
tiers retain `observed`; baskets made from observed anchors are labelled `derived`; modelled and imputed
inputs propagate those weaker bases; `activities_free = 0` is `definitional`.

The contract tests also reject contradictory status/value pairs and verify that the auxiliary
`mcmeal_combo` anchor is never silently substituted for a missing street-food measure. This is schema and
provenance evidence only — no statistical coefficients were fitted or promoted. The machine-readable
result and verdict are in `data/reference/v5/experiments/003-derivation-contract/`.

## Experiment 005 — target-model sub-agent prompt feasibility (31 July 2026)

A delegated GPT-5.6 Luna-class sub-agent ran the exact v5 18-anchor extraction prompt for Lisbon,
Copenhagen, Hanoi, Prague, and sparse Don Det without a user-supplied provider API key. All five response
objects passed the local one-call schema validator and emitted no tiers, arithmetic, FX conversion, or
invented sparse-city facts. It found 20 of 90 anchors (22.2%): five food/drink facts in each of the four
well-covered cities and none in Don Det. Four direct page reads returned HTTP 503; the orchestration surface
did not expose exact provider model ID, parameters, token use, latency, or monetary cost.

**Verdict:** the delegated route removes API-key absence as a prompt-iteration blocker, but the candidate
prompt is rejected as production-ready. Revise the source cascade and test accommodation/activity anchors
before attempting the locked accuracy holdout. Artifacts are under
`data/reference/v5/experiments/005-target-model-subagent/`.

## Experiment 006 — explicit source-cascade retest (31 July 2026)

The v006 prompt made the source cascade and hard-category query templates explicit, then reran the same
five-city delegated GPT-5.6 Luna-class pilot. Complete contracts rose from **20/90 (22.2%)** to
**30/90 (33.3%)**. Accommodation rose from zero to six facts (five dorm beds and one private double), and
adult attraction tickets rose from zero to four. All 30 found facts were audited against a retrieved search
result or canonical page; no unsupported facts, arithmetic, FX, or tier values appeared.

Hotel 1–4-star classes remained zero, as did half-day and full-day activity prices. Two relevant page reads
failed, and the orchestration surface still exposes no exact provider model ID, parameters, token count,
latency, or monetary cost. **Verdict:** retain the cascade as evidence, reject 18-anchor direct extraction
as production-ready, and test a smaller observed-anchor set with validated deterministic models. Artifacts
are under `data/reference/v5/experiments/006-source-cascade-retest/`.

## Experiment 007 — minimal observed-anchor retest (31 July 2026)

The nine-anchor prompt (dorm, private hostel, 3-star hotel, five food/drink anchors, and paid attraction)
returned **32/45 facts (71.1%)** on the same five-city Luna-class panel. The 18-anchor prompt found 20/45
on this subset and the explicit cascade found 30/45. Four ordinary cities returned 7–8 anchors; Don Det
returned only its dorm. Found facts were source-audited, and no omitted anchors, tiers, arithmetic, FX, or
unsupported facts appeared.

**Verdict:** promote the prompt to model-boundary validation. This is not final acceptance: nine omitted
anchors still need definition-matched model accuracy, the 3-star anchor is weak, sparse-city fallback is
unresolved, and source basis heterogeneity must be controlled. Artifacts are under
`data/reference/v5/experiments/007-minimal-anchor-retest/`.

## Experiment 008 — omitted-anchor ground-truth feasibility (31 July 2026)

A bounded ten-city delegated Luna-class task searched for the nine omitted anchors needed by the minimal
contract. Only **4/90 cells (4.4%)** met the frozen basis: one street-food item, one cocktail, and two
half-day group activities. No compatible 1/2/4-star two-adult rooms, premium meals, wine glasses, or full-
day premium activities were found. Thirty-one near-misses were rejected for ranges, private/package rates,
missing class or occupancy, stale promotions, or named venues without item prices.

**Verdict:** reject broad direct collection as the model-fitting method. The low result is predominantly a
definition/basis problem rather than a claim that the classes do not exist. Narrow source-specific panels or
revised estimands are required before any 30-city model validation. Artifacts are under
`data/reference/v5/experiments/008-omitted-anchor-ground-truth/`.

## Experiment 009 â€” accommodation panel feasibility (31 July 2026)

A bounded ten-city delegated GPT-5.6 Luna-class task used a narrow prompt for six accommodation
classes: dorm, private hostel, and hotel 1–4-star rooms. Only **4/60 cells (6.7%)** survived the frozen
definition: Prague private hostel, Nairobi dorm and private hostel, and Don Det 1-star. Three cities had
any compatible fact, and no city had all six classes; hotel 2-, 3-, and 4-star coverage was zero.

The dominant failures were structural: `from` prices and ranges, multi-night or package bundles, missing
occupancy or formal class labels, stale/promotional prices, and prices requiring arithmetic. Relaxing those
rules would change the estimand, so the near-misses remain rejected. The four surviving facts are feasibility
evidence only and must not be used for fitted coefficients.

**Verdict:** reject broad accommodation-panel collection as a general ground-truth method. Test a
date-fixed, source-specific contract or a separately curated benchmark with explicit two-adult occupancy,
one-night totals, class labels, currency, and retrieval date. The delegated execution counted three search
calls, ten queries, and one page-read call with three attempts; exact provider model/parameter/token/
latency/cost telemetry was not exposed. Artifacts are under
`data/reference/v5/experiments/009-accommodation-panel-feasibility/`.

## Experiment 010 â€” date-fixed accommodation source contract (31 July 2026)

A five-city delegated GPT-5.6 Luna-class task tested a fixed 15–16 September 2026 one-night stay for two
adults, with Hostelworld/property pages restricted to hostel classes and Booking.com/Hotels.com pages
restricted to hotel classes. Strict compatibility produced **0/30 facts** and zero complete cities.
Hostelworld results exposed undated `from` rates; Booking/Hotels results exposed different dates,
promotions, or multi-night totals. No page-read candidate met the date contract.

**Verdict:** reject date injection into broad indexed searches as a production accommodation source
contract. This does not rule out interactive public pages that preserve query state, nor a separately
curated benchmark. Retain the frozen class, occupancy, one-night, currency, and provenance rules. The
delegated task counted three search calls and eleven queries; exact provider model/parameter/token/latency/
cost telemetry was not exposed. Artifacts are under
`data/reference/v5/experiments/010-date-fixed-accommodation-contract/`.

## Experiment 011 â€” direct class-page templates (31 July 2026)

A five-city delegated GPT-5.6 Luna-class task opened the known Booking.com, Trip.com, and Hostelworld
class-page templates directly before searching. It found **10/30 facts (33.3%)**: Booking 3-star and
4-star pages returned explicit USD city averages for all five cities, with default two-adult/one-room
wording. Booking 1-star pages were blocked, 2-star pages yielded no compatible average, and Hostelworld
returned only prohibited `Dorms From`/`Privates From` values.

**Verdict:** partially promote only the Booking 3/4-star average templates to a broader definition and
stability audit. This is not complete accommodation coverage and does not validate accuracy. The task used
four direct page-read calls, 35 URL attempts, two find calls, and no general search; exact provider
model/parameter/token/latency/cost telemetry was not exposed. Artifacts are under
`data/reference/v5/experiments/011-direct-class-page-templates/`.

## Experiment 012 â€” single-city production-shape repeatability (31 July 2026)

Three independent delegated GPT-5.6 Luna-class invocations each received **one city only**: Copenhagen.
Every run passed the six-measure contract and returned the same 3-star city average (USD 254), 4-star city
average (USD 347), Hostelworld `From`-price rejection, and Booking 1-/2-star blocked statuses. All six
found facts (two per run) were audited against the retrieved pages; no arithmetic, FX, tiers, or unsupported
facts were emitted.

The 4-star city average converts to AUD 496.17 under the frozen 2026-07-22 FX snapshot. The existing five
accepted direct-property quotes have a median of AUD 309.28, giving **+60.4% signed and absolute error**.
The bases differ (city average versus dated direct-property median), so this is a basis warning rather than
a final multi-city accuracy estimate. It exceeds the v5 25% gate and cannot be corrected from one city.

**Verdict:** reject the Booking city-average source as a final accommodation anchor, but promote the
single-city invocation shape. Any future multi-city panel must be an explicit set of separately recorded
one-city calls. Telemetry counted three delegated tasks, 18 direct URL attempts, 12 successes, six failures,
three page-read calls, three find calls, and one fallback search with two queries; exact provider
model/parameter/token/latency/cost telemetry was not exposed. Artifacts are under
`data/reference/v5/experiments/012-single-city-production-shape/`.

## Experiment 013 â€” interactive official quote extraction (31 July 2026)

Three independent delegated GPT-5.6 Luna-class calls each inspected Copenhagen only and attempted five known
official booking-engine URLs for a fixed seven-night, two-adult stay. All **15/15 quote cells were blocked**
at the delegated web safety boundary before page content was available. No totals, tax facts, arithmetic, or
substitute searches were emitted. The runs agreed on the blocked result.

This does not prove the pages intrinsically fail: the existing manual direct-property capture opened these
same engines and produced accepted ground truth. It proves the target web-tool route cannot currently use
arbitrary long booking-engine URLs, so the route is rejected for production and blocks are retained as blocks.
Next test safe stable templates or another free source that the target tool can open. Artifacts are under
`data/reference/v5/experiments/013-interactive-official-quote-extraction/`.

## Experiment 014 â€” single-city Numbeo food/drink extraction (31 July 2026)

Three separate one-city Luna calls tested the direct Numbeo page for inexpensive meal, mid-range meal,
McMeal, cappuccino, and domestic draft beer. Lisbon's lowercase URL initially returned a 503/cache miss;
the canonical case-correct `/in/Lisbon` page then returned all five rows. Three Lisbon rows matched retained
observations exactly, cappuccino differed by 0.8% across dates, and McMeal had no prior row. Copenhagen and
Prague lowercase URLs were blocked before page content.

**Verdict:** retain Numbeo, revise the URL contract to try the canonical city-name path once, and retest
Copenhagen and Prague as separate one-city calls. No arithmetic, FX, search fallback, or unsupported values
were emitted; exact provider telemetry was unavailable. Artifacts are under
`data/reference/v5/experiments/014-single-city-numbeo-food-drink/`.

## Experiment 015 â€— canonical Numbeo URL retest (31 July 2026)

Two separate one-city Luna calls opened only canonical Numbeo URLs: `/in/Copenhagen` returned HTTP 503 and
`/in/Prague` returned HTTP 429. All **10/10** requested food/drink cells were blocked, with no lowercase
retry, search fallback, arithmetic, or estimate. The failures are rate/access outcomes, not missing data.

**Verdict:** reject direct Numbeo page retrieval as a reliable production route in the target web environment.
Retain the Lisbon success from Experiment 014, but test search-result extraction or another free source and
measure its rate-limit behaviour. Artifacts are under
`data/reference/v5/experiments/015-numbeo-canonical-url-retest/`.

## Experiment 016 â€— Numbeo search-snippet fallback (31 July 2026)

Two separate one-city Luna calls (Copenhagen and Prague) issued five Numbeo-restricted searches each and
returned **10/10** exact row/value/currency/URL facts. Direct page reads were zero; no fallback source,
arithmetic, FX, cross-city value, or unsupported fact was accepted. Eight matched retained observations had
median absolute difference 0.79% and p90 7.66%; snippets were dated June 2026 while prior rows were captured
in June/July, so date drift is visible. McMeal had no prior retained row.

**Verdict:** promote the search-only route to broader one-city validation. The direct Numbeo page route remains
rejected after 503/429 outcomes. This pilot does not establish final citation correctness, regional coverage,
or throttling behaviour at steady state. Artifacts are under
`data/reference/v5/experiments/016-numbeo-search-snippet-fallback/`.

## Experiment 017 — broad one-city Numbeo search validation (31 July 2026)

Six independent delegated GPT-5.6 Luna-class invocations each received one city only: Lisbon, Hanoi,
Bangkok, San Francisco, Nairobi, or sparse Don Det. Each issued exactly five Numbeo-restricted search
queries using the Experiment 016 prompt. Five cities returned all five exact food/drink facts (25/25);
Don Det returned 0/5 because results were unrelated similarly prefixed locations. Overall coverage was
25/30 cells (83.3%) and 5/6 complete cities (83.3%). There were 30 queries and 11 search operations,
with zero direct page reads, fallback sources, arithmetic, or cross-city evidence.

Every accepted fact carried exact city identity, row label, central value, source currency, and canonical
Numbeo URL in the returned evidence. This is a contract/citation audit, not an independent page-read audit,
because direct retrieval was intentionally prohibited. Ten definition-compatible rows from Lisbon and Hanoi
matched retained observations with 0% median absolute error, 9.09% p90, and 10% maximum; this is a small
date-drift source comparison, not the locked 30-city holdout. The delegated surface exposed no exact provider
model ID, parameters, tokens, latency, or cost.

**Verdict:** promote the search-only Numbeo route to a 30-city/10-holdout food/drink validation, preserving
the exact source contract and fail-closed sparse-city `not_found`. Do not substitute nearby-city evidence for
Don Det. Accommodation, activities, complete 19-field coverage, and provider telemetry remain unresolved.
Artifacts are under `data/reference/v5/experiments/017-numbeo-search-broad-panel/`.

## Experiment 018 — 30-city Numbeo search validation (31 July 2026)

Thirty independent delegated GPT-5.6 Luna-class invocations used the unchanged Experiment 016 prompt:
20 development cities and 10 locked holdout cities. Development returned **100/100 cells** and 20/20
complete cities. The holdout returned **44/50 cells** and 8/10 complete cities: Helsinki's beer query was
`not_found`, and Kyoto returned no exact city page for any of five queries. Overall coverage was **144/150
cells (96%)** and **28/30 complete cities (93.3%)**. Failures remained explicit missing outcomes.

The calls issued 150 restricted queries and 60 search operations, with zero direct page reads, fallback
sources, arithmetic, or cross-city evidence. Every accepted record contained exact city, row, central value,
currency, and canonical URL evidence in the search response. Nha Trang had five explicit `displayCurrency=USD`
records, and symbol-to-ISO context mappings were retained as provenance review items rather than hidden
conversions. Direct page verification was intentionally not part of this route.

Against retained definition- and currency-compatible observations, 139 rows across 28 cities had median
absolute error 0%, p90 7.14%, and maximum 16.88%; the 44 holdout rows had 0.54% median, 7.22% p90, and
16.67% maximum. These are source/date-drift audits, not 19-tier model accuracy. Exact provider model ID,
parameters, tokens, latency, and cost were not exposed by the delegated execution surface.

**Verdict:** promote the route for continued food/drink anchor work, but reject it as the complete pipeline.
The overall complete-city success rate is below the 95% gate, holdout coverage is 44/50, and accommodation,
activities, complete derivation, and provider telemetry remain unresolved. Artifacts are under
`data/reference/v5/experiments/018-numbeo-search-30-city/`.

## Experiment 019 — Numbeo edge-case repeatability (31 July 2026)

Fifteen fresh one-city GPT-5.6 Luna-class calls repeated Kyoto, Helsinki, Don Det, Nha Trang, and Beijing
three times each with the unchanged Experiment 016 prompt. Kyoto and Don Det were stable failures: 0/5 in
all three repeats. Nha Trang returned identical five-value USD-rendered results in all three runs, while
native VND alternatives were recorded and rejected rather than mixed. Beijing returned identical five-value
CNY results in all three runs; the `¥` symbol was mapped from explicit Beijing/China context without conversion.

Helsinki exposed query-provenance sensitivity. Repeat 1 followed Experiment 018's broad same-call policy and
counted 5/5 because a canonical beer row appeared in another query batch, although the dedicated beer query
did not return it. Repeats 2 and 3 enforced dedicated-query provenance and returned 3/5 and 4/5. Broad
coverage was 42/75 cells; normalizing the non-dedicated beer to `not_found` gives 41/75. The protocol
amendment and both scores are retained in the experiment artifacts; dedicated-query provenance is the
production recommendation.

The 15 calls issued 75 queries and 36 search operations, with zero direct reads, retries, fallback sources,
arithmetic, or cross-city evidence. Exact provider model ID, parameters, tokens, latency, and cost were not
exposed.

**Verdict:** repeatability is mixed. Keep Numbeo as a bounded ordinary-city food/drink candidate only with
dedicated-query provenance, native-currency checks, and fail-closed missingness. Do not average away Kyoto
or Don Det failures. Accommodation, activities, complete derivation, and provider telemetry remain open.
Artifacts are under `data/reference/v5/experiments/019-numbeo-repeatability-edge-cases/`.

## Experiment 020 — activity anchor search feasibility (31 July 2026)

Six independent one-city GPT-5.6 Luna-class calls issued exactly three targeted searches each for a standard
paid attraction, a 3–5 hour group activity, and a 6–10 hour premium activity. Strict coverage was **6/18
cells (33.3%)**, with only Hanoi complete. Copenhagen, Bangkok, and Lisbon supplied one low-cost attraction
ticket each; Hanoi supplied a museum ticket, a four-hour group tour, and an eight-hour premium organized tour;
San Francisco and Don Det supplied no qualifying cells. Lisbon's four-hour EUR41/person brochure result was
retained raw but normalized to `not_found` because shared/group status was not explicit.

The six calls issued 18 searches and 12 search operations, with zero direct reads, retries, fallback sources,
arithmetic, FX, or cross-city evidence. Six strict accepted facts carried city/activity identity, adult or
per-person basis, duration where required, central value, currency, and source URL. The Hanoi result is a
feasibility observation only; one city cannot fit or validate a cross-city activity model.

**Verdict:** promote official attraction-ticket sources for a larger activity panel. Keep half-day/full-day
activities fail-closed unless duration, adult basis, organized/group status, and a non-`from` price are
explicit. Do not infer all activity tiers from Hanoi or use nearby-city/package evidence. Accommodation,
complete food/drink derivation, provider telemetry, and the remaining methodology gates remain open. Artifacts
are under `data/reference/v5/experiments/020-activities-search-feasibility/`.

## Experiment 021 — accommodation class search feasibility (31 July 2026)

Six independent one-city GPT-5.6 Luna-class calls issued six search-only queries each for hostel dorm/private
and hotel 1–4-star city averages, deliberately avoiding direct pages and date injection. Only **7/36 cells
(19.4%)** were accepted and no city was complete: Copenhagen supplied a 3-star average; Lisbon supplied
2/3/4-star averages; San Francisco supplied a dorm average and 3/4-star averages; Hanoi, Bangkok, and Don
Det were 0/6. Hostel `From` prices, mixed hostel/guesthouse values, missing occupancy/per-room basis, generic
or wrong-city results, and event-specific prices were rejected.

The calls issued 36 queries and 17 search operations, with zero direct reads, retries, fallback sources,
arithmetic, FX, or cross-city evidence. Seven accepted observations carried exact city/class or occupancy,
nightly value, currency, and URL evidence. They come from heterogeneous source families and are feasibility
observations, not ground truth or fitted coefficients.

**Verdict:** reject the complete accommodation route. Retain KAYAK/Momondo/Booking/Budget Your Trip class-
average patterns only for a separately curated, definition-matched 30-city/10-holdout panel. Do not infer
hostel private rooms, 1-star, or missing classes from these seven facts. Artifacts are under
`data/reference/v5/experiments/021-accommodation-class-search-feasibility/`.

## Experiment 022 — bounded Numbeo identity cascade (31 July 2026)

Six independent one-city GPT-5.6 Luna-class calls used a canonical Numbeo query plus at most one different
city+country identity query per measure. The route returned **21/30 cells (70%)** and four complete cities:
Lisbon, Hanoi, Helsinki, and San Francisco. Kyoto recovered only domestic beer (1/5); Don Det remained 0/5
after ten searches. Hanoi's identity query recovered a canonical mid-range page after the first result was a
noncanonical ranking page; Helsinki's identity query recovered beer.

The six calls issued 30 canonical and 11 identity searches (41 total) and 12 search operations, with zero
direct reads, third queries, retries, fallback sources, arithmetic, FX, or cross-city evidence. All 21 accepted
facts contained exact city, row, central value, currency, and canonical URL evidence. No country-average or
nearest-city substitution was accepted.

**Verdict:** promote the fixed two-query identity cascade for ordinary food/drink cities with dedicated-query
provenance and fail-closed sparse missingness. It remains source-feasibility evidence, not independent price
accuracy or complete 19-field validation. Artifacts are under
`data/reference/v5/experiments/022-numbeo-identity-cascade/`.

## Experiment 023 — activity ground-truth audit (31 July 2026)

The deterministic audit `scripts/analyze-v5-activity-ground-truth.mjs` counted only accepted, direct,
definition-compatible rows in `data/reference/observations/*.jsonl`. It found 29 paid-attraction cities, 3
half-day group-activity cities, and 2 full-day premium-activity cities (34 rows across 31 cities). Only
Vancouver contains all three activity anchors. The accepted-direct ledger therefore cannot supply the frozen
30 matched-city and 10 locked-holdout gate for any material activity relationship.

**Verdict:** reject activity model fitting. Do not fit a ratio or impute timed activities from this ledger;
`activities_free = 0` remains definitional. Experiment 020 remains the separate target-model retrieval
feasibility result and is not ground truth. Read `data/reference/v5/experiments/023-activity-ground-truth-audit/`.

## Experiment 024 — strict accommodation panel (31 July 2026)

Three independent GPT-5.6 Luna-class one-city calls (Barcelona, Prague, and Nairobi) used the same six-class
search-only prompt. They issued 18 searches and 18 search operations with no direct reads, retries, fallback
sources, arithmetic, currency conversion, or cross-city evidence. Only **3/18 cells** passed: Barcelona and
Prague 3-star Skyscanner averages with explicit two-adult/one-room identity, and Nairobi's 4-star Skyscanner
average displayed in TRY with the same occupancy identity. No city was complete. Hostel dorm/private results
were per-bed, `from`, mixed, or missing two-adult identity; 1-star/2-star results lacked compatible
class/occupancy evidence. Nairobi's raw response omitted per-measure query fields, but its standalone
telemetry preserved the exact query list and the deterministic audit records that join.

**Verdict:** reject the strict six-class panel route; it cannot reach the 30-city/10-holdout gate. This is
target-model retrieval evidence, not ground truth or fitted accommodation coefficients. Revise the boundary
in the next experiment to accept an explicit one-bed dorm price as an observed input and scale it to two
travellers in deterministic code, while preserving strict per-room hotel identity and display-currency review.
Read `data/reference/v5/experiments/024-accommodation-ground-truth-panel/`.

## Experiment 025 — one-bed dorm boundary (31 July 2026)

Three paired GPT-5.6 Luna-class one-city calls repeated Barcelona, Prague, and Nairobi with the only changed
boundary being explicit one-adult dorm-bed prices. They issued 18 searches and 18 search operations with no
direct reads, retries, fallbacks, arithmetic, FX, or cross-city evidence. Coverage rose from **3/18 to 6/18**:
Barcelona dorm EUR15 per bed, Barcelona 3/4-star, Nairobi 3/4-star, and Prague 4-star. No city was complete;
private-hostel, 1-star, and 2-star classes remained unresolved. The dorm value is an observed one-bed input;
only deterministic code may multiply it by two. Barcelona 4-star was displayed in PLN and Nairobi values in
USD; source display currencies are retained and flagged for FX review.

**Verdict:** promote the one-bed dorm boundary for broader collection, but do not fit accommodation ratios or
call the route complete. Require 30 complete cities and 10 locked holdout cities with definition-matched
inputs. Read `data/reference/v5/experiments/025-accommodation-bed-boundary/`.

## Experiment 026 — broader accommodation panel (31 July 2026)

Three new independent GPT-5.6 Luna-class one-city calls (Lisbon, Hanoi, Copenhagen) reused the unchanged
Experiment 025 prompt. They issued 18 searches and 18 search operations with no direct reads, retries,
fallbacks, arithmetic, FX, or cross-city evidence. The tranche accepted **5/18 cells**: one explicit dorm bed
in each city, plus Copenhagen 3-star and 4-star. Lisbon and Hanoi supplied no qualifying hotel class rows;
private hostel, 1-star, and 2-star remained missing in all three cities. No city was complete.

**Verdict:** retain the one-bed dorm boundary, but reject complete accommodation coverage and pivot the
hotel-class occupancy/source hypothesis. These are retrieval-feasibility rows, not ground truth or fitted
coefficients. Copenhagen's non-local display currencies remain source facts and require deterministic FX
review. Read `data/reference/v5/experiments/026-accommodation-broader-panel/`.

## Experiment 027 — HOTEVI grouped hotel tiers (31 July 2026)

Three independent GPT-5.6 Luna-class one-city calls issued three HOTEVI-restricted searches each. There were
nine searches and nine search operations, with no page reads, retries, fallbacks, arithmetic, FX, or cross-city
evidence. Only Hanoi returned all three exact grouped rows (Budget 1–2 star $30, Mid-Range 3 star $65, Luxury
4–5 star $150, July 2026). Lisbon lacked a visible row month/date and Copenhagen lacked exact city rows, for
3/9 strict coverage. The accepted Hanoi rows have unknown occupancy basis and are grouped tiers, not product
star observations.

**Verdict:** reject HOTEVI as a production accommodation source; retain it only as a calibration benchmark
candidate. Do not map grouped tiers to `accom_1_star`–`accom_4_star` or treat them as two-adult evidence.
Read `data/reference/v5/experiments/027-hotevi-tier-feasibility/`.

## Experiment 028 — Expedia class trends (31 July 2026)

Three independent GPT-5.6 Luna-class one-city calls tested four Expedia class-trend searches each. Lisbon and
Hanoi each issued exactly four searches; Copenhagen repeated the identical batch, creating eight actual search
operations for four unique queries. The duplicate is recorded as a protocol deviation and not counted as
production-compliant. First-batch coverage was **7/12**: Lisbon 2/3/4-star, Hanoi 2/3/4-star, Copenhagen
3-star. No 1-star row and no complete city were found.

Accepted snippets explicitly state city/class, two-adult nightly trend basis, reference window, and taxes/fees
excluded. USD is normalized from Expedia.com dollar display and remains a source-locale inference for FX
review. **Verdict:** promote the 2–4-star route for broader testing, solve 1-star separately, and do not fit
accommodation models until the 30-city/10-holdout gate. Read `data/reference/v5/experiments/028-expedia-class-trends/`.

## Experiment 029 — broader Expedia class panel (31 July 2026)

Bangkok, San Francisco, and Nairobi each received one compliant four-query Expedia invocation. The tranche
issued 12 searches and 12 search operations with no reads, retries, fallbacks, arithmetic, FX, or cross-city
evidence. It accepted **8/12** cells: Bangkok 2/3/4-star, San Francisco 2/3/4-star, and Nairobi 3/4-star.
No 1-star row was found anywhere; Nairobi 2-star was also missing. No city was complete.

**Verdict:** promote 2–4-star Expedia for broader validation, but reject complete coverage and solve 1-star
separately. Across Experiments 028–029 this is six-city source feasibility only, not ground truth or fitted
accuracy. Read `data/reference/v5/experiments/029-expedia-class-panel/`.

## Experiment 030 — one-star source cascade (31 July 2026)

Three independent GPT-5.6 Luna-class one-city calls tested one Momondo and one KAYAK query each for Bangkok,
San Francisco, and Nairobi. Momondo returned one city-wide 1-star candidate in each city; KAYAK returned no
exact city-wide 1-star row. Coverage was **3/6** candidate cells. All accepted rows had `unknown` or
`source_default_room` occupancy, so none matched the frozen two-adult product estimand. No retries, reads,
arithmetic, FX, or cross-city evidence were used.

**Verdict:** retain Momondo rows as calibration candidates, reject them as product observations, and design a
definition-matched occupancy panel before any 1-star mapping or fit. Read
`data/reference/v5/experiments/030-one-star-source-cascade/`.

## Experiment 031 — one-star occupancy calibration (31 July 2026)

Three independent one-city GPT-5.6 Luna-class calls tested Momondo, Skyscanner, and Expedia for Bangkok, San
Francisco, and Nairobi. All nine bounded searches were protocol-compliant. Only two cells passed strict source
validation, both Momondo source-default-room rows (Nairobi USD243 and San Francisco USD54). No Skyscanner or
Expedia result supplied an exact city-wide 1-star row with explicit two-adult/one-room occupancy, so explicit
calibration coverage was **0/9** and no matched city existed.

**Verdict:** reject this occupancy-calibration route; retain the two Momondo rows as unresolved evidence only.
Do not fit a correction or map a value to `accom_1_star`. Test a different direct one-star source or an
independently curated two-adult property panel. Read
`data/reference/v5/experiments/031-one-star-occupancy-calibration/`.

## Experiment 032 — explicit one-star property basket (31 July 2026)

Barcelona, Prague, and Nairobi each received one compliant one-city call with four bounded source searches
(Booking.com, Hotels.com, Trip.com, Agoda). Across 12 searches, **zero** named property quotes passed the joint
1-star, explicit-two-adult/one-room, non-`from`, exact-city, date-aware contract. The sources exposed occupancy
without class, class without occupancy, or `from`/range prices. No reads, retries, arithmetic, FX, averaging, or
cross-city evidence were used.

**Verdict:** reject the property-basket route; no basket statistic or `accom_1_star` value is produced. Pivot to
a different source or separately curated ground truth. Read
`data/reference/v5/experiments/032-one-star-property-basket/`.

## Experiment 033 — one-star aggregator sources (31 July 2026)

Three independent one-city Luna calls tested Trip.com, HotelsCombined, and Budget Your Trip for Lisbon,
Barcelona, and Hanoi. Eight of nine strict city/class/date-aware cells passed; no call used reads, retries,
fallbacks, arithmetic, FX, averaging, or cross-city evidence. All eight rows had `source_default_room` or
`unknown` occupancy, so explicit two-adult coverage was **0/9**. Cross-source values diverged materially (Lisbon
USD101–207; Hanoi USD24–53), and Barcelona's Budget Your Trip row reported zero hotels.

**Verdict:** promote these aggregators as calibration candidates only; reject product mapping and fitting until
occupancy and held-out city-level accuracy are demonstrated. Read
`data/reference/v5/experiments/033-one-star-aggregators/`.

## Experiment 034 — one-star aggregator panel (31 July 2026)

Ten independent one-city Luna calls tested the pre-registered seven development cities and three locked
holdouts. Each issued exactly three restricted searches; 30 searches/operations were protocol-compliant with no
reads, retries, fallback, arithmetic, FX, averaging, or cross-city evidence. Strict coverage was **12/30 (40%)**,
only Tokyo was complete, development coverage was 10/21, and holdout coverage was 2/9. All rows had
source-default/unknown occupancy. Budget Your Trip returned 9/10 rows, but Helsinki had zero hotels and Nairobi
one hotel; Trip.com/HotelsCombined were sparse.

**Verdict:** reject the complete source-agreement panel; retain Budget Your Trip only as a guarded fallback/
calibration candidate with minimum-sample and zero-denominator checks. No `accom_1_star` mapping or fit is
promoted. Read `data/reference/v5/experiments/034-one-star-aggregator-panel/`.

## Experiment 035 — Budget Your Trip activity spend (31 July 2026)

Three independent one-city Luna calls tested BudgetYourTrip for Lisbon, Hanoi, and Copenhagen. Each issued
exactly two restricted searches; all six searches/operations were compliant with no reads, retries, fallback,
arithmetic, FX, averaging, or cross-city evidence. All **12/12** rows passed: a per-person/day activity average
and budget, mid-range, and luxury entertainment rows for every city. Every basis was explicitly one person/day.

**Verdict:** promote the source contract to a broader validation panel. Keep `activities_free = 0` definitional;
do not yet scale to two people or map entertainment tiers to product values. Read
`data/reference/v5/experiments/035-activity-budgetyourtrip/`.

## Experiment 036 — activity Budget Your Trip panel (31 July 2026)

Ten independent one-city Luna calls covered seven development cities and three locked holdouts. Each issued
exactly two BudgetYourTrip-restricted searches; all 20 searches/operations were compliant. Strict coverage was
**40/40**, with every city complete and all rows explicitly one-person/day. No reads, retries, fallback, scaling,
arithmetic, FX, averaging, or cross-city evidence were used.

**Verdict:** promote the source contract to a methodology candidate. Keep `activities_free = 0` definitional and
apply two-person scaling only in deterministic code; independent tier semantics, date drift, and held-out accuracy
remain acceptance gates. Read `data/reference/v5/experiments/036-activity-budgetyourtrip-panel/`.

## Experiment 037 — definition-matched activity anchors (31 July 2026)

Three independent one-city Luna calls tested BudgetYourTrip for Lisbon, Hanoi, and Copenhagen with exactly three
restricted searches each. All nine searches/operations were compliant. Zero of nine rows matched the frozen
activity definitions: ticket candidates lacked adult/two-person basis, half-day group rows were absent, and
full-day private tours had unspecified group size or incompatible duration. No reads, retries, fallback,
arithmetic, FX, averaging, or cross-city evidence were used.

**Verdict:** reject BudgetYourTrip for definition-matched activity anchors. Preserve the generic entertainment
source as a separate candidate only; do not weaken party/duration gates or map it to the current activity tiers.
Read `data/reference/v5/experiments/037-activity-definition-matched/`.

## Experiment 038 — one-star BudgetYourTrip broad panel (31 July 2026)

Twenty independent one-city Luna calls each issued exactly one BudgetYourTrip-restricted search. All 20
searches/operations were compliant with no reads, retries, fallback, arithmetic, FX, or cross-city evidence.
Strict coverage was **17/20**: Buenos Aires and Taipei failed closed, and Paris was blocked by a truncated result
without retry. All accepted rows had unknown/source-default occupancy; explicit two-adult coverage was **0**.

Manila (n=2) and Mumbai (n=3) are tiny-sample warnings. Multiple BudgetYourTrip page families also expose
conflicting values for some cities; alternatives were rejected rather than averaged.

**Verdict:** retain BudgetYourTrip only as a guarded imputation/fallback candidate with zero-denominator,
minimum-sample, page-family, provenance, and uncertainty checks. Do not treat it as observed `accom_1_star` or
fit a correction. Read `data/reference/v5/experiments/038-one-star-budgetyourtrip-panel/`.

## Experiment 039 — hostel dorm/private boundary (31 July 2026)

Six independent one-city Luna calls issued exactly two targeted source searches each. All 12 search operations
were compliant with no page reads, retries, fallback sources, arithmetic, FX conversion, or cross-city evidence.
The dorm input was found in **6/6** cities as an exact city-level central one-adult-bed statistic. The private
hostel-room measure passed the strict two-adult/two-guest occupancy contract in **0/6** cities.

**Verdict:** retain the dorm-bed observation boundary for deterministic two-traveller scaling, but reject the
private-room route as a production anchor or fitted correction. Unknown-occupancy private-room numbers remain
source evidence only. Read `data/reference/v5/experiments/039-hostel-private-boundary/`.

## Experiment 040 — explicit private-hostel two-guest search (31 July 2026)

Six independent one-city Luna calls issued exactly two ordered searches each: Hostelworld followed by
Booking.com. All 12 search operations were compliant with no reads, retries, fallback sources, arithmetic, FX
conversion, or cross-city evidence. Three cities passed the strict two-adult/two-guest contract (London, Lisbon,
and Hanoi); three failed closed (Melbourne, New York City, and Tokyo).

The accepted rows are dated named-property quotes, not city averages. They preserve source currency, dates,
tax/fee exclusions, occupancy, and property identity. **Verdict:** promote the route only as an independent
property-panel/ground-truth candidate; reject direct city-wide mapping and any correction fit until a broader
city-stratified panel and aggregation rule pass the 30-city/10-holdout accuracy gates. Read
`data/reference/v5/experiments/040-private-two-guest-search/`.

## Experiment 041 — paired one-star source/calibration search (31 July 2026)

Six independent one-city Luna calls issued exactly three ordered searches each: BudgetYourTrip, Booking.com,
and Hotels.com. All 18 searches/operations were compliant with no reads, retries, fallback sources, arithmetic,
FX conversion, averaging, or cross-city evidence. Five cities returned an exact-city BudgetYourTrip one-star
statistic; New York City failed on a zero-hotels result. No city returned an explicit two-adult one-star quote,
so paired calibration coverage was **0/6**.

**Verdict:** reject the paired occupancy-calibration route. Retain compatible BudgetYourTrip statistics only as
guarded source evidence; Tokyo's testing-subdomain result and Rome's conflicting page families carry explicit
provenance warnings. Do not map source-default rows to `accom_1_star` or fit a correction. Read
`data/reference/v5/experiments/041-one-star-paired-calibration/`.

## Experiment 042 — registry-class plus explicit two-adult property quotes (1 August 2026)

Three independent one-city Luna calls used frozen official-register one-star manifests for Barcelona, Lisbon,
and Da Nang, with exactly one ordered property search for each of nine listed properties. All nine searches were
compliant with no reads, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.
Only one strict quote survived: Lisbon's Hotel LX ROSSIO at EUR63/night for two guests with taxes included. The
quote has an address discrepancy against the frozen register and remains a guarded identity-review candidate.

**Verdict:** reject the registry join as a productive one-star panel (1/9 strict quotes; 0/3 cities meeting the
two-quote threshold). Do not compute a basket or map the quote to `accom_1_star`; preserve the class evidence,
tax failure, and property-identity failure reasons. Read
`data/reference/v5/experiments/042-registry-class-property-quotes/`.

## Experiment 043 — Google Hotels one-star property search (1 August 2026)

Six independent one-city Luna calls issued exactly three Google-Hotels-restricted searches each. All 18
searches/operations were compliant with no reads, retries, fallback sources, arithmetic, FX conversion, averaging,
or cross-city evidence. Only Cape Town produced a strict quote: Road Lodge Cape Town International Airport,
USD63 all-in for one night, exact one-star class, and explicit two-adult occupancy. The other five cities failed
on class, identity, occupancy, or tax/price evidence.

**Verdict:** reject Google Hotels as a productive one-star panel (1/6 strict quotes); retain Cape Town only as
independent ground-truth candidate evidence. Do not map it to `accom_1_star` or fit a correction. Read
`data/reference/v5/experiments/043-google-hotels-one-star/`.

## Experiment 045 — Trip.com activity-definition route (1 August 2026)

Six independent single-city Luna-class contexts (Lisbon, Hanoi, Bangkok, Cape Town, Barcelona, and New York
City) issued exactly three ordered Trip.com-restricted searches each: 18 searches total. No page reads, retries,
fallback sources, arithmetic, FX conversion, aggregation, or cross-city evidence occurred. The strict contract
accepted **0/18 cells**: budget 0/6, mid-range 0/6, and high-end 0/6.

Most results exposed lowest/“From” prices. Remaining failures lacked tax status, explicit adult/party basis,
compatible duration, or premium status. No row is ground truth, and no value was scaled, averaged, or mapped to a
product tier.

**Verdict:** reject Trip.com as a production source route for the frozen activity definitions. Preserve the raw
failure reasons and URLs as source-feasibility evidence only. A materially different retrieval contract would
require a new pre-registered panel. Read `data/reference/v5/experiments/045-trip-activity-definitions/`.

## Experiment 044 — operator activity-source route (1 August 2026)

Six independent single-city Luna-class contexts (Lisbon, Hanoi, Bangkok, Cape Town, Barcelona, and New York
City) issued exactly three ordered searches each: GetYourGuide ticket, Viator half-day group, and GetYourGuide
full-day premium (18 searches total). No page reads, retries, fallback sources, arithmetic, FX conversion,
averaging, or cross-city evidence occurred. Strict coverage was **0/18**: budget 0/6, mid-range 0/6, and high-end
0/6.

“From”/lowest prices and variable group pricing dominated. Other failures included tour-versus-ticket mismatch,
unknown taxes, incomplete or incompatible duration, and missing adult/premium/package basis.

**Verdict:** reject this GetYourGuide/Viator route for the frozen activity definitions. Preserve raw failure
evidence only; no activity value is observed, scaled, averaged, or mapped. Read
`data/reference/v5/experiments/044-activity-operator-sources/`.

## Experiment 046 — official activity pages (1 August 2026)

Six independent single-city Luna-class contexts (Lisbon, Hanoi, Bangkok, Cape Town, Barcelona, and New York
City) issued exactly three ordered searches each for an official attraction ticket, official half-day group
activity, and official full-day premium activity (18 searches total). No page reads, retries, marketplace fallbacks,
arithmetic, FX conversion, averaging, or cross-city evidence occurred.

Strict compatible coverage was **0/18**: budget 0/6, mid-range 0/6, and high-end 0/6. Bangkok and Cape Town each
had an otherwise compatible budget ticket, but tax treatment was unknown; all other cells failed on tax, adult or
party basis, duration, premium status, or numeric price. Unknown-tax rows remain rejected evidence and are not
observed inputs.

**Verdict:** reject the official-page route as a complete production activity source. A future tax-resolved
budget-only test would require a new pre-registered experiment. Read
`data/reference/v5/experiments/046-official-activity-pages/`.

## Experiment 047 — accommodation property panel (1 August 2026)

Six independent single-city Luna-class contexts (Berlin, Rome, Madrid, Paris, Tokyo, and Mexico City) issued
exactly four ordered searches each: Hostelworld private room, Booking private room, Google Hotels one-star, and
Hotels.com one-star (24 searches total). No page reads, retries, arithmetic, FX conversion, averaging, or
cross-city evidence occurred.

Strict explicit-two-adult, named-property, non-`from`, tax-resolved quotes were **3/6 for private hostels**
(Berlin, Mexico City, Tokyo) and **1/6 for one-star hotels** (Tokyo). The private route meets its 3/6 promotion
gate only as property-level ground-truth collection; one-star coverage fails.

**Verdict:** promote the private-hostel route to a broader property panel, with a separately declared property
selection and aggregation rule before any city mapping. Reject the one-star route for now. No product values were
mapped. Read `data/reference/v5/experiments/047-accommodation-property-panel/`.

## Experiment 048 — broad private-hostel property panel (1 August 2026)

Twelve independent single-city Luna-class contexts issued exactly two ordered searches each (Hostelworld then
Booking.com), 24 searches total. No page reads, retries, arithmetic, FX conversion, averaging, or cross-city
evidence occurred.

Strict explicit-two-adult, named-hostel, non-`from`, one-night, tax-resolved quotes passed in **4/12** cities:
Nairobi, Prague, Seoul, and Sydney. The pre-registered 6/12 promotion gate failed. Rejections included
members-only/login prices, multi-night totals, nearby-city results, capsule rather than room classes, unknown tax,
and `from` prices.

**Verdict:** do not promote the private-hostel route to aggregation or product mapping. Preserve the four accepted
property-level ground-truth candidates and the failure reasons. Read
`data/reference/v5/experiments/048-private-hostel-broad-panel/`.

## Experiment 049 — broad one-star property panel (1 August 2026)

Twelve independent single-city Luna-class contexts issued exactly three ordered searches each (Google Hotels,
Expedia, Hotels.com), 36 searches total. No page reads, retries, arithmetic, FX conversion, averaging, or
cross-city evidence occurred.

Strict explicit-one-star, two-adult, non-`from`, nightly, tax-resolved quotes passed in **1/12** cities (Amsterdam).
The pre-registered 6/12 promotion gate failed. Other rows failed on absent occupancy, wrong star class, from/lowest
prices, missing tax treatment, or no numeric nightly quote.

**Verdict:** reject the broad one-star route. Preserve Amsterdam as a ground-truth candidate only; do not map or
fit `accom_1_star`. Read `data/reference/v5/experiments/049-one-star-broad-panel/`.

## Experiment 050 — tax-resolved official activity ticket (1 August 2026)

Six independent single-city Luna-class contexts issued exactly one targeted search each (six searches total), with
no page reads, retries, fallback sources, arithmetic, FX conversion, or cross-city evidence. Strict tax-resolved
adult-ticket coverage was **2/6**: Bangkok (SeaLife Bangkok via Expedia, taxes/fees included) and Lisbon (Oceanário
de Lisboa first-party brochure, VAT included). Four cities failed on unknown tax, from/starting prices, absent
numeric adult prices, or bundles.

**Verdict:** reject the 4/6 promotion gate. Retain Bangkok and Lisbon as direct one-person ticket candidates only;
do not map `activities_budget` or claim complete production coverage. Read
`data/reference/v5/experiments/050-tax-resolved-activity-ticket/`.
