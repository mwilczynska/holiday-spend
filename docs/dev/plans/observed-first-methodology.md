# Phase 6: Observed-First City Cost Methodology And Validation

## Status

In progress. The baseline assessment and version 3 design were completed in July 2026. Data collection,
model fitting, holdout validation, dataset replacement, and runtime prompt migration remain open.

## Objective

Replace the predominantly model-estimated city-cost dataset with an observed-first, reproducible data
product. The revised system must minimise systematic bias and unexplained city-to-city variance while
remaining practical for 121 cities and future additions.

This work has two audiences:

1. Travellers need estimates that are useful, current, and honest about uncertainty.
2. Technical reviewers should be able to inspect the estimand, evidence, transformations, validation
   design, error metrics, model-selection decisions, and limitations.

## Baseline Assessment

The current anchor-and-derive architecture is explainable, but explainability is not the same as
accuracy. Its strongest property is deterministic traceability from ten anchors to the tier baskets.
Its weakest property is that most anchor values were estimated by an LLM rather than collected from
dated observations.

The supplied `data/reference/accuracy_audit.csv` contains nine comparisons across Lisbon, Prague, and
Hanoi. It covers four food/drink anchors and no accommodation or activity prices.

| Metric | Baseline result | Interpretation |
|---|---:|---|
| Cities | 3 of 121 | Too narrow for population-level claims |
| Comparisons | 9 | Descriptive spot check only |
| MAPE | 17.47% | Average percentage miss; sensitive to large percentage errors |
| Median APE | 14.29% | Typical comparison is approximately 14% away |
| Mean signed percentage error | -16.30% | Strong downward bias |
| WAPE | 21.00% | Absolute dollar error divided by reference dollars |
| RMSPE | 22.96% | Large misses are materially worse than the median suggests |
| Within 10% / 15% / 25% | 3/9, 5/9, 7/9 | Useful descriptive thresholds, not confidence levels |

The city split is also unstable: Lisbon has 29.50% MAPE and -29.50% bias; Prague has 6.56% MAPE and
-6.56% bias; Hanoi has 9.77% MAPE and -4.51% bias. That is evidence of heterogeneous error, not a
single global correction factor.

### What the audit establishes

- The current sample underestimates eight of nine reference prices.
- The Lisbon miss demonstrates a material recency or source-selection problem.
- A single global multiplier would leave substantial region, city, and category error.
- The present audit is sufficient to reject the claim that internal ratio stability proves external
  accuracy.

### What the audit does not establish

- It does not estimate accuracy across all cities or regions.
- It does not test accommodation, activities, seasonality, group scaling, or trip totals.
- Its source labels are not URLs and do not preserve retrieval timestamps, raw currencies, or a frozen
  database version.
- The reference observations are benchmarks, not error-free ground truth. Crowd-sourced medians and
  marketplace quotes have sampling, timing, inventory, and definition error of their own.
- With only three city clusters, confidence intervals or regional corrections would create false
  precision.

## Problems To Correct

1. **Undefined estimands.** “A 3-star night” is not reproducible without dates, stay length, occupancy,
   location, taxes, cancellation policy, review threshold, and booking lead time.
2. **Soft provenance.** The canonical CSV stores final AUD values but not the observations that produced
   them. Generated estimates store an LLM label rather than a source URL per observation.
3. **LLM arithmetic.** The runtime prompt asks the model to research, calculate tiers, and convert FX.
   The server validates shape but does not recompute the formulas or reject inconsistent outputs.
4. **Unfitted global constants.** The street-food ratio, high-end food multiplier, alcohol fallbacks,
   4-star multiplier, and activities multipliers are not supported by a retained training dataset and
   holdout results.
5. **Weak missing-data rule.** Geographic proximity plus an arbitrary 10% to 30% adjustment is not a
   measured similarity model.
6. **No seasonal layer.** Accommodation is a dated inventory market, not a timeless city attribute.
7. **Narrow validation.** Random anchor rows would also leak city information between training and
   validation; evaluation must hold out whole cities.
8. **Contract drift.** The documentation refers to 17 tier values, the generation JSON contains 18
   tiers, and the canonical CSV contains 19 numeric cost columns because coffee is stored separately.
9. **Coverage drift.** The original methodology text says 68 countries, while the canonical dataset
   contains 121 cities across 58 countries.

## Version 3 Design Decision

Version 3 is **observed-first and model-assisted**, not anchor-first and model-generated.

~~~text
dated source observations
        -> definition and unit validation
        -> local-currency normalization
        -> robust aggregation within city/category/date window
        -> deterministic basket construction
        -> hierarchical imputation only for missing cells
        -> prediction interval and quality flags
        -> frozen validation set and acceptance checks
        -> AUD publication snapshot
~~~

The LLM may search, extract, classify, and explain. It must not be the source of an uncited price, the
calculator of record, or the authority that decides whether its own estimate is accurate.

## Estimands

Every published number must answer: “the expected cost of what, for whom, where, and when?”

### Accommodation

- Two adults, one room, seven-night stay.
- Publicly available rate, all mandatory taxes and non-conditional charges included.
- Standard desktop booker context and a recorded booker country.
- Three fixed non-event reference weeks representing low, shoulder, and high season.
- Fixed 90-day booking lead time. Quote capture is scheduled separately for each stay week; three
  seasons cannot be measured at the same lead time on one research day.
- City-centre search area with a documented 5 km radius.
- A deterministic property panel drawn from an official accommodation register or classification
  directory, stratified by hostel
  room type or hotel star class. Proprietary review scores are not a primary inclusion criterion.
- Target 12 panel properties per measure and season, with a hard minimum of five and at least 60% panel
  overlap across seasons.
- Report the median nightly total plus the 25th and 75th percentiles, property count, panel overlap, and
  each season's retained distribution.
- Dorm tier is per bed; private tiers are per room.

The free-only collection path uses LLM web research against each selected property's public official
booking page. Booking.com and Hostelworld are not extraction sources because their reviewed current terms
restrict automated/assistant extraction. Search dates and the displayed mandatory-charge treatment must
be retained. If a payable total cannot be verified without a login, partner API, member/mobile rate, or
access-control bypass, the observation is recorded as missing and the next property in the frozen reserve
order is tried.

The annualized accommodation point estimate is the median of the low-, shoulder-, and high-season
medians, giving each season equal weight regardless of how much inventory a source exposes. A direct
accommodation measure remains ineligible for tier materialization until all three strata contain at least
five accepted property quotes. The season labels are pre-registered design strata, not conclusions drawn
from the prices: provisional climate-based labels stay flagged and are upgraded from official monthly
accommodation-demand data where available in the next schedule version, never relabelled after observing
the current outcomes.

### Food

- Preserve explicit item definitions and local units.
- Prefer fresh city-level medians with contributor counts and reported ranges.
- Add independent menu observations for a stratified validation sample.
- Construct daily tiers from transparent meal baskets after observation aggregation.
- Treat “street food” as an equivalently defined low-cost meal channel by market, not a universal 0.60
  multiple of an inexpensive restaurant.

### Drinks

- Retain coffee, domestic beer, cocktail, and wine as separately observed inputs.
- Construct lifestyle tiers as literal baskets.
- Estimate missing cocktail/wine relationships from retained regional/category training observations,
  with shrinkage toward a global ratio, rather than fixed universal multipliers.

### Activities

- Replace the inexpensive-meal proxy with observed attraction and tour prices.
- Define a reproducible product taxonomy: free attraction, paid attraction, half-day group experience,
  and premium/full-day experience.
- Collect current adult prices for a fixed city search radius and reference dates.
- Construct budget, mid-range, and high-end baskets from robust quantiles within the taxonomy.
- Viator and Amadeus expose product prices; individual official attraction sites are preferred for the
  validation subset where they can be matched exactly.

## Observation-Level Data Contract

The next canonical asset should be an observation table, not only a wide table of final tiers.

Required fields:

- observation id and extraction batch id
- canonical city and country ids
- category, item definition, tier, occupancy, and unit
- numeric raw price and raw currency
- tax/fee inclusion status
- source name, source type, source URL, and source record id where available
- source-access basis and source-terms URL, including personal-use attribution where applicable
- observed/retrieved timestamp and price-valid date or stay window
- direct, derived, or imputed status
- sample size, source low/high range, and marketplace result count where available
- geographic radius, booking lead time, stay length, and season label where relevant
- extraction method and parser version
- reviewer status and exclusion reason

Final city tiers are materialized outputs from this table. They must be reproducible from a versioned
transformation script and a frozen FX snapshot.

## Aggregation And Missingness

1. Normalize definitions before values. Non-comparable observations are rejected rather than averaged.
2. Work in local currency until the city-level estimate is complete.
3. Use robust medians or trimmed estimators and retain quantiles; do not use marketplace minimums.
4. Treat sources as measurement channels. Compare channels and flag disagreements rather than silently
   blending them.
5. Winsorization or outlier removal must use a documented rule and preserve the excluded observation.
6. Impute only after direct observations are exhausted.

For missing cells, fit candidate models on log prices because price ratios are more stable and log error
treats proportional over- and under-estimation symmetrically. Candidate fallbacks should include:

- global median ratio
- region and cost-band median ratio
- regularized model using country, region, category, city size, tourism intensity, and available local
  anchor prices
- hierarchical partial-pooling model with city/country/region effects

Choose the simplest candidate that wins whole-city cross-validation. Store the imputed estimate,
prediction interval, model version, and features used. “Nearest city minus 20%” is removed unless it
outperforms the alternatives on held-out cities.

## Validation Design

### Independent benchmark

Collection and evaluation must be separated:

- Freeze a stratified set of at least 30 cities across region, cost quartile, city size, tourism intensity,
  and data-density bands.
- Hold out entire cities; never split observations from one city across training and validation.
- Use independent sources or independently recollected observations for validation.
- Include all four categories and enough observations per city to avoid treating correlated items as
  independent evidence.
- Report uncertainty by resampling cities as clusters, not individual rows.
- Add a second, behavioural validation layer using real trip expenses mapped to the same tier definitions;
  this tests whether the basket definitions represent actual traveller spend.

### Error definitions

For estimate `p_hat` and benchmark `p`, define signed log error:

~~~text
log_error = ln(p_hat / p)
~~~

This is zero when correct, positive when over-estimating, negative when under-estimating, and symmetric
for reciprocal proportional errors.

Report:

- median signed log error and mean signed percentage error for bias
- median absolute percentage error for typical error
- weighted absolute percentage error for dollar impact
- root mean squared log error for variance and tail penalty
- 50th, 80th, and 90th absolute-error percentiles
- share within 10%, 15%, and 25%
- Spearman rank correlation for cross-city ordering
- interval coverage and average interval width for uncertainty calibration
- itinerary-weighted error after category shares and trip lengths are applied

MAPE remains a secondary continuity metric; it must never be the sole accuracy claim. Accuracy results
are always shown with city count, observation count, reference window, dataset version, and cluster-level
95% intervals once the validation sample is large enough.

### Provisional acceptance gates

These targets are hypotheses to test, not achievements to advertise:

| Output | Gate on untouched holdout cities |
|---|---|
| Food and drink anchors | Median APE <= 10%; absolute bias <= 5% |
| Accommodation and activities | Median APE <= 15%; absolute bias <= 7.5% |
| Two-person city-day basket | Median APE <= 12%; 90th percentile APE <= 25% |
| City affordability ranking | Spearman rho >= 0.95 |
| 80% prediction intervals | Empirical coverage between 75% and 85% |
| Direct-observation coverage | >= 90% of spend-weighted inputs; >= 80% of all required inputs |

Results must also be published by category, region, cost quartile, provenance class, and season. A good
global average cannot conceal a failing subgroup.

## New-City LLM Alignment

The existing `llm_prompt_new_cities_1.md` remains a versioned description of the version 2 method until
the version 3 data contract and deterministic calculator exist. It must not be silently edited into a
new method while old estimate records still cite that prompt version.

Version 3 requires a new prompt and schema that return:

- structured observations, original currencies, units, dates, and source URLs
- explicit direct/derived/imputed status per observation
- missing values as missing, not invented numbers
- source excerpts limited to the minimum needed for verification
- no calculated tier values and no self-assigned qualitative confidence label

Server code will validate observations, calculate the tiers, obtain FX from a configured data source,
run invariant checks, assign an evidence score, and store the complete lineage. New-city output must pass
the same validation checks as the bulk dataset.

## Free-Only Source Feasibility

Paid data APIs are out of scope. Collection uses free LLM calls with web access to inspect public Numbeo
city pages one city at a time for this private project, official property pages selected through public
accommodation registers, official attractions,
public activity listings, and open official statistics. Each value must retain its inspected URL,
retrieval timestamp, source-access basis, and attribution requirement. The process does not use a
Numbeo scraper/crawler or paid API, respects ordinary access controls, and never bypasses a login, block,
CAPTCHA, or explicit restriction.

Numbeo's public pages are treated as a measured source with uncertainty rather than ground truth; its
published methodology documents crowd-sourced/manual inputs and adaptive data-age rules:
https://www.numbeo.com/common/motivation_and_methodology.jsp. ECB and Eurostat public data remain useful
for FX and seasonality context. The free-call, checkpointed protocol is specified in
`docs/dev/plans/city-cost-source-access.md`.

## Work Packages

### 6A. Baseline and specification

- [x] Audit the supplied accuracy sample.
- [x] Identify implementation/documentation mismatches.
- [x] Define version 3 estimands, metrics, data contract, and provisional acceptance gates.
- [x] Add reproducible audit code rather than relying on precomputed CSV error columns.

### 6B. Observation store and collection pipeline

- [x] Add a versioned raw-observation schema and JSONL validator.
- [x] Add a persistent JSONL observation store and versioned batch manifest.
- [x] Add an extraction-batch schema and manifest validator.
- [x] Add deterministic normalization, FX, aggregation, and basket scripts.
- [x] Add explicit source-channel selection, retained channel summaries, and provisional disagreement flags instead of silently pooling unlike sources.
- [x] Define a free-only LLM research protocol with adaptive throughput and no project-imposed call cap.
- [ ] Confirm public-page usage and retention constraints before scaling each source.
  - [x] Retain page-by-page Numbeo use with attribution for this private project.
  - [x] Exclude Booking.com and Hostelworld as LLM extraction sources after reviewing their current terms.
  - [x] Route accommodation through official registers plus direct property pages, subject to a per-page
    access check.
  - [ ] Complete the same access review for every secondary menu/activity source before scaling it.
- [x] Build a provider-neutral source-research runner with fixture-based parser tests. It renders one
  bounded assignment from the versioned prompt, accepts raw or fenced JSON from a saved free web-enabled
  LLM call, verifies assignment identity and complete observed/missing measure coverage, and forces every
  returned observation to remain `unreviewed` for a separate evidence-review step.

Checkpoint: batch zero and the first six pilot-wave checkpoints currently provide 120 accepted direct
observations across 24 cities, covering every pilot region. The v3-alpha materializer aggregates in
city-local currency, applies a frozen and source-attributed AUD FX snapshot, and materializes 115 of 456 possible
city-tier cells. No city is complete and no partial wide row is published.
The pipeline is therefore reproducible and fail-closed, but it is not yet a replacement for the active
121-city dataset.

The first accommodation schedule is now pre-registered for these nine cities in
`data/reference/accommodation_reference_windows_2026_2027.json`: 27 seven-night windows, exactly 90 days
between quote capture and check-in, one low/shoulder/high stratum per city, and a capture-day event-screen
gate with a deterministic same-season replacement rule. Several destination labels currently use
official climate/travel guidance and are explicitly provisional until upgraded with monthly demand data.

The first three official-source sampling frames are also frozen in
`data/reference/accommodation_property_panels_2026_2027.json`. Its generic version 2 contract stores
properties separately from measure-specific rankings, so a verified hostel can participate in both dorm
and private-room panels without duplicating the establishment. For Barcelona, an `HB` registration-id
join between the July 2026 Catalonia Tourism Register and Barcelona City Council geolocation data retains
344 active standard 1-4-star hotels, joins 327 to official coordinates, and leaves 322 within the fixed
5 km radius. A price-blind SHA-256 rank selects 12 primary properties for each hotel star class (48 total)
and preserves 274 ordered reserves. Seventeen coordinate misses and five radius exclusions remain visible.
The frame has zero verified property websites and zero accepted prices, so this is achieved sampling
infrastructure rather than coverage or accuracy evidence. Hostel dorm/private measures remain missing
until a separate youth-hostel frame is found; Catalonia's `Hostal o pensió` class is not mislabelled as a
youth hostel.

For Copenhagen, the 24 July 2026 Hotelstars Union public search snapshot contains 309 Denmark records:
209 hotels and 100 separately listed conference products. Excluding conference and 5-star products leaves
201 one- through four-star hotel records with official-directory coordinates. The component-wise median
of 29 eligible `København*` records fixes the price-independent centre at `55.67250000, 12.56450000`;
29 eligible hotels fall within 5 km (three two-star, 11 three-star, and 15 four-star). The snapshot has no
one-star property. All three two-star records remain below the five-quote gate, while the 4-star panel has
12 primary properties and three reserves. A separate VisitCopenhagen directory contributes 13 hostel
candidates, but dorm/private eligibility and geolocation are still pending direct-site verification.

Prague adds an explicit physical-property deduplication stage because the 24 July Czech Hotelstars
snapshot contains 229 hotel rows but repeated classifications for many establishments. Removing four
5-star rows and grouping by normalized name, street, street number, and postcode collapses 225 eligible
rows to 148 physical properties; 76 identity groups contain duplicates. Four groups with official
coordinates disagreeing by more than 0.25 km remain visibly ungeolocated. The component-wise median of
18 deduplicated `Praha*` properties fixes the centre at `50.07870000, 14.43375000`.

Prague City Tourism's official hostel directory and 12 property-detail pages provide direct destination
evidence for inventory, addresses, coordinates, and source-listed websites. Ten in-radius properties
explicitly support each hostel measure. One property is geolocated but remains inventory-pending because
its official detail page does not state dorm or private-room inventory. The complete in-radius frame has
25 distinct properties: ten dorm-eligible hostels, ten private-room-eligible hostels, five 3-star hotels,
and nine 4-star hotels, with overlap where one hostel supports both measures. No 1-star or 2-star hotel is
eligible within 5 km. The frozen sampling-frame artifact initially contains zero verified websites because
price and website visibility were excluded from ranking. A separate append-only quote-attempt ledger now
records verification and retrieval outcomes without rewriting that frozen rank.

The completed Copenhagen shoulder capture attempted ranks 1-10 in order. Five public official-site quotes
were accepted, Absalon had no inventory for the exact reference week, and four booking paths failed the
exact-date or mandatory-charge verification gate. The accepted nightly prices are DKK 1,178.36,
DKK 1,365.29, DKK 1,417.43, DKK 1,652.57, and DKK 1,738.93. Their median is DKK 1,417.43. The
pre-registered five-property seasonal minimum is therefore satisfied, but no annualized accommodation tier
materializes until the low and high seasons also pass and at least 60% of the property panel overlaps across
seasons. The ledger explicitly distinguishes room-only, bundled-breakfast, and unstated meal bases;
flexible and non-refundable conditions; a true availability failure; and technical capture failures.

### 6C. Pilot and model selection

- [x] Generate a deterministic 36-city candidate pilot across every region and the current cost range.
- [ ] Enrich the candidate manifest with city size, tourism intensity, and public-source density.
- [x] Collect the first batch-zero checkpoint: 12 directly inspected Numbeo food/drink observations and
  three official paid-attraction prices across Lisbon, Prague, and Hanoi.
- [x] Collect batch-zero day 02: eight Numbeo food/drink observations, one Pu Luong official-menu meal,
  two official attraction prices, and one Pu Luong half-day group activity across Copenhagen, Bangkok,
  and Pu Luong; retain sparse-city missingness instead of substituting a hub.
- [x] Collect pilot wave 1 for Barcelona, San Francisco, and Da Nang: 12 direct Numbeo food/drink
  observations and three official attraction prices.
- [x] Extend pilot wave 1 into three previously unobserved regions through Zanzibar, Shanghai, and
  Auckland: 12 direct Numbeo food/drink observations and two official attraction prices; retain
  Zanzibar's small contributor count and missing official attraction price explicitly.
- [x] Add the next uncovered Africa, East Asia, and Oceania cities through Nairobi, Fukuoka, and
  Queenstown: 12 direct Numbeo food/drink observations and three official attraction prices; preserve
  localized Numbeo URLs, month-level validity, source density, and explicit unsupported measures.
- [x] Add first pilot evidence for the remaining unrepresented regions through Medellin, Istanbul, and
  Goa: 12 direct Numbeo food/drink observations and three official attraction prices; retain Goa's older
  December 2025 freshness date and Medellin's source-access limitation explicitly.
- [x] Add the next uncovered Latin America, Middle East, and South Asia cities through Havana, Dubai, and
  Delhi: 12 direct Numbeo food/drink observations and two official attraction prices; retain Havana's
  August 2025 freshness/source-density limitation and explicit missing official attraction price.
- [x] Add Sendai, Sofia, and Vancouver: 12 direct Numbeo food/drink observations and three official
  attraction prices; retain Sendai's sparse 19-contributor context and wide ranges, and correct Bulgaria's
  canonical currency to EUR after its 1 January 2026 euro adoption.
- [x] Freeze the first official-register accommodation sampling frame for Barcelona, including
  deterministic hotel panels, full reserve order, join coverage, and visible exclusions.
- [x] Generalize the panel contract and freeze Copenhagen's Hotelstars hotel frame plus the official
  13-property VisitCopenhagen hostel candidate universe, retaining the absent one-star class and the
  below-minimum two-star class as explicit limitations.
- [x] Freeze Prague's deduplicated Hotelstars frame and official 12-property hostel evidence: 25 distinct
  in-radius properties, two ten-property hostel panels, five 3-star and nine 4-star hotels, explicit
  absent 1-/2-star classes, and one geolocated inventory-pending hostel.
- [x] Add a validated property-attempt ledger and complete the Copenhagen shoulder checkpoint:
  ten rank-ordered official-site attempts, five accepted 4-star quotes, one no-availability result, and
  four explicit booking-path failures; retain the seasonal median but keep the annualized measure
  ineligible until low/high coverage and the 60% repeated-property overlap gate pass.
- [ ] Collect batch zero, then the 36-city pilot, with all four categories.
- [ ] Profile missingness, source disagreement, seasonality, and outliers.
- [ ] Fit and compare fallback models with whole-city cross-validation.
- [ ] Freeze holdout cities and acceptance gates before final fitting.

### 6D. Full re-collection

- [ ] Collect direct observations for all 121 cities in auditable batches.
- [ ] Reach direct-observation coverage targets or document exceptions.
- [ ] Produce versioned city tiers, intervals, and evidence scores.

### 6E. Independent validation

- [ ] Recollect the holdout benchmark independently.
- [ ] Publish overall and subgroup metrics with city-cluster uncertainty intervals.
- [ ] Run tier-level and itinerary-level backtests.
- [ ] Diagnose and remediate any failed acceptance gate without tuning on the holdout set.

### 6F. Product and LLM migration

- [ ] Add `llm_prompt_new_cities_2.md` for observation extraction.
- [ ] Move tier calculation and validation entirely into deterministic server code.
- [ ] Persist URLs, dates, raw currency, provenance class, and uncertainty.
- [ ] Migrate the canonical CSV/database and retain the version 2 dataset for reproducibility.
- [ ] Update `/estimates` with achieved—not aspirational—metrics and methodology version.

### 6G. Maintenance

- [ ] Schedule freshness checks based on category volatility and source age.
- [ ] Revalidate after material source, formula, FX, or prompt changes.
- [ ] Monitor actual-trip residuals for drift by region and category.
- [ ] Publish a small model card/data card with every dataset release.

## Definition Of Done

Phase 6 is complete only when the published 121-city dataset is generated from retained observations,
the untouched holdout gates pass or failures are disclosed, the new-city flow uses the same deterministic
pipeline, and the public methodology reports achieved metrics with reproducible evidence.
