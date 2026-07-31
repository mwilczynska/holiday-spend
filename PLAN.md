# Holiday Spend — Plan

The working document for the current workstream. Confirmed historical results and rejected
methodologies live in [LOG.md](LOG.md). Project memory is in [CLAUDE.md](CLAUDE.md).

**Last reviewed:** 31 July 2026

---

## Where things stand

The application is feature-complete and stable for planning, tracking, dashboard, saved plans, and
comparison. The shipping city-cost path is still v1: it asks an LLM for remembered anchors, performs
arithmetic and FX in the model, and applies asserted multipliers. v4 is retained as prior evidence;
its collection contract and calculator were never integrated.

The active workstream is **city-cost methodology v5**. Its objective is a validated, implementation-ready
methodology, not an early rewrite of the shipping application. No 121-city migration starts before the
acceptance gates below pass.

The current worktree also contains an untracked `LOOP-PROMPT.md` supplied during the v5 kickoff. It is
preserved as user material and is not part of the methodology evidence until deliberately adopted.

---

## v5 objective

For an ordinary in-scope city, produce numeric values for the 19 planner fields: six accommodation
tiers per night for two travellers, four food tiers per day, five drink values per day, and four activity
tiers per day. City base values are AUD for two people; runtime traveller scaling remains an app concern.

One user-initiated production request must use one fast, inexpensive target model (GPT-5.6 Luna or a
Claude Haiku-class model). Search and page retrieval inside that request are allowed. A second LLM request,
retry, second sample, or human intervention is not part of the production path.

The v5 data dictionary and validation design are frozen in:

- `data/reference/v5/data-dictionary-v5.md`
- `data/reference/v5/validation-manifest-v5.json`

These are experiment contracts. They may change only through a dated decision recorded here and in the
experiment log before the affected holdout is used.

---

## Acceptance gates

The methodology is not accepted because it is better than v1 on a few examples, works in-sample, or
achieves coverage by hiding imputation. The locked end-to-end evaluation must show:

1. Valid schema and complete numeric product semantics for every test city.
2. A named, free, no-key, signed-out source cascade with explicit block/rate-limit outcomes.
3. At least 30 definition-matched city records for each material model relationship, including at least
   10 locked holdout cities for multi-tier claims. City-level splits prevent correlated observations from
   one city crossing partitions.
4. Held-out median absolute percentage error ≤25% for every non-definitional category and modelled
   measure, p90 absolute percentage error ≤50%, and absolute median signed error ≤10%.
5. No material regional or cost-band bias hidden by an aggregate; city ordering is reported with rank and
   pairwise accuracy.
6. ≥95% one-call pipeline success and ≥95% audited citation/source correctness on the representative
   target-model test.
7. Three independent calls on five difficult cities with dispersion retained, not averaged away.
8. Measured per-city searches, page reads, tokens, latency, provider cost, and steady-state throttling
   behaviour.
9. Every value labelled observed, modelled, imputed, definitional, or not-applicable, with provenance and
   uncertainty.
10. A blind demonstration from city input through one target-model request, validation, deterministic
    derivation, and all 19 outputs.

If a gate is shown to be inappropriate, amend it before the final holdout with evidence and a dated
decision. Never weaken a gate after seeing its result merely to declare success.

---

## Current experiment sequence

### Completed

- v1 shipped and audited; its constant `accom_4_star = hotel_3star × 1.80` is refuted by the v4 evidence.
- v3 observed-first collection abandoned at 22.8% pilot cell coverage and zero complete cities.
- v4 source, ratio, accommodation, and prompt evidence retained under `data/reference/` and documented
  in `LOG.md`.
- Project memory was verified with `npm run docs:check-memory` at the start of v5.

### Completed / in progress

**Experiment 000 — deterministic baseline reassessment — complete.** The retained evidence covers 99 cities
across all nine regions and reproduces byte-identically. It has zero direct dorm/private/1–3-star hotel
observations, one direct 4-star city, three half-day activity cities, and two full-day activity cities.
Food/drink proxy-input counts are not shipped-target calibration. Full details are in
`data/reference/v5/experiments/000-baseline-reassessment/verdict.md`.

**Experiment 002 — accommodation ladder reassessment — complete, candidate rejected.** The retained hotel
ladder has only 16 cities, the blended-hostel relation 13, first-page windows vary up to 3.945×, and the
hostel source cannot identify dorm versus private room. See
`data/reference/v5/experiments/002-accommodation-ladder/verdict.md`.

**Experiment 003 — deterministic derivation contract — complete, contract retained.** The isolated v5
function materializes all 19 tiers from post-FX anchors, fails closed on missing or blocked inputs, and
propagates source IDs, model versions, and imputed measures. It deliberately does not select statistical
coefficients; `mcmeal_combo` remains an auxiliary collected anchor and is never substituted for street food.
See `data/reference/v5/experiments/003-derivation-contract/` and
`src/lib/city-cost-methodology-v5.ts`.

**Experiment 001 — target-model one-call harness — built; provider telemetry optional.** The candidate 18-measure
extractor and provider-neutral OpenAI/Anthropic telemetry harness make exactly one request and do not retry
or fall back. Provider API credentials are not configured locally, but that is no longer a methodology
blocker: a delegated GPT-5.6 Luna-class sub-agent is the target-model prompt-test path. Provider API runs
remain useful for real web-tool telemetry when credentials are supplied, but a stronger model or manual web
run is not counted as target-model evidence.

**Experiment 005 — target-model sub-agent prompt feasibility — complete; candidate rejected.** A low-latency GPT-5.6
target-model sub-agent ran the exact candidate prompt against five difficult cities. All five responses
passed the local schema validator, but only 20/90 anchors were found; direct page reads returned HTTP 503
and the orchestration surface exposed no exact provider telemetry. This removes API-key absence as a
prompt-iteration blocker but rejects the candidate as production-ready. See
`data/reference/v5/experiments/005-target-model-subagent/`.

Status correction: this pilot is complete with a `revise_and_retest` verdict; the next prompt iteration is
the active experiment.

**Experiments 006–008 — source cascade, minimal anchors, and omitted-anchor ground truth — complete.**
The explicit cascade improved extraction, and the nine-anchor prompt reached 32/45 facts on the small
five-city panel. However, the ten-city omitted-anchor task found only 4/90 definition-compatible facts,
so broad collection is rejected as a model-fitting route. See the experiment directories and `LOG.md`.

**Experiment 009 — accommodation panel feasibility — complete; candidate rejected.** A narrow six-class
accommodation prompt was tested on ten cities. Only 4/60 cells (6.7%) met the frozen basis, no city had
all six classes, and the 2-, 3-, and 4-star classes had zero coverage. Ranges, `from` prices, packages,
missing occupancy/class labels, stale promotions, and arithmetic bundles were the dominant failure modes.
This is feasibility evidence only; the four surviving facts must not be fitted. The next candidate must
use a date-fixed, source-specific contract or a separately curated benchmark.

**Experiment 010 — date-fixed source contract — complete; search-index path rejected.** A five-city Luna
pilot used a fixed 15–16 September 2026 one-night/two-adult stay and source-family restrictions. It found
0/30 compatible facts: Hostelworld exposed undated `from` rates, while Booking/Hotels results exposed
other dates, promotions, or multi-night totals. This rejects the assumption that date parameters in broad
indexed searches preserve the accommodation estimand. Interactive provider pages and curated benchmarks
remain open; the result is not evidence that every public accommodation page is unusable.

**Experiment 011 — direct class-page templates — complete; partial promotion.** Direct URL templates were
tested on five cities. Booking 3-star and 4-star pages returned explicit USD city averages for all five
cities (10/30 facts, 33.3%); 1-star pages were blocked, 2-star pages yielded no compatible average, and
Hostelworld returned only prohibited `from` values. Promote only the Booking 3/4-star average templates
to a broader definition/stability audit; do not treat this as complete accommodation coverage.

**Experiment 012 — single-city production shape — complete; shape promoted, source rejected.** Three
independent Copenhagen-only invocations returned identical 3-star/4-star averages and identical missing /
blocked statuses. The 4-star city average was +60.4% against the existing direct-property median after the
frozen FX conversion. This is a narrow basis comparison, not a final multi-city accuracy estimate, but it
exceeds the 25% gate and rejects the Booking city-average source as a final anchor. All future target-model
tests must use one city per invocation; a panel is only a set of separately recorded calls.

**Experiment 013 — interactive official quote extraction — complete; target web route rejected.** Three
independent Copenhagen-only calls attempted five known official booking-engine URLs with fixed dates and
occupancy. All 15 quote cells were blocked at the delegated web safety boundary before page content was
available. Manual ground truth proves the pages themselves can work, so this rejects the target web-tool URL
route rather than the sites intrinsically; retain the blocked telemetry and fail closed.

**Experiment 014 — single-city Numbeo food/drink extraction — complete; revise URL normalization.** Three
separate one-city calls tested the direct Numbeo page. Lisbon succeeded after a canonical case-correct URL
retry and returned all five rows; Copenhagen and Prague lowercase URLs were blocked. The five Lisbon facts
were source-audited and matched prior observations for three rows exactly (cappuccino differed 0.8% across
dates). Do not reject Numbeo; retest canonical city-name URLs explicitly.

**Experiment 015 — canonical Numbeo URL retest — complete; direct page route rejected.** Separate Copenhagen
and Prague calls opened only `/in/Copenhagen` and `/in/Prague`; the pages returned HTTP 503 and HTTP 429,
respectively. All ten cells were blocked with no fallback. Lisbon's Experiment 014 success is retained, but
direct page retrieval is not reliable enough for production at the required steady-state volume.

**Experiment 016 — Numbeo search-snippet fallback — complete; promote to broader validation.** Separate
Copenhagen and Prague calls returned 10/10 food/drink anchors from five Numbeo-restricted searches each, with
zero direct page reads. Eight matched prior rows had median absolute difference 0.79% and p90 7.66%; date
drift is visible and McMeal has no prior row. No third-party or cross-city values were accepted.

**Experiment 017 — broad one-city Numbeo search validation — complete; promote with a sparse-city failure.**
Six independent calls covered Lisbon, Hanoi, Bangkok, San Francisco, Nairobi, and sparse Don Det across
regions and cost bands. Five cities returned all five exact Numbeo food/drink facts (25/25); Don Det returned
0/5 because every result was an unrelated similarly prefixed location. Overall coverage was 25/30 cells
(83.3%), with 11 search operations, no direct reads, no fallback sources, and no cross-city substitution.
The accepted facts all met the exact-city/row/value/currency/canonical-URL contract. Ten retained
definition-compatible rows had median absolute error 0%, p90 9.09%, and maximum 10.0%, but this is a small
date-drift source audit, not the locked validation. Exact provider model, parameters, tokens, latency, and
cost remain unavailable through the delegated execution surface. Promote the route for a larger city-level
food/drink validation; retain sparse `not_found` and do not impute Don Det from another city. See
`data/reference/v5/experiments/017-numbeo-search-broad-panel/`.

**Experiment 018 — 30-city Numbeo search validation — complete; promote food/drink route, reject complete
pipeline.** The frozen manifest separated 20 development cities from 10 locked holdout cities. Independent
Luna calls returned 144/150 cells (96%) and 28/30 complete cities (93.3%): development was 100/100, while
the holdout was 44/50 (88%) with Helsinki beer `not_found` and Kyoto 0/5. There were 150 queries and 60
search operations, no direct reads/fallbacks/arithmetic/cross-city evidence, and all accepted facts met the
search evidence contract. The 139 compatible retained rows had median absolute error 0%, p90 7.14%, max
16.88%; holdout rows had 0.54% median, 7.22% p90, 16.67% max. These are source/date audits, not final
19-tier model validation. Overall complete-city success is below the 95% gate and exact provider telemetry
remains unavailable. See `data/reference/v5/experiments/018-numbeo-search-30-city/`.

**Experiment 019 — edge-case repeatability — complete; mixed result.** Fifteen independent calls (three per
city) kept Kyoto and Don Det at 0/5 in every run, kept Nha Trang and Beijing at 5/5 with identical values, and
made Helsinki provenance-sensitive: broad same-call policy gave 5/5 once, while dedicated-query policy gave
3/5 and 4/5. Broad coverage was 42/75; normalizing Helsinki's non-dedicated beer gives 41/75. There were
36 search operations, no direct reads/retries/fallbacks/arithmetic/cross-city evidence, and no exact provider
telemetry. Keep the route bounded to ordinary food/drink cities with dedicated-query provenance; do not claim
complete reliability. See `data/reference/v5/experiments/019-numbeo-repeatability-edge-cases/`.

**Experiment 020 — activity anchor search feasibility — complete; promote attraction pattern only.** Six
independent calls issued three targeted searches each. Strict coverage was 6/18 cells (33.3%), with only
Hanoi complete: Copenhagen, Bangkok, and Lisbon supplied low-cost attraction tickets; Hanoi supplied all
three anchors; San Francisco and Don Det supplied none. Lisbon's half-day result was normalized to `not_found`
because shared/group status was not explicit. There were 18 queries and 12 search operations, no direct
reads/retries/fallbacks/arithmetic/cross-city evidence. Promote official attraction-ticket sources for a
broader panel; keep timed organized activities fail-closed. See `data/reference/v5/experiments/020-activities-search-feasibility/`.

**Experiment 021 — accommodation class search feasibility — complete; reject complete route.** Six
independent calls issued six targeted search-only queries. Only 7/36 cells (19.4%) were accepted and no city
was complete: Copenhagen supplied 3-star; Lisbon 2/3/4-star; San Francisco dorm/3/4-star; Hanoi, Bangkok,
and Don Det were 0/6. Hostel `From`, mixed classes, missing occupancy/per-room basis, generic, and wrong-city
results were rejected. Retain the heterogeneous class-average sources only for a separately matched panel;
do not fit accommodation ratios from these seven feasibility observations. See
`data/reference/v5/experiments/021-accommodation-class-search-feasibility/`.

**Experiment 022 — bounded Numbeo identity cascade — complete; promote bounded route.** Six independent calls
used a canonical query plus at most one city+country identity query per measure. The route returned 21/30
cells (70%) and four complete cities: Lisbon, Hanoi, Helsinki, and San Francisco. Kyoto recovered only beer
(1/5); Don Det stayed 0/5 after ten searches. It used 41 searches and 12 search operations, with no direct
reads/third queries/retries/fallbacks/arithmetic/cross-city evidence. Promote the cascade for ordinary
food/drink cities with a fixed search cap, but retain sparse/partial missingness. See
`data/reference/v5/experiments/022-numbeo-identity-cascade/`.

**Experiment 023 — activity ground-truth audit — complete; reject activity model fit.** The accepted-direct
observation ledger contains 29 paid-attraction cities, 3 half-day group-activity cities, 2 full-day premium
activity cities, and only one city with all three. This cannot satisfy the frozen 30-city/10-holdout gate, so
no activity ratio or imputation is fitted; `activities_free = 0` remains definitional. See
`data/reference/v5/experiments/023-activity-ground-truth-audit/`.

**Experiment 024 — strict accommodation panel — complete; reject and revise.** Three independent one-city
calls (Barcelona, Prague, Nairobi) issued 18 bounded searches and accepted only 3/18 cells: two 3-star
averages and one 4-star average. No city was complete. Hostel values were per-bed, `from`, mixed, or missing
two-adult identity; lower hotel classes lacked compatible class/occupancy evidence. The route cannot create a
30-city/10-holdout panel. Nairobi's raw response omitted per-measure query fields, but its standalone
telemetry preserved the exact six queries and the audit records that exception. See
`data/reference/v5/experiments/024-accommodation-ground-truth-panel/`.

### Next experiments, in order

1. Test a revised accommodation boundary in independent one-city calls: accept explicit one-bed dorm prices
   as observed inputs and scale to two travellers in deterministic code, while retaining strict two-adult
   per-room rules for hotel classes. Preserve source currency, display-currency warnings, exact query
   provenance, and fail-closed missingness; do not fit ratios before the 30-city/10-holdout gate.
2. Continue the official attraction-ticket panel and timed-activity source tests only after recording the
   revised accommodation boundary; do not silently substitute another city.
3. Replace or calibrate the rejected Booking city-average basis using independently collected matched
   direct-property quotes across separately recorded one-city calls. Do not fit a correction from Copenhagen
   alone; require the pre-registered 30-city/10-holdout relationship gate. Direct booking-engine URLs are
   rejected in the target web path after Experiment 013.
4. Test whether an interactive public accommodation page can preserve fixed dates and occupancy in the
   one-call target-model path, or pivot to a separately curated benchmark. Search-index date injection is
   rejected; retain the same strict class, currency, one-night, and occupancy rules.
5. Validate the nine-anchor candidate from Experiment 007 against definition-matched panels for food,
   drinks, and activities, while resolving accommodation measurement and dorm/private identifiability
   with independent ground truth. Do not infer two hostel tiers from one blended channel.
6. Establish direct ground truth for activity tiers or prove a simple model with held-out cities.
7. Compare the simplest direct/modelled partition against v4 using city-level validation and the locked
   manifest.
8. Run the full one-call blind evaluation, freeze the winning methodology, and only then plan integration,
   121-city migration, and rollback.

---

## Experiment protocol

Every material candidate gets a directory under `data/reference/v5/experiments/` containing its hypothesis,
pre-registered sample and gates, versioned prompt, raw responses, normalized observations, deterministic
results, and verdict. `LOG.md` receives confirmed results; this file carries current status and decisions.

Use the simplest candidate first: direct observation, a global median ratio, cost-band or regional ratios,
then log-linear forms. Add parameters only when a richer model improves both city-level validation schemes
by at least 10% relative, has stable coefficients, and improves a product metric. Prefer fewer parameters
when performance is practically tied.

Production extraction should report source currency and facts only where possible. Arithmetic, FX, modelling,
validation, tier construction, and evidence-basis labelling belong in deterministic code. A model-generated
estimate is never observed evidence.

All publicly accessible sources may be tested, including previously deferred channels, subject to signed-out
access, no paywall or source key, no bypassing blocks/CAPTCHAs/rate limits, and normal browsing behaviour.
Manual or browser collection may create ground truth but cannot be substituted for the target-model
production feasibility test.

---

## Documentation and verification

Current v5 artifacts:

- `docs/dev/plans/city-cost-methodology-v5.md`
- `docs/dev/handoffs/city-cost-v5.md`
- `data/reference/v5/README.md`
- `data/reference/v5/data-dictionary-v5.md`
- `data/reference/v5/validation-manifest-v5.json`
- `data/reference/v5/experiments/000-baseline-reassessment/`
- `data/reference/v5/experiments/001-one-call-harness/`
- `data/reference/v5/experiments/005-target-model-subagent/`
- `data/reference/v5/experiments/006-source-cascade-retest/`
- `data/reference/v5/experiments/007-minimal-anchor-retest/`
- `data/reference/v5/experiments/008-omitted-anchor-ground-truth/`
- `data/reference/v5/experiments/009-accommodation-panel-feasibility/`
- `data/reference/v5/experiments/010-date-fixed-accommodation-contract/`
- `data/reference/v5/experiments/011-direct-class-page-templates/`
- `data/reference/v5/experiments/012-single-city-production-shape/`
- `data/reference/v5/experiments/013-interactive-official-quote-extraction/`
- `data/reference/v5/experiments/014-single-city-numbeo-food-drink/`
- `data/reference/v5/experiments/015-numbeo-canonical-url-retest/`
- `data/reference/v5/experiments/016-numbeo-search-snippet-fallback/`
- `data/reference/v5/experiments/017-numbeo-search-broad-panel/`
- `data/reference/v5/experiments/018-numbeo-search-30-city/`
- `data/reference/v5/experiments/019-numbeo-repeatability-edge-cases/`
- `data/reference/v5/experiments/020-activities-search-feasibility/`
- `data/reference/v5/experiments/021-accommodation-class-search-feasibility/`
- `data/reference/v5/experiments/022-numbeo-identity-cascade/`
- `data/reference/v5/experiments/023-activity-ground-truth-audit/`
- `data/reference/v5/experiments/024-accommodation-ground-truth-panel/`
- `docs/prompts/llm_prompt_city_cost_v5_experiment_024_accommodation_ground_truth.md`
- `docs/prompts/llm_prompt_city_cost_v5_experiment_006.md`
- `docs/prompts/llm_prompt_city_cost_v5_experiment_007.md`
- `data/reference/v5/experiments/002-accommodation-ladder/`
- `data/reference/v5/experiments/003-derivation-contract/`
- `src/lib/city-cost-methodology-v5.ts` and its contract test

When `CLAUDE.md` changes, run `npm run docs:sync-memory` and `npm run docs:check-memory`; `AGENTS.md`
must remain byte-for-byte identical. Update the data, prompt, and script inventories when new artifacts
are added. Commit and push each sizeable experiment and milestone on `feat/city-cost-methodology-v5`.

After v5 acceptance, add integration, migration, and tested rollback milestones here. Until then, the app,
shipping v1 prompt, and 121-row production CSV remain unchanged.

---

## Unrelated app backlog

- [ ] Add tests around city generation parsing and Wise import format handling.
- [ ] Expand Playwright from planner regressions into full add-leg / generation success-path tests.
- [ ] Add provider/model capability validation for planner transport estimation.
- [ ] Add automated coverage around bulk transport estimation and planner apply flows.
- [ ] Consider transport-estimation caching — explicitly deprioritised.

## Traps retained from earlier work

1. A model's explanation for a failure is a hypothesis; verify the response independently.
2. Contract defects often look like model unreliability.
3. Never ask the model to grade its own work.
4. A contract that fights the shape of its sources will lose.
5. Inspect the underlying record, not only a summary.
6. On rate limiting, defer the city; do not silently fall through to search.
7. Do not adopt a promising result on one city's evidence.
