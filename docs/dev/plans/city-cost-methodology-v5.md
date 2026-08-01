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

Experiment 042 joined frozen official-register one-star classes to exact-property searches in Barcelona, Lisbon,
and Da Nang. Only one of nine property attempts passed strict tax/occupancy/identity checks; the Lisbon quote
has a register-versus-search address discrepancy. Reject the route as a productive panel and retain the row only
as guarded identity-review evidence.

Experiment 043 tested Google Hotels one-star snippets across six one-city calls. Only Cape Town passed the strict
property contract (1/6); reject the route as a productive panel and retain that row only as an independent
ground-truth candidate.

Experiment 045 tested Trip.com activity pages in six independent one-city calls. Exactly 18 searches were
compliant, but strict coverage was 0/18: budget 0/6, mid-range 0/6, and high-end 0/6. “From” prices, unknown
taxes, incompatible durations, and missing adult/party or premium basis caused the failures. Reject Trip.com for
the frozen activity source route; retain raw failures only and do not map or fit any activity tier.

Experiment 044 tested GetYourGuide/Viator operator sources in six independent one-city calls. Exactly 18 searches
were compliant, but strict coverage was also 0/18 (0/6 for each activity measure). “From”/variable group prices,
tour-versus-ticket mismatches, unknown taxes, and incomplete duration or premium evidence caused the failures.
Reject the operator route under the frozen contract; no activity value is promotable.

Experiment 046 tested official attraction/authority/museum/named-operator pages in six independent one-city
calls. Strict compatibility was 0/18: budget 0/6, mid-range 0/6, and high-end 0/6. Bangkok and Cape Town had
otherwise-compatible budget tickets but unknown tax treatment; no timed activity row passed. Reject the route as a
complete activity source and retain only rejected evidence.

Experiment 047 tested explicit two-adult accommodation property quotes in Berlin, Rome, Madrid, Paris, Tokyo, and
Mexico City. Private-hostel quotes passed in 3/6 cities (Berlin, Mexico City, Tokyo), meeting the source-feasibility
promotion threshold for a broader property/ground-truth panel. One-star quotes passed in 1/6, so the one-star blocker
remains. The private rows are property observations only; define selection and aggregation before any city mapping.

Experiment 048 broadened the private-hostel panel to 12 new cities. Only 4/12 strict quotes passed, below the
6/12 promotion gate. Retain the four property-level ground-truth candidates, but do not promote to aggregation or
map the route; members-only, tax, one-night, and class failures remain unresolved.

Experiment 049 broadened the one-star property panel to 12 cities and three public source families. Only 1/12
strict quotes passed (Amsterdam), far below the 6/12 gate. Reject the direct one-star route; no class substitution
or correction fit is allowed.

Experiment 050 isolated tax-resolved official attraction tickets across six cities. Only 2/6 strict tickets passed
(Bangkok via Expedia and Lisbon first-party), below the 4/6 gate. Retain these as direct source candidates but do
not map `activities_budget`; timed activity and complete activity coverage remain unresolved.

Experiment 051 retested the nine-anchor shape in six one-city calls with a fixed four-search budget. No city was
complete; non-sparse coverage was 5/9–8/9 and Don Det was 0/9. Food/drink and attraction inputs are promising,
but three-star hotel coverage was 0/6 and accommodation/sparse gaps remain. Do not promote the complete contract.

### Experiment 052 - broad three-star property panel

Twelve independent one-city Luna contexts issued exactly three ordered searches each (Google Hotels, Expedia,
Booking.com; 36 searches). Strict explicit-three-star, two-adult, one-room, non-from, nightly, tax-resolved
coverage was **0/12**, below the 6/12 promotion gate. Most candidates had class, price, and tax but no explicit
one-room occupancy; the remainder failed on from pricing, generic averages, wrong/nearby class, or missing class.

**Decision:** reject this source route for `accom_3_star`. The one-room requirement remains part of the frozen
estimand. Treating a two-adult selector as proof of one room would be a separately pre-registered estimand change,
not a silent parser relaxation, and would need independent property-level accuracy validation. The next experiment
should test that semantic question or move the boundary to a modelled tier while preserving evidence-basis labels.
Read `data/reference/v5/experiments/052-three-star-broad-panel/`.

### Experiment 053 - selector-based occupancy semantic audit

The next run tests a declared semantic amendment rather than silently relaxing the strict contract. Twelve
independent one-city Luna calls use the same three-source search budget and record both strict explicit-one-room
status and a selector-relaxed hypothesis: exact named 3-star property, two-adult/one-night selector, numeric
non-from nightly price, and known tax, but no explicit room wording. No mapping or aggregation is permitted.

Promotion requires 8/12 relaxed candidates and at least 6 strict failures attributable solely to omitted room
wording. A pass only authorizes a new 30-city/10-holdout explicit-room validation panel; it does not change the
frozen data dictionary.

The panel completed with 0/12 strict rows and 7/12 selector-relaxed rows. The strict-failure condition passed, but
the 8/12 relaxed-coverage gate failed. **Decision:** reject promotion; retain the seven rows as semantic hypotheses
only and do not map or fit `accom_3_star`.

### Experiment 054 - model-fit adequacy audit

The accepted direct ledger was scanned without fitting. Of six pre-registered relationships, accommodation class
relations had zero matched cities, hostel private/dorm had zero, and each activity-tier relation had one matched
city. All failed the 30-city/10-holdout gate. **Decision:** reject model fitting for this evidence boundary and
collect definition-compatible paired observations before tuning any coefficient.
Read `data/reference/v5/experiments/054-model-fit-adequacy/`.

### Experiment 055 - Skyscanner hotel-class average panel

Twelve one-city Luna calls are testing all four Skyscanner class pages with exact city/class, explicit 2 adults and
1 room, numeric current class-average, and known tax requirements. Promotion requires 1-star and 2-star coverage in
at least 6/12 cities, 3-star and 4-star coverage in at least 8/12, and six complete cities. This remains source
feasibility only; no product mapping or ratio fit follows automatically.

The panel completed with 0/48 strict rows and no complete city. The route is rejected because tax treatment was
unknown or class/currency evidence was malformed, even where 3-/4-star selectors and prices appeared.

### Experiment 056 - Agoda one-/three-star class panel

Twelve one-city Luna calls are testing Agoda 1-star and 3-star class prices with exact city/class, explicit
two-adult/one-room one-night basis, numeric non-from nightly price, and known tax. Promotion requires 6/12 strict
rows per class and four complete cities; a pass only authorizes a separate validation or paired-model experiment.

The panel completed with 0/24 strict rows and no complete city. Agoda required date entry before exposing a numeric
nightly price and did not provide the complete occupancy/tax evidence in search results. Reject promotion.

### Experiment 057 - Booking class-average tax panel

Twelve one-city Luna calls issued exactly two ordered Booking searches each (3-star then 4-star; 24 total). Strict
rows required exact city/class, explicit 2 adults and 1 room, a numeric current class average, and known tax.
Coverage was 0/24 (3-star 0/12, 4-star 0/12), with no complete city. Class pages sometimes exposed a selector and
numeric average but omitted tax/fee treatment; other rows lacked class or same-evidence occupancy.

**Decision:** reject the route. Do not map or fit from these rows. A different tax or price-statistic estimand needs
new pre-registration and independent validation. Read `data/reference/v5/experiments/057-booking-class-tax-panel/`.

### Experiment 058 - Trip.com hotel-class tax panel

Twelve one-city Luna calls issued exactly three ordered Trip.com searches each (star-2, star-3, star-4; 36 total).
Strict coverage was 0/36 (0/12 per class), with no complete city. Class-page averages lacked same-evidence explicit
two-adult/one-room occupancy and tax status, or were from/localized/stale values.

**Decision:** reject the route. Do not map or fit from Trip.com class pages; a different tax or price-statistic
estimand needs new pre-registration and independent validation. Read `data/reference/v5/experiments/058-trip-class-tax-panel/`.

### Experiment 059 - Expedia two-adult class-trend panel

Twelve new one-city Luna calls expanded Expedia's 2-/3-/4-star class-trend route. Strict coverage was 27/36:
2-star 9/12, 3-star 11/12, and 4-star 7/12, with six complete cities. The 4-star 8/12 gate failed by one row;
all accepted rows explicitly state two-adult, tax-excluded base-rate trends.

**Decision:** near-pass, retain as the strongest source candidate, and run a targeted 4-star gap panel. Do not map
or fit until source/basis and locked holdout gates pass.

### Experiment 060 - Expedia four-star gap panel

Twelve one-city Luna calls issued exactly one Expedia-restricted 4-star query each. Strict coverage was 9/12 overall,
recovering 3/5 prior Experiment 059 misses (below the 4/5 recovery gate); Buenos Aires, Cape Town, and Warsaw
remained not-found. All accepted rows explicitly state two-adult, tax-excluded trends.

**Decision:** reject the recovery gate. Retain Expedia as a strong source candidate but do not amend 059 or map/fit.
Continue a new-city paired 2-/3-/4-star panel toward 30 matched cities.

### Experiment 061 - Expedia paired 2-/3-/4-star panel

Twelve new one-city Luna calls issued exactly three Expedia searches each. Strict coverage was 26/36 (2-star 8/12,
3-star 8/12, 4-star 10/12), with five complete cities; the six-complete-city gate failed. Retain paired evidence,
but do not map or fit. Continue toward pooled 30-city/10-holdout validation.

### Experiment 062 - Expedia three-star gap panel

Twelve one-city Luna calls issued exactly one Expedia 3-star query each. Strict coverage was 4/12, with 0/4 recovery
among the Experiment 061 misses; both gates failed. Retain four strict rows, but stop query-retry expansion and
reassess the pooled Expedia source/model boundary. Do not map or fit.

### Experiment 063 - Expedia paired 2-/3-/4-star panel, tranche 2

Twelve entirely new one-city Luna calls issued exactly three Expedia searches each. Strict coverage was 15/36
(2-star 2/12, 3-star 7/12, 4-star 6/12), with one complete city; all gates failed. Retain rows for a pooled
source-ceiling audit; no mapping or fitting follows.

### Experiment 064 - Expedia pooled ceiling audit

A deterministic script pooled Experiments 028/029/059/060/061/063 without fitting. It found 80 rows across 36
cities, 16 complete 2-/3-/4-star cities, 20 matched 2↔3 cities, and 22 matched 3↔4 cities; one-star/hostel had
zero eligible rows. No relationship reached 30 matched cities plus ten holdouts.

**Decision:** reject fitting from the current pool and pivot the missing-class data boundary. Do not use shipping
asserted values as ground truth.

### Experiment 065 - Expedia one-star/three-star paired panel

The next source-boundary test is twelve fresh one-city Luna contexts with exactly two ordered Expedia searches per
city: explicit 1-star, then 3-star. Strict acceptance requires exact city/class, a numeric non-from nightly
city-class average or trend for two adults in one room, named currency and reference window, and explicit tax
treatment. Promotion requires 8/12 strict rows for each class and six complete paired cities. A pass authorizes
only a larger source-and-basis validation panel; it never authorizes mapping or fitting. Source-default occupancy,
generic budget labels, and unknown tax remain ineligible under the frozen dictionary.

Results: the twelve-city panel produced 0/12 strict one-star rows, 9/12 strict three-star rows, and zero complete
pairs. Generic all-hotel, district, class-ambiguous, and non-numeric results were rejected. **Verdict:** reject the
Expedia one-star route and pivot to a materially different one-star/hostel source or explicitly amended estimand;
retain the nine three-star rows as source evidence only.

### Experiment 066 - BudgetYourTrip one-star semantic-basis audit

This source-semantics test uses twelve fresh one-city Luna contexts, exactly one BudgetYourTrip search and one
exact-city page read per city. A row is strict only when the same page explicitly provides the one-star numeric city
statistic, per-room/night unit, two-person occupancy, named currency, reference period, and tax/fee status. The
promotion gate is 8/12 strict rows (with six accepted cities). Source-default or unknown occupancy cannot pass and
cannot be used as ground truth for a one-star model.

Results: the twelve-city panel produced 0/12 explicit two-person rows. Eight exact-city pages exposed numeric
one-star averages but no row-level occupancy, and four page reads were blocked or timed out. **Verdict:** reject
BudgetYourTrip as a direct one-star source. Retain numeric observations as unvalidated proxy candidates while
testing whether the same source explicitly defines its hotel statistics as double occupancy; they remain ineligible
as model ground truth until independent calibration passes.

### Experiment 067 - BudgetYourTrip source-level double-occupancy proxy

This controlled relaxation tests twelve fresh one-city Luna contexts with exactly two searches and two page reads:
the exact-city one-star page and the same-source destination page that explicitly defines typical double-occupancy
hotel prices. A candidate requires both pages, exact city/class, numeric one-night statistic, named currency, tax
basis, and source-level two-person wording. The screening gate is 8/12 proxy candidates with at least 10/12
protocol-compliant calls. A pass authorizes only independent calibration against explicit-two-adult observations;
it never authorizes mapping, fitting, or presenting a proxy as observed.

Results: all twelve calls were protocol-compliant, but only Cairo produced a complete source-defined proxy candidate
(1/12), far below the 8/12 screening gate. The other cities had blocked/timed-out reads, absent or stale classes, or
could not join both source pages. **Verdict:** reject this proxy route at the observed web-tool reliability; retain
Cairo as labelled proxy evidence only and do not map or fit.

### Experiment 068 - BudgetYourTrip search-snippet occupancy proxy

This lower-evidence operational test uses twelve fresh one-city Luna contexts with exactly two ordered BudgetYourTrip
searches and no page reads. A candidate requires exact-city one-star numeric/tax evidence plus a same-source search
snippet explicitly stating two-person or typical double occupancy. The screening gate is 8/12 proxy candidates and
10/12 protocol-compliant calls. A pass authorizes only page-backed or independent explicit-two-adult calibration;
snippets remain proxy-only and cannot be mapped or fitted.

Results: all twelve calls were protocol-compliant and ten produced complete snippet proxy candidates (10/12), passing
the screening gate. Paris lacked explicit two-person wording and Mumbai lacked an exact-city one-star value. **Verdict:**
promote only to an independent explicit-two-adult calibration/page-backed validation stage; do not map, fit, or treat
snippets as observed.

### Experiment 069 - BudgetYourTrip one-star proxy explicit calibration screen

This follow-up kept the production-shaped single-city context and paired the 068 proxy searches with three
independent search-only checks: Google Hotels, Expedia, and Hotels.com. A direct candidate required an exact-city
named property, explicit one-star class, standard non-`from` nightly price, two adults/one room, and tax basis. The
pre-registered screen required 6/12 matched proxy-plus-direct cities and 10/12 protocol-compliant calls. Direct
named-property rows were retained as calibration candidates, not city-level ground truth; no aggregation or ratio was
allowed.

Results: all twelve calls were protocol-compliant and eleven produced a BudgetYourTrip proxy. Only one direct
explicit-two-adult one-star candidate was found (Mumbai), where the proxy was missing, so matched coverage was 0/12.
The gate failed. **Verdict:** reject this proxy calibration route. Preserve the labelled proxy rows and the unpaired
direct candidate, but do not compute a correction, design a property basket retrospectively, map a product tier, or fit.
Any future calibration must be pre-registered with definition-compatible city-level aggregation and at least 30
matched cities including 10 locked holdout cities.

### Experiment 071 - activity per-person adult scaling panel

This screen tested a deliberate boundary amendment already compatible with the frozen basket units: collect an explicit
adult/per-person source price and defer the fixed factor of two to deterministic code. The three searches per city
targeted a standard attraction ticket, a 3-6 hour group activity, and a 6+ hour premium activity. The LLM did no
arithmetic or scaling.

Results: all 12 calls were protocol-compliant, but strict coverage was budget 3/12, mid-range 0/12, and high-end 1/12,
with no complete city. Unknown taxes, from/discount rates, missing duration, and group/party ambiguity dominated.
**Verdict:** reject this per-person source screen at current reliability. Four source facts remain evidence only; no
factor-of-two scaling, product mapping, or accuracy claim is authorized. A future activity method must use a materially
different source or contract and independently validate scaling against two-adult benchmarks.

### Experiment 070 - explicit two-guest private-hostel three-source panel

This follow-up broadened Experiment 040 from two to three signed-out search sources (Hostelworld, Booking.com, and
Google Hotels) while preserving the strict product boundary: named hostel/private room, two adults or guests, standard
non-`from` nightly price, and known taxes. Twelve single-city Luna contexts issued exactly three searches each; the
analyzer retained all candidates but did no basket aggregation.

Results: 12/12 calls were protocol-compliant, but only 4/12 cities produced a candidate (five rows total: Lisbon,
Hanoi, Nairobi, and Cape Town). The 6/12 screening gate failed. **Verdict:** reject this search-only three-source
route at current reliability. The five rows remain property-level evidence only; no city estimate, scaling, mapping,
or fitting is authorized. A future private-hostel method needs a materially different source or aggregation design and
the unchanged 30-city/10-locked-holdout validation gate.

### Experiment 072 - Price of Travel Hostel Index dorm anchor

This source screen used one restricted search and one exact-page read per city. The source documents a one-person
shared-dorm bed per-night price, included taxes and fees, and an average of Thursday and Friday nights in mid-April
2023. All 12 one-city Luna contexts returned strict rows and were protocol-compliant.

**Verdict:** promote only to deterministic two-bed scaling and independent accuracy validation. The reference window
is stale and the statistic is a selected named-hostel observation rather than a current city median. Do not map
`accom_shared_hostel_dorm` until a 30-city/10-locked-holdout benchmark establishes error, drift, and refresh policy.

## Restart rule

At the end of every work cycle, record the verdict, update the experiment index, commit sizeable work, and
start the next highest-value unresolved package. Remain active until the Definition of Done is met or a
credential, permission, or explicit product decision is genuinely required.
