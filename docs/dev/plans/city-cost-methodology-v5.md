# City Cost Methodology v5 — Active Workstream

**Status:** Research and validation in progress. The shipping path remains v1. v4 is prior evidence,
not an assumed implementation.

## Objective

Select and document a method that produces all 19 planner cost values for an ordinary in-scope city from
one user-initiated request to a fast, inexpensive web-enabled model (GPT-5.6 Luna or Claude Haiku-class).
The method may directly collect some inputs and model others, but must label the evidence basis and validate
every material model on definition-matched city data.

## Non-negotiables

- no paid data APIs, source account, source key, paywall, member rate, or access-control bypass;
- one provider request in the production path; search/page retrieval inside it is counted and measured;
- source currency and published facts are retained; deterministic code owns FX, arithmetic, models, and tiers;
- missing, blocked, stale, and class-absent are distinct outcomes;
- a modelled or imputed value is never presented as observed;
- ground truth may use manual/browser research, but that does not prove target-model feasibility; the
  delegated GPT-5.6 Luna-class sub-agent is now the no-key prompt-feasibility path, while provider telemetry
  and the locked holdout remain separate gates;
- the final holdout is city-level and locked before final tuning.

## Work packages

1. Freeze the data dictionary and validation manifest.
2. Audit existing v3/v4 evidence and reproducibly establish the v4 baseline.
3. Implement a provider-neutral one-call test harness that records request and web-tool telemetry.
4. Test direct-source anchors and source fallbacks on the target cheap model.
5. Collect matched ground truth for accommodation and activities, the v4 blockers.
6. Fit and compare simple model families with parameter penalties and locked validation.
7. Run the blind end-to-end test, write the methodology/data card, and freeze the winner.
8. Only after acceptance, add app integration, 121-city migration, and rollback milestones to PLAN.md.

## Decision rule

Promote a candidate only when it passes the pre-registered gates in `PLAN.md` and
`data/reference/v5/validation-manifest-v5.json`. A candidate that has good accuracy but cannot be retrieved
reliably in one cheap-model request is not production-ready. A candidate with broad coverage but unvalidated
imputation is not production-ready.

## Latest evidence

Experiments 009 and 010 rejected broad and indexed date-fixed accommodation collection: strict coverage was
4/60 and 0/30 respectively. Experiment 011 partially promoted only the direct Booking 3-star and 4-star
city-average templates, which returned 10/30 facts on five separately tested cities; lower classes and
Hostelworld `from` prices remain unresolved. Experiment 012 enforced the production shape: three independent
Copenhagen-only calls were identical, but the 4-star city average was +60.4% against the existing dated
direct-property median. Experiment 013 then attempted the known official booking engines in three separate
one-city calls; all 15 URLs were blocked by the delegated web safety boundary. The source is rejected for the
target web path, while the one-city invocation shape is mandatory for all target-model tests. The next work
item is a matched-basis source or model tested through separate one-city calls and a 30-city/10-holdout
validation design. Experiment 014 retained Numbeo for food/drink extraction after one canonical-case Lisbon
call returned all five rows and matched the retained observations; two lowercase city URLs were blocked.
Experiment 015 then tested canonical Copenhagen and Prague URLs and received HTTP 503 and HTTP 429. Direct
Numbeo retrieval is therefore rejected for target reliability; the next experiment must test search-result
extraction or another free source, with blocked/rate-limited outcomes retained separately. Experiment 016
promoted the Numbeo-restricted search-snippet route after two separate one-city calls returned 10/10 facts;
eight matched prior rows had median absolute difference 0.79% and p90 7.66%. Experiment 017 broadened this
to six separate one-city calls: Lisbon, Hanoi, Bangkok, San Francisco, and Nairobi returned 25/25 facts,
while sparse Don Det returned 0/5 wrong-city search results. The route therefore has 25/30 cell coverage
and 5/6 complete-city coverage, with 11 search operations and no direct reads or fallback sources. Ten
retained matched rows had 0% median absolute error, 9.09% p90, and 10% maximum; this remains a small
date-drifting source audit, not a holdout. Promote the route to a 30-city/10-holdout validation while
retaining sparse-city failure, exact citation checks, and missingness; exact provider telemetry remains
unavailable through delegated execution.
Experiment 018 then ran the frozen route on 30 independent one-city calls (20 development, 10 locked
holdout). It returned 144/150 cells (96%) and 28/30 complete cities (93.3%): development was 100/100,
holdout 44/50 (88%), with Helsinki beer missing and Kyoto entirely `not_found`. There were 150 restricted
queries and 60 search operations, no direct reads/fallbacks/arithmetic/cross-city evidence. One hundred
thirty-nine definition/currency-compatible retained rows had 0% median absolute error, 7.14% p90, and
16.88% maximum; holdout rows had 0.54% median, 7.22% p90, and 16.67% maximum. These are source/date audits,
not model validation. The route is promoted for food/drink work but the complete pipeline is rejected because
complete-city success is below 95%, provider telemetry is unavailable, and the other 14 product fields remain
unresolved. Nha Trang's five USD-rendered cells and several symbol-to-ISO mappings require provenance review.
Experiment 019 then repeated five edge cases three times each with the frozen prompt. Kyoto and Don Det were
0/5 in all repeats; Nha Trang and Beijing were 5/5 with identical values in all repeats; Helsinki was
provenance-sensitive (5/5 under broad same-call evidence, then 3/5 and 4/5 when dedicated-query provenance
was enforced). Broad repeat coverage was 42/75; strict normalization gives 41/75. Keep dedicated-query
provenance and fail-closed missingness as the source contract. This confirms bounded food/drink repeatability
for some cities, not complete reliability or 19-field methodology acceptance.
Experiment 020 tested three activity anchors on six independent one-city calls. Strict coverage was 6/18
cells (33.3%): Copenhagen, Bangkok, and Lisbon supplied low-cost attraction tickets; Hanoi supplied a museum
ticket plus four-hour group and eight-hour premium organized tours; San Francisco and Don Det supplied none.
Lisbon's half-day brochure price was normalized to `not_found` because shared/group status was not explicit.
Promote official attraction-ticket pages for broader validation, but keep timed activity anchors fail-closed
unless duration, adult basis, organized/group status, and a non-`from` price are explicit.
Experiment 021 tested a materially different accommodation route: public search snippets for hostel dorm /
private and hotel 1–4-star city averages, without direct URLs or date injection. Six independent calls accepted
7/36 cells (19.4%) and no city was complete: Copenhagen 3-star, Lisbon 2/3/4-star, San Francisco dorm/3/4-star;
Hanoi, Bangkok, and Don Det were 0/6. Retain the heterogeneous class-average sources only for a curated,
definition-matched ground-truth panel; do not fit ratios from these seven feasibility facts.
Experiment 022 tested a bounded identity cascade: one exact canonical query plus at most one city+country
query per measure. Six independent calls returned 21/30 food/drink cells (70%) and four complete cities.
Helsinki recovered beer, Hanoi recovered its noncanonical mid-range result, Kyoto recovered only beer, and Don
Det remained 0/5 after ten searches. The route used 41 queries and 12 search operations with no direct reads,
third queries, retries, fallback sources, arithmetic, FX, or cross-city evidence. Promote it for ordinary
food/drink cities with a fixed cap and fail-closed sparse missingness; it is not complete validation.
Delegated GPT-5.6 Luna tasks are the no-key target-class prompt-test path; exact provider telemetry remains a
separate acceptance gate.
Experiment 023 audited the accepted-direct activity ledger before any fitting. It contains 29 paid-attraction
cities, 3 half-day group-activity cities, 2 full-day premium-activity cities, and only one complete city, so
the 30-city/10-holdout gate is impossible. Reject activity model fitting; retain `activities_free = 0` as
definitional and treat Experiment 020 as retrieval feasibility only.
Experiment 024 then tested a strict six-class accommodation panel across three independent one-city calls.
Only 3/18 cells passed and no city was complete; the route cannot supply the 30-city/10-holdout panel needed
for fitting. Revise by allowing explicit one-bed dorm observations to be scaled deterministically to two
travellers, while retaining strict per-room hotel identity, query provenance, and display-currency review.
Experiment 025 tested that revised bed boundary on paired Barcelona, Prague, and Nairobi calls. Coverage rose
from 3/18 to 6/18: one explicit Barcelona dorm bed plus five hotel class averages. No city was complete and
private hostel, 1-star, and 2-star remained missing. Promote the bed input boundary for a broader panel, but
do not fit until the 30-city/10-holdout gate; retain source display currencies for deterministic FX review.
Experiment 026 broadened the same boundary to Lisbon, Hanoi, and Copenhagen. It accepted 5/18 cells: dorm
inputs in all three cities plus Copenhagen 3/4-star; no city was complete and private hostel, 1-star, and
2-star remained absent. Retain the dorm boundary, but pivot hotel-class occupancy/source testing rather than
calling the accommodation route complete.
Experiment 027 tested HOTEVI's free grouped hotel tiers in three one-city calls. Only Hanoi returned a dated
1–2/3/4–5-star row set; Lisbon lacked a visible month and Copenhagen lacked exact city rows. The accepted rows
have unknown occupancy and cannot map to product star classes. Reject HOTEVI for production; retain only as a
possible calibration benchmark.
Experiment 028 tested Expedia class-trend snippets in three one-city calls. First-batch coverage was 7/12:
Lisbon and Hanoi supplied 2/3/4-star rows, Copenhagen supplied 3-star, and 1-star was absent. Accepted rows
state two-adult trend bases and tax exclusion; one duplicate Copenhagen search batch is a protocol deviation.
Promote 2–4-star Expedia as a candidate for broader validation, but solve 1-star and require the full
30-city/10-holdout gate.
Experiment 029 broadened Expedia to Bangkok, San Francisco, and Nairobi with 8/12 accepted 2–4-star rows;
1-star was absent in all three and Nairobi 2-star was missing. Together 028–029 support a six-city source
candidate, not a complete method. Run a separate 1-star source test before any fitting.

Experiment 030 tested a one-star source cascade in three independent one-city calls. Momondo supplied one
candidate per city and KAYAK supplied none, but all three Momondo rows used unknown or source-default-room
occupancy. Retain the source rows for calibration only; they cannot be mapped to the two-adult `accom_1_star`
estimand. The next experiment is an explicit occupancy-calibration panel with the 30-city/10-holdout gate.

Experiment 031 tested that calibration panel shape with Momondo, Skyscanner, and Expedia in three one-city
calls. It produced two source-default Momondo rows and zero explicit two-adult 1-star rows. Reject the route
without fitting; pivot to a different direct source or an independently curated two-adult property panel.

Experiment 032 tested that property-panel pivot across Barcelona, Prague, and Nairobi. Twelve bounded searches
produced zero qualifying named 1-star property quotes: occupancy, class, and non-`from` price never co-occurred
in the same evidence. Reject the route and retain the failure reasons for source selection.

Experiment 033 tested Trip.com, HotelsCombined, and Budget Your Trip and accepted 8/9 city-level 1-star rows in
three one-city calls. Every row lacked explicit two-adult occupancy and source levels diverged materially. Promote
the aggregator route only for calibration and agreement testing; reject product mapping and fitting for now.

Experiment 034 broadened the aggregator panel to ten cities (seven development, three locked holdouts). It
accepted 12/30 cells, only Tokyo was complete, and holdout coverage was 2/9. Budget Your Trip covered 9/10 but
included zero/one-hotel quality failures; retain it only as a guarded fallback and reject the complete route.

Experiment 035 tested BudgetYourTrip activity pages in three one-city calls and accepted all 12 activity rows.
Every source value is explicitly one person/day. Promote the contract to a broader panel, but validate two-person
scaling, tier semantics, and independent accuracy before product mapping.

Experiment 036 broadened the activity contract to ten cities with locked holdouts and accepted 40/40 rows. All
values were one-person/day; promote the source contract but retain deterministic scaling, tier semantics, and
independent accuracy gates.

Experiment 037 rejected BudgetYourTrip as a definition-matched activity source (0/9). Ticket party basis,
half-day group identity, and full-day premium group size/duration failed. Keep generic entertainment rows unmapped
unless a product-definition decision is made and independently validated.

Experiment 038 expanded the guarded BudgetYourTrip one-star fallback to 20 new one-city calls: 17/20 strict
rows, zero explicit two-adult occupancy, two tiny samples, one zero-denominator rejection, and one blocked search.
Retain only as quality-guarded imputation/fallback; no product mapping or correction fit is accepted.

Experiment 039 tested the hostel dorm/private boundary in six independent one-city calls. Dorm-bed input
coverage was 6/6, while private-room coverage was 0/6 because no source explicitly established two-adult or
two-guest occupancy. Retain the one-bed dorm input boundary for deterministic scaling; reject private-room
mapping and correction fitting. The next package must test explicitly two-guest private-room wording or a
definition-matched model against independent observations.

Experiment 040 met the explicit two-guest source-feasibility threshold at 3/6 cities. London, Lisbon, and Hanoi
returned dated named-hostel Booking quotes for two adults/max two; Melbourne, New York City, and Tokyo failed
closed. Treat these as property-panel ground-truth candidates only, preserving dates, taxes/fees, and currency;
they are not city-wide anchors or a fitted private-room correction.

Experiment 041 rejected the paired one-star calibration route: five of six BudgetYourTrip city statistics were
retrieved, but zero of six cities had an explicit two-adult one-star property quote. Keep source-default rows
guarded and preserve Tokyo testing-subdomain/Rome page-family provenance warnings; do not fit occupancy or map
these rows to the product. The next one-star step must use independent definition-matched ground truth or a
pre-registered imputation model.

## Restart rule

At the end of every work cycle, record the verdict, update the experiment index, commit sizeable work, and
start the next highest-value unresolved package. Remain active until the Definition of Done is met or a
credential, permission, or explicit product decision is genuinely required.
