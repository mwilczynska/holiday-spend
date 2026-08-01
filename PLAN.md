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

**Experiment 025 — one-bed dorm boundary — complete; promote boundary, reject complete route.** Three paired
one-city calls used the revised prompt and accepted 6/18 cells, including one explicit Barcelona dorm price
of EUR15 per bed/night that can be scaled deterministically to two travellers. Hotel/private-hostel rules
remained unchanged. No city was complete; private hostel, 1-star, and 2-star remained unresolved. Retain
source/display currency exactly and flag non-local currency for FX review. See
`data/reference/v5/experiments/025-accommodation-bed-boundary/`.

**Experiment 026 — broader accommodation panel — complete; retain dorm boundary, pivot hotel coverage.** Three
new independent one-city calls (Lisbon, Hanoi, Copenhagen) used the unchanged Experiment 025 contract and
accepted 5/18 cells: one dorm bed in each city plus Copenhagen 3/4-star. No city was complete; private hostel,
1-star, and 2-star remained missing. The repeated dorm boundary is useful, but the hotel-class source/model
route cannot yet form a 30-city/10-holdout panel. See `data/reference/v5/experiments/026-accommodation-broader-panel/`.

**Experiment 027 — HOTEVI grouped tiers — complete; reject production source.** Three independent one-city
calls issued nine HOTEVI searches. Only Hanoi returned all three grouped rows (1–2, 3, and 4–5 star); Lisbon
lacked a visible row month and Copenhagen lacked exact city rows. Accepted coverage was 3/9, with unknown
occupancy basis and no valid mapping to the four product star classes. Retain HOTEVI only as a possible
calibration benchmark, not as a production anchor. See `data/reference/v5/experiments/027-hotevi-tier-feasibility/`.

**Experiment 028 — Expedia class trends — complete; promote 2–4-star candidate, reject complete route.** Three
one-city calls issued four class searches each; 7/12 cells passed (Lisbon 2/3/4-star, Hanoi 2/3/4-star,
Copenhagen 3-star). No 1-star row and no complete city. Copenhagen repeated the identical batch, so it has
eight actual search operations for four unique queries and is not production-compliant. Accepted snippets
state two-adult trend bases and excluded taxes/fees; source-locale USD needs FX review. See
`data/reference/v5/experiments/028-expedia-class-trends/`.

**Experiment 029 — broader Expedia class panel — complete; promote 2–4-star route, reject complete coverage.**
Bangkok, San Francisco, and Nairobi each passed one compliant four-query call. Coverage was 8/12: 2/3/4-star
in Bangkok and San Francisco, 3/4-star in Nairobi; 1-star was absent everywhere and Nairobi 2-star was missing.
No city was complete. Together with 028 this is promising six-city source feasibility, not accuracy or a
1-star solution. See `data/reference/v5/experiments/029-expedia-class-panel/`.

**Experiment 030 — one-star source cascade — complete; retain calibration candidates, reject product mapping.**
Three independent one-city Luna calls (Bangkok, San Francisco, Nairobi) issued exactly one Momondo and one
KAYAK search each. Momondo returned one 1-star candidate in every city, but all three had unknown or
source-default-room occupancy; KAYAK returned no exact city-wide 1-star row. Coverage was 3/6 candidate
cells, with zero explicit two-adult rows. Retain the rows only for a separately declared occupancy-calibration
panel; do not map them to `accom_1_star` or fit from this tranche. See
`data/reference/v5/experiments/030-one-star-source-cascade/`.

### Next experiments, in order

Experiment 033 found 8/9 class-specific one-star aggregator rows across Lisbon, Barcelona, and Hanoi. All are
source-default/unknown occupancy and disagree materially by source, so promote Trip.com, HotelsCombined, and
Budget Your Trip only to a larger calibration/agreement panel; do not map them to `accom_1_star`.

Experiment 034 rejected that full panel: 12/30 cells, one complete city, and only 2/9 locked holdout cells. Keep
Budget Your Trip as a guarded fallback candidate (9/10 rows, but zero/one-hotel quality failures); explicit
occupancy and held-out accuracy remain unresolved.

Experiment 035 found a strong activity source shape: BudgetYourTrip returned 12/12 exact-city per-person/day
activity and budget/mid/luxury entertainment rows across Lisbon, Hanoi, and Copenhagen. Broaden this panel, then
validate deterministic two-person scaling and tier semantics against independent ground truth; do not map yet.

Experiment 036 passed the activity source panel: 40/40 rows across 10 cities (7 development, 3 holdout), all
one-person/day and every city complete. Promote the extraction contract, then run independent ground-truth
scaling/tier validation before mapping activity product values.

Experiment 037 rejected the definition-matched BudgetYourTrip activity route: 0/9 rows met ticket party-basis,
half-day group, or full-day premium duration gates. Keep the generic 036 entertainment contract separate and
unmapped; test an independent activity source or revisit the product interpretation explicitly before mapping.

Experiment 038 expanded the guarded BudgetYourTrip 1-star fallback to 20 new cities: 17/20 strict rows, zero
explicit two-adult occupancy, two tiny samples, one zero-denominator rejection, and one blocked search. Retain
only as imputation/fallback with hard quality guards; no product mapping or correction fit is allowed.

Experiment 039 tested the hostel dorm/private boundary across six independent one-city calls: dorm-bed input
coverage was 6/6, but private-room coverage was 0/6 because no source explicitly established two-adult/two-guest
occupancy. Retain the one-bed dorm boundary for deterministic scaling; reject private-room source mapping and
correction fitting. The private-hostel gap remains a top validation blocker.

Experiment 040 met its pre-registered source-feasibility threshold: 3/6 one-city calls returned explicit
two-adult named-hostel quotes from Booking snippets (London, Lisbon, Hanoi), while Melbourne, New York City,
and Tokyo failed closed. These are dated property observations, not city averages. Promote only as a frozen
property-panel/ground-truth collection route; do not map directly to `accom_hostel_private_room` or fit a
city-wide correction before the 30-city/10-holdout aggregation and accuracy gates.

Experiment 041 rejected the paired one-star calibration hypothesis: five of six calls found guarded
BudgetYourTrip city statistics, but zero of six found an explicit two-adult one-star quote from Booking or
Hotels.com. Do not fit an occupancy correction or map source-default rows to `accom_1_star`; retain testing-
subdomain/page-family warnings and pivot to independently curated definition-matched ground truth or a
validated imputation model.

Priority update: Experiments 030–041 have not produced an explicit two-adult one-star panel. The next run must
either collect independently curated definition-matched one-star ground truth or pre-register a guarded
imputation model with a separate validation sample; require the 30-city/10-holdout gate before mapping any
candidate to `accom_1_star`.

Experiment 042 tested frozen official-register class evidence joined to exact-property two-adult quotes. Only
1/9 properties passed strict price/tax/occupancy checks, and the surviving Lisbon quote needs an address identity
review. Reject the route as a productive panel; do not compute a basket or map a quote to `accom_1_star`.

Experiment 043 tested Google Hotels snippets as a new one-star source family. Only 1/6 cities produced a strict
exact-city, explicit-two-adult, non-`from`, tax-resolved quote. Reject the broader route; retain the Cape Town
row only as independent ground-truth evidence and do not map or fit it.

Experiment 045 tested Trip.com for the frozen activity definitions in six independent one-city calls. All 18
searches were compliant, but strict coverage was 0/18 (0/6 for each activity measure). “From” prices dominated;
other rows lacked tax, adult/party, duration, or premium evidence. Reject Trip.com for this production route and
retain only the failure evidence. No activity value is currently promotable.

The one-star priority statement above predates Experiments 042–043; those experiments also failed to produce a
promotable explicit-two-adult one-star panel. The current one-star blocker is therefore unchanged.

The next activity experiment is the queued operator-source panel 044 (GetYourGuide/Viator). It must use the same
single-city Luna shape and strict ticket, half-day-group, and full-day-premium definitions; Trip.com’s 0/18 result
is not a reason to weaken those gates.

Experiment 046 tested official attraction, authority, museum, and named-operator pages in six independent one-city
calls. Strict compatibility was 0/18 (0/6 per activity measure): two budget tickets lacked tax treatment, and no
mid-range or high-end row passed. Reject this route as a complete activity source; retain the two unknown-tax
budget rows only as rejected evidence.

Experiment 047 tested a six-city explicit two-adult accommodation property panel. Private-hostel quotes passed in
3/6 cities (Berlin, Mexico City, Tokyo), meeting the source-feasibility promotion threshold for a broader
property/ground-truth panel. One-star quotes passed in only 1/6, so the one-star blocker remains. No city average or
product mapping is permitted yet.

Experiment 048 broadened the private-hostel property panel to 12 new cities. Only 4/12 strict quotes passed,
below the 6/12 promotion gate. The route remains a ground-truth candidate, not a production anchor; resolve
members-only, tax, one-night, and class failures before defining aggregation.

Experiment 049 broadened the one-star property search to 12 cities and three public source families. Only 1/12
strict quotes passed (Amsterdam), far below the 6/12 gate. The direct one-star route remains rejected; no class
substitution or correction fit is allowed.

Experiment 050 isolated tax-resolved official attraction tickets across six cities. Only 2/6 strict tickets passed
(Bangkok via Expedia and Lisbon first-party), below the 4/6 gate. Retain these as direct source candidates but do
not map `activities_budget`; timed activity and complete activity coverage remain unresolved.

Experiment 051 retested the nine-anchor shape in six one-city calls with a fixed four-search budget. No city was
complete; non-sparse coverage was 5/9–8/9 and Don Det was 0/9. Food/drink and attraction inputs are promising,
but three-star hotel coverage was 0/6 and accommodation/sparse gaps remain. Do not promote the complete contract.

Experiment 031 rejected that calibration route: three one-city calls and nine bounded searches produced zero
explicit two-adult 1-star rows. Momondo's two source-default candidates remain unresolved evidence only. The
next run must test a different direct 1-star source or a separately curated two-adult property panel; do not
fit a correction from this tranche.

Experiment 032 rejected the direct property-basket pivot: three one-city calls and 12 bounded searches produced
zero named 1-star quotes with the joint explicit-two-adult/non-`from` contract. The next run must test a different
source or a separately curated ground-truth collection; no one-star value is currently promotable.

1. Run a separately declared 1-star source test while continuing the Expedia 2–4-star panel. Enforce one
   search batch per city, preserve duplicate-call deviations, and require 30 complete cities plus 10 locked
   holdouts before any accommodation model is promoted. Retain the one-bed dorm boundary and all currency/
   missingness provenance.
2. Test a new activity source or an explicitly different activity estimand; Trip.com (Experiment 045) is rejected
   under the frozen contract. Do not silently substitute “From” prices or generic entertainment rows.
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
6. Establish direct ground truth for activity tiers or prove a simple model with held-out cities. The 045 Trip.com
   panel supplied no compatible rows.
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
- `data/reference/v5/experiments/025-accommodation-bed-boundary/`
- `docs/prompts/llm_prompt_city_cost_v5_experiment_025_accommodation_bed_boundary.md`
- `data/reference/v5/experiments/026-accommodation-broader-panel/`
- `data/reference/v5/experiments/027-hotevi-tier-feasibility/`
- `docs/prompts/llm_prompt_city_cost_v5_experiment_027_hotevi_tiers.md`
- `data/reference/v5/experiments/028-expedia-class-trends/`
- `docs/prompts/llm_prompt_city_cost_v5_experiment_028_expedia_class_trends.md`
- `data/reference/v5/experiments/029-expedia-class-panel/`
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

Experiment 052 broadened the three-star property panel to 12 independent one-city calls and 36 ordered searches
across Google Hotels, Expedia, and Booking.com. Strict explicit-three-star, two-adult, one-room, non-from,
nightly, tax-resolved coverage was **0/12**, so the 6/12 promotion gate failed. Exact class/price/tax snippets
often omitted one-room occupancy; other failures were from prices, generic averages, wrong classes, nearby cities,
or missing class labels. Reject the route and do not map `accom_3_star` or infer one room from a two-adult selector.

The next highest-value experiment must explicitly test a declared occupancy semantic or a deterministic model/data
boundary. Any relaxed occupancy rule is an estimand amendment, not an implementation detail, and must be validated
against independent named-property observations before use. The v5 methodology remains unaccepted and the shipping
v1 path remains unchanged.

Experiment 053 completed the selector-occupancy semantic audit in twelve independent one-city Luna calls and 36
ordered searches. Strict explicit-one-room coverage was 0/12; the separately labelled selector-relaxed hypothesis
reached 7/12, below its 8/12 promotion gate (the six strict-failure condition passed at 7/12). Reject promotion:
the relaxed rows remain hypotheses, not observed two-person rooms. Any future semantic amendment requires a dated
estimand decision and a new 30-city/10-holdout explicit-room validation panel.

Experiment 054 scanned 176 accepted direct ledger rows and tested six material relationships without fitting. No
accommodation relationship had a matched city; each activity-tier relationship had only one (Vancouver). All
failed the 30-city/10-holdout gate. Reject fitting until definition-compatible paired observations or a materially
different source/estimand is found. The v5 methodology remains unaccepted.

Experiment 055 completed twelve independent one-city Luna contexts and 48 ordered Skyscanner class searches. Strict
coverage was 0/48 (1-star 0/12, 2-star 0/12, 3-star 0/12, 4-star 0/12); no city was complete. Exact class,
selector, and price snippets generally lacked tax treatment or had malformed currency/class evidence. Reject the
route and do not map or fit. A different tax or price-statistic estimand requires a new pre-registration.

Experiment 056 completed twelve independent one-city Luna contexts and 24 ordered Agoda searches. Strict coverage
was 0/24 (1-star 0/12 and 3-star 0/12), with no complete city. Agoda exposed some class or maximum-occupancy facts,
but selected dates were required before a numeric nightly price, one-room basis, and tax treatment appeared. Reject
the route and do not map or fit; a different retrieval shape or estimand requires a new pre-registration.

Experiment 057 completed twelve independent one-city Luna contexts and 24 ordered Booking 3-star/4-star searches.
Strict coverage was 0/24 (3-star 0/12, 4-star 0/12), with no complete city. Some class pages exposed numeric
averages and selectors but not tax/fee treatment in the same evidence; other rows lacked class or occupancy proof.
Reject the route and do not map or fit. A materially different tax or price-statistic estimand requires a new
pre-registration.

Experiment 058 completed twelve independent one-city Luna contexts and 36 ordered Trip.com star-2/3/4 searches.
Strict coverage was 0/36 (0/12 for each class), with no complete city. Class pages exposed weekday/weekend or
localized averages but not same-evidence explicit two-adult/one-room occupancy and tax status. Reject the route and
do not map or fit; a materially different tax or price-statistic estimand requires new pre-registration.

Experiment 059 completed twelve independent one-city Luna contexts and 36 ordered Expedia 2-/3-/4-star searches.
Strict coverage was 27/36 (2-star 9/12, 3-star 11/12, 4-star 7/12), with six complete cities. The complete-city
sub-gate passed but the pre-registered 4-star 8/12 gate failed. All accepted rows explicitly state two-adult
tax-excluded base-rate trends. Retain Expedia as the strongest candidate, but do not map or fit; run a separately
pre-registered 4-star gap panel.

Experiment 060 completed twelve independent one-city Luna contexts and 12 ordered Expedia 4-star searches. Strict
coverage was 9/12; 3/5 prior misses recovered (Budapest, Sydney, Tokyo), below the pre-registered 4/5 recovery gate.
The overall gate passed, but no mapping or fitting is authorized. Combined with 059, Expedia has 16 unique strict
4-star cities; continue a new-city paired 2-/3-/4-star panel toward the 30-city modelling requirement.

Experiment 061 completed twelve new one-city Luna contexts and 36 ordered Expedia 2-/3-/4-star searches. Strict
coverage was 26/36 (2-star 8/12, 3-star 8/12, 4-star 10/12), with five complete cities; the six-complete-city gate
failed. Retain paired evidence but do not map or fit; run a 3-star gap panel.

Experiment 062 completed twelve independent one-city Luna contexts and 12 ordered Expedia 3-star searches. Strict
coverage was 4/12, with 0/4 recovery among the 061 misses; both pre-registered gates failed. Retain four strict rows
but stop query-retry expansion and reassess the pooled Expedia source/model boundary. No mapping or fitting is allowed.

Experiment 063 completed twelve entirely new one-city Luna contexts and 36 ordered Expedia 2-/3-/4-star searches.
Strict coverage was 15/36 (2-star 2/12, 3-star 7/12, 4-star 6/12), with one complete city; all gates failed.
Retain rows for a pooled source-ceiling audit, but do not map or fit.

Experiment 064 completed the deterministic pooled Expedia evidence audit. It found 80 accepted rows across 36
unique cities, all tax-excluded; 16 cities were complete for 2-/3-/4-star, with 20 matched 2↔3 cities and 22 matched
3↔4 cities. No relationship reached the 30-city plus 10-holdout gate, and one-star/hostel had zero eligible rows.
Do not fit or map. Pivot the missing-class boundary while retaining Expedia as a candidate 2-/3-/4-star source.

Experiment 065 completed twelve fresh one-city Luna contexts with exactly two ordered Expedia searches per city
(1-star then 3-star). Strict coverage was 0/12 one-star, 9/12 three-star, and zero complete pairs; all promotion
gates failed. Generic all-hotel, district, class-ambiguous, and non-numeric one-star results were rejected. Pivot
to a materially different one-star/hostel source or an explicitly amended estimand; do not map or fit.

Experiment 066 completed with 0/12 explicit two-person rows: eight numeric pages lacked row-level occupancy and four
page reads were blocked or timed out. Reject BudgetYourTrip as a direct one-star source, but test a source-level
double-occupancy proxy calibration before closing the route. No mapping or fitting is allowed yet.

Experiment 067 completed with 1/12 proxy candidates and 12/12 protocol-compliant calls. The gate failed because
most cities had blocked/timed-out reads, stale or absent one-star classes, or no joinable same-source occupancy page.
Reject this proxy route at current web-tool reliability; retain Cairo as labelled proxy evidence only and do not map
or fit.

Experiment 068 completed with 10/12 proxy candidates and 12/12 protocol-compliant calls, passing its screening gate.
Promote only to independent explicit-two-adult calibration/page-backed validation; snippets remain proxy-only and no
mapping or fitting is allowed.

Experiment 069 completed with 12/12 protocol-compliant calls, 11/12 proxy candidates, and 0/12 matched cities with an
independent explicit-two-adult one-star named-property candidate. The 6/12 matched-city gate failed. Reject this
BudgetYourTrip proxy calibration route; retain the proxy rows and rejected direct-source evidence as labelled records
only. Do not map or fit. Any future property-basket calibration must be a new design and still meet the
30-city plus 10-locked-holdout gate.

Experiment 070 is active: twelve one-city Luna contexts issue exactly three ordered Hostelworld, Booking.com, and
Google Hotels searches for explicit two-guest private-hostel room candidates. The screen requires at least 6/12
cities with one qualifying standard non-from candidate and 10/12 protocol-compliant calls. A pass authorizes only a
new city-level property-basket design; no product mapping or fitting is allowed.

Experiment 070 completed with 12/12 protocol-compliant calls, 4/12 cities with strict candidates, and five accepted
property rows. The 6/12 gate failed. Reject this search-only private-hostel route; retain the five named-property rows
as property-level evidence only and do not aggregate, scale, map, or fit. The next private-hostel attempt must be a
materially different source or aggregation design and still meet the 30-city plus 10-locked-holdout gate.

Experiment 071 is active: twelve one-city Luna contexts issue exactly three searches for an adult attraction ticket,
a half-day group activity, and a full-day premium activity. The source reports explicit per-person adult prices; any
factor-of-two scaling is deferred to deterministic code. The screen requires 8/12 strict rows per category, 6/12
complete cities, and 10/12 protocol-compliant calls. No product mapping or accuracy claim follows this screen.

Experiment 071 completed with 12/12 protocol-compliant calls but strict coverage of budget 3/12, mid-range 0/12,
high-end 1/12, and zero complete cities. Reject this per-person activity screen; retain four source facts only and do
not apply the factor of two, map tiers, or fit. The next activity attempt must use a materially different source or
contract and independently validate scaling.

Experiment 072 completed with 12/12 strict rows and 12/12 protocol-compliant calls, passing its source screen. All
rows use the tax-included Price of Travel Hostel Index reference window (Thursday/Friday mid-April 2023). Promote only
to a pre-registered two-bed scaling and independent accuracy experiment; the stale selected-hostel statistic is not
yet a production city median, and no dorm product mapping is allowed.

Experiment 073 completed twelve one-city Luna contexts with exactly one Price of Travel search, one exact-page read,
and one current exact-property dorm search. All calls were protocol-compliant and all index rows were strict, but
only 5/12 current benchmarks were strict, 4/12 had the same property identity, and just 1/12 had matching currency.
The same-currency calibration gate (8/12) failed; Lisbon's one scored pair had 38.76% absolute percentage error.
Reject this calibration boundary. Do not map or fit the index. A separate deterministic-FX audit may test the retained
definition-compatible CNY rows, but it must be pre-registered and still meet the 30-city/10-holdout gate.

Experiment 074 completed twelve one-city Luna contexts with exactly one public Hostelworld search each. All calls were
protocol-compliant, but strict shared-dorm coverage was 0/12: results were `From`/seasonal prices or lacked visible
dates and tax/fee basis. Reject this source/query boundary; do not map or scale it. The next accommodation priority is
the closest viable model-evidence package, beginning with a targeted pooled Expedia 3↔4-star completion audit.

Experiment 075 completed with 12/12 protocol-compliant calls and 15 strict fresh rows. The pooled evidence now has 20
matched 2↔3 cities and 23 matched 3↔4 cities (81 rows across 36 cities), so neither 30-city relationship gate passed.
Reject pooled fitting promotion; retain rows as source evidence only and do not map hotel classes. The accommodation
model remains unresolved.

Experiment 076 is active: twelve one-city Luna contexts test HOTEVI's public research table with exactly one search and
one exact-page read. The strict screen extracts grouped budget (1–2★), mid (3★), and luxury (4–5★) standard-room rates
as source-defined proxies. A pass authorizes only independent calibration; no star splitting, fitting, or product mapping.

Experiment 076 completed with 12/12 protocol-compliant calls and 12/12 complete cities (36/36 grouped rows). Promote
HOTEVI only to independent proxy calibration. Its occupancy is source-defined standard-room, tax status is unknown,
the index month is not exposed, and grouped 1–2★/4–5★ tiers cannot be split. Do not map or fit.

Experiment 077 completed with 12/12 protocol-compliant calls but 0/12 strict rows for 1★, 3★, and 4★, and zero
complete cities. Reject the direct HOTEVI property boundary. Keep the grouped table proxy-only and do not relax
occupancy, class, date, or tax evidence.

Experiment 078 completed with 12/12 protocol-compliant calls and eight strict new rows. Pooling now contains 89
strict rows across 41 cities, but only 20 matched 2-star/3-star cities and 26 matched 3-star/4-star cities. Both
30-city relationship gates failed. Reject pooled fitting promotion; retain rows as source evidence only and do not
fit coefficients or map hotel classes.

The next accommodation experiment must test a materially different anchor or explicitly pre-register another
bounded source-panel attempt; repeating the same Expedia query contract without a changed hypothesis is not justified.

Experiment 079 completed with 18/18 protocol-compliant, complete grouped proxy rows. Combined with Experiment 076,
only 19 cities matched explicit Expedia 3-star rows and 15 matched explicit Expedia 4-star rows; locked holdout
matches were 8 and 5. Both 30-city/10-holdout gates failed. The unfitted proxy screen was also unstable (3-star
overall median APE 17.65%, p90 109.68%; 4-star median APE 35.92%, p90 183.02%). Reject proxy calibration; retain
HOTEVI as labelled research evidence only and do not split, fit, or map grouped classes.

The next accommodation experiment must test a materially different anchor, not repeat Expedia/HOTEVI grouped
semantics without a changed hypothesis.

Experiment 080 completed with 30/30 protocol-compliant calls and 28/30 complete exact-city per-person/day tier sets,
passing its source screen. Fukuoka was `not_found`; Rome's multi-city itinerary rows were rejected. Deterministic
factor-of-two scaling produced candidate two-traveller values, but the locked holdout was only 8/10 complete and no
independent ground truth establishes equivalence to ticket, half-day, or full-day activity estimands. Promote only to
definition-matched validation; do not accept final activity mapping.

Experiment 081 completed with 15/15 protocol-compliant calls. Mumbai, Dubai, Paris, and Copenhagen each returned
identical complete tiers across three calls (0% dispersion); Fukuoka was `not_found` in all three calls. The
pre-registered five-city repeatability gate therefore failed. Retain the ordinary-city route with explicit sparse
fail-closed behavior; do not average calls or map missing values. This remains a dispersion result, not accuracy.

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
