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

## Experiment 020 result

Six independent one-city Luna calls issued exactly three activity searches each: standard low-cost attraction,
3–5 hour group activity, and 6–10 hour premium activity. Strictly, 6/18 cells were found and only Hanoi was
complete. Copenhagen, Bangkok, and Lisbon supplied one attraction ticket each; Hanoi supplied all three
anchors; San Francisco and Don Det supplied none. Lisbon's four-hour EUR41/person brochure result was kept in
raw evidence but normalized to `not_found` because it did not explicitly say shared/group. There were 18
queries and 12 search operations, with no direct reads/retries/fallbacks/arithmetic/FX/cross-city evidence.

**Verdict:** promote official attraction-ticket sources for a larger activity panel; keep half-day/full-day
activities fail-closed unless duration, adult basis, organized/group status, and non-`from` price are explicit.
Do not fit a model from Hanoi alone. Read `data/reference/v5/experiments/020-activities-search-feasibility/`.

## Experiment 021 result

Six independent one-city calls issued six accommodation searches each for hostel dorm/private and hotel
1–4-star city averages, without direct page reads or date injection. Only 7/36 cells (19.4%) were accepted
and no city was complete: Copenhagen supplied 3-star; Lisbon 2/3/4-star; San Francisco dorm/3/4-star;
Hanoi, Bangkok, and Don Det were 0/6. Hostel `From` prices, mixed hostel/guesthouse values, missing
occupancy/per-room basis, generic or wrong-city results, and event-specific prices were rejected. The calls
used 36 queries and 17 search operations, with no direct reads/retries/fallbacks/arithmetic/FX/cross-city
evidence; exact provider telemetry was unavailable.

**Verdict:** reject the complete accommodation route. Retain the KAYAK/Momondo/Booking/Budget Your Trip
class-average patterns only for a separately curated, definition-matched ground-truth panel; do not fit
ratios from seven feasibility observations. Read `data/reference/v5/experiments/021-accommodation-class-search-feasibility/`.

## Experiment 022 result

Six independent one-city calls used a canonical Numbeo query plus at most one city+country identity query per
measure. The route returned 21/30 cells (70%) and four complete cities: Lisbon, Hanoi, Helsinki, and San
Francisco. Kyoto recovered only domestic beer (1/5); Don Det remained 0/5 after ten searches. Hanoi's
identity query recovered a canonical mid-range page after the first result was a noncanonical ranking page.
There were 41 searches and 12 search operations, with no direct reads, third queries, retries, fallback
sources, arithmetic, FX, or cross-city evidence; exact provider telemetry was unavailable.

**Verdict:** promote a fixed two-query identity cascade for ordinary food/drink cities, with dedicated-query
provenance and fail-closed sparse missingness. Do not use country averages or nearest-city substitutions.
Read `data/reference/v5/experiments/022-numbeo-identity-cascade/`.

## Next action

Experiment 023 confirms that the retained activity ledger cannot support a model: there are 29 paid-attraction
cities, 3 half-day cities, 2 full-day cities, and only one complete city. Keep `activities_free = 0`
definitional and do not fit timed-activity ratios from this evidence.

Experiment 024 rejected the strict accommodation panel route after three independent one-city calls accepted
3/18 cells and no complete city. The next accommodation test may accept explicit per-bed dorm prices as
observed one-bed inputs for deterministic scaling, but must retain strict two-adult per-room hotel rules,
exact query provenance, source currency, and a display-currency warning. Do not fit before 30 complete cities
and 10 locked holdout cities exist.

Experiment 025 promoted the one-bed dorm boundary: paired Barcelona, Prague, and Nairobi calls accepted 6/18
cells (up from 3/18), including Barcelona's explicit EUR15 per-bed input. No city was complete; private
hostel, 1-star, and 2-star remain unresolved. Broaden this boundary with additional independent cities, keep
strict hotel/private-room occupancy, and require 30 complete cities plus 10 locked holdouts before fitting.

Experiment 026 broadened the boundary to Lisbon, Hanoi, and Copenhagen and accepted 5/18 cells: three dorm
inputs plus Copenhagen 3/4-star. No city was complete; private hostel, 1-star, and 2-star remain unresolved.
Retain deterministic dorm scaling and pivot to a separately declared hotel occupancy/source hypothesis.

Experiment 027 tested HOTEVI grouped 1–2/3/4–5-star rows and accepted only Hanoi's dated set (3/9 cells);
occupancy was unknown and the grouped tiers cannot map to product star classes. Reject HOTEVI for production
and test another public source or an explicitly validated occupancy hypothesis.

Experiment 028 found a promising Expedia route: 7/12 2–4-star trend cells across Lisbon, Hanoi, and
Copenhagen, with no 1-star and no complete city. Copenhagen repeated its four-query batch (8 actual search
operations), so retain that protocol deviation. Broaden the 2–4-star route, solve 1-star separately, and keep
strict one-city/search-count/currency provenance.
Experiment 029 added compliant Bangkok, San Francisco, and Nairobi calls: 8/12 2–4-star cells, no 1-star, no
complete city. Treat 028–029 as six-city source feasibility only. Next, test a separately declared 1-star
source while retaining the Expedia 2–4-star route and the 30-city/10-holdout gate.

Experiment 030 tested Momondo/KAYAK 1-star search candidates in three independent one-city calls. Momondo
returned Bangkok, San Francisco, and Nairobi rows (3/6 candidate cells); KAYAK returned none. Every retained
row had unknown or source-default-room occupancy, so zero rows are valid two-adult observations. Keep these
rows only for an explicit occupancy-calibration panel; do not map them to `accom_1_star`.

Experiment 031 tested the explicit occupancy panel in the same one-city shape: three cities, three bounded
searches each (Momondo, Skyscanner, Expedia), nine searches total. It produced two Momondo source-default
rows and zero explicit two-adult rows. Reject the route; retain candidates only as unresolved evidence and test
a different direct 1-star source or a separately curated two-adult property panel.

Experiment 032 tested that property panel in Barcelona, Prague, and Nairobi: four bounded source searches per
city, 12 total, zero qualifying named 1-star quotes. Occupancy, class, and non-`from` price did not co-occur.
Reject the route and pivot to a different source or separately curated ground truth; do not map any one-star
value.

Experiment 033 found a better one-star retrieval candidate: Trip.com, HotelsCombined, and Budget Your Trip
returned 8/9 exact city/class statistics across Lisbon, Barcelona, and Hanoi. All occupancy bases were
source-default/unknown; Lisbon and Hanoi had large cross-source spreads. Promote only to a broader calibration
panel, not to product mapping.

Experiment 034 broadened this to ten cities with a 7/3 development/holdout split. It accepted 12/30 cells, one
complete city, and 2/9 holdout cells. Budget Your Trip supplied 9/10 rows but had zero/one-hotel quality failures;
keep it as a guarded fallback candidate only and do not map it to `accom_1_star`.

Experiment 035 is the strongest new route: BudgetYourTrip returned exact-city activity average plus budget,
mid-range, and luxury entertainment values for Lisbon, Hanoi, and Copenhagen (12/12), all explicitly one
person/day. Broaden the panel next; no two-person scaling or product mapping has been accepted.

Experiment 036 passed a 10-city activity panel (40/40, 7 development/3 holdout), all one-person/day. The source
contract is a methodology candidate; next validate deterministic two-person scaling and tier semantics against
independent ground truth before mapping.

Experiment 037 tested the frozen activity definitions directly and accepted 0/9 rows. Reject BudgetYourTrip for
ticket/half-day/full-day anchors; generic entertainment rows from 036 remain separate and must not be silently
substituted.

Experiment 038 broadened the guarded one-star BudgetYourTrip candidate to 20 new cities. It accepted 17/20 rows,
but zero had explicit two-adult occupancy; Manila/Mumbai were tiny samples, Taipei failed a zero denominator, and
Paris was blocked without retry. Keep only as guarded imputation/fallback; do not present it as observed.

Experiment 039 tested six one-city hostel boundary calls with two targeted searches each. All six returned a
strict city-level one-adult dorm-bed input; none returned a private-room row with explicit two-adult/two-guest
occupancy. Retain deterministic two-traveller dorm scaling, but reject unknown-basis private-room values as
observations, corrections, or product mappings.

Experiment 040 found explicit two-adult named-hostel quotes in 3/6 one-city calls (London, Lisbon, Hanoi) using
ordered Hostelworld/Booking searches. The rows are dated property observations with source currency and
tax/fee exclusions, not city averages. Promote only as a ground-truth/property-panel collection candidate and
keep direct city-wide private-room mapping rejected until the 30-city/10-holdout aggregation and accuracy gates
pass.

Experiment 041 tested one-star pairing in six one-city calls. BudgetYourTrip returned five city statistics, but
Booking/Hotels.com returned zero explicit two-adult one-star quotes. Reject occupancy calibration and direct
mapping; Tokyo's testing-subdomain row and Rome's conflicting page families require guarded provenance. The
remaining path is independent definition-matched ground truth or a separately validated imputation model.

Experiment 042 tested the repository's frozen registry manifests against exact-property searches: 1/9 strict
quotes, in Lisbon, with an unresolved address discrepancy. Barcelona's only price had unknown tax treatment and
Da Nang had no qualifying quote. Reject the join as a productive one-star panel; no basket, correction, or product
mapping is permitted.

Experiment 043 tested Google Hotels as another one-star source family: 1/6 strict property quotes, Cape Town
only. The route fails the 3/6 promotion gate; preserve the all-in USD63 row as ground-truth candidate evidence,
but no one-star mapping, basket, or correction is allowed.

Experiment 045 tested Trip.com for activity definitions in six independent one-city calls. All 18 ordered searches
were compliant, but strict coverage was 0/18 (0/6 budget, 0/6 mid-range, 0/6 high-end). “From” pricing dominated;
other failures lacked tax, adult/party, duration, or premium evidence. Reject the route and preserve raw failure
artifacts only. The next activity step must test a materially different source or explicitly revise the estimand
before a new pre-registered panel.

Experiment 044 tested GetYourGuide/Viator activity operator sources in six independent one-city calls. All 18
ordered searches were compliant, but strict coverage was 0/18 (0/6 budget, 0/6 mid-range, 0/6 high-end). “From”
or variable group prices, tour-versus-ticket mismatch, unknown taxes, and incomplete duration/premium evidence
caused the failures. Reject the route and preserve raw failure artifacts only; a new activity source or revised
estimand requires a new pre-registered panel.

Experiment 046 tested official attraction/authority/museum/named-operator pages in six independent one-city calls.
All 18 searches were compliant, but strict compatibility was 0/18 (0/6 per activity measure). Two budget tickets
had unknown tax treatment; no mid-range or high-end row passed. Reject the route as a complete activity source and
retain raw rejected evidence only. A future tax-resolved budget-only test needs a new pre-registration.

Experiment 047 tested explicit two-adult private-hostel and one-star property quotes in six independent one-city
calls. Exactly 24 searches were compliant. Private-hostel quotes passed in 3/6 (Berlin, Mexico City, Tokyo), so
promote that route only to a broader property/ground-truth panel. One-star quotes passed in 1/6 and remain rejected.
No city aggregation, correction, or product mapping is allowed until property selection, aggregation, and the
30-city/10-holdout gates are pre-registered.

Experiment 048 broadened the private-hostel route to 12 cities with 24 compliant searches. Four strict quotes
passed (Nairobi, Prague, Seoul, Sydney), below the 6/12 promotion gate. Do not aggregate or map the private-room
route; preserve these property candidates and the failure reasons while resolving login/tax/one-night/class gaps.

Experiment 049 tested one-star properties in 12 independent one-city calls with 36 compliant searches across
Google Hotels, Expedia, and Hotels.com. Only Amsterdam passed (1/12), below the 6/12 gate. Keep it as a single
ground-truth candidate; do not map, substitute classes, or fit a correction.

Experiment 050 tested tax-resolved official adult tickets in six independent one-city calls. Six searches were
compliant; Bangkok (Expedia SeaLife, taxes included) and Lisbon (Oceanário brochure, VAT included) passed, for 2/6,
below the 4/6 gate. Keep both as direct candidates only; no `activities_budget` mapping or complete activity claim.

Experiment 051 retested nine raw anchors in six independent one-city calls with 24 compliant searches. No city was
complete; non-sparse coverage was 5/9–8/9 and Don Det was 0/9. Food/drink and attraction inputs are promising,
but three-star hotel coverage was 0/6 and hostel gaps remain. Do not promote the complete extraction contract or
hide missingness through modelling until independent validation is available.

Experiment 052 broadened the three-star property route to 12 independent one-city calls with 36 compliant searches
(Google Hotels, Expedia, Booking.com). Strict explicit-three-star, two-adult, one-room, non-from, nightly,
tax-resolved coverage was **0/12**. Most exact class/price/tax candidates omitted explicit one-room occupancy;
remaining failures included from prices, generic averages, wrong/nearby class, and absent class. Reject the route,
do not map `accom_3_star`, and do not infer one room from a two-adult selector. A relaxed occupancy semantic must
be a new pre-registered estimand experiment with independent validation.

Experiment 053 completed. It recorded strict and selector-relaxed outcomes for the same 12-city three-star
panel, where the relaxed hypothesis requires an exact named property, explicit two-adult/one-night selector,
numeric non-from nightly price, known tax, and no multi-room/per-person/suite signal despite omitted one-room words.
Strict coverage was 0/12 and relaxed coverage 7/12, so the 8/12 plus 6/12 promotion gate failed. The relaxed label
is not observed occupancy and cannot be mapped or fitted. Any future amendment requires a dated estimand decision
and a separate 30-city/10-holdout explicit-room validation panel.

Experiment 054 completed the deterministic model-fit adequacy audit. Among 176 accepted direct ledger rows, all
three hotel-class relationships and private-hostel/dorm had zero matched cities; activity mid/high from paid
attraction each had one matched city (Vancouver). All six failed the 30-city/10-holdout gate. No model was fitted.
Next work must collect definition-compatible paired observations or test a materially different source/estimand.

Experiment 055 completed its test of Skyscanner's 1-4-star city-class averages across twelve independent one-city
Luna contexts. Strict rows require exact class/city, explicit two-adult one-room occupancy, numeric current average,
and known tax treatment. Coverage was 0/48 and no city was complete; tax was unknown or class/currency evidence was
malformed. Reject mapping and fitting; a different estimand needs a new pre-registration.

Experiment 056 completed its test of an untried Agoda 1-star/3-star source route across twelve independent one-city
Luna contexts. Strict rows require exact city/class, two adults and one room, non-from nightly price, and known tax.
Coverage was 0/24 and no city was complete; Agoda required date entry before price and tax evidence appeared. No
source row is mapped or used for a ratio fit.

Experiment 057 completed twelve independent one-city Luna contexts and 24 ordered Booking 3-star/4-star searches.
Strict rows required exact city/class, explicit two-adult one-room occupancy, current numeric average, and known tax.
Coverage was 0/24 (3-star 0/12, 4-star 0/12), with no complete city. Reject the route: class pages often exposed
numeric averages/selectors but not tax treatment, and other rows lacked class or same-evidence occupancy. No mapping
or fitting is allowed.

Experiment 058 completed twelve independent one-city Luna contexts and 36 ordered Trip.com star-2/3/4 searches.
Strict coverage was 0/36 (0/12 per class), with no complete city. Class-page averages lacked same-evidence explicit
two-adult/one-room occupancy and tax status, or were from/localized/stale values. Reject the route; no row is mapped
or fitted.

Experiment 059 completed twelve new independent one-city Luna contexts and 36 ordered Expedia 2-/3-/4-star trend
searches. Strict coverage was 27/36 (2-star 9/12, 3-star 11/12, 4-star 7/12), with six complete cities. All
accepted rows explicitly state two-adult tax-excluded base-rate trends. The 4-star 8/12 gate failed by one row;
retain Expedia as the strongest candidate but do not map or fit.

Experiment 060 completed twelve independent one-city Luna contexts and 12 ordered Expedia 4-star searches. Strict
coverage was 9/12, recovering 3/5 prior misses (below the 4/5 recovery gate); Buenos Aires, Cape Town, and Warsaw
remained not-found. Retain the accepted rows but do not amend the frozen gate or map/fit. The next package is a
new-city paired 2-/3-/4-star Expedia panel toward 30 matched cities.

Next, run a new-city paired Expedia 2-/3-/4-star panel toward 30 complete matched cities, retaining the one-bed dorm
boundary, strict private/hotel identity, exact source/display currency, and explicit tax-excluded basis. Direct
booking-engine URLs and direct Numbeo retrieval remain rejected for the target web path. Do not tune the locked 018
holdout, use the shipping CSV as ground truth, or infer dorm/private separation from the blended hostel channel. The
derivation contract remains out of the shipping path until source feasibility and accuracy gates pass.

Experiment 061 completed twelve new independent one-city Luna contexts and 36 ordered Expedia 2-/3-/4-star
searches. Strict coverage was 26/36 (2-star 8/12, 3-star 8/12, 4-star 10/12), with five complete cities; the
complete-city gate failed. Retain paired evidence but do not map or fit.

Experiment 062 completed twelve independent one-city Luna contexts and 12 ordered Expedia 3-star searches. Strict
coverage was 4/12, with 0/4 recovery among the 061 misses; both gates failed. Retain four strict rows, stop query
retry expansion, and reassess the pooled Expedia source/model boundary. No mapping or fitting is allowed.

Experiment 063 completed twelve entirely new independent one-city Luna contexts and 36 ordered Expedia 2-/3-/4-star
searches. Strict coverage was 15/36 (2-star 2/12, 3-star 7/12, 4-star 6/12), with one complete city; all gates
failed. Retain rows for a pooled source-ceiling audit but do not map or fit.

Experiment 064 completed the deterministic pooled Expedia audit: 80 rows across 36 cities, 16 complete 2-/3-/4-star
cities, 20 matched 2↔3 cities, 22 matched 3↔4 cities, and zero one-star/hostel rows. No relationship reached the
30-city plus 10-holdout gate. Do not fit or map; pivot the missing-class boundary while retaining Expedia as a
candidate source for 2-/3-/4-star values.

Experiment 065 completed twelve fresh one-city Luna contexts with exactly two ordered Expedia searches (1-star then
3-star). Strict coverage was 0/12 one-star, 9/12 three-star, and zero complete pairs; all promotion gates failed.
Generic all-hotel, district, class-ambiguous, and non-numeric one-star results were rejected. Do not map or fit;
pivot to a materially different one-star/hostel source or an explicitly amended estimand.

Experiment 066 completed twelve one-city search+page-read contexts. It found 0/12 explicit two-person rows: eight
numeric pages lacked row-level occupancy and four reads were blocked or timed out. Reject BudgetYourTrip as a direct
one-star source. A source-level double-occupancy proxy calibration is now the next experiment; do not map or fit
until that proxy is independently calibrated.

Experiment 067 completed twelve fresh one-city Luna contexts with exactly two searches and two page reads. The output
was a labelled proxy candidate in Cairo only (1/12); all calls were protocol-compliant, but the 8/12 screening gate
failed because other cities were blocked, stale, class-absent, or lacked a joinable semantic page. Reject this proxy
route at current web-tool reliability; no mapping, tax normalization, or fitting follows.

with no page reads, to determine whether page blocking—not source semantics—is the remaining operational bottleneck.
Experiment 068 completed twelve one-city Luna contexts with exactly two ordered searches and no page reads. Ten
cities produced complete snippet proxy candidates and all calls were protocol-compliant, so the screening gate passed.
Promote only to independent explicit-two-adult calibration/page-backed validation; snippets remain proxy-only and
cannot be mapped or fitted.

Experiment 069 completed twelve one-city Luna contexts with exactly five ordered searches and no page reads. Eleven
cities produced the BudgetYourTrip proxy pair, but no independent explicit-two-adult one-star named-property
candidate was found. Thus matched coverage was 0/12
and the calibration screen failed. Reject this proxy route and retain the rows as labelled evidence only; no property-
basket aggregation, mapping, or fitting is authorized. The next experiment must choose a materially different
one-star/hostel anchor or a newly declared benchmark with independent city-level ground truth.

Experiment 070 completed twelve one-city Luna contexts with exactly three ordered Hostelworld, Booking.com, and
Google Hotels searches and no page reads. Four cities yielded five strict private-hostel property rows, below the
6/12 screen gate. Reject the search-only three-source route; retain the five rows as property-level evidence only. Do
not aggregate or map `accom_hostel_private_room`. The next attempt must use a materially different source or a
pre-registered city-level basket design.

Experiment 071 completed twelve one-city Luna contexts with exactly three ordered searches for an adult attraction,
half-day group activity, and full-day premium activity. All calls were protocol-compliant, but strict coverage was
budget 3/12, mid-range 0/12, high-end 1/12, and zero complete cities. Reject the per-person screen; retain four
one-person/per-person source facts only. Do not apply factor-of-two scaling or map activity tiers until a materially
different source/contract passes independent scaling validation.
