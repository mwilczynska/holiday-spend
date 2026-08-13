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

Six methodology versions have been attempted. **v1 is what still ships.** v3 and v5 were abandoned. v4 is
researched but not integrated. **v6 is the active workstream** — see [PLAN.md](PLAN.md).

| Version | Approach | Status | Verdict |
| --- | --- | --- | --- |
| v1 | LLM recalls 10 anchors, asserted multipliers derive 19 tiers | **In production** | Structurally defective but not disproven |
| v2.1 | v1 plus hybrid/Xotelo accommodation lookup | Removed | Code deleted; only the doc baseline remains |
| v3 | Observed-first: direct source-attributed observation of every measure | **Abandoned** 25–27 Jul 2026 | Stalled at 22.8% coverage, zero complete cities |
| v4 | Measure price *level* cheaply, model tier *structure* | **Research complete, unintegrated** | 18–22% median APE; accommodation level unresolved |
| v5 | Definition-matched one-call collection with per-relationship sample gates | **Closed** 9 Aug 2026 | 95 experiments, zero product mappings; acceptance rule unsatisfiable from public sources |
| v6 | v4's principle, executed: measure one level per category, ladder the rest, grade every value | **Active** | M0 complete; ladder fitted at 11.4% / 13.0% LOO |

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

## v4 — Measure level, model structure (never integrated; its principle survives into v6)

**Status: research complete, app integration not started. Its governing principle and its fitted ratios
are reused directly by v6.**

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

## v5 — Definition-matched one-call collection (closed 9 August 2026)

**Status: closed after 95 experiments and zero product mappings.** All evidence retained under
`data/reference/v5/`; every experiment verdict remains an accurate statement about its source.

### What it required

One user-initiated request to a cheap web-enabled model, producing all 19 values, where every observation
carried explicit occupancy, tax basis, class, currency, reference period and a non-`from` price *in the
same evidence*, and every modelled relationship was fitted on ≥30 matched cities plus 10 locked holdouts.
Shipping was forbidden until those gates passed.

### What it produced

| Category | Experiments | Result |
| --- | --- | --- |
| Accommodation | **61 of 95** | No field mapped. 15 of those targeted `accom_1_star` alone (~150 city-calls) and produced **zero** usable rows |
| Activities | 13 | No field mapped; no definition-matched source found in 6 source families |
| Food / drink | 11 | Route promoted at 96% cell coverage, never mapped |
| Infrastructure / audit | 10 | Derivation contract built and retained |

### Why it could not terminate

Five independent mechanisms, documented in full in `docs/dev/plans/city-cost-methodology-v6.md` §1:

1. **The estimand demanded metadata commercial sources do not publish.** Eight facts co-occurring in one
   snippet. Experiment 052 is the clean case — 0/12 strict, with most candidates having class, price and
   tax but no explicit one-room occupancy. The price was on the page; the label was not.
2. **The sample-size gate was unreachable.** Eleven Expedia panels (~130 city-calls) reached 18 matched
   2↔3 cities and 26 matched 3↔4, then flatlined — the last four panels added zero new 2↔3 pairs.
3. **The accuracy that gate protected was already achieved.** See below.
4. **Fail-closed was wired to the product, not the label.** No route achieved complete coverage, so
   `complete` was false for every city and nothing shipped — leaving the known-defective v1 path live.
5. **The one-call constraint** saved ~A$10 per full refresh and in exchange forbade category
   specialisation, retry-on-block and second samples.

The proximate cause was `LOOP-PROMPT.md` (now `docs/dev/archive/loop-prompt-v5.md`), which forbade
shipping before the gates passed, forbade stopping before the Definition of Done, and forbade banking a
working category while a harder one remained — mathematically an infinite loop.

### The finding that ended it

Pooling v5's own Expedia evidence and scoring R0 leave-one-out at city level:

| Relation | Matched cities | Coefficient | LOO median APE | p90 | v4's independent Booking.com fit | Agreement |
| --- | --- | --- | --- | --- | --- | --- |
| `accom_2_star ← accom_3_star` | 18 | 0.7500 | **11.37%** | 24.63% | 0.7341 (n=16) | 2.17% |
| `accom_4_star ← accom_3_star` | 26 | 1.3372 | **12.98%** | 27.18% | 1.2972 (n=16) | 3.08% |

Two independent sources, different estimators, different years, largely different city samples — agreeing
to within 2–3%, at roughly half the error the v5 gate allowed. **v5 rejected this fit eleven times for
having fewer than 30 matched cities.** The sample-size gate was a proxy for "does this generalise?", and
cross-source replication answers that better than a larger single-source sample would.

Reproduce: `node scripts/fit-city-cost-ladder-v6.mjs`.

### What v5 leaves behind, and it is a lot

| Asset | Location | Reused by v6 as |
| --- | --- | --- |
| Numbeo food/drink route | Exp 016–019, 022 | Spine call A — 144/150 cells, 28/30 complete cities |
| Expedia class-trend route | Exp 028–088 | Spine call B **and** the fitted ladder — 101 rows / 51 cities |
| BudgetYourTrip activity route | Exp 035, 036, 080, 081 | Spine call C — 28/30 cities, 0% repeat dispersion |
| Expatistan drink route | Exp 091, 092 | Optional spine call D |
| Price of Travel dorm index | Exp 072 | Dorm ratio (2023 window, stale) |
| Derivation function | `src/lib/city-cost-methodology-v5.ts` | **Unchanged** — the v6 derivation core |
| Data dictionary | `v5/data-dictionary-v5.md` | Estimands unchanged in v6 |
| Experiment protocol | pre-registration, deterministic scoring, one verdict | Carried forward unchanged |

**The lesson, recorded as trap 8:** an unreachable gate is a defect in the gate, not a reason to collect
more. Measure whether a gate has ever been passed by anything before spending another experiment on it.

---

## v6 — The ladder, shipped and graded (active)

**Status: adopted 9 August 2026. M0 complete; M1 (integrate) is next.**

Not a new research programme. v6 is v4's principle — *measure what is cheap to measure, model only the
gaps, never assert a constant* — finally executed, using v5's collected evidence, with an acceptance rule
that can be satisfied.

Measure one level per category (Numbeo food/drink, Expedia 3-star, BudgetYourTrip activities), derive the
rest from fitted ratios, grade every value **A** observed / **B** source proxy / **C** laddered /
**D** regional prior, attach an interval, and ship. Integrate first, improve grades after.

Gates move from per-relationship sample size to product outcomes: city ranking (Spearman ρ ≥0.90), trip
total (±20%), and — the gate v5 never had — **beat the shipping v1 dataset**.

Current documents: `docs/dev/plans/city-cost-methodology-v6.md`, `docs/dev/handoffs/city-cost-v6.md`,
`LOOP-PROMPT-V6.md`, `data/reference/v6/`.

Results will be appended here as milestones complete.

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

## Experiment 051 — one-city minimal anchor panel (1 August 2026)

Six independent single-city Luna-class contexts issued exactly four ordered searches each (24 searches total),
with six returned-current-city page reads, no retries, arithmetic, FX conversion, averaging, or cross-city evidence.
The nine-anchor contract returned no complete city. Non-sparse coverage ranged from 5/9 to 8/9; Don Det returned
0/9.

Across the panel, food/drink anchors reached 4–5/6 and paid attractions 5/6, while three-star hotel coverage was
0/6, dorm 2/6, and private hostel 1/6. **Verdict:** reject promotion as a complete source boundary; retain
food/drink and attraction source patterns, but do not hide accommodation, hotel-class, or sparse-city gaps.
Read `data/reference/v5/experiments/051-minimal-anchor-panel/`.

## Experiment 052 - broad three-star property panel (1 August 2026)

Twelve independent single-city Luna-class contexts (Amsterdam, Prague, Copenhagen, Dublin, Vienna, Budapest,
Istanbul, Seoul, Sydney, Vancouver, Nairobi, and Buenos Aires) issued exactly three ordered searches each:
Google Hotels, Expedia, and Booking.com (36 searches total). No page reads, retries, arithmetic, FX conversion,
averaging, or cross-city evidence occurred.

Strict explicit-three-star, two-adult, one-room, non-from, nightly, tax-resolved quotes passed in **0/12**
cities, below the pre-registered 6/12 promotion gate. Most candidates contained an exact class, price, and tax
but did not explicitly establish one room; other failures were from prices, generic averages, wrong classes,
nearby cities, or absent class labels.

**Verdict:** reject the broad three-star property route. Do not map `accom_3_star`, aggregate properties, or infer
one-room occupancy from a two-adult selector. A relaxed occupancy interpretation would change the estimand and
requires a new pre-registered experiment with independent accuracy validation. Read
`data/reference/v5/experiments/052-three-star-broad-panel/`.

## Experiment 053 - selector-based occupancy semantic audit (1 August 2026)

Twelve independent single-city Luna-class contexts issued exactly three ordered searches each (Google Hotels,
Expedia, Booking.com; 36 searches total). No page reads, retries, arithmetic, FX conversion, averaging, fallback
sources, or cross-city evidence occurred.

Strict explicit-one-room coverage was **0/12**. The pre-registered selector-relaxed hypothesis (exact named
three-star property, explicit two-adult one-night selector, numeric non-from nightly price, known tax, and no
multi-room/per-person/suite signal) reached **7/12**. The 8/12 promotion gate failed, although the requirement
for at least six strict failures attributable solely to omitted room wording was met (7/12).

**Verdict:** reject promotion. The seven relaxed rows remain semantic hypotheses, not observed two-person room
prices. Do not map `accom_3_star`, fit a correction, or infer one room. Any future change requires a dated
estimand decision and a new 30-city/10-holdout explicit-room validation panel. Read
`data/reference/v5/experiments/053-selector-occupancy-audit/`.

## Experiment 054 - model-fit adequacy audit (1 August 2026)

The deterministic audit scanned 176 accepted direct rows in `data/reference/observations/*.jsonl` and tested six
pre-registered relationships without fitting a model. The canonical ledger contains one direct 4-star city and no
direct 1-star, 2-star, or 3-star class rows; no private-hostel/dorm pair; and only one matched city for each
definition-compatible half-day-from-attraction and full-day-from-attraction relationship.

All six relationships failed the 30 matched-city plus 10 locked-holdout gate. **Verdict:** reject model fitting for
this evidence boundary. No coefficient, correction, or product mapping was created. Food/drink primitives and
paid-attraction rows remain useful direct inputs for deterministic baskets, but they do not validate accommodation
or activity tier models. Read `data/reference/v5/experiments/054-model-fit-adequacy/`.

## Experiment 055 - Skyscanner hotel-class average panel (1 August 2026)

Twelve independent single-city Luna-class contexts issued exactly four ordered searches each for Skyscanner 1-,
2-, 3-, and 4-star class pages (48 searches total). No page reads, retries, arithmetic, FX conversion, averaging,
fallback sources, or cross-city evidence occurred.

Strict coverage was **0/48**: 1-star 0/12, 2-star 0/12, 3-star 0/12, and 4-star 0/12; no city was complete.
Several 3-/4-star snippets had exact city/class, explicit two-adult/one-room selectors, and numeric averages, but
tax treatment was unknown or currency/class evidence was malformed. Lower classes were absent or ambiguous, not
positively established as class absence.

**Verdict:** reject the Skyscanner class-average route under the frozen contract. Do not map, aggregate, or fit from
these snippets. A materially different tax or price-statistic estimand requires a new pre-registered experiment.
Read `data/reference/v5/experiments/055-skyscanner-class-panel/`.

## Experiment 056 - Agoda one-/three-star class panel (1 August 2026)

Twelve independent single-city Luna-class contexts issued exactly two ordered searches each (Agoda 1-star then
3-star; 24 searches total). No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or
cross-city evidence occurred.

Strict coverage was **0/24**: one-star 0/12 and three-star 0/12; no city was complete. Agoda exposed some class or
maximum-occupancy facts, but selected dates were required before a numeric nightly price, explicit one-room basis,
and tax treatment appeared.

**Verdict:** reject the Agoda route under the frozen contract. Do not map or fit from these results; a different
retrieval shape or estimand requires a new pre-registration. Read
`data/reference/v5/experiments/056-agoda-one-three-star-panel/`.

## Experiment 057 - Booking class-average tax panel (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly two ordered Booking searches each
(3-star then 4-star; 24 searches total). No page reads, retries, arithmetic, FX conversion, averaging, fallback
sources, or cross-city evidence occurred. Strict coverage was **0/24**: 3-star 0/12 and 4-star 0/12, with no
complete city.

Some Booking class pages exposed an exact city/class, a current numeric average, and sometimes a two-adult/one-room
selector, but the same evidence did not state whether tax or fees were included. Other rows lacked a class average,
had a wrong city/class, or lacked same-evidence occupancy. **Verdict:** reject the Booking class-average route
under the frozen contract. Do not map 3- or 4-star prices, infer tax treatment, or fit a class ratio from these
rows. Read `data/reference/v5/experiments/057-booking-class-tax-panel/`.


## Experiment 058 - Trip.com hotel-class tax panel (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly three ordered Trip.com searches each
(star-2, star-3, star-4; 36 searches total). No page reads, retries, arithmetic, FX conversion, averaging, fallback
sources, or cross-city evidence occurred. Strict coverage was **0/36**: 2-star 0/12, 3-star 0/12, and 4-star
0/12, with no complete city.

Trip.com often exposed exact class pages and weekday/weekend averages, but the same evidence did not establish
explicit two-adult/one-room occupancy and tax/fee treatment. Other results were from prices, localized/stale
displays, or lacked a numeric class average. **Verdict:** reject the Trip.com class-page route under the frozen
contract. Do not map 2-/3-/4-star prices, infer occupancy/tax basis, or fit a class ratio. Read
`data/reference/v5/experiments/058-trip-class-tax-panel/`.

## Experiment 059 - Expedia two-adult class-trend panel (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly three ordered Expedia searches each
(2-star, 3-star, 4-star; 36 searches total). No page reads, retries, arithmetic, FX conversion, averaging, fallback
sources, or cross-city evidence occurred.

Strict coverage was **27/36**: 2-star 9/12, 3-star 11/12, and 4-star 7/12. Six cities were complete, but the
pre-registered 4-star 8/12 gate failed by one row. All accepted rows explicitly state two-adult nightly base-rate
trends with taxes/fees excluded. **Verdict:** near-pass; retain Expedia as the strongest source candidate, run a
targeted 4-star gap panel, and do not map or fit yet. Read `data/reference/v5/experiments/059-expedia-class-panel/`.

## Experiment 060 - Expedia four-star gap panel (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly one ordered Expedia 4-star search each
(12 searches total). No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city
evidence occurred.

Strict coverage was **9/12** overall. Three of the five Experiment 059 misses recovered (Budapest, Sydney, Tokyo);
Buenos Aires, Cape Town, and Warsaw remained not-found. All accepted rows explicitly state two-adult nightly
base-rate trends with taxes/fees excluded. The overall 8/12 gate passed, but the pre-registered recovery gate was
4/5 and failed. **Verdict:** reject coverage-repair promotion, retain Expedia as a source candidate, and continue
a new-city paired panel. Read `data/reference/v5/experiments/060-expedia-four-star-gap-panel/`.

## Experiment 061 - Expedia paired 2-/3-/4-star panel (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly three ordered Expedia searches each
(2-star, 3-star, 4-star; 36 searches total). No page reads, retries, arithmetic, FX conversion, averaging, fallback
sources, or cross-city evidence occurred.

Strict coverage was **26/36**: 2-star 8/12, 3-star 8/12, and 4-star 10/12. Only five cities were complete, below
the 6/12 promotion gate. All accepted rows explicitly state two-adult nightly base-rate trends with taxes/fees
excluded. **Verdict:** reject promotion, retain paired evidence, and run a 3-star gap panel; no mapping or fitting.
Read `data/reference/v5/experiments/061-expedia-paired-panel/`.

## Experiment 062 - Expedia three-star gap panel (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly one ordered Expedia 3-star search each
(12 searches total). No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city
evidence occurred.

Strict coverage was **4/12** overall (Athens, Ho Chi Minh City, Manila, Zurich), with **0/4** recovery among the
Experiment 061 misses. Generic all-hotel trends, district-only pages, and missing exact class trends were rejected.
**Verdict:** reject the coverage-repair gate, retain four strict rows, and reassess the pooled Expedia boundary; no
mapping or fitting. Read `data/reference/v5/experiments/062-expedia-three-star-gap-panel/`.

## Experiment 063 - Expedia paired 2-/3-/4-star panel, tranche 2 (1 August 2026)

Twelve entirely new single-city GPT-5.6 Luna-class contexts issued exactly three ordered Expedia searches each
(2-star, 3-star, 4-star; 36 searches total). No page reads, retries, arithmetic, FX conversion, averaging, fallback
sources, or cross-city evidence occurred.

Strict coverage was **15/36**: 2-star 2/12, 3-star 7/12, and 4-star 6/12. Only Chicago was complete. Accepted
rows explicitly state two-adult nightly base-rate trends with taxes/fees excluded; generic, district, class-missing,
and truncated responses were rejected. **Verdict:** reject the paired gate, retain rows for a pooled ceiling audit,
and do not map or fit. Read `data/reference/v5/experiments/063-expedia-paired-panel-2/`.

## Experiment 064 - Expedia pooled evidence ceiling audit (1 August 2026)

The deterministic audit pooled accepted rows from Experiments 028, 029, 059, 060, 061, and 063 without fitting.
It found **80 rows across 36 unique cities**, all explicitly tax-excluded: 1-star 0, 2-star 23, 3-star 30, and
4-star 27. Sixteen cities were complete for 2-/3-/4-star; 2↔3 matched cities numbered 20 and 3↔4 matched cities
22. Hostel/private and one-star relationships had zero eligible rows. **Verdict:** no relationship meets the
30-city plus 10-holdout gate; do not fit or map. Pivot the missing-class boundary and retain Expedia only as a
candidate 2-/3-/4-star source. Read `data/reference/v5/experiments/064-expedia-pooled-ceiling-audit/`.

## Experiment 065 - Expedia one-star/three-star paired panel (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly two ordered Expedia searches each
(1-star, then 3-star; 24 searches total). No page reads, retries, arithmetic, FX conversion, averaging, fallback
sources, or cross-city evidence occurred.

Strict coverage was **0/12 one-star** and **9/12 three-star**, with **zero complete paired cities**. Generic
all-hotel trends, district or nearby results, class-ambiguous snippets, and non-numeric exact-city results were
rejected. The nine accepted three-star rows explicitly state two-adult nightly base-rate trends with taxes/fees
excluded; no one-star row satisfied the frozen explicit class/occupancy/tax contract.

**Verdict:** reject promotion of the Expedia one-star route. Retain the nine three-star rows as source evidence only;
do not map or fit. A materially different one-star/hostel source or explicitly amended estimand requires a new
pre-registered validation panel. Read `data/reference/v5/experiments/065-expedia-one-star-paired-panel/`.

## Experiment 066 - BudgetYourTrip one-star semantic-basis audit (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly one BudgetYourTrip search and one
exact-city page read each (24 web operations total). No second search/read, retries, arithmetic, FX conversion,
averaging, fallback sources, or cross-city evidence occurred.

Strict coverage was **0/12 explicit two-person rows**. Eight exact-city pages exposed numeric one-star averages but
did not state row-level occupancy; four page reads were blocked or timed out. The numeric rows remain unvalidated
source-level proxy candidates and cannot be promoted to `accom_1_star` or used as model ground truth.

**Verdict:** reject BudgetYourTrip as a direct one-star source, but test a source-level
`source_defined_double_occupancy` convention separately. It requires independent explicit-two-adult calibration;
any resulting product value must be labelled `modelled`. Read `data/reference/v5/experiments/066-budgetyourtrip-one-star-semantics/`.

## Experiment 067 - BudgetYourTrip source-level double-occupancy proxy (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly two ordered searches and two page reads
each (24 searches and 24 reads total). No retries, fallback sources, arithmetic, FX conversion, averaging, or
cross-city evidence occurred; all twelve calls were protocol-compliant.

Only **1/12** cities (Cairo) joined an exact-city one-star numeric page with a same-source destination page explicitly
defining typical double occupancy. The screening gate required 8/12 proxy candidates. Other cities were blocked or
timed out, stale, class-absent, or lacked a joinable semantic page. **Verdict:** reject this proxy route at current
web-tool reliability. Retain Cairo as labelled proxy evidence only; do not map or fit. Read
`data/reference/v5/experiments/067-budgetyourtrip-double-occupancy-proxy/`.

## Experiment 068 - BudgetYourTrip search-snippet occupancy proxy (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly two ordered BudgetYourTrip searches each
(24 searches total). No page reads, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city
evidence occurred; all twelve calls were protocol-compliant.

Ten cities produced complete same-source snippet proxy candidates. Paris lacked explicit two-person wording and Mumbai
lacked an exact-city one-star value. The 10/12 candidate rate passed the pre-registered screening gate. Search
snippets are lower-evidence than page reads and every value remains `proxy_candidate`, never observed.

**Verdict:** promote only to independent explicit-two-adult calibration or page-backed validation. Do not map, fit,
tax-normalize, or present snippets as product observations. Read
`data/reference/v5/experiments/068-budgetyourtrip-snippet-proxy/`.

## Experiment 069 - BudgetYourTrip one-star proxy explicit calibration screen (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts repeated the two-search BudgetYourTrip proxy pair and
then issued one search each for Google Hotels, Expedia, and Hotels.com (60 searches total). There were no page reads,
retries, fallbacks, arithmetic, FX conversions, or cross-city evidence; all 12 calls were protocol-compliant.

Eleven cities produced a complete source-defined proxy candidate. No independent explicit-two-adult one-star named-
property candidate was found, leaving 0/12 matched cities. Google Hotels usually lacked occupancy wording; Expedia and
Hotels.com mostly exposed from/lowest
prices or the wrong class. **Verdict:** reject this proxy calibration route at the screening gate (required 6/12
matched cities and 10/12 compliant). Retain rows as labelled evidence only; no correction, property-basket
aggregation, mapping, or fitting. Read `data/reference/v5/experiments/069-budgetyourtrip-explicit-calibration/`.

## Experiment 070 - explicit two-guest private-hostel three-source panel (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly three ordered search-only operations each
(Hostelworld, Booking.com, and Google Hotels; 36 searches total). All calls were protocol-compliant, with no page
reads, retries, fallbacks, arithmetic, FX conversion, averaging, or cross-city evidence.

Four cities produced five qualifying named private-hostel property rows: Lisbon, Hanoi, Nairobi, and Cape Town. The
other eight cities failed on from/sale prices, ambiguous room/property class, missing occupancy, missing numeric price,
or no result. The 4/12 city gate failed (required 6/12). **Verdict:** reject this search-only three-source route at
current reliability. Keep the five rows as property-level evidence only; no basket aggregation, correction, or product
mapping. Read `data/reference/v5/experiments/070-private-hostel-three-source-panel/`.

## Experiment 071 - activity per-person adult scaling panel (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly three ordered searches each (standard adult
attraction, half-day group activity, full-day premium activity; 36 searches total). All calls were protocol-compliant;
there were no page reads, retries, fallbacks, arithmetic, FX conversions, averaging, or cross-city evidence.

Strict coverage was only 3/12 budget-ticket rows, 0/12 half-day group rows, and 1/12 full-day premium rows; no city was
complete. Unknown taxes, from/discount prices, missing duration, and group/party ambiguity dominated failures.
**Verdict:** reject this per-person screen at the feasibility gate. Retain four one-person/per-person source facts only;
do not apply the factor of two, map tiers, or claim accuracy. Read `data/reference/v5/experiments/071-activity-per-person-scaling-panel/`.

## Experiment 072 - Price of Travel Hostel Index dorm anchor (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts each issued exactly one restricted search followed by one
read of the exact Price of Travel Hostel Index page (24 operations total). There were no second reads, retries,
fallbacks, arithmetic, FX conversions, averaging, or cross-city evidence; all calls were protocol-compliant.

All 12 cities produced strict one-person shared-dorm rows. The source states taxes and fees are included and uses an
average of Thursday and Friday nights in mid-April 2023. **Verdict:** promote only to deterministic two-bed scaling and
independent validation. The reference window is stale and the selected-hostel statistic is not yet a production city
median; do not map `accom_shared_hostel_dorm` until the 30-city/10-locked-holdout accuracy gates pass. Read
`data/reference/v5/experiments/072-priceoftravel-hostel-index-dorm/`.

## Experiment 073 - Price of Travel same-property dorm-index calibration (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts each issued exactly one Price of Travel index search, one
exact index-page read, and one current exact-property dorm search. All 12 calls were protocol-compliant and all 12
index rows were strict. Only 5/12 current benchmarks were strict, 4/12 had the same property identity, and just 1/12
had matching currency. The sole scored Lisbon pair had an absolute percentage error of 38.76%.

**Verdict:** reject the pre-registered same-currency calibration gate (1/12 versus 8/12 required). Do not map, fit,
or scale the Price of Travel index. Retain the source rows and current snippets as labelled evidence only. A separate
deterministic-FX audit may test the CNY rows, but it must preserve strict property/occupancy/tax/date semantics and
the 30-city/10-locked-holdout validation gate. Read
`data/reference/v5/experiments/073-priceoftravel-hostel-index-calibration/`.

## Experiment 074 - Hostelworld current shared-dorm panel (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts each issued exactly one public Hostelworld search. All
calls were protocol-compliant, but strict shared-dorm coverage was **0/12**. Search results exposed `From`/seasonal
prices, city-list summaries, or omitted dates and tax/fee basis; no values were inferred.

**Verdict:** reject this source/query boundary. Retain not-found reasons as access evidence only; do not map, scale,
or fit a dorm value. The next accommodation experiment is a targeted pooled Expedia 3↔4-star completion panel.
Read `data/reference/v5/experiments/074-hostelworld-shared-dorm-panel/`.

## Experiment 075 - targeted Expedia class-gap panel (1 August 2026)

Twelve fresh independent single-city GPT-5.6 Luna-class contexts issued exactly three ordered Expedia searches each
(2-star, 3-star, 4-star), with no page reads, retries, fallback sources, arithmetic, FX conversion, or cross-city
evidence. All calls were protocol-compliant and yielded 15 strict rows (2-star 4, 3-star 7, 4-star 4).

The deterministic pool, with 075 precedence and legacy field compatibility, contains 81 rows across 36 cities. It has
20 matched 2↔3 cities and 23 matched 3↔4 cities, below the 30-city gate for both relationships. **Verdict:** reject
pooled fitting promotion; retain the strict rows as source evidence only. No coefficients or product mapping follow.
Read `data/reference/v5/experiments/075-expedia-gap-panel/`.

## Experiment 076 - HOTEVI grouped-tier proxy panel (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts each issued exactly one HOTEVI research search and one
exact-page read. All calls were protocol-compliant and all 12 cities produced all three grouped rows (36/36): budget
(1–2★), mid-range (3★), and luxury (4–5★). Every row is a source-defined standard-room proxy with unknown tax
treatment and an unspecified calendar index month; New York City is represented by an explicit `New York` source alias.

**Verdict:** promote to independent proxy calibration only. Do not split groups, infer two-adult occupancy/taxes, fit,
or map product tiers. Read `data/reference/v5/experiments/076-hotevi-grouped-tier-panel/`.

## Experiment 077 - HOTEVI explicit class/property quote panel (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts each issued exactly six HOTEVI operations (search/read for
1-star, 3-star, and 4-star). All calls were protocol-compliant, but strict coverage was 0/12 for every class and zero
cities were complete. Wrong-city pages, grouped research rows, cache misses, and missing two-adult/date/tax evidence
caused fail-closed results.

**Verdict:** reject the direct HOTEVI property boundary. Keep the grouped HOTEVI table proxy-only; no mapping, split,
or fitting follows. Read `data/reference/v5/experiments/077-hotevi-explicit-class-panel/`.

## Experiment 076 - HOTEVI grouped-tier proxy panel (1 August 2026)

Twelve independent single-city GPT-5.6 Luna-class contexts each issued exactly one HOTEVI research search and one
exact-page read. All calls were protocol-compliant and all 12 cities produced all three grouped rows (36/36): budget
(1–2★), mid-range (3★), and luxury (4–5★). Every row is a source-defined standard-room proxy with unknown tax
treatment and an unspecified calendar index month; New York City is represented by an explicit `New York` source alias.

**Verdict:** promote to independent proxy calibration only. Do not split groups, infer two-adult occupancy/taxes, fit,
or map product tiers. Read `data/reference/v5/experiments/076-hotevi-grouped-tier-panel/`.
## Experiment 078 - Expedia matched 2-4-star panel (1 August 2026)

This experiment used twelve independent single-city Luna contexts. Each call
must issue exactly three ordered Expedia-restricted searches for 2-, 3-, and 4-star city-class averages and must not
read pages, retry, use fallbacks, calculate, convert currencies, or use cross-city evidence. A deterministic audit will
pool strict rows with experiments 028, 029, 059-063, and 075 and check whether both the 2-star/3-star and 3-star/4-star
relationships reach the frozen 30-city matched-city gate. The calls were 12/12 protocol-compliant and yielded eight
strict new rows. Pooling reached 89 strict rows across 41 cities, with 20 matched 2-star/3-star cities and 26 matched
3-star/4-star cities. Both gates failed. **Verdict:** reject pooled fitting promotion; retain rows as source evidence
only and do not fit or map hotel classes. Read `data/reference/v5/experiments/078-expedia-matched-panel/`.

## Experiment 079 - HOTEVI grouped proxy calibration panel (1 August 2026)

This experiment used eighteen new single-city Luna contexts, each with one HOTEVI-restricted search and one exact
page read. All 18 calls and grouped proxy rows were complete. Pooling with the 12 Experiment 076 development rows
matched only 19 explicit Expedia 3-star cities and 15 explicit 4-star cities; locked holdout matches were 8 and 5.
The 30-city/10-holdout gates failed, and the unfitted proxy error was unstable (3-star median APE 17.65%, p90 109.68%;
4-star median APE 35.92%, p90 183.02%). **Verdict:** reject HOTEVI proxy calibration; retain source-defined grouped
values as labelled evidence only. Do not split, fit, or map product tiers.

## Experiment 080 - BudgetYourTrip per-person activity scaling panel (1 August 2026)

This experiment is in progress. Thirty new single-city Luna contexts are assigned exactly two ordered
BudgetYourTrip-restricted searches for Budget, Mid-Range, and Luxury entertainment rows. Accepted rows must be
explicitly one person per day; deterministic code may multiply them by two for the two-traveller product. Ten cities
are locked holdout. The source screen does not yet establish that reported-spend entertainment tiers equal the
product's ticket or duration-specific activity estimands.

Experiment 080 completed with 30/30 protocol-compliant calls and 28/30 complete exact-city per-person/day tier sets,
passing the registered source screen. Fukuoka was `not_found`; Rome's multi-city itinerary rows were rejected. The
analyzer doubled accepted inputs deterministically and performed no fitted scaling. Holdout completeness was 8/10,
below the final 95% gate, and no independent ground truth validates the reported-spend activity semantics.
**Verdict:** promote deterministic scaling only to definition-matched validation; do not accept product mapping.
Read `data/reference/v5/experiments/080-activity-scaling-panel/`.

## Experiment 081 - activity one-call repeatability panel (1 August 2026)

This experiment is in progress. Five difficult cities (Fukuoka, Mumbai, Dubai, Paris, Copenhagen) each receive three
independent one-city calls using the exact 080 activity prompt. The deterministic audit measures protocol compliance,
complete tier coverage, and within-city relative range; it does not average calls, fit a model, or claim ground truth.

Experiment 081 completed with 15/15 protocol-compliant calls. Mumbai, Dubai, Paris, and Copenhagen each returned
identical complete tiers in all three calls (0% within-city relative range); Fukuoka was `not_found` in every call.
The pre-registered five-city repeatability gate failed. **Verdict:** retain the ordinary-city route with explicit
sparse fail-closed behavior; do not average calls or map missing values. Read `data/reference/v5/experiments/081-activity-repeatability/`.

## Experiment 082 - World Stay Tracker accommodation panel (1 August 2026)

Twelve independent one-city Luna contexts issued exactly four ordered operations per city: World Stay Tracker 3-star
search/read, then 4-star search/read. All 12 calls were protocol-compliant after normalizing telemetry so
`searchesAttempted` counts the two search queries and `searchOperations` plus `directReads` represent the four total
operations. The strict audit accepted five canonical 3-star rows and zero 4-star rows, with zero complete cities; two
additional semantically equivalent 3-star rows failed canonical field validation. The 10/12 complete-city screen failed.
Breakfast-included, review-7+, popular-property averages remain labelled source evidence only. **Verdict:** reject
promotion; do not remove breakfast, fit coefficients, or map product tiers. Read
`data/reference/v5/experiments/082-worldstaytracker-accommodation/`.

## Experiment 083 - World Stay Tracker cityid/rating URL panel (1 August 2026)

The pre-registered panel used twelve independent one-city Luna contexts, each performing exactly one World Stay Tracker
search, one read of the returned city page, and one read of the same `cityid` URL with only `rating=4` substituted.
The changed URL boundary tests whether direct parameter navigation avoids the search index's repeated 4-star-to-3-star
misrouting. No second search, retry, fallback, arithmetic, FX conversion, or cross-city evidence is allowed. Strict
rows retain the source's explicit 2-adult/1-night/breakfast/review-7+ basis; a screen pass authorizes only a later
room-only semantic calibration.

Experiment 083 completed with 12/12 protocol-compliant calls: one exact-city search, one returned-page read, and one
direct read after substituting only the World Stay Tracker `rating=4` URL parameter. The audit accepted six strict
3-star rows and zero 4-star rows; zero cities were complete. Every direct 4-star read was unsafe or unavailable, and
the 10/12 complete-city screen failed. **Verdict:** reject promotion; retain labelled observations and access-failure
evidence only, with no fallback search, breakfast adjustment, fitting, or product mapping. Read
`data/reference/v5/experiments/083-worldstaytracker-cityid-rating/`.


## Experiment 084 - Nomadlio food/drink structured-page proxy panel (1 August 2026)

The pre-registered panel used twelve independent one-city Luna contexts, each performing exactly one Nomadlio city-page
search and one exact-page read. The panel records six labels (inexpensive meal, mid-range meal, coffee, beer, cocktail,
wine bottle) while preserving whether the page defines serving size, party size, taxes, and statistic. Undefined labels
remain source-defined proxies; no wine-bottle-to-wine-glass, coffee-to-cappuccino, street-food, or premium-meal
substitution is allowed.

Experiment 084 completed with 12/12 protocol-compliant calls. The audit found 64 labelled cells and nine complete
cities, but zero definition-compatible rows: page units, party size, taxes/fees, and statistic were not stated. Dubai
returned a guide-page misroute; London and Prague each missed one label. **Verdict:** retain all values as
`source_defined_proxy` only; do not map, substitute, or fit from them. Read
`data/reference/v5/experiments/084-nomadlio-food-drink/`.

## Experiment 085 - Expedia exact-heading query contract (1 August 2026)

This experiment is pre-registered before collection. Twelve independent one-city Luna contexts will issue exactly
three Expedia-restricted search queries, each quoting the indexed heading `Price trends for properties with N Stars`
and the source's `2 adults` and `taxes and fees` language. The strict exact-city/class, named-currency,
non-`from`, reference-window, occupancy, and tax-status contract is unchanged from the pooled Expedia audits. No
page reads, retries, fallback sources, arithmetic, FX conversion, aggregation, or cross-city evidence is allowed.
The deterministic analyzer will pool new rows with 028/029/059-063/075/078 and will fit or map nothing. Promotion
requires at least 10 compliant calls and at least 30 matched cities for both 2-star←3-star and 4-star←3-star;
otherwise the changed query ceiling is rejected. Read
`data/reference/v5/experiments/085-expedia-query-contract/`.

Experiment 085 completed with 12/12 protocol-compliant calls and zero strict new rows. Exact class pages often
exposed a bare `$` without a named currency; generic, district, wrong-city, and class-ambiguous results were also
rejected. The pooled audit remains 89 rows across 41 cities, with 20 matched 2-star/3-star cities and 26 matched
4-star/3-star cities, below both frozen 30-city gates. **Verdict:** reject the changed query contract and pooled
fitting; retain negative source/access evidence only and pivot to a materially different anchor or independently
validated estimand. Read `data/reference/v5/experiments/085-expedia-query-contract/verdict.md`.

## Experiment 086 - Expedia.com bare-dollar currency proxy (1 August 2026)

This experiment is pre-registered before collection. It repeats the exact three Expedia class searches on twelve
cities with prior named-USD rows, but asks the Luna extractor to preserve numeric bare-dollar trends as
`found_proxy` with `currency: null` rather than inferring USD. Deterministic code may map only an exact
`www.expedia.com` host with no locale override to a labelled `source_locale_proxy` USD basis and imputed currency.
The same-city/class comparison is a source/date calibration, not independent ground truth. The screen requires
10 compliant calls, 10 mapped/named rows, 10 matched rows, median APE ≤25%, and p90 APE ≤50%; even a pass cannot
authorize product mapping or fitting. Read `data/reference/v5/experiments/086-expedia-locale-currency-proxy/`.

Experiment 086 completed with 12/12 protocol-compliant calls. It retained 24 exact bare-dollar proxy rows and three
named-USD rows; deterministic exact-host mapping joined all 27 to prior named-USD rows with median APE 0% and p90
APE 1.72%, passing the pre-registered same-source screen. This is not independent ground truth because both sides
come from the Expedia source family. **Verdict:** promote only to a broader independent proxy validation panel;
preserve `currency: null` and imputed-currency provenance, and do not map product tiers or fit coefficients. The
Istanbul artifact uses country label `Turkey` while the manifest uses `Türkiye`; retain that raw alias for canonical
country resolution rather than silently normalizing the response.

## Experiment 087 - Expedia.com locale-proxy broad panel (1 August 2026)

This 24-city panel is pre-registered after the 086 source/date screen and official Expedia.com locale audit. Each
city receives one independent Luna context and exactly three search-only class queries. Bare-dollar exact rows stay
`currency: null` in the response and are mapped only by deterministic exact-host code with imputed-currency
provenance. The source-coverage gate is 23/24 compliant calls, 20 completed calls, and at least 30 pooled matched
city relationships for both 2-star/3-star and 4-star/3-star. A pass authorizes only independent explicit-two-adult
accuracy validation; no fitting or product mapping occurs. Read
`data/reference/v5/experiments/087-expedia-locale-proxy-broad-panel/`.

Experiment 087 completed with 24/24 protocol-compliant one-city calls and 32 strict-or-proxy rows. The deterministic
pooled audit reached 20 matched 2-star/3-star cities and 29 matched 4-star/3-star cities, below both registered
30-city gates. Generic all-city, district, wrong-city, and sparse 2-star results dominated the remaining gap.
**Verdict:** reject the broad coverage gate; retain rows with `source_locale_proxy`/imputed-currency provenance only.
The next experiment may target the missing 2-/3-star pair boundary, but independent explicit-two-adult accuracy
validation remains mandatory before any production mapping or fitting. Read
`data/reference/v5/experiments/087-expedia-locale-proxy-broad-panel/verdict.md`.

## Experiment 088 - targeted Expedia 2-/3-star URL-pattern panel (1 August 2026)

This 15-city panel is pre-registered after 087's persistent 2-star gap. Each independent one-city Luna context
issues exactly two search-only queries targeting Expedia's indexed `2Star-...-Hotels.s20` and `3Star-...-Hotels.s30`
URL patterns. The strict city/class, two-adult, tax, reference-period, non-`from`, and exact-host contract remains;
bare-dollar rows are labelled source-locale proxies with imputed currency. Promotion requires 14/15 compliant calls,
eight new paired rows, and pooled 2-star/3-star coverage ≥30. No fitting or product mapping occurs. Read
`data/reference/v5/experiments/088-expedia-targeted-23-panel/`.

The panel completed with 15/15 protocol-compliant calls, 12 accepted rows, and no new paired 2-/3-star city.
After deterministic de-duplication, pooled matched coverage remained 20 versus the registered threshold of 30;
the new-pair and pooled gates therefore failed. Generic all-city trends, wrong-city/district pages, and sparse
2-star indexing dominated the not-found outcomes. Bare-dollar rows remain source-locale proxies with imputed
currency, not observed USD. **Verdict:** reject this Expedia URL-pattern repair; retain raw access evidence only,
with no coefficient fit, class split, or product mapping. The next accommodation experiment must be materially
different. See `data/reference/v5/experiments/088-expedia-targeted-23-panel/verdict.md`.

## Experiment 089 - activity semantic calibration screen (pre-registered 1 August 2026)

Experiment 080 provides strong one-call coverage for BudgetYourTrip budget/mid-range/luxury entertainment tiers,
but those source-defined reported-spend values are not definition-matched observations of the product's low-cost
ticket, half-day group, and full-day premium activity estimands. Experiment 089 pre-registers a 12-city, one-city
per Luna screen with exactly three ordered searches per city for independent public anchors. Strict rows require
exact city, non-`from` numeric adult price, named currency, reference period, explicit tax status, and the required
duration or premium evidence. The screen requires 8/12 compliant calls, eight strict rows per anchor, and six
complete cities. No product mapping or coefficient fitting is authorized before the deterministic audit and an
independent definition-matched validation.

Experiment 089 completed with 12/12 protocol-compliant calls. The audit accepted 0/12 strict low-cost attraction
ticket rows, 5/12 half-day group rows, and 4/12 full-day premium rows; zero cities were complete. Compatible USD
matches to the BudgetYourTrip baseline were only 0, 1, and 2 rows respectively, so no calibration was identified.
Missing tax, duration, party, premium, or current-price evidence caused honest exclusions. **Verdict:** reject the
activity semantic-calibration route; retain 080 values as `source_defined_proxy` only and perform no product
mapping. The workstream is paused after this experiment at the user's request. Read
`data/reference/v5/experiments/089-activity-semantic-calibration/verdict.md`.

## Experiment 090 - one-call multi-source anchor bundle (pre-registered 1 August 2026)

Experiment 090 tests whether the strongest surviving source contracts can coexist in one production-shaped,
single-city Luna request. Twelve cities each receive exactly five ordered source-restricted searches: Numbeo
food/drink, BudgetYourTrip activities, Expedia 2–4-star trends, public hostel prices, and a one-star query. The
audit will report evidence-labelled coverage and complete anchor bundles without fitting, arithmetic, FX, or product
mapping. A pass only authorizes broader validation; all frozen model and provenance gates remain in force.

Experiment 090 completed with 12/12 protocol-compliant calls. The deterministic audit accepted five Numbeo
food/drink inputs and all three BudgetYourTrip activity proxies in 8/12 cities, but zero cocktail, wine-glass,
2-star, hostel-dorm, private-hostel, or one-star rows; no city had a complete anchor bundle. **Verdict:** reject
the five-search bundle as sufficient for all 19 fields. Preserve partial evidence and source-defined labels; no
coefficient fitting, imputation, or product mapping is authorized. Read
`data/reference/v5/experiments/090-one-call-anchor-bundle/verdict.md`.

## Experiment 091 - Expatistan drink-anchor panel (pre-registered 1 August 2026)

Experiment 091 targets the two missing Numbeo drink rows with public Expatistan city pages. Twelve independent
one-city Luna calls issue exactly two ordered searches for the standard downtown-club cocktail and good-quality red
wine bottle. The bottle is deliberately not treated as a wine glass; any conversion must be modelled and validated
separately. The screen requires 10/12 compliant calls and 8/12 accepted rows for each anchor.

Experiment 091 completed with 12/12 protocol-compliant calls, 10/12 accepted cocktail rows, and 12/12 accepted
wine-bottle rows. **Verdict:** promote Expatistan only to independent calibration. Preserve the wine unit as
`per_bottle`; unknown tax treatment and the source-defined statistic prevent product mapping. No bottle-to-glass
factor was fitted. Read `data/reference/v5/experiments/091-expatistan-drink-anchors/verdict.md`.

## Experiment 092 - independent drink-menu calibration (pre-registered 1 August 2026)

Experiment 092 will collect definition-matched public-menu ground truth for standard cocktails and standard red wine
by the glass. Twelve one-city Luna calls issue exactly three searches, preserve raw samples, and allow only returned
public page reads. Deterministic code computes medians and same-currency comparisons to Expatistan. A bottle remains
a bottle; no conversion or product mapping is authorized from this screen.

Experiment 092 completed with 12/12 protocol-compliant calls. It accepted 12/12 cocktail medians but only 4/12
strict wine-glass medians. Ten cocktail rows matched Expatistan in the same currency (median ratio 0.917), with
wide dispersion; no coefficient was accepted. **Verdict:** reject wine-glass calibration, retain cocktail evidence
only, and perform no drink mapping or bottle-to-glass conversion. The workstream is paused after 092 at the user's
request. Read `data/reference/v5/experiments/092-drink-menu-calibration/verdict.md`.

## Experiment 093 - volume-targeted wine-glass panel (pre-registered)

Experiment 093 targets the 092 wine-volume coverage gap with three explicit 125/150/175 ml or 15 cl searches per
city. It preserves the frozen volume-compatible definition, returns raw samples only, and uses deterministic
medians. No bottle-to-glass conversion or product mapping is authorized.

The panel completed with 12/12 protocol-compliant calls and 9/12 strict explicit-volume red-wine panels, passing the
registered 10/12 + 8/12 screen. Nine same-currency joins to Experiment 091 had median glass/bottle ratio 0.727, with
extreme dispersion (0.001–3.704). Dubai's displayed `$` versus declared AED and Hanoi's thousand-VND denomination
also require an explicit normalization audit. **Verdict:** promote the volume-targeted query contract to a locked
independent calibration study, but reject a global bottle-to-glass coefficient and all product mapping. Read
`data/reference/v5/experiments/093-wine-volume-targeted-panel/verdict.md`.

## Experiment 094 - Trip.com class proxy calibration (pre-registered)

Experiment 094 tests whether Trip.com's abundant city/star averages can be retained as a labelled
`source_defined_proxy` rather than silently discarded for missing occupancy and tax wording. Twelve independent
one-city Luna calls issue exactly three ordered Trip.com class searches. A deterministic audit will compare same-
currency weekday averages with existing Expedia trends that explicitly state two adults and excluded taxes. The
screen requires 10/12 compliant cities, 8 rows per class, 15 same-currency pairs, median APE ≤25%, and p90 APE ≤50%.
No product mapping or coefficient fit follows a screen pass.

The panel completed with 12/12 compliant calls and 36/36 proxy rows, but only 12 same-currency joins were available.
Median APE was 124.2%, p90 APE 532.4%, and median signed error +124.2%; both pair-count and accuracy gates failed.
**Verdict:** reject Trip.com proxy calibration. Unknown occupancy/tax is materially consequential, so retain rows as
labelled source evidence only and do not relax the frozen accommodation estimand or map a product field. Read
`data/reference/v5/experiments/094-trip-class-proxy-calibration/verdict.md`.

## v6 M1 — integration complete (9 August 2026)

M1 integrated the v6 path behind the opt-in `CITY_COST_METHODOLOGY_V6=true` feature flag. The default v1
generation path and the 121-city CSV remain unchanged.

Confirmed implementation:

- `src/lib/city-cost-methodology-v6.ts` reads the frozen validation band cuts and generated accommodation
  coefficients, derives all five non-three-star accommodation tiers from the measured three-star anchor,
  applies worst-grade basket propagation, computes intervals, and falls back to regional/band medians at
  grade D without returning blanks.
- `src/lib/city-cost-v6-collection.ts` runs three versioned search-snippet spine extractors (Numbeo,
  Expedia three-star, BudgetYourTrip). It keeps source-currency facts separate from deterministic FX,
  preserves `blocked`/`not_found`/`stale`/`class_absent`, retries a block once, and records per-call
  telemetry within the v6 refresh budget.
- Estimate metadata persists v6 grades, intervals, anchor provenance, missingness, prior basis and telemetry.
  `/dataset` shows a per-city grade distribution, per-value grades/intervals, and editor tooltips.

Verification passed from the physical OneDrive target path: `npx tsc --noEmit`, `npm run build` (with the
documented dynamic `/api/export` message), `npm test -- --run` (153 tests), `npm run docs:check-memory`, and
`node scripts/fit-city-cost-ladder-v6.mjs --check`. The flagged generation path is covered by a deterministic
integration test; a live provider smoke test remains pending because no provider key is configured locally.

**Verdict:** promote M1 integration. Do not collect v6 experiments or score gates yet. The next work is M2:
collect and seal the 25 development plus 15 locked-holdout ground-truth cities defined in the frozen manifest.

## v6 M2 — ledger and holdout boundary (9 August 2026)

M2 has started with a manifest-driven ledger at `data/reference/v6/ground-truth/development-ledger.json`.
It contains the exact 25 development cities and six frozen measures per city, with no values copied from
the shipping CSV or older v5 observations. `scripts/validate-city-cost-v6-ground-truth.mjs` checks the
reference window, city/region/band membership, duplicate rows, found-row provenance and explicit missingness.

The holdout boundary is represented by `data/reference/v6/ground-truth/holdout-seal.json`, which contains
only the lock marker and has null result and score files. The audit passes structural checks and
reports 25 found observations plus 125 pending development slots. The attraction tranche uses official
city or attraction tariff pages. A live Hanoi availability check also found an official Văn Miếu adult
ticket price and generic hotel/hostel listings, but the hotel listings did not expose an auditable exact
2026-09-17 to 2026-09-18 quote in the permitted result, so no accommodation row was written. **Verdict:**
promote the ledger scaffold and the first attraction tranche; continue M2 dated-fact collection without
tuning or scoring the holdout.

## v6 M2 — accommodation retrieval screen (9 August 2026)

The next collection slice tested indexed Expedia/Booking/travel-search results for the frozen
2026-09-17 to 2026-09-18 window. Returned pages were generic, “from” rates, stale date selections, or
prices without a verifiable class/occupancy combination. The connected browser runtime was also
unavailable in this session, so no browser-only result was treated as a source block and no accommodation
fact was written. **Verdict:** retain all 125 accommodation slots as pending; resume with an available
interactive browser or an indexed result that exposes the exact dates, two-adult basis, property class,
display currency, and total.

## v6 M2 — dated accommodation tranche: Hanoi and Singapore (9 August 2026)

With the connected Chrome session available, the frozen 2026-09-17 to 2026-09-18 window was queried
interactively on Booking.com for Hanoi and Singapore. Each city now has all five accommodation measures:
hostel dorm bed, private hostel room, 1-star, 3-star and 4-star room. The ledger records the selected
property, exact occupancy, room type, displayed AUD price, source URL, retrieval date and tax basis.

Singapore supplied base prices with taxes shown separately. Hanoi exposed original public prices alongside
Genius/Getaway/Early Booker discounts; the discounted member/promotional prices were excluded in accordance
with the contract. No holdout data was inspected or written. Validation reports **35 found observations,
115 pending development slots**, with zero errors. **Verdict:** promote this tranche as dated source evidence;
continue M2 collection city by city without tuning coefficients or opening the holdout.

## v6 M2 — dated accommodation tranche: Ho Chi Minh City (9 August 2026)

The next interactive Booking.com collection covered Ho Chi Minh City for the frozen 2026-09-17 to
2026-09-18 window. All five accommodation measures were verified: Tao Dan Hotel (4-star), GK Central
Hotel (3-star), Thanh Lan Hotel (1-star), City Backpackers Hostel private room, and the same hostel's
one-adult mixed dormitory bed. Each row records exact occupancy, room type, displayed AUD price, source URL,
retrieval date and the observed promotion/tax basis.

The hotel and hostel pages showed original public prices alongside Genius, Getaway Deal or Bonus savings
discounts; discounted member/promotional prices were excluded. No holdout data was inspected or written.
Validation reports **40 found observations, 110 pending development slots**, with zero errors. **Verdict:**
promote this tranche as dated source evidence and continue M2 collection without tuning coefficients or
opening the holdout.

## v6 M2 — dated accommodation tranche: Taipei (9 August 2026)

The next interactive Booking.com collection covered Taipei for the frozen 2026-09-17 to 2026-09-18
window. All five accommodation measures were verified: Green World Hotel - Zhonghua (4-star), Lumos Inn
(3-star), Chian Huei Business Hotel (1-star), We Come Hostel private room, and the same hostel's
one-adult mixed dormitory bed. The 1-star row is explicitly marked as an Inn by Booking.com; it remains
the in-city 1-star result and the property-type distinction is preserved in the evidence text.

Original public prices were retained when Genius or Getaway Deal discounts were displayed; current
member/promotional prices were excluded. No holdout data was inspected or written. Validation reports
**55 found observations, 95 pending development slots**, with zero errors. **Verdict:** promote this
tranche as dated source evidence and continue M2 collection without tuning coefficients or opening the
holdout.

## v6 M2 — dated accommodation tranche: Da Nang (9 August 2026)

The next interactive Booking.com collection covered Da Nang for the frozen 2026-09-17 to 2026-09-18
window. All five accommodation measures were verified: HAIAN Riverfront Hotel Da Nang (4-star), Sekong
Hotel Da Nang (3-star), Summer Beach (1-star), IKIGAI Dorm Hostel private room, and City Hostel Da Nang
one-adult dormitory bed. Each row records exact occupancy, room type, displayed AUD price, source URL,
retrieval date and the observed promotion/tax basis.

Original public prices were retained when a Genius or Getaway Deal discount was displayed; current
member/promotional prices were excluded. No holdout data was inspected or written. Validation reports
**45 found observations, 105 pending development slots**, with zero errors. **Verdict:** promote this
tranche as dated source evidence and continue M2 collection without tuning coefficients or opening the
holdout.

## v6 M2 — dated accommodation tranche: Phuket (9 August 2026)

The next interactive Booking.com collection covered Phuket Town for the frozen 2026-09-17 to 2026-09-18
window. All five accommodation measures were verified: Little Nyonya Hotel (4-star), The Memory at On On
Hotel (3-star), Siri Hotel Phuket (1-star), Book a Bed Poshtel private room, and the same hostel's
one-adult mixed dormitory bed. Each row records exact occupancy, room type, displayed AUD price, source URL,
retrieval date and the observed promotion/tax basis.

Original public prices were retained when VIP reward, Genius or Getaway Deal discounts were displayed;
current member/promotional prices were excluded. No holdout data was inspected or written. Validation
reports **50 found observations, 100 pending development slots**, with zero errors. **Verdict:** promote
this tranche as dated source evidence and continue M2 collection without tuning coefficients or opening
the holdout.

## v6 M2 — dated accommodation tranche: Beijing (9 August 2026)

The next interactive Booking.com collection covered Beijing for the frozen 2026-09-17 to 2026-09-18
window. Four accommodation measures were verified: Jianguo Hotel (4-star), Dequan Xinyue Hotel, near
Sanlitun (3-star), Beijing Pagoda Light International Youth Hostel private room, and the same hostel's
one-adult dormitory bed. The exact-date Beijing city-scope 1-star query returned zero properties, so that
slot is recorded as `class_absent` under the missingness contract; no substitute class or inferred price was
written.

The accommodation rows record exact occupancy, room type, displayed AUD price, source URL, retrieval date
and the observed promotion/tax basis. Original public prices were retained when a Genius discount was
displayed; current member prices were excluded. No holdout data was inspected or written. Validation reports
**59 found observations, 90 pending development slots**, with zero errors. **Verdict:** promote this tranche
and the explicit class-absence result as dated M2 evidence; continue M2 collection without tuning coefficients
or opening the holdout.

## v6 M2 — dated accommodation tranche: Tokyo (9 August 2026)

The next interactive Booking.com collection covered Tokyo for the frozen 2026-09-17 to 2026-09-18 window.
All five accommodation measures were verified: Hotel Mystays Premier Akasaka (4-star), OTHER SPACE Asakusa
(3-star), Oyado Cocochi (1-star), Grids Tokyo Ueno Hotel&Hostel private room, and the same hostel's one-adult
6-bed mixed dormitory bed. The 1-star selection used the hotel-only plus 1-star filters, keeping the hotel
anchor separate from the hostel measures.

Original public prices were retained when Bonus savings, Secret Deal, VIP, Getaway Deal or Genius discounts
were displayed; current member/promotional prices were excluded. The Booking results labelled these quotes
with additional charges may apply, so their original tax basis is recorded as unknown. No holdout data was
inspected or written. Validation reports **64 found observations, 85 pending development slots**, with zero
errors. **Verdict:** promote this tranche as dated source evidence and continue M2 collection without tuning
coefficients or opening the holdout.

## v6 M2 — accommodation tranche verdicts superseded by the v2 reset (9 August 2026)

The Beijing and Tokyo tranche verdicts above are superseded. Those rows were collected under the
pre-correction price basis: they retained Booking.com strikethrough/original prices and excluded public
promotional prices that any logged-out visitor could transact. The single-property captures also predated
the deterministic multi-listing selection rule. The rows were removed from the development ledger in
`4cf397b`; they are historical evidence of the failed collection rule, not current ground truth.

At the `4cf397b` contract checkpoint, the ledger correctly returned to **25 found / 125 pending** with
**zero accommodation cities**. The 25 found cells were the attraction tranche; all 125 accommodation cells
were deliberately reopened for collection under the corrected v2 contract. No holdout result or score was
used in this repair.

## v6 M2 — corrected six-city accommodation and attraction repair (9 August 2026)

The six-city accommodation panel was re-collected after the contract reset, not patched. Hanoi, Ho Chi
Minh City, Da Nang, Phuket, Singapore and Taipei now contribute all five accommodation measures each: 30
Booking.com rows using the logged-out `booking_price_asc_median_v1` rule, with the v2 sample prices, list
price, deal-label and selection-rule fields. Taipei had six eligible 1-star listings and therefore uses the
same six-listing sample count for every class in that city. The corrected ledger now has **55 found / 95
pending** cells: 25 attraction rows and 30 accommodation rows.

The attraction estimand was repaired for nine rows. Da Nang, Melbourne, Taipei, Beijing, Barcelona,
Budapest, Prague, Phuket and Delhi now use standard adult general-admission museum or historic-site
tariffs rather than a theme park, observation deck, zoo or exhibition-specific ticket. The Taipei source
URL was also corrected to remove its trailing period.

The old accommodation panel's apparent class failures were collection artifacts from strikethrough prices
and the one-property rule. The corrected panel no longer supports treating those as ladder defects. One
real M2 finding survives: the dorm rung remains roughly 2× above the fitted 0.163 coefficient; defer that
weak-coefficient issue to M5 and do not refit during M2. The Booking.com ground truth to Expedia production
offset remains unfit until at least 12 accommodation cities are available. **Verdict:** promote the
corrected rows as M2 source evidence, continue collection from the remaining 95 slots, and do not score
gates or open the holdout.

## v6 M2 — `booking_price_asc_median_v1` superseded by the top-picks pilot (9 August 2026)

The preceding six-city verdict is superseded. The `booking_price_asc_median_v1` rule took a fixed
count of the cheapest listings, so the sampled percentile varied with class inventory depth: deep
3-star and 4-star classes were pulled toward their price floor while shallow 1-star and hostel
classes represented a much deeper slice of their distributions. The resulting ratios inverted even
after the price-basis correction. This is a selection-rule defect, not evidence against the fitted
ladder. The Copenhagen stage-1 analysis independently measures the first-page depth effect: its first
10 four-star prices were 5.2% below the full 108-price median, with the first 15 already 23.7% below it.

The replacement rule is `booking_top_picks_firstpage_median_v2`: retain every eligible first-page
listing in Booking.com's default Our top picks order, record all prices and the displayed class
inventory count, and use the median. A two-city pilot was collected for Hanoi (deep inventory) and
Singapore (shallow inventory), producing 10 new accommodation rows. Hanoi medians for 4-star,
3-star, 1-star, private hostel and dorm were A$62/A$42/A$27/A$32/A$10; Singapore medians were
A$182/A$118/A$73/A$99/A$39. Both cities still show a private-hostel/1-star inversion, and Singapore's
dorm/3-star ratio of 0.331 is just outside the validator's fitted-coefficient band. Per the pilot
stop rule, the other four accommodation cities were not collected; no coefficient refit, gate score,
source offset or holdout inspection was performed.

The ledger therefore remains at **55 found / 95 pending**: 25 attraction rows, 10 v2 pilot
accommodation rows and 20 legacy v1 rows awaiting an approved replacement rule. Seoul's SEOULDAL
observation was also replaced with the next-ranked paid historic-site observation, Changdeokgung
Palace. The current handoff records the pilot stop and the exact state required for a cold resume.

## v6 M2 — v2 re-collection stopped on a direction-flipping artifact signature (9 August 2026)

The pilot stop was superseded by the revised artifact-signature rule. The four legacy cities were
re-collected under `booking_top_picks_firstpage_median_v2`, then 13 additional development cities were
attempted. The ledger now has **118 found / 30 pending** cells: all 25 attraction rows and 93 of 125
accommodation rows. Seventeen cities have five found accommodation classes; Beijing and Nairobi have an
explicit `class_absent` one-star result. The remaining six development cities were not collected after
the stop condition fired, and no holdout city was collected or inspected.

The stop signature is a direction-flipping class-order violation. Most completed cities have 4-star above
3-star, but Delhi records A$32/A$34 = **0.941** and Prague A$134/A$144 = **0.931**. This is the exact
ordering-violation pattern now designated as a collection artifact, so it is not ladder evidence and does
not authorise a refit. The same panel strengthens the separate M5 note: dorm/3-star remains above the
fitted 0.163 band across multiple independent cities, consistent with the stale 2023 Price of Travel
coefficient already flagged in `coefficients-v6.json`. The private-room/1-star relationship remains a
candidate M5 ladder correction, but M2 does not refit either coefficient.

The Booking.com ground-truth panel has crossed the 12-city minimum for a future Booking → Expedia source
offset: 17 development cities have complete five-class accommodation rows. The offset remains unfitted;
no gate was scored, no coefficient was changed, and the holdout remains sealed. The Copenhagen stage-1
first-page bias caveat is now recorded in the ground-truth README and ledger `sourcePolicy`: the panel is
valid for ratios and source-structure calibration, not absolute city levels.

## v6 M2 — development panel completed and ladder validated (9 August 2026)

The previous stop on Delhi/Prague 4-star-versus-3-star direction flips is superseded. Across the 19-city
v2 panel, the ratios form a continuous distribution with median 1.404; Delhi 0.941 and Prague 0.931 are
near-parity low-tail dispersion, not collection artifacts. The genuinely defective v1 rows were Da Nang
0.64 and Phuket 0.28. The decision procedure is now explicit and owned by the loop: record and continue by
default; mark an artifact candidate only for a class-order violation exceeding 25%, a within-city ratio that
correlates with `classInventoryCount` across the batch, or an implausible 3-star level below A$10 or above
A$400. Stop and report only when artifact candidates exceed 30% of the cities in a batch. Individual
outliers never stop collection.

The six remaining development cities were then collected under `booking_top_picks_firstpage_median_v2`.
The development ledger now resolves all 150 cells: 25 attraction rows, 122 accommodation rows and three
explicit one-star `class_absent` results (Beijing, Nairobi and Melbourne). No development slot remains
pending. The requested 19-city ladder validation is:

| Relationship | Fitted k | GT median | Difference | Result |
| --- | ---: | ---: | ---: | --- |
| 4-star / 3-star | 1.337 | 1.404 | +5.0% | **CONFIRMED** (interval ±25%) |
| 1-star / 3-star | 0.666 | 0.745 | +11.9% | **CONFIRMED** (interval ±45%) |
| private room / 3-star | 0.592 | 0.800 | +35.2% | **At interval edge — M5 correction candidate** |
| dorm / 3-star | 0.163 | 0.319 | +96.5% | **REFUTED — stale 2023 coefficient confirmed** |

The 1-star median uses n=17 because two cities have explicit class absence; the other medians use n=19.
After the six-city extension, the full development refresh is 1.395 (4-star, n=25), 0.727 (1-star, n=22),
0.795 (private, n=25) and 0.295 (dorm, n=25), leaving the conclusions unchanged. v5 never validated a
single relationship against product ground truth; v6 has now validated all four across the 19-city panel
and rechecked them after the full development tranche. No coefficient was refit, no gate was scored, and
the Booking → Expedia offset remains unfitted for M3.

## v6 M2 — holdout collected and sealed (9 August 2026)

The six remaining development cities were followed by the 15 locked holdout cities from the frozen manifest.
Each holdout city has all six required measure slots in `data/reference/v6/ground-truth/holdout-ledger.json`:
Booking.com top-picks accommodation observations under the v2 contract and an official museum or historic-site
tariff where one could be verified, otherwise explicit `not_found` missingness. The holdout ledger is sealed
behind `holdout-seal.json` with `status: sealed_after_collection` and no score file.

This entry records collection and sealing only. Holdout prices, ratios and city comparisons were not inspected,
scored, fitted, or used to tune a prompt, coefficient, gate or source offset. The Booking → Expedia offset
threshold is crossed in the development panel, but fitting it and scoring the gates remain M3 work.
M2 exit is therefore complete: 150 development cells resolved, 90 holdout slots sealed, and no holdout result
has been revealed.

### v6 M2 artifact-candidate audit (9 August 2026)

Applying the owned batch rule to the completed 25-city development panel produced six artifact candidates,
24% of cities, below the 30% stop threshold. Every candidate is retained as a warning, but collection is not
reopened. The class-order candidates are private room above 1-star by more than 25%: Ho Chi Minh City
**A$38/A$27 = 1.41**, Singapore **A$99/A$73 = 1.36**, Seoul **A$105/A$80 = 1.31**, Delhi
**A$33/A$11.50 = 2.87**, Mexico City **A$92/A$50 = 1.84**. San Francisco is an implausible absolute-level
candidate because its 3-star median is **A$537**, above the A$400 ceiling. No development 3-star median is
below A$10.

A simple batch diagnostic found no inventory-depth signature: Pearson correlations of each within-city ratio
with log class inventory count were 4-star **0.035** (n=25), 1-star **−0.085** (n=22), private **0.124**
(n=25) and dorm **0.098** (n=25). These are recorded as the audit numbers, not as a gate score. The six
candidates are dispersion / source-panel warnings under the 24% batch rule; the private and dorm ladder
findings remain the substantive M5 conclusions already recorded above.

## v6 M3 — development refit and Booking → Expedia calibration (9 August 2026)

The validator's unreachable completion condition was repaired first. `complete` now means zero validation
errors and zero pending development slots; substance warnings are reported separately as
`substanceWarningCount` and never block `--require-complete`. The holdout seal now also records and validates
`methodologyVersion: v6.0` and the frozen manifest path.

The two refuted rungs were then refit from the 25-city Booking.com v2 development panel only. Private room is
**0.7955**, with a leave-one-city-out p90 residual interval of **±52%**; dorm bed is **0.2955**, with
**±54%**. Both retain grade C and generated provenance. The confirmed 4-star **1.3372 ±25%** and interpolated
1-star **0.6663 ±45%** coefficients were left unchanged. `coefficients-v6.json` is generated by
`scripts/fit-city-cost-ladder-v6.mjs`; no coefficient was hand-edited.

The Booking → Expedia 3-star source calibration is also generated there. It uses 15 matched development
cities, above the 12-city minimum: Booking.com v2 displayed-AUD ground truth is the calibration target and
Expedia 3-star class-trend output is the production anchor. The runtime Expedia→Booking multiplier is **0.9361**
with a **±41%** leave-one-city-out p90 residual interval; the inverse Booking→Expedia multiplier is recorded
explicitly. Four matched Expedia rows are the documented bare-dollar proxy, whose shared displayed-dollar basis
is absorbed by the offset and retained in provenance. The runtime collector now applies this fitted offset and
propagates its interval to the Expedia anchor.

No holdout value has been read. Candidate freeze and the one-time gate 2–6 scoring pass remain the next M3
actions; no tuning or rescore is permitted after the first holdout read.

## v6 M3 — candidate frozen and holdout scored once (9 August 2026)

Candidate freeze was committed before the first holdout read. `holdout-seal.json` records configuration hash
`sha256:bbd581154a657ccc0ffaf0b3a9ca3bac289564c0c9f8c5a53226785c094d2cde` and base commit
`f52be517359c51d878e667673918e88487e6199d`; the seal is now `revealed_once` and points to the one score file
`data/reference/v6/ground-truth/holdout-scores.json`. The holdout ledger itself was not modified with scoring
fields.

Gates 2–6 were scored once, with the frozen six-measure contract's limits preserved. Gate 2 passes dorm,
1-star, 3-star and 4-star, but private room fails the signed-error criterion: median APE **31.89%**, p90
**74.36%**, median signed error **+31.89%**. Gate 3's accommodation-category component passes with Spearman
**0.9642** and pairwise ordering **0.9429**; food-category and total-daily-cost components are not evaluable
because the panel has no food or drink measures. Gate 4 fails exact cost-band agreement at **73.33%** (within
one band **100%**). Gate 5 is not evaluable without a full food/drink basket. Gate 6 improves all five
evaluable accommodation tiers, but the manifest's 15/19 full-tier requirement cannot be claimed from a
six-measure panel. Gate 8's development fit remains recorded, but holdout reduction is not evaluable because
the holdout contains no paired Expedia production-anchor rows.

These are the initial raw score results, recorded before the audit correction. No coefficient, grade, interval
or offset was changed during the one-time scoring pass, and no second scoring pass is permitted. The later
reporting correction and private rollback are recorded below; the score remains tied to the original frozen
candidate hash.

## v6 M3 audit correction — contaminated gates and private rollback (10 August 2026)

The M3 audit corrected the report without rereading the holdout ledger or rescoring. The six-measure holdout
has no paired Expedia 3-star production-anchor observation, so the observed Booking three-star row was used
as its own prediction anchor. Gate 2's three-star row, Gate 4 cost-band agreement, and Gate 6's three-star
no-regression row are **not evaluable**. Gate 3's accommodation ranking remains **upper bound only** because
the anchor is the dominant term in the category sum and is ground truth. Gate 5 remains not evaluable without
food and drink inputs. The corrected score file retains the valid conditional ladder measurements: dorm median
APE **32.98%**, private **31.89%**, 1-star **30.45%**, and 4-star **13.26%**. Holdout attraction coverage is
**6 found / 9 missing**, so activities cannot be validated from this panel.

The private development fit **0.7955** over-predicted every holdout private row (median signed error and
median APE both **+31.89%**), implying a holdout ratio near **0.603**. The current coefficient was therefore
rolled back through `fit-city-cost-ladder-v6.mjs` to the pre-holdout v4-blended **0.5919 ±35%**. This is a
rollback, not a holdout fit; the score was run under the earlier frozen 0.7955 candidate, so the private rung
is no longer an independent holdout test. The development/holdout split — major-metro versus smaller,
touristic cities — is the primary M5 candidate for a cost-banded R1 private-room form. Dorm remains the
validated development refit at **0.2955 ±54%**.

An end-to-end test requires paired Expedia observations for the same cities and frozen window as Booking ground
truth. That belongs in M4 or a separately pre-registered future holdout; the existing holdout is not reopened.

## v6 M3 — Expedia production-anchor replication accepted (10 August 2026)

Experiment `001-expedia-production-anchor` was preregistered before collection and then run against the 15
matched development cities using the production Expedia prompt and delegated GPT-5.6 Luna test path. All 15
cities returned observed values in 15 provider calls and 52 searches; direct page reads and blocks were zero.
With the frozen USD→AUD snapshot and existing Expedia→Booking multiplier `0.9361`, median APE was **8.36%**
and median signed error **+7.08%**, so the preregistered acceptance rule passed. No coefficient or offset was
refit, and the spent holdout was not read. A late duplicate Cape Town response is retained as excluded audit
evidence; fixed invocation order selected the primary observed `$92` response.

The FX snapshot was checked against the ECB's 7 August 2026 reference rates. The frozen USD→AUD rate
`1.4298737728` is only **0.66% higher** than the checked `1.4203727785`; sensitivity improves the median APE
to 7.67% and does not change the verdict. The frozen rate remains primary because it was preregistered and
preserves reproducibility.

The full-basket validation remains open: paired Expedia plus food, drink and activity evidence is needed for
levels and Gates 4–5. Recommendation remains v6 for new cities only while the 121-city CSV stays on v1; do
not start M4 migration yet.

## v6 M3 â€” independent panel contract reset and two-star batch (10 August 2026)

The owner reopened M3 with a stricter scope: M3 now means fitting and holdout-validating all 19 product
tiers, not accommodation alone. The six-measure panel was accommodation-scoped, and its food, drink and
activity gates were only partly evaluable. The frozen contracts were amended to a 17-measure development
panel supporting all 19 tiers, with per-measure holdout seals and independent ground truth for every measure
that Numbeo or BudgetYourTrip supplies in production. Official menus, operator pages and attraction tariffs
are admissible; Numbeo/BudgetYourTrip are not ground truth for their own production-derived values.

Experiment `002-independent-anchor-panel` began with the preregistered hotel-2-star tranche. All 25
development cities produced found Booking.com observations under `booking_top_picks_firstpage_median_v2`:
first-page Our top-picks prices, the displayed class inventory count, public promotional rates where present,
and separate list-price fields. The rows were merged into `development-ledger.json`; coverage is now **172
found / 250 pending** across 25 cities x 17 measures. The remaining 250 cells are the ten independent
food, drink and activity measures. No coefficient was refit, no gate was scored, and no holdout value was
read.

## v6 M3 — independent menu/activity batch 001 (10 August 2026)

Experiment `002-independent-anchor-panel` batch 001 resolved all 60 non-accommodation slots for Hanoi, Ho
Chi Minh City, Da Nang, Phuket, Singapore and Taipei. The found rows use current official restaurant, bar,
operator or venue-menu pages, preserve source currency and every panel price, and retain tax/fee wording.
Rows that did not meet the independent selection rule were recorded as explicit `not_found`; no Numbeo,
BudgetYourTrip, third-party menu aggregator, or plausible substitute was used.

The batch added 31 found observations and 29 explicit missingness rows, taking development coverage from
**172 found / 250 pending** to **203 found / 190 pending**. Reduced panels are called out in evidence text
where a current official page exposed only one or two qualifying prices; they are not silently treated as
full five-page panels. No coefficient was refit, no gate was scored, and no holdout value was read. Next
batch is Beijing, Tokyo, Seoul, Delhi, Colombo and Mumbai.

## v6 M3 — independent menu/activity batch 002 (10 August 2026)

Experiment `002-independent-anchor-panel` batch 002 resolved all 60 non-accommodation slots for Beijing,
Tokyo, Seoul, Delhi, Colombo and Mumbai. The 11 found rows use current official restaurant, bar, operator or
venue-menu pages, preserve source currency and every panel price, and retain tax/fee wording. Tokyo's
McDonald's combo uses the official city menu rule; the other found rows use the preregistered independent
menu panel rule. Rows that did not meet the independent selection rule were recorded as explicit
`not_found` or `class_absent`; no Numbeo, BudgetYourTrip, third-party menu aggregator, or plausible substitute
was used.

The batch added 11 found observations and 49 explicit missingness rows, taking development coverage from
**203 found / 190 pending** to **214 found / 130 pending**. No coefficient was refit, no gate was scored, and
no holdout value was read. The remaining development tranche is Istanbul, Dubai, Cairo, Cape Town, Nairobi,
Budapest, Prague, Lisbon, Barcelona, Mexico City, Lima, San Francisco and Melbourne.

## v6 M3 — independent menu/activity batch 003 (10 August 2026)

Experiment `002-independent-anchor-panel` batch 003 resolved all 40 non-accommodation slots for Istanbul,
Dubai, Cairo and Cape Town. The 20 found rows use current official restaurant and bar menus, preserve source
currency and every panel price, and retain tax/fee and serving-basis wording. The remaining 20 rows are
explicit `not_found` because the bounded official route did not produce a compliant observation; no Numbeo,
BudgetYourTrip, third-party menu aggregator, or plausible substitute was used. The batch included the first
independent wine-glass rows with an explicit 15 cl or 0.125 litre serving basis, and domestic draft beer only
where the official menu stated a draft/on-tap serving.

The batch took development coverage from **214 found / 130 pending** to **234 found / 90 pending**. The
validator returned zero errors; its accommodation substance warnings are the standing tripwires and no new
batch-level artifact signature exceeded the owned 30% stop threshold. No coefficient was refit, no gate was
scored, and no holdout value was read. The next tranche is Nairobi, Budapest, Prague, Lisbon, Barcelona,
Mexico City, Lima, San Francisco and Melbourne.

The verification baseline also exposed and repaired a replay-fixture regression: the historical warning test
uses the pre-two-star `a80e922` ledger, so the validator now evaluates its five-class substance order and adds
the two-star ratio check whenever that row is present. The replay again confirms inversion, sub-amount AUD and
ratio-band warnings for Hanoi, Phuket and Da Nang.

## v6 M3 — independent menu/activity batch 004 (10 August 2026)

Experiment `002-independent-anchor-panel` batch 004 resolved all 40 non-accommodation slots for Nairobi,
Budapest, Prague and Lisbon. The 18 found rows use current official restaurant, bar and venue menus, preserve
source currency and every panel price, and retain tax/fee and serving-basis wording. The 22 remaining rows are
explicit `not_found` because the bounded official route did not yield a compliant observation; no Numbeo,
BudgetYourTrip, third-party menu aggregator, or plausible substitute was used. Nairobi's official hotel menu
was not promoted into the midrange or premium estimands because it did not provide a defensible qualifying
venue panel. Prague contributed the first independent 0.4 litre domestic draft-beer panel in this tranche;
Budapest and Lisbon contributed explicit 0.15 litre wine panels.

The batch took development coverage from **234 found / 90 pending** to **252 found / 50 pending** across the
25-city x 17-measure ledger. No new batch-level artifact signature exceeded the owned 30% stop threshold.
No coefficient was refit, no gate was scored, and no holdout value was read. The next tranche is Barcelona,
Mexico City, Lima, San Francisco and Melbourne.
## v6 M3 — independent menu/activity batch 005 (10 August 2026)

Experiment `002-independent-anchor-panel` batch 005 resolved all 50 non-accommodation slots for Barcelona,
Mexico City, Lima, San Francisco and Melbourne. It added **17 found observations and 33 explicit missingness
rows**, taking development coverage to **269 found / 0 pending** across the 25-city x 17-measure ledger.

Found rows came from current official menus: Abrelatas in Barcelona; Meroma, Tagers and Street Art Hotel in
Mexico City; El Chinito and Limaná in Lima; Hazie's in San Francisco; and Dame, Neptune, Aegli and Matteo's
in Melbourne. A current official route was not promoted when it lacked the required panel size, serving basis,
three-course structure or current regular price. In particular, bottled/canned beer was not substituted for
draft, unlabelled wine glasses were not substituted for the 125–175 ml target, and activity/operator routes
that did not yield compliant scheduled group prices remain `not_found`. No Numbeo, BudgetYourTrip, delivery
menu, aggregator, happy-hour or other promotional price was used as ground truth.

The validator returned zero errors, zero pending slots and 19 standing accommodation substance warnings. No
new batch-level artifact signature exceeded the owned 30% stop threshold. The arithmetic audit caught and
corrected two Melbourne median values before completion. No coefficient was refit, no gate was scored, and no
holdout value was read. Phase 2 collection is complete; the next action is script-generated Phase 3 fitting
of every non-accommodation derivation, with leave-one-city-out provenance, residual intervals and a dated
decision on whether cocktail/wine remain laddered or receive a production spine call.

## v6 M3 — McMeal street-food proxy superseded (10 August 2026)

An audit found that `deriveStreetFromMcMeal` copied the Numbeo `mcmeal_combo` anchor unchanged into
`street_food_meal_1p` (`k=1.0`) and stamped the relationship grade B with a ±20% interval. That is an
asserted constant, not a fitted derivation. The retained v5 Numbeo panel shows same-city McMeal/inexpensive
ratios from **0.40 to 3.46** (median **0.817**, 36 cities); McMeal is more expensive than an inexpensive
local meal in 13 cities, with the most extreme ratios concentrated in Southeast Asia. The global-brand
pricing mechanism is not the street-food estimand.

The 2026-08-10 contract amendment therefore adds independent `street_food_meal_1p` observations to the
development and fresh holdout measure lists. Street food will be selected from official street-stall,
market-board, bakery-takeaway or local prepared-meal menus under `independent_street_food_panel_first5_median_v1`.
The new relation will be generated as `street_food_meal_1p / inexpensive_restaurant_meal_1p`, with
leave-one-city-out residual interval and grade C. McMeal remains in the production call and will be reported
as a per-city diagnostic only; the v1 CSV comparison and the v5 panel are not a fitting basis. Phase 2's
previous 269/0 count is superseded by the amended 18-measure panel's 269 found / 25 pending slots.
No holdout value was read, no gate was scored, and the 121-city CSV remains untouched.

## v6 M3 — independent street-food panel and generated relation (10 August 2026)

The amended `city-cost-v6-ground-truth-ledger-v4` contract adds `street_food_meal_1p` as an independent
18th measure. Batch 006 collected 11 compliant rows from official vendor, market, bakery-takeaway or local
prepared-meal menus and recorded 14 explicit `not_found` rows; zero cities had official evidence proving
the category absent, so `class_absent` count is 0. The validator returned **280 found / 0 pending**, zero
errors and the same 19 accommodation substance warnings. No Numbeo, McDonald's or delivery/aggregator price
was used as street-food ground truth.

The generator now fits `street_food_meal_1p <- inexpensive_restaurant_meal_1p` rather than copying McMeal.
The six currency-compatible development pairs produce R0 `k=0.3248`, LOO median APE **100.73%**, p90
**335.59%** and a grade-C residual interval of **±336%**. The tested R1 cost-band candidate ties R0 because
no cost band has three eligible pairs, so R0 is selected and both candidates are retained in
`coefficients-v6.json`. This is intentionally weak evidence and must be validated on the fresh holdout;
the wide interval is not hidden. The old McMeal identity (`k=1.0`, grade B ±20%) is superseded and McMeal
is retained only as a diagnostic. The report also records that the modeled `food_street_food` and
`food_budget` tiers have correlation 1 because both are deterministic functions of the inexpensive anchor;
direct street rows provide independent evidence for the fit, not independent production signal.

No coefficient was hand-edited, no gate was scored, no holdout value was read, and the 121-city CSV remains
untouched. The next action is fresh per-measure holdout collection, followed by one all-19 candidate freeze
before any new holdout value is read.

## v6 M3 — fresh per-measure holdout extension and integrity-limited score (10 August 2026)

Batch 007 collected the 15-city fresh extension under the per-measure seal. All 180 slots were resolved:
12 found independent official-menu rows and 168 explicit `not_found` rows. The found rows retain their source
currency and panel prices; NPR and JOD rows are preserved as source facts but cannot be converted by the frozen
FX snapshot. No missing row was filled from Numbeo, BudgetYourTrip, a proxy, or a plausible substitute.

The extension was sealed before candidate freeze. Exactly one candidate was frozen by
`freeze-city-cost-v6-candidate.mjs`; the fresh extension was then read once by
`score-city-cost-v6-holdout-all-tier.mjs`. That scorer did not open any of the six old `revealed_once`
measures. It recorded gates 2-6 as `not_evaluable`, not passes: the fresh ground truth has no paired
production-path prediction bundle, and the spent old measures cannot be reopened to construct an end-to-end
daily basket. Ratio-only validation is also not evaluable where both independent sides are not found and
frozen-FX comparable. This is the honest M3 result for the current holdout contract; the missing prediction
bundle and the spent-measure boundary are explicit reasons, not a scoring failure to tune around.

## v6 M3 — supersede item-level holdout route and reset to product-tier validation (10 August 2026)

The owner stopped the prior M3 collection approach. The 25-city development ledger is preserved at **280
found / 0 pending** across 18 measures; the previous holdout is spent, with all 18 measures `revealed_once`.
No holdout value was reopened, rescored, frozen against, or used for tuning.

The diagnosis is twofold: the old process collected truth without generating the matching production
predictions, so scoring could only return `not_evaluable`; and item-level food, drink and activity sources
are sparse and do not measure the product's daily-spend estimand. The active route is now to generate exact
production-path predictions, collect BudgetYourTrip's tier-labelled daily food/activity spend for the
development panel, add Expatistan cocktail and neighbourhood-pub beer cross-checks for Numbeo drinks, and
score development in-sample. BYT activity rows are explicitly production-sourced and unvalidated; the
official attraction panel remains the independent budget-activity check. Wine glass is not recollected after
the rejected bottle calibration route.

The new generator is `scripts/generate-v6-prediction-bundle.mjs` and its first run is stored under
`data/reference/v6/experiments/007-production-prediction-bundle-initial/`: **0/25 materialized** because no supported
provider credential is configured in this checkout. Every city is recorded `not_run`; no prediction was
fabricated. No new holdout action is permitted before Phase 6, which will verify BYT page coverage, add a
minimum-coverage freeze guard, propose a fresh 15-city panel, and stop for owner approval.

The development evidence artifacts are now banked. BYT covers 24/25 development city pages with 144 found
labelled tier rows; Colombo is explicit `not_found`. Expatistan contributes 4 accepted cocktail rows and 3
accepted neighbourhood-pub beer rows; remaining cities are explicit missingness and wine glass is not collected. The generated prior artifact
`data/reference/v6/priors-v6.json` uses 246 AUD-convertible direct ledger rows plus the BYT tier panel and no
shipping-CSV inversion. The in-sample scorer is present, but with 0/25 production predictions it correctly
reports all 19 tiers blocked rather than scoring truth against nothing.

Phase 6 page verification found a 15-city proposal across the nine regions in
`data/reference/v6/ground-truth/fresh-holdout-proposal-v2.json`. Its pre-registered minimum is 72 found BYT
tier rows out of 90; below that the freeze script must refuse and no holdout may be read. The proposal has
no tier values. No new holdout was drawn, frozen, read or scored, and the owner must approve before that can
change.

## v6 M3 — pair delegated spine responses with deterministic production derivation (10 August 2026)

The provider-key prediction attempt in experiment 007 is superseded as the default route. It remains
archived as a faithful 0/25 fail-closed run: no supported local provider credential was configured and no
prediction was fabricated. Experiment 006 generalizes experiment 001's delegated production-prompt method.
It stores one raw, schema-validated response and one telemetry record per city/source, reuses the 15 existing
Expedia responses byte-for-byte, and collects the remaining Numbeo, BudgetYourTrip and Expedia responses under
the frozen window. All 75 response files and 75 telemetry files passed the spine schema, identity/search
budget and `directPageReads=0` checks; Dubai's `UAE`/`United Arab Emirates` spelling is handled by an explicit
country-alias identity check.

Stage B runs `buildV6CollectionResultFromSpineResponses` and the real `materializeCityCostV6` library path.
It produced complete 19-tier bundles for **25/25** development cities. The development score is explicitly
**IN-SAMPLE**: 10 tiers evaluable, one definitional (`activities_free`) and 8 blocked. The blocked set is
street food (no direct daily-tier truth), five drinks (no independent full basket), and BudgetYourTrip
mid/high activities (circular production source). Gates 3–6 are `not_evaluable`; this is not a holdout result.

The street-food decision is superseded again, this time in favour of the measured evidence: the shipped
coefficient is the paired R0 `k=0.3248` from n=6, grade C with the full ±336% LOO-p90 interval. The direct
prior ratio of marginal medians is 0.276; the coefficient warning records why that differs from the
median-of-paired-ratios and does not silently choose between them. The former reasoned 0.5 constant is not
used. The prior generator now records all 34 frozen-FX exclusions rather than silently dropping them:
EGP/Cairo 7, LKR/Colombo 2, PEN/Lima 4, SGD/Singapore 8, TWD/Taipei 6 and ZAR/Cape Town 7.

Experiment numbering is repaired: the old empty provider attempt is `007-production-prediction-bundle-initial`,
the current collection is `006-development-prediction-spine`, and the score is normalized under
`005-development-in-sample-score/`. The spent holdout and the proposed fresh holdout were not read, changed,
frozen or scored.

## v6 M3 — post-derivation food fix and honest development score (10 August 2026)

Audit found a live materializer defect: `applyDirectTierPriors` checked the pre-derivation anchor map, so
derived `street_food_meal_1p` and `premium_restaurant_meal_2p` made all three food baskets fall back to
grade-D direct tier priors even when their Numbeo source anchors were observed. The requirement check now
uses the post-derivation set; observed and modelled anchors satisfy it, while imputed anchors still fall back.
A regression test proves that observed inexpensive and midrange anchors retain the basket formulas.

Stage B was rerun from the existing experiment 006 disk responses with zero LLM calls. The corrected
development score is **IN-SAMPLE ONLY**: six accommodation tiers remain genuine; food budget is n=14 with
median APE 24.22%, food mid-range n=13 with 37.40%, and food high-end n=13 with 51.99%. The score records
the excluded cities per tier because a food score requires observed Numbeo source anchors, not priors:
budget excludes Singapore, Taipei, Colombo, Mumbai, Istanbul, Dubai, Cairo, Cape Town, Nairobi, Prague and
Lima; mid/high exclude the same list plus Budapest. The old food results 14.56%, 14.34% and 13.76% are
superseded: they compared BYT regional medians against BYT city truth and measured source dispersion, not
method accuracy.

The 54.19% activities-budget result is also superseded. The official rows are single-admission ticket
observations, while production predicts two-person daily activity spend. The contract now uses the daily
BYT estimand for all three activity tiers; the 25 ticket rows remain preserved under their different
estimand, and no activity recollection occurred. Daily activity spend is structurally unvalidated because
BYT is production and no independent spend panel is identified; Price of Travel is the candidate future route.

The uniform minimum fitted-relation threshold is n=8. The measured street-food relation (n=6, k=0.3248,
LOO-p90 ±336%) is diagnostic only. The generated shipped fallback is the global direct-evidence prior ratio
k=0.2757, grade D ±45%, matching `priors-v6.json`; premium n=3 remains the parallel grade-D 1.5 fallback.
No coefficient was hand-edited, no holdout value was read or changed, and the 121-city CSV remains untouched.

## v6 M3 — food basket boundary and composition diagnostic (10 August 2026)

The existing 25-city prediction bundles and BYT food panel were re-analysed without collection, holdout
access or coefficient changes. Adding the product's drink tiers to food closes the budget discrepancy:
food-only prediction/truth is **0.76x**, rising to **0.90x** with `drinks_none` and **1.04x** with
`drinks_light`. This is recorded as a category-boundary artifact: BYT's Food & Meals figure evidently
includes beverages that the product assigns to drinks. The adjustment barely closes the mid/high gaps:
`food_mid_range` moves **0.63x → 0.70x**, and `food_high_end` **0.48x → 0.51x**. Those remain genuine
basket-composition questions.

A non-negative, no-intercept diagnostic re-fit against the scoreable BYT rows gave identifiable effective
weights, not raw street/premium terms: mid-range **1.7674 × inexpensive + 1.3618 × midrange** (n=13)
and high-end **0 × inexpensive + 4.2724 × midrange** (n=13). The mid re-fit improved LOO median APE
from **37.41% to 36.98%** but worsened p90 from **46.92% to 48.39%**, so it does not beat the current
basket on both criteria. The high re-fit improved LOO median APE **51.99% → 29.82%** and p90
**61.00% → 47.21%**. These are diagnostic candidates only; no re-weighting ships.

Numbeo coverage is materially skewed: inexpensive observed **14/25 (56%)**, midrange **13/25 (52%)**,
and all five production anchors **13/25 (52%)**. Regional all-five rates are Africa 0/3, East Asia
3/4, Europe 2/4, Latin America 1/2, Middle East 0/2, North America 1/1, Oceania 1/1, SEA 4/5 and
South Asia 1/3. The food score therefore runs on a Western/East-Asian-leaning subsample and may not
generalise to cities with weak Numbeo coverage. The detailed diagnostic is
`data/reference/v6/m3-food-basket-diagnostic.json`; the generated report incorporates it.

## v6.1 — reachable finish line adopted (10 August 2026)

The owner stopped the all-19 independent-validation programme because it had become the same kind of
unreachable process v6 was intended to replace. The production architecture itself succeeded: 25/25
development cities materialized through the real path, and the six accommodation tiers achieved genuine
development median APE from **8.27% to 25.46%**. The failure was treating food, drink and activity planner
presets as 13 additional independently observable city prices. The 450-slot item ledger found 280 rows, the
spent fresh extension found only 12/180 rows, and complete gates remained structurally not evaluable.

The superseding v6.1 contract keeps every one of the **19 user-facing tiers**. New-city collection is three
source-native calls: Expedia 3-star accommodation; BudgetYourTrip food budget/mid/high and activity
budget/mid/high per person/day; and Numbeo cappuccino plus domestic beer. Deterministic code applies the
banked accommodation ladder, scales BYT values to two people, composes the existing drink presets, and
models street food plus cocktail with explicit grades and intervals. Missing data uses one category tier
vector fallback rather than the v6.0 anchor/relation/basket/direct-prior chain.

The active design is `docs/dev/plans/city-cost-methodology-v6-1.md`; the reachable gates are frozen in
`data/reference/v6/validation-manifest-v6-1.json`; the three verbatim source contracts are the
`docs/prompts/llm_prompt_city_cost_v6_1_*.md` files. `LOOP-PROMPT-V6.md` and
`docs/dev/handoffs/city-cost-v6.md` now give GPT-5.6 Luna Max the phased implementation sequence, exact
commits, generated tooling, verification baseline, stop rules and Definition of Done.

No implementation claim is made by this entry: v6.1 source schemas and materialization are the next work.
Existing experiments 003 and 006 provide development fixtures with zero new model calls. Every old holdout
remains spent and closed, the proposed fresh holdout is cancelled for v6.1, the accommodation coefficients
are frozen, and `data/reference/city_costs_app_aud.csv` remains unchanged. v6.1 releases only for new-city
generation behind the existing opt-in flag; migration of the 121 stored cities is a separate future decision.

## v6.1 — source-native spine contracts (10 August 2026)

Phase 1 is complete. `src/lib/city-cost-v6-1-collection.ts` adds the strict
`city-cost-v6-1-spine-response-v1` contract for exactly nine source facts: Expedia 3-star, six BYT daily
food/activity tiers, and Numbeo cappuccino plus domestic beer. It enforces exact source-specific measure
keys, per-source search ceilings totalling ten per city, and zero direct page reads. Missingness remains
explicit and unsupported currencies do not become fabricated values.

The three v6.1 prompts are now wired to the new collector. The legacy v6.0 collector and parser remain
unchanged so stored responses and historical experiment 006 can still be replayed. No LLM call, holdout,
coefficient, prior or CSV was changed. Phase 2 — the simplified deterministic materializer and feature-flag
handoff — is the next action.

## v6.1 — source-native development replay and feature switch (10 August 2026)

Phase 3 of the reachable v6.1 finish line is complete. No new LLM calls, holdout reads or shipping-CSV
reads were made. The existing delegated experiment 006 responses and the 003 BudgetYourTrip daily-tier
panel were deterministically normalized into 75 v6.1 source fixtures under
`data/reference/v6/experiments/008-v6-1-development-fixtures/`, then validated through the new collector
contract and the real `materializeCityCostV61` implementation.

All 25 development cities produced all 19 tiers. Category fallback was explicit in 5 accommodation cities,
1 food city, 12 drinks cities and 1 activity city. The generated `priors-v6-1.json` is decoupled from the
historical `priors-v6.json` and from `data/reference/city_costs_app_aud.csv`; eight source rows were excluded
because the frozen FX snapshot lacks SGD, TWD, ZAR or PEN, and those exclusions are listed in the generated
file. The feature-flagged new-city path now uses v6.1; the historical v6.0 path remains available for replay,
flag-off remains v1, and the 121-city CSV is unchanged.

## v6.1 — reachable release checks complete (10 August 2026)

Phase 4 passed through `scripts/validate-city-cost-v6-1-release.mjs --check`: all 25 development cities
materialize all 19 tiers with finite values, complete provenance, explicit category fallback, ordered
presets and deterministic replay. The nine reachable gates pass, including the banked accommodation
result (8.27%–25.46% median APE), three-call/ten-search/zero-direct-read economics and flag integration/
rollback. The generated artifacts are `data/reference/v6/v6-1-release-validation.json` and
`data/reference/v6/v6-1-development-release-report.md`.

The report's v1 comparison is read-only informational A/B evidence, not ground-truth validation. Food and
activities remain BYT source-backed estimates, drinks remain source-priced presets, and no independent
accuracy claim is made for those categories. No new collection, holdout read, coefficient refit or shipping
CSV change occurred. The v1 rollback regression test now explicitly verifies that an unset
`CITY_COST_METHODOLOGY_V6` flag leaves the v1 path selected. Phase 5 is final baseline and release-boundary
documentation.

## v6.1 — new-city release boundary complete (10 August 2026)

Phase 5 is complete for new-city generation. The v6.1 feature flag, v1 rollback, three-call source
contract, category fallback, 25-city × 19-tier replay, generated release report and all reachable gates
are documented and verified. The full baseline passed: TypeScript, build, 35 test files / 163 tests, memory,
legacy coefficient and warning checks, ground-truth ledger validation, v6.1 priors/materialization checks
and release validation. The branch is pushed at `a5848a5` plus the final documentation closure commit.

The 121-city CSV remains unchanged and no holdout was read or collected. v6.1 is ready for new-city
generation only; migrating the existing CSV is M4 and remains a separate future decision.

## v6.1 release-hardening correction — 12 August 2026

The 10 August v6.1 completion record claiming that all nine reachable gates passed is superseded. The
deterministic materializer and 25-city replay were sound, but the production persistence boundary only
recognized `v6.0`, so a v6.1 result could be misclassified as v1 and lose its grades, intervals, telemetry,
missingness, prior basis and input snapshot. Commits `a8e93ce` and `68c17c8` added explicit v1/v6.0/v6.1
persistence and API/UI provenance coverage without changing the CSV or holdouts.

The release validator was also corrected: source-dependence and integration are computed from actual
fixtures, development coverage is measured at 25/25, runtime >=95% coverage is recorded as unmeasured,
and Gate 10 verification is recorded as external evidence. The generated status is
`scored_development_runtime_unmeasured`; this is a truthful development release score, not a claim that
runtime coverage or the external baseline was observed by the validator. The dated Phase 4 and Phase 5
records below supersede the earlier statement that those hardening phases remained open.

## v6.1 frozen-FX coverage maintenance — 12 August 2026

Phase 4 is complete with no model/provider collection. The frozen 22 July AUD snapshot now has
source-attributed rates for SGD and TWD from the Reserve Bank of Australia, ZAR from the European Central
Bank, and PEN from the Central Reserve Bank of Peru cross-referenced to the frozen USD/AUD rate. The
derivations and source dates are stored in `data/reference/fx/city_cost_fx_aud_2026-07-22.json`.

Regenerated priors and the 25-city v6.1 materializations removed all 34-currency exclusions: prior
construction now excludes 0 rows instead of 34. Direct Numbeo drink coverage improved from 13/25 cities
(52%) to 17/25 (68%); drink fallback declined from 12 to 8 cities. The generated coefficient artifact
was also refreshed to restore its deterministic check after the earlier street-food gating change; the
accommodation coefficients and source offset are byte-equivalent in substance, with no accommodation
refit. No city-price collection, holdout, or shipping-CSV change occurred.

## v6.1 Phase 5 rollout preview — 12 August 2026

Phase 5 is complete without provider, web, city-price or holdout access. The deterministic preview compares
the 25 existing v6.1 development fixtures × 19 tiers with the unchanged v1 CSV, and records every city ×
tier pair, category subtotals, fixed representative budget/mid-range/high-end baskets, median and p10/p90
tails, and explicit >2x/<0.5x flags. The protocol and generated artifacts are experiment 009,
`data/reference/v6/v6-1-rollout-preview.json`, and `data/reference/v6/v6-1-rollout-preview.md`; the CSV
SHA-256 is `0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8`.

This is an operational impact comparison, not ground-truth validation. It recommends NEW-city-only v6.1
activation behind the existing feature flag after owner review. Runtime >=95% coverage remains unmeasured;
global flag enablement, migration of the 121-city CSV, holdout work and M4 remain out of scope.

## v6.1 M4 coherent-library migration decision — 12 August 2026

After reviewing the completed v6.1 implementation and Phase 5 rollout preview, the owner approved
migration of the existing 121-city library as part of this workstream. This dated decision supersedes the
new-city-only recommendation above; the generated preview remains valid as an operational comparison and
is not rewritten as ground-truth evidence.

The migration sequence is deliberately gated: first reconcile the stale release declarations with the
generated cocktail coefficient (`2.4838`, n=14, grade C, ±64%) and make the release validator detect future
contract drift; then run a representative 20-city live-provider canary to measure the currently unmeasured
≥95% runtime clause; then generate the frozen 121-city frame in resumable batches into a staged CSV and
full provenance sidecar. A complete v1-versus-v6.1 impact report must be reviewed before the live CSV or
global generation default changes.

The preview's 81/450 non-zero tier comparisons outside 0.5×–2× v1, including `food_high_end` above 2× in
18/25 cities, require visibility and staged review but are not a fitting target: v1 is not ground truth.
The approved finish line avoids an indefinite mixed-method library. Cutover and rollback each move the CSV
and new-city default together. No holdout is reopened, no accommodation coefficient is refit, and the live
121-city CSV remains unchanged at this planning decision.

## v6.1 Phase 6 release-contract reconciliation — 12 August 2026

Phase 6 completed and was committed/pushed after the owner-approved migration decision. The active
`validation-manifest-v6-1.json` was bumped to schema v3 and reconciled with the generated
`coefficients-v6.json`: `cocktail_1 = 2.4838 × cappuccino_1`, n=14, grade C, interval ±64%.

The release validator now compares the manifest coefficient key, source anchor, value, grade, interval,
authority and relation text against the generated artifact. A temporary negative regression restored the
superseded `2.6`, ±75% declaration and confirmed that `--check` fails with explicit drift errors. Generated
release validation, development report, rollout preview and experiment protocol were regenerated through
their scripts. No provider call, city-price collection, holdout access, coefficient refit or live CSV change
occurred. Phase 7—the pre-registered 20-city live-provider canary—is now the exact next action.

## v6.1 Phase 7 runtime canary — 12 August 2026

Phase 7 was preregistered and attempted against the actual `generateCityCostEstimate` production path with
`CITY_COST_METHODOLOGY_V6=true`, using the frozen CSV/FX/prompt hashes and the 20-city frame in
`data/reference/v6/experiments/010-v6-1-runtime-canary/`. The canary failed its registered coverage gate:
0/20 cities completed all 19 tiers, versus the required 19/20.

Every city failed closed before the first source call because this environment had no
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`. The result records the exact missing-provider
error per city. No fixture replay, delegated collection or v1 comparison was substituted; no holdout was
read and no CSV was written. This is a failed runtime-coverage gate, not evidence about source quality or
materialization correctness. Phase 8 is stopped until a real server-side provider credential is configured,
then the same frozen canary must be rerun without changing its threshold or city frame.

## v6.1 Phase 7 canary audit and owner correction — 12 August 2026

The Phase 7 interpretation above is superseded. Experiment 010 remains an accurate record of a CLI run
without an application provider key, but no provider call occurred; `0/20` is therefore a credential
preflight result, not measured runtime or source coverage. Production users still provide their own key in
the web app. For development and migration, the owner approved Codex subagents for schema-constrained Stage
A, followed by the shipped deterministic parser, `materializeCityCostV61`, persistence adapter and API
parser as Stage B.

The audit also found that a key would not have made experiment 010 valid. The city-cost client sends plain
JSON-completion requests without enabling the provider web-search tools required by all three prompts, and
the prompt renderer substitutes the same `referenceDate` for Expedia arrival and departure, turning the
registered one-night stay into a zero-night window. The canary predicate omits registered call-count and
artifact-fraction gates, can count all-prior fallback output as source coverage, discards partial failed-city
calls and checks provenance mainly by field counts rather than equality.

The replacement sequence is Phase 7A production collection repair, Phase 7B a fresh delegated 20-city
operational canary, then Phase 8/9 staged migration. A small user-key provider/database/API smoke remains a
pre-cutover requirement, while ≥95% complete-generation coverage becomes a monitored post-release SLO; a
19/20 sample is not presented as statistical proof of that population rate. Experiment 010 is preserved and
must not be rerun or mutated. No holdout or live CSV was touched by this correction.
## v6.1 Phase 7A collection-boundary repair — 12 August 2026

Phase 7A completed after the audit of experiment 010. The v6.1 production spine now routes through the
existing provider-specific web-search adapters, requires provider-observed search activity, preserves raw
provider envelopes and partial/error call telemetry, and enforces the three-call/search/direct-read contract.
Expedia receives distinct arrival and departure dates, with a regression for the frozen 17–18 September
2026 one-night window. A pure canary evaluator now checks schema and city identity, call cardinality,
per-source and per-city search ceilings, retries, provenance equality through persistence/API parsing and
the 30% all-prior artifact threshold. Anchors and input snapshots are exposed to the API provenance parser.
Generated development materializations were regenerated without duplicating raw provider responses; the
raw collection evidence remains in the experiment layer. No provider call, holdout access or live CSV write
occurred. Phase 7B is now the exact next action: collect the fresh delegated 20-city canary in experiment
011, leaving immutable experiment 010 untouched.

## v6.1 Phase 7B delegated operational canary failed — 12 August 2026

Experiment 011 was preregistered from experiment 010's immutable 20-city frame with the corrected search-enabled
collection boundary, distinct Expedia arrival/departure dates (`2026-09-17` to `2026-09-18`), three source calls per
city, the 4/4/2 search ceilings, ten-search city ceiling and zero direct reads. Codex subagents supplied the raw
Stage-A responses and telemetry; local Stage B used the shipped schema parser, `materializeCityCostV61`, persistence
adapter, API provenance parser and pure canary evaluator. All 20 cities have three raw responses and three telemetry
records in the experiment directory.

The registered gate **failed at 17/20 complete cities**, below the required 19/20. The artifact threshold passed:
two artifact candidates (Cape Town and Lima) are 10% of the batch, below the 30% maximum. The failures are explicit:
Dubai's three responses changed the registered city/country identity; Cape Town's BYT response used schema-invalid
null `sourceTitle`/`evidenceText` fields for blocked measures; Lima's Expedia response used the same schema-invalid
missingness representation. The evaluator therefore rejected those two cities rather than converting them into
source coverage. Seventeen successful cities proved the search ceilings, zero direct reads, three-call records,
19-tier materialization and field-by-field persistence/API provenance equality.

This is a failed operational contract gate, not evidence to tune coefficients or compare with v1. The owner stop rule
now blocks Phase 8 migration tooling and any rerun of the canary until this batch is reviewed and a corrected attempt
is authorized. The 3–5-city user-key smoke remains pending before cutover; it is not a substitute for the failed
19/20 gate. No holdout was read, no live CSV was written, no accommodation was refit, and no Phase 8 migration
artifact was retained.

## v6.1 Phase 7D boundary correction — 12 August 2026

Experiment 011 remains immutable failed history at 17/20 complete. The three failures are now recorded as
regression fixtures rather than reasons to tune the methodology: Dubai's `UAE` versus `United Arab Emirates`
identity was a comparator defect; Cape Town and Lima used null documentary fields for explicit missingness;
and the from-disk loader discarded the two successful source calls beside an invalid one. The production and
canary paths now share canonical country identity, normalize documentary nulls only for non-observed measures,
and preserve every raw response, telemetry record and validation error independently.

The domestic-beer contract is also corrected. Numbeo's canonical `Domestic Draft Beer (0.5 Liter)` row is now
accepted alongside `Domestic Draft Beer (1 Pint)` with the displayed unit preserved and no conversion. The old
1-pint-only contract is superseded because it rejected the canonical row in most 011 responses and forced all
drink tiers to fallback. Bottled/imported beer remains excluded; this changes no coefficient or basket count.
The release validator now reads the explicit hashed 011 result artifact and reports its failed status rather than
pending. A fresh 012 delegated canary is authorized only after this phase's baseline passes; experiments 010/011,
all holdouts and the live CSV remain untouched.

## v6.1 Phase 7E corrected delegated canary failed — 12 August 2026

Experiment 012 (`012-v6-1-corrected-delegated-canary`) is immutable failed evidence. It used the corrected prompts,
shared identity comparator, safe missingness parser and real Stage-B materializer/persistence/API path. Codex
delegated Stage A supplied 30 of the registered 60 source-call records before the practical collection route
timed out/exhausted. Stage B therefore completed 10/20 cities and marked the other 10 as incomplete artifact
candidates: 50%, above the 30% limit. The observed totals were 30 attempted/valid responses, 72 searches, zero
retries and zero direct page reads. The 10 complete cities produced all 19 tiers and passed provenance round-trip.

This is a delegation-capacity/incomplete-frame failure, not evidence against v6.1 coefficients, source quality or
the corrected domestic-beer contract. No raw response was invented, and missing records were not converted into
source-level `not_found`. Experiments 010/011, all holdouts and the live CSV remain untouched. Phase 8 migration
is blocked; no further canary is authorized without owner review and a decision on the collection mechanism.

## v6.1 Phase 7F resumable collection lifecycle — 12 August 2026

Phase 7F is complete and experiments 010, 011 and 012 remain byte-for-byte immutable. Experiment 012's original
10/20 result is retained as incomplete-orchestration history, not promoted to a clean canary: independent inventory
finds 35 raw files, 32 telemetry files, 32 reusable raw+telemetry pairs and 28 pending slots in its registered
60-call frame. Lisbon and Prague's valid Expedia pairs and Colombo/Dubai raw-only evidence are now visible rather
than erased by an all-or-nothing loader.

The new lifecycle inspects every city/source call independently, distinguishes assignment attempts from actual
provider-call telemetry, preserves invalid/error evidence, and refuses finalization while any new experiment slot is
pending. Missing collection is not converted to source-level `not_found`, and pending/uncollected cities are not
artifact candidates. The next authorized action is experiment 013 after owner review; it was not created or collected
in this run. Experiment 012 contains no assignment ledger, so assignment attempts are reported as unrecorded rather
than inferred. No holdout was read, no live CSV was written, and no coefficient or accommodation fit changed.

## v6.1 Phase 7G resumable delegated canary failed — 12 August 2026

The Phase 7F next action above is superseded. Experiment 013 was preregistered against the same 20-city frame,
17–18 September 2026 Expedia window, current prompts/implementation/FX/CSV hashes and mixed
`validated_experiment_012_reuse+delegated_codex_subagent` collection mode. A deterministic reuse manifest copied
32 experiment-012 raw/telemetry pairs byte-for-byte after schema, identity, prompt, window and limit validation.
Delegated Stage A then filled all 28 remaining registered slots. Final inventory reached 60/60 terminal slots,
58 reusable calls, two invalid calls, no missing files and no raw/telemetry orphans.

The immutable result is **FAIL**, with 19/20 complete source-contract cities and zero artifact candidates. All 20
cities still produced deterministic 19-tier bundles and passed field-by-field persistence/API provenance equality;
none was all-prior. Direct/fallback category counts were accommodation 10/10, food 18/2, drinks 17/3 and activities
18/2. Cappuccino and domestic draft beer were each observed in 19/20 cities, confirming that the corrected canonical
Numbeo serving contract works in the completed frame.

The failed city was Prague. A parallel subagent spawn returned a thread-limit error after one worker had already
started; a later explicit assignment repeated its BYT and Numbeo calls. The second writes overwrote the first pair
before detection. Rather than hide the duplicate, the assignment ledger records both workers, the surviving raw
responses remain intact, the two slots are deliberately invalid, and `collection-incidents.json` records the evidence
loss. Actual work was 62 provider calls, 11 assignment attempts, two retries, 171 searches and zero direct page reads.
The standard result reports 167 searches from surviving telemetry; the incident accounts for the four overwritten
first-attempt searches.

The result also exposed an unreachable aggregate predicate. The frozen batch thresholds were at least 19/20 complete
cities and no more than 30% artifact candidates, both of which were numerically met. However,
`evaluateV61CanaryBatch` initializes batch `problems` with every per-city diagnostic and sets
`passed = problems.length === 0`, so the declared one-city tolerance cannot ever absorb an invalid city. The recorded
experiment remains failed and is not rescored or restated as a pass. Phase 8 is blocked for owner review. Recommended
follow-up, if authorized, is an exclusive write-once slot claim plus a regression-correct batch predicate, followed by
one new immutable canary reusing the 58 valid experiment-013 calls and recollecting only Prague BYT/Numbeo.

No holdout was read, no coefficient or accommodation fit changed, and the live 121-city CSV remained untouched.

### v6.1 Phase 7H post-013 audit and repair start — 12 August 2026

The experiment-013 review separates two orchestration defects from the v6.1 method itself. The full 60-slot frame was
terminal, 58 city/source pairs were reusable, 19/20 cities completed the source contract, all 20 produced deterministic
19-tier bundles, all 20 passed persistence/API provenance equality, and zero cities were all-prior artifacts. The
recorded failure came from two invalid Prague calls after a duplicate delegated assignment, not from a source-price,
coefficient or materializer finding. The surviving collection facts were 62 actual provider calls, 11 assignment
attempts, two retries, 167 surviving-record searches plus four discarded-attempt searches, and zero direct page reads.

The first defect is lifecycle: `record-v6-1-canary-assignment.mjs` enforced unique assignment IDs but did not reserve
city/source slots before work began. A thread-limit report could arrive after a worker had started, allowing a later
assignment to duplicate and overwrite the same Prague BYT and Numbeo files. The second defect is evaluation: the pure
batch evaluator sets `passed` from `problems.length === 0`, so a diagnostic on the one incomplete city makes the
registered 19/20 tolerance unreachable. These are independent: fixing the evaluator must not excuse duplicate source
calls, and fixing claims must not silently alter the historical result.

The owner authorized Phase 7H implementation: add atomic write-once city/source slot claims for new experiments, split
tolerated per-city diagnostics from true batch-fatal violations, and add regression coverage. Experiments 010–013 remain
immutable; no new canary, migration, holdout access or live CSV write occurs during this repair. After the focused and
full verification baselines pass, the next gated action is one fresh immutable canary reusing the 58 valid experiment-
013 calls and collecting only the two invalid Prague sources. Phase 8 remains blocked until that fresh canary passes.
013 calls and collecting only the two invalid Prague sources. Phase 8 remains blocked until that fresh canary passes.

### v6.1 Phase 7H repair complete — 12 August 2026

Implemented and tested the authorized lifecycle repair. New experiments now use an atomic write-once city/source slot
claim backed by an exclusive claim file and a guarded assignment ledger; a duplicate assignment ID is no longer the
only protection. A stale lock is recoverable only when its owner process is no longer alive, and a live lock fails closed.
Immutable historical assignment ledgers remain readable, including experiment 013's two recorded duplicate slots.

The pure evaluator now separates per-city diagnostics from batch-fatal conditions. One terminal incomplete city is
allowed by the registered 19/20 threshold; window drift, search/retry/direct-read limits, artifact signatures, pending
frames and an insufficient complete-city count remain fatal. Regression tests cover 19/20 pass, 18/20 failure and
duplicate city/source assignment rejection.

The full baseline passed: TypeScript, Next build, 39 Vitest files/190 tests, memory synchronization, coefficient and
ground-truth checks, generated priors/materialization, release validation, rollout replay, experiment-013 inventory/
reuse/assignment/result checks and the new claim test. No new experiment was created, no holdout was read, no
coefficient or accommodation fit changed, and the live CSV remained untouched. The exact next action is one owner-gated
fresh immutable canary reusing the 58 valid experiment-013 calls and recollecting Prague BYT/Numbeo; Phase 8 remains
blocked until it passes.

### v6.1 Phase 7 fresh canary passed — 13 August 2026

Experiment 014 (`014-v6-1-final-delegated-canary`) is the one owner-authorized fresh canary after the Phase 7H lifecycle
repair. It reused 58 raw/telemetry pairs from immutable experiment 013 only after call-level schema, identity, prompt,
window and limit validation, then collected the two corrected Prague calls with delegated Stage A. The complete 60-slot
frame is terminal and reusable: 20/20 cities materialized all 19 tiers, all 20 passed field-by-field persistence/API
provenance equality, zero cities were artifact candidates, 167 searches were recorded, retries were 0 and direct page
reads were 0. Prague's canonical Numbeo `Domestic Draft Beer (0.5 Liter)` row was observed successfully.

The result is immutable and passed. Its result hash is
`d7de2557cc1b9cc27616e3c774d1ce829db11431af1eafe04b428ca719da6a69`; the active manifest and generated release report
now point to that hash. Experiments 010–013 remain unchanged history. This establishes source-contract feasibility and
the deterministic/provenance boundary, not the post-release >=95% runtime SLO. The exact next action is Phase 8:
build and dry-run the frozen resumable migration protocol with experiment 014 as fixture; no holdout or live CSV was
read or changed.

### v6.1 Phase 8 migration tooling complete; Phase 9 active — 13 August 2026

The Phase 8 migration pipeline is now implemented and dry-run. A frozen protocol under
`data/reference/v6/migration-v6-1/` records the unchanged 121-city input frame, CSV/FX/prompt/implementation
hashes, the 2026-09-17 to 2026-09-18 source window, exact three-call/search limits and a hard prohibition on
writing `data/reference/city_costs_app_aud.csv`. Experiment 014 was reused through call-level validation for
all 20 canary cities: 60 raw/telemetry pairs were accepted, 20 complete v6.1 materializations were generated,
and the staged CSV, provenance sidecar and deterministic import plan were regenerated and checked.

The pipeline preserves raw evidence outside materializations, records collection mode and hashes per call, refuses
materialization while any source slot is pending, checks implementation hashes against the frozen protocol, and
rejects both partial sidecars and the live database in the importer. The current staged artifact is intentionally
only 20/121 cities and has not been imported or cut over. Phase 9 now collects the remaining 101 cities in fixed
batches through delegated Stage A and the shipped Stage B path. No holdout was read and the live CSV remains
untouched. This supersedes the prior Phase 7H entry's statement that Phase 8 remained blocked after experiment 013;
experiments 010–014 remain immutable history.
