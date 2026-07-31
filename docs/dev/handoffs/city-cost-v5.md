# Handoff — City Cost Methodology v5

**As at:** 31 July 2026
**Branch:** `feat/city-cost-methodology-v5`
**Goal status:** active; v5 is not accepted

## Completed this cycle

- Reconstructed the project state and verified `CLAUDE.md`/`AGENTS.md` with
  `npm run docs:check-memory`.
- Rewrote `PLAN.md` as the active v5 workstream plan while preserving the unrelated app backlog.
- Added the v5 data dictionary and frozen validation manifest under `data/reference/v5/`.
- Added Experiment 000, a deterministic audit of the retained v3/v4 evidence.
- Re-ran the v4 ratio fit and confirmed its output is reproducible; the v5 baseline report also reproduces
  byte-identically.
- Added the Experiment 001 candidate extractor prompt and a provider-neutral one-call harness.
- Added Experiment 003, an isolated deterministic derivation contract and tests for all 19 tiers,
  fail-closed missingness, and provenance propagation.
- Updated the data, script, and prompt inventories; synchronized `AGENTS.md` from `CLAUDE.md`.

## Experiment 000 result

The retained evidence has 176 accepted observations, zero duplicate observation IDs, and 99 cities across
all nine regions. Direct coverage is strong for Numbeo food/drink anchors but absent for dorm/private and
1–3-star accommodation, with only one direct 4-star city. Paid-attraction coverage is 29 cities; half-day
and full-day activity coverage is 3 and 2 cities. V4 proxy-input counts are not shipped-target calibration.

Read:

- `data/reference/v5/experiments/000-baseline-reassessment/results.json`
- `data/reference/v5/experiments/000-baseline-reassessment/verdict.md`

Verdict: retain the evidence and provenance model; reject v4 as a complete production methodology.

## Experiment 001 result

The candidate prompt asks the model to extract 18 source measures, not calculate tiers. The runner supports
OpenAI Responses web search and Anthropic server web search, with no retries or provider fallback. The
schema-only fixture passes validation. Provider API keys are absent from the environment, but the delegated
GPT-5.6 Luna-class sub-agent is now the target-model prompt-test path; the absence of API keys is not a
blocker for prompt feasibility.

Run a provider-telemetry test when credentials are available (the target-model prompt test does not require
provider API credentials):

```text
node scripts/run-city-cost-v5-one-call.mjs --provider anthropic --model <haiku-model-id> --city Lisbon --country Portugal
```

The output is written under `data/reference/v5/experiments/001-one-call-harness/` and must be treated as
unvalidated until source/citation correctness, one-call reliability, and target accuracy are scored.

## Experiment 005 result

The delegated GPT-5.6 Luna-class sub-agent ran the exact v5 extraction prompt against five difficult cities.
All five responses passed local schema validation, but only 20/90 anchors were found and direct page reads
returned HTTP 503. Its raw JSON, source outcomes, and limitations belong under
`data/reference/v5/experiments/005-target-model-subagent/`. This is prompt-feasibility evidence only; it
does not replace the locked city-level accuracy holdout.

## Experiment 002 result

The retained accommodation ladder was independently summarized from the raw v4 artifacts. Hotel class
relations have n=16, the blended-hostel relation n=13, and the first-page window check spans 3.945x. The
hostel source has no dorm/private occupancy label. The candidate is rejected as final v5 methodology and
retained only as evidence. Read `data/reference/v5/experiments/002-accommodation-ladder/`.

## Experiment 006 result

The explicit source-cascade prompt improved the same five-city Luna-class pilot from 20/90 to 30/90
anchors. It added six accommodation facts and four adult attraction tickets; all 30 found facts were
audited against retrieved search results or canonical pages. Hotel-star classes and half/full-day activity
prices remained at zero. Read `data/reference/v5/experiments/006-source-cascade-retest/`.

## Experiment 007 result

The minimal nine-anchor prompt returned 32/45 facts (71.1%) across the same five cities: four ordinary
cities returned 7–8 anchors and Don Det returned one. Dorm coverage was 4/5, private-hostel 3/5,
three-star hotel 1/5, each food/drink anchor 4/5, and paid attraction 4/5. Promote this prompt to model-
boundary validation, but do not treat it as final: nine omitted anchors, sparse fallback, basis consistency,
and hotel-anchor reliability remain open. Read `data/reference/v5/experiments/007-minimal-anchor-retest/`.

## Experiment 008 result

A bounded ten-city Luna-class ground-truth task for the nine omitted anchors found only 4/90
definition-compatible facts: one street-food item, one cocktail, and two half-day group activities. It
found no compatible hotel 1/2/4-star rooms, premium meals, wine glasses, or full-day premium activities;
31 near-misses were rejected for range, occupancy, package, stale, or missing-price basis mismatches. Broad
collection is rejected for model fitting. Read `data/reference/v5/experiments/008-omitted-anchor-ground-truth/`.

## Experiment 009 result

A bounded ten-city narrow accommodation panel searched for dorm, private-hostel, and hotel 1–4-star
rooms. Only **4/60 cells (6.7%)** met the frozen definition: Prague private hostel, Nairobi dorm and
private hostel, and Don Det 1-star. No city had all six classes; hotel 2-, 3-, and 4-star coverage was
zero. The dominant failures were `from`/range prices, multi-night or package bundles, missing occupancy
or formal class, stale promotions, and prices requiring arithmetic. The four surviving facts are
feasibility evidence only and must not be fitted. Read
`data/reference/v5/experiments/009-accommodation-panel-feasibility/`.

## Experiment 010 result

A five-city Luna task tested fixed check-in 2026-09-15, check-out 2026-09-16, two adults, and restricted
source families (Hostelworld/property pages for hostels; Booking.com/Hotels.com for hotels). It found
**0/30** compatible facts and no complete city. Search-index retrieval did not preserve the requested dates:
Hostelworld exposed undated `from` rates, while Booking/Hotels results exposed different dates, promotions,
or multi-night totals. Three search calls and eleven queries produced no page-read candidate. This rejects
the indexed-search date-fixed contract, but does not rule out interactive public pages or a curated benchmark.
Read `data/reference/v5/experiments/010-date-fixed-accommodation-contract/`.

## Experiment 011 result

A five-city Luna task opened the known Booking.com, Trip.com, and Hostelworld class-page templates directly.
It found **10/30** compatible facts (33.3%): Booking 3-star and 4-star pages returned explicit USD city
averages for every city, with default two-adult/one-room wording. Booking 1-star pages were blocked;
2-star pages yielded no compatible average; and Hostelworld exposed only prohibited `Dorms From`/
`Privates From` values. There were four direct page-read calls, 35 URL attempts, two find calls, and no
general searches. Promote only the Booking 3/4-star templates to broader stability and definition audit.
Read `data/reference/v5/experiments/011-direct-class-page-templates/`.

## Experiment 012 result

Three independent invocations of the same prompt each inspected **Copenhagen only**. All passed the JSON
contract and returned identical 3-star (USD 254) and 4-star (USD 347) city averages, identical Hostelworld
`From`-price rejection, and identical 1-/2-star blocked statuses. The 4-star average converts to AUD 496.17,
versus the existing five-quote direct-property median AUD 309.28: **+60.4%**. The source bases differ, so
this is a basis warning rather than a final accuracy estimate; it nevertheless exceeds the v5 25% gate and
rejects the city-average source as a final anchor. Read
`data/reference/v5/experiments/012-single-city-production-shape/`.

## Experiment 013 result

Three independent Copenhagen-only calls attempted five known official booking-engine URLs with the fixed
2026-10-22 to 2026-10-29 stay, two adults, and one room. All **15/15 quote cells were blocked** at the
delegated web safety boundary before page content was available. No totals or substitute searches were
produced. Manual v3 ground truth proves the pages themselves can work, so this rejects the target web-tool
URL route rather than the sites intrinsically. Read
`data/reference/v5/experiments/013-interactive-official-quote-extraction/`.

## Experiment 014 result

Three separate one-city calls tested the direct Numbeo food/drink page for five anchors. Lisbon initially
hit a lowercase URL cache miss, then succeeded on the canonical case-correct `/in/Lisbon` page with all five
rows. Inexpensive meal, mid-range meal, and beer matched retained Lisbon observations exactly; cappuccino
differed by 0.8% across retrieval dates; McMeal has no prior retained row. Copenhagen and Prague lowercase
URLs were blocked before page content. The source is retained, but URL normalization must be retested.
Read `data/reference/v5/experiments/014-single-city-numbeo-food-drink/`.

## Experiment 015 result

Canonical direct Numbeo calls for Copenhagen and Prague were run separately, with no lowercase retry or
fallback. Copenhagen returned HTTP 503 and Prague HTTP 429; all **10/10** measure cells were blocked before
page rows were available. This rejects direct Numbeo page retrieval as reliable production infrastructure,
although Lisbon's Experiment 014 page success remains valid evidence. Read
`data/reference/v5/experiments/015-numbeo-canonical-url-retest/`.

## Experiment 016 result

Two separate one-city search-only calls (Copenhagen and Prague) issued five Numbeo-restricted queries each
and returned **10/10** exact row/value/currency/URL facts. No direct page reads, fallback sources, arithmetic,
or cross-city facts were accepted. Eight matched retained observations had median absolute difference 0.79%
and p90 7.66%; page-date drift is visible and McMeal lacks a prior row. Promote the search-snippet route to
broader validation. Read `data/reference/v5/experiments/016-numbeo-search-snippet-fallback/`.

## Experiment 017 result

Six separate one-city GPT-5.6 Luna-class calls used the exact Experiment 016 prompt and five
Numbeo-restricted searches per city. Lisbon, Hanoi, Bangkok, San Francisco, and Nairobi each returned 5/5
exact facts; sparse Don Det returned 0/5 because search results were unrelated similarly prefixed locations.
Coverage was therefore 25/30 cells (83.3%) and 5/6 complete cities. Across the calls there were 30 queries,
11 search operations, no direct reads, no fallback sources, no arithmetic, and no cross-city evidence. All 25
accepted facts met the exact city/row/central value/currency/canonical URL contract. Ten retained matched
rows had median absolute error 0%, p90 9.09%, and maximum 10%; this is a small date-drift source audit,
not the locked validation. Provider model ID, parameters, tokens, latency, and cost were not exposed.
Promote the route for larger food/drink validation, but preserve Don Det as `not_found` and do not use
nearby-city substitution.

## Experiment 018 result

Thirty independent one-city GPT-5.6 Luna-class calls used the unchanged Experiment 016 prompt and source
policy: 20 development cities and 10 locked holdout cities. Development returned 100/100 facts and 20/20
complete cities. The holdout returned 44/50 facts and 8/10 complete cities; Helsinki's beer was `not_found`
and Kyoto was 0/5 because all queries returned only other-city/comparison pages. Overall coverage was
144/150 (96%) and 28/30 complete cities (93.3%). There were 150 queries, 60 search operations, zero direct
reads/fallbacks/arithmetic/cross-city evidence, and 144 accepted records with exact city/row/value/currency/
URL evidence. One hundred thirty-nine rows across 28 cities matched retained observations
with 0% median absolute error, 7.14% p90, and 16.88% maximum; holdout rows were 0.54%/7.22%/16.67%. This
is a source/date audit, not 19-tier model validation. Nha Trang's explicit `displayCurrency=USD` records and
symbol-to-ISO context mappings remain provenance review items. Exact provider telemetry was unavailable.

**Verdict:** promote Numbeo search snippets for continued food/drink work, but reject the complete pipeline:
complete-city success is below the 95% gate, the holdout is 44/50, and accommodation, activities, and
derivation remain unresolved. Read `data/reference/v5/experiments/018-numbeo-search-30-city/`.

## Experiment 019 result

Fifteen fresh independent calls (three repeats each for Kyoto, Helsinki, Don Det, Nha Trang, and Beijing)
used the unchanged Experiment 016 prompt. Kyoto and Don Det were stable no-result failures: 0/5 in all
three repeats. Nha Trang returned the same five USD-rendered values in all three runs, while native VND
alternatives were recorded and rejected rather than mixed. Beijing returned the same five CNY values in all
three runs, with `¥` mapped from explicit Beijing/China context. Helsinki was provenance-sensitive: repeat 1
followed the broad 018 same-call policy and counted 5/5, but its dedicated beer query did not return the row;
repeats 2 and 3 enforced dedicated-query provenance and returned 3/5 and 4/5. Broad coverage was 42/75;
strictly normalizing the non-dedicated Helsinki beer gives 41/75. The calls used 75 queries and 36 search
operations, with no direct reads, retries, fallbacks, arithmetic, or cross-city evidence; provider telemetry
was unavailable.

**Verdict:** retain Numbeo only as a bounded ordinary-city food/drink candidate with dedicated-query
provenance, native-currency checks, and fail-closed missingness. Do not average away Kyoto/Don Det failures.
Read `data/reference/v5/experiments/019-numbeo-repeatability-edge-cases/`.

## Next action

Test a separately validated sparse-city fallback rather than cross-city substitution, retaining dedicated-query
provenance, explicit native-currency checks, and fail-closed missingness. In parallel, attack accommodation
and activities with independent one-city calls; do not tune the locked 018 holdout or average away failures.
Find or calibrate a matched-basis accommodation source using separately recorded one-city calls; do not fit a correction from
Copenhagen alone. Direct booking-engine URLs and direct Numbeo retrieval are rejected for the target web
path. Keep the one-city shape for safe stable templates or curated benchmarks for unresolved lower classes
and hostels; search-index date injection is rejected. Continue definition-matched panels for activities and
other omitted anchors. Do not use the shipping CSV as ground truth and do not infer dorm/private separation
from the blended hostel channel. The derivation contract remains out of the shipping path until source
feasibility and accuracy gates pass.
