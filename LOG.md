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
