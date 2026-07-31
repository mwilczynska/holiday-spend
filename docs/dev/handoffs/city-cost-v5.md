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

## Next action

Find or calibrate a matched-basis accommodation source using separately recorded one-city calls; do not fit
a correction from Copenhagen alone. Keep the one-city prompt shape mandatory. Test an interactive public page
or curated benchmark for unresolved lower classes and hostels; search-index date injection is rejected.
Continue definition-matched panels for the other omitted anchors. Do not use the shipping CSV as ground truth
and do not infer dorm/private separation from the blended hostel channel. The derivation contract remains out
of the shipping path until source feasibility and accuracy gates pass.
