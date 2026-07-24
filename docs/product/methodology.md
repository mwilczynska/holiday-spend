# Holiday Spend Tracker — City Cost Database Methodology

**Version 2.1 baseline + Version 3 redesign | Reference dataset: April 2026 | Review: July 2026**

All tier values are for **TWO people**, per night (accommodation) or per day (food/drinks/activities).  
Currency: AUD in app-facing data (USD→AUD reference rate: 1.55). The canonical CSV stores AUD values;
USD anchors and generation context are retained in research or estimate metadata where available.

---

## Review Summary

This is a transparent planning model, not a quote, forecast, or statistical confidence interval. It
constructs a representative city-level basket from named price anchors, applies deterministic formulas,
converts the result to AUD, and scales the two-person base values at runtime.

The model is intended to let a reviewer answer four questions for every output:

1. What source observation or fallback produced the input?
2. What formula transformed the input into the tier?
3. What assumptions or uncertainty remain?
4. Can the result be recomputed from the recorded context?

The current canonical CSV stores app-facing AUD values but not complete observation-level lineage, so
it is not sufficient by itself to reproduce or re-audit every reference row. USD anchors and generation
context are retained in estimate metadata only where available. Closing that provenance gap is a core
requirement of the version 3 redesign below.

### Data Flow

~~~text
researched source prices (USD)
        -> named anchors + source/date/confidence notes
        -> deterministic tier formulas for two travellers
        -> AUD conversion and monetary rounding
        -> stored base-2 city row
        -> runtime group-size scaling
        -> itinerary allocation by city, date, and tier
~~~

The distinction between observed inputs and derived outputs is intentional. A source price is an input;
a tier such as mid-range food is a model output. The model does not imply that every derived tier was
directly observed in a source.

## What The Current Accuracy Evidence Shows

Accuracy requires an external benchmark. Internal ratios can show whether formulas behave consistently,
but a perfectly stable formula can still be wrong in every city. The first external audit therefore
compared stored anchor values with independently retrieved July 2026 reference prices.

| Metric | Result |
|---|---:|
| Cities | 3 of 121 |
| Anchor comparisons | 9 |
| Mean absolute percentage error (MAPE) | 17.47% |
| Median absolute percentage error | 14.29% |
| Mean signed percentage error (bias) | -16.30% |
| Weighted absolute percentage error | 21.00% |
| Root mean squared percentage error | 22.96% |
| Comparisons within 10% / 15% / 25% | 3/9, 5/9, 7/9 |

Eight of nine stored prices were below the reference value. That is evidence of systematic
under-estimation, not symmetric random noise. The error is also heterogeneous: Lisbon's four anchors
have 29.50% MAPE and -29.50% bias, compared with 6.56% MAPE in Prague and 9.77% in Hanoi. A single global
uplift would therefore correct the mean while leaving important regional or city-level error.

These results are deliberately described as a **baseline spot check**, not a validated accuracy claim.
Only three city clusters and four food/drink anchor types are represented. Accommodation, activities,
seasonality, group scaling, and final itinerary totals are untested. The reference prices are also
measurements with their own uncertainty; a marketplace quote or crowd-sourced median is not an error-free
ground truth. The audit demonstrates that the current inputs need replacement, but it cannot estimate
population-wide error or support narrow confidence intervals.

## Version 3: Observed-First Redesign

The revised methodology reverses the current priority. Direct, dated observations become the default;
statistical estimation is reserved for missing cells; an LLM may locate and extract evidence but cannot
invent an uncited price or perform the calculation of record.

~~~text
dated source observations
        -> definition and unit validation
        -> local-currency normalization
        -> robust city/category aggregation
        -> deterministic basket construction
        -> validated imputation only where observations are missing
        -> prediction interval and evidence-quality fields
        -> frozen holdout validation
        -> versioned AUD publication snapshot
~~~

### Implementation Checkpoint

The observation schema, JSONL validator, and batch manifest are now implemented. Batch zero plus the
first eleven pilot-wave checkpoints contain 171 direct observations across 35 represented cities, and
bounded first-pass source research now covers all 36 deterministic pilot candidates. The store contains
132 standardized Numbeo food/drink prices, two independent restaurant-menu meals, 29 official
paid-attraction prices, three operator-listed duration-specific activities, and five exact-date official-property accommodation
quotes. Every row retains its original EUR, CZK, DKK, THB, VND, USD, TZS, CNY, NZD, KES, JPY, COP, TRY,
INR, AED, CAD, KRW, HUF, or MXN value, source URL,
retrieval time, page-valid date where known, displayed range, source-access basis, and extraction version.
The validator reports 171 valid direct rows
and no schema errors.

A provider-neutral local research runner now renders one versioned city/category assignment and validates
the saved response from a free web-enabled LLM call. It does not call a paid API. The parser rejects
wrong-city or out-of-category output, duplicate ids, uncatalogued missingness, and any observation the
research call tries to mark accepted. This makes the LLM an evidence collector while preserving a separate
review decision before a row can influence the model.

Pu Luong is an intentional sparse-market stress test. No defensible Numbeo city page was found, so the
pipeline retained the directly observed local menu and activity listings while leaving all other fields
missing. It did not inherit Hanoi prices or a Vietnam-wide average. Collection reports are now
schema-validated and reconciled against manifest call counts, accepted/rejected row counts, city lists,
and per-measure JSONL coverage.

Paid data APIs are excluded. Free web-enabled LLM research has no project-imposed daily call cap; it
continues while the selected provider offers free capacity and checkpoints after each completed
city/category. Provider-enforced free-tier limits affect throughput, not the evidence standard. This
checkpoint demonstrates that the collection contract works; it is not an updated accuracy result and
does not replace the frozen holdout evaluation.

The v3-alpha deterministic calculator is also implemented as a reproducible research artifact. It
validates the category, unit, and traveller count implied by every measure; converts source currencies
into the canonical city-local currency; aggregates comparable accepted observations with medians and
interquartile ranges; and only then converts the aggregated result to AUD using a frozen FX snapshot.
Direct observations take precedence over derived values, which take precedence over imputed values, so
an imputation cannot dilute available direct evidence.

Calculator `city-cost-v3-alpha-3` also treats source types as measurement channels rather than silently
pooling them. Food and drink use the retained city-level published dataset channel as the primary point
estimate, with menu samples retained as triangulation evidence. Activities prefer the attraction or
operator's official site. Accommodation uses direct property sites selected from a deterministic panel
drawn from official accommodation registers or classification directories. Booking.com and Hostelworld are excluded as extraction
sources after review of their current restrictions on automated/assistant use.
Every available channel keeps its own observation count, source names, median, interquartile range, and
lineage. A secondary-channel median more than 25% from the selected primary median receives a provisional
disagreement flag for review; this threshold is an operational diagnostic to validate during the pilot,
not an accuracy result.

The current frozen snapshot uses the European Central Bank's 22 July 2026 euro reference rates for EUR,
USD, CAD, KRW, HUF, MXN, CZK, DKK, THB, CNY, NZD, JPY, TRY, and INR; official central-bank references for VND, TZS, KES,
COP, AED, and CUP; and explicit cross-rate or inversion formulas where no direct AUD quote exists. CUP
uses the natural-person segment because Havana's retained Numbeo prices are tourist-facing USD values.
Each stored rate retains its source date, quote, URL, and derivation formula. The materializer verifies
the snapshot and recomputes cross-rate arithmetic in automated tests.

The current materialized artifact contains 35 cities and 171 accepted direct observations. It can
calculate 166 of 665 possible city-tier cells: coffee and the coffee-only/light drinks baskets for 33
cities, free activities for all 35, budget paid-attraction baskets for 29, two mid-range half-day activity
baskets, and one high-end full-day activity basket. It reports zero complete cities and emits no publishable wide row because
the Copenhagen shoulder panel has reached five quotes but its low/high seasons and repeated-property
overlap gate are still missing, while street/premium food, cocktail/wine, and many activity observations
are also missing.
This fail-closed behaviour is intentional: partial evidence remains visible without being misrepresented
as a complete replacement dataset.

No city/measure currently has observations from more than one source channel, so the artifact reports
zero cross-channel comparisons and zero disagreement flags. That is missing triangulation evidence, not
evidence that sources agree; the independent menu-sampling stage remains open.

The v3-alpha formula set is provisional until the pilot and whole-city validation are complete. Literal
two-person baskets are calculated deterministically from retained primitives; for example,
`drinks_light = 2 * cappuccino + 2 * domestic beer`, while `activities_budget = 2 * paid adult
attraction`. Missing parent measures produce a named missing-data result, not an invented fallback. The
current artifact lives at `data/reference/materialized/city_costs_v3_alpha.json` and is reproduced with
`npm run methodology:materialize:v3`; `npm run methodology:materialize:v3:check` detects drift.

### Reproducible Estimands

Every estimate must specify what is being estimated. Accommodation uses fixed reference weeks, an exact
90-day booking lead, seven nights, two adults in one room, a 5 km central search radius, room type/star
class, public non-member rates, cancellation basis, and all mandatory taxes. Food and drink retain
explicit item and serving definitions. Activities use a
fixed taxonomy of free attractions, paid attractions, half-day group experiences, and premium/full-day
experiences instead of an inexpensive-meal proxy.

Within an eligible room category, collection takes the lowest public standard rate and records whether it
is flexible or non-refundable. Optional breakfast and add-ons are excluded. If the property's lowest public
rate bundles breakfast with no room-only equivalent, the full payable rate is retained and flagged as
bundled rather than subtracting an invented meal value. This keeps the price observable while making the
remaining comparability limitation measurable.

For accommodation, a deterministic panel targets 12 registered properties per measure and season, with
a hard minimum of five accepted quotes per season and at least 60% property overlap across seasons. The
same properties are followed through low, shoulder, and high reference weeks where possible, reducing
property-mix confounding. Each seasonal search produces a median nightly total, interquartile range, and
property count; the annualized point estimate is the equally weighted median of the three seasonal
medians. A partial panel remains visible in the research artifact but cannot materialize an accommodation
tier. Before a property can be quoted, its direct website is verified against source-attributed ownership
or identity evidence and applied through a reproducible verification artifact. A verified website is only
an eligible collection path: it is not a room-price observation, availability result, or accepted quote.
Unresolved ownership remains explicit and the collector continues down the frozen rank order rather than
substituting a directory page or a similarly named property. For food and drink, city-level source medians will be
triangulated with independent menu observations in the validation sample. For activities, current
official attraction and tour-operator prices will replace global multipliers.

The first four frames now provide concrete reproducibility tests. Barcelona's July 2026 frame joins the
Catalonia Tourism Register to Barcelona City Council coordinates using the official `HB` registration id.
It starts with 344 active standard one- through four-star hotels; 327 join to official coordinates and
322 fall within 5 km of the frozen, price-independent centre (`41.38749043, 2.16952564`). A SHA-256 rank
that excludes price, brand, capacity, and website visibility selects 12 primary properties in each star
class and retains every other eligible property as a reserve. The artifact therefore contains 48 primary
and 274 reserve properties, plus 17 coordinate misses and five radius exclusions kept for audit.

This is not yet an accommodation estimate. No official property website has been verified and no price
has been accepted from the frame. Barcelona's hostel tiers also remain missing because the register's
`Hostal o pensió` lodging class is not evidence of youth-hostel dorm or private-room inventory. A separate
official hostel frame is required rather than forcing a misleading category mapping.

Copenhagen uses a different but equally explicit source path. A current, public, no-key Hotelstars Union
search snapshot contains 309 Denmark records. The pipeline excludes 100 separately listed conference
products, then retains 201 hotel records in the planner's one- through four-star scope. All have directory
coordinates. A component-wise median of the 29 eligible records labelled `København*` fixes the centre at
`55.67250000, 12.56450000`; applying the 5 km radius to all eligible Denmark records produces 29 hotels:
three two-star, 11 three-star, and 15 four-star. The official snapshot contains no eligible one-star
hotel. The four-star SHA-256 panel has 12 primary and three reserve properties; every two- and three-star
property is retained because those classes contain fewer than 12.

This frame exposes two useful forms of missingness. Three two-star properties are fewer than the frozen
five-quote minimum, so that direct measure cannot materialize even if all three sites quote successfully.
One-star remains unavailable rather than being imputed from two-star. VisitCopenhagen's current official
hostel directory contributes 13 named candidates and direct property links, but those candidates remain
unranked until their sites prove a location within 5 km and the applicable dorm and/or private-room
inventory. The panel schema therefore stores properties separately from per-measure rankings: after
verification, one real hostel can enter both hostel measures without being counted as two properties.

Neither Copenhagen source states an open-data licence. The research artifact therefore stores only the
factual fields required for the private sampling frame, attributes the publishers, and freezes exact
retrieval timestamps, byte counts, request body, and source checksums. Source-listed websites are not
treated as verified booking evidence.

Prague adds a data-cleaning problem that is important to make visible in a portfolio methodology. The
current Czech Hotelstars response contains 229 hotel rows, but many are repeat records for the same
physical establishment. After excluding 5-star inventory, 225 eligible rows collapse to 148 physical
properties using normalized name, street, street number, and postcode; 76 identity groups contain
duplicates. Duplicate rows must agree on class and city. Coordinates are combined only when every pair
is within 0.25 km, leaving four conflicting groups explicitly ungeolocated rather than choosing the most
convenient value.

The median of 18 deduplicated `Praha*` hotel locations fixes Prague's centre at
`50.07870000, 14.43375000`. Prague City Tourism's official hostel directory and its 12 destination-detail
pages then supply inventory descriptions, addresses, coordinates, and direct website links. Ten
in-radius properties explicitly support the dorm measure and ten support the private-room measure. One
hostel remains geolocated but inventory-pending because its official page states neither room type. The
hotel frame contains five eligible 3-star and nine eligible 4-star properties within 5 km, but no 1-star
or 2-star property; missing classes remain missing.

Lisbon uses two daily official Turismo de Portugal open-data registers captured on 24 July 2026. The
RNET snapshot contains 5,649 national records and 372 Lisbon records. Restricting the frame to properties
whose municipality is Lisboa, type is `Hotel`, and national category is exactly one through four stars
retains 254 hotels, all with official coordinates. Their component-wise median fixes the price-independent
centre at `38.72280334, -9.14327108`; 242 hotels fall within 5 km: 13 one-star, 29 two-star, 90 three-star,
and 110 four-star. Each class therefore has a frozen 12-property primary panel and ordered reserves.

The Lisbon-only RNAL extract contains 11,865 local-accommodation registrations, including 113 with the
explicit `EstabelecimentoHospedagemHostel` modality. Normalized name, postcode, and rounded official
coordinates collapse those to 106 physical hostel candidates; four identity groups contain multiple
floor or unit registrations. Ninety-seven physical candidates fall within 5 km. RNAL does not supply an
official property website or prove current dorm/private inventory, so these candidates remain unranked
and ineligible for either hostel measure until direct-site matching verifies the applicable room types.
The register class and capacity are not treated as substitutes for inventory evidence.

The original Lisbon shoulder week of 22-29 October did not pass the capture-day event screen. Lisbon's
official calendar lists the citywide doclisboa festival through 25 October, Drawing Room Lisboa from
22-25 October, and a major arena concert on 22 October. Following the frozen replacement rule, the stay
moves forward exactly seven days to 29 October-5 November and its exact-90-day capture moves to 31 July.
The rejected window and source URLs stay in the schedule's replacement history, and no price from the
rejected dates enters the evidence store.

Bangkok's original low-season week of 22-29 October also failed its capture-day screen because the official
2026 Bank of Thailand calendar places King Chulalongkorn Memorial Day on Friday 23 October, creating a
three-day public-holiday weekend within the stay. The stay and capture therefore move exactly seven days
forward to 29 October-5 November and 31 July. The replacement is not pre-cleared: it requires a fresh
official event and holiday review on its new capture date.

The event review is fail-closed. A missing calendar listing is not proof of ordinary demand: a review is
either cleared with evidence, replaced under the frozen seven-day rule, or retained as `inconclusive` when
official sources cannot support either decision. Hanoi, Pu Luong, San Francisco, and Da Nang all produced
source-attributed inconclusive outcomes on 24 July because the available calendars were incomplete for a
required part of their registered screen. Pending and inconclusive windows cannot contribute a quote.

Da Nang's property frame begins with a frozen official-register universe rather than a commercial list.
The Viet Nam National Authority of Tourism directory was filtered to government-managed hotel records in
Da Nang and captured separately for one through four stars. The validated checkpoint contains 423 unique
hotels (180 one-star, 103 two-star, 86 three-star, and 54 four-star), with an address for every record and
page-level hashes.

A cached, policy-limited OpenStreetMap Nominatim pass then evaluates the central-city cohort. Coordinates
are accepted only when the result is a name-matched lodging property or matches the exact house number and
road; road and neighbourhood centroids do not qualify. Two duplicate physical identities are collapsed.
This leaves 50 accepted physical coordinates and a median centre of `16.06682875, 108.24336055`. Forty-nine
properties fall within 5 km: ten 1-star, eight 2-star, twelve 3-star, and nineteen 4-star hotels. The other
371 rows remain visible but unranked because their location is missing, ambiguous, coarse, or still needs
merged-boundary review. This is deliberately low geolocation coverage, not evidence that those hotels are
outside the city-centre radius.

Hanoi is currently one step earlier. A reproducible query of the same national directory captured 330
government-managed 1-4-star records, but an official February 2026 city summary reports only 37 hotels
with currently valid classifications in those classes. The larger search result is retained as a hashed
source universe, not treated as an active property frame. No Hanoi property will be ranked or quoted until
its current classification status is supported by authoritative evidence.
The reconciliation ledger therefore begins with all 330 source records pending and zero eligible. It does
not guess which 37 records correspond to the aggregate current count.

Barcelona's first direct-site checkpoint covers the frozen 4-star primary panel. Eleven of twelve properties
now have source-attributed official websites applied deterministically to the panel. The current Marriott
page explicitly matches registration `HB-003973`, resolving the legacy Husa L'Illa identity as AC Hotel
Diagonal L'Illa. Sansi Pedralbes (rank 4) remains unresolved because the reviewed evidence does not establish
a current property-owned booking site. These eleven verifications do not add price observations or quote
attempts; they establish auditable paths for the later exact-date collection pass.

The completed Copenhagen shoulder-season capture demonstrates the operational audit trail. Properties were
attempted in the frozen order, independent of price. Ten official-property paths produced five accepted
4-star quotes, one genuine no-availability result, and four booking-path failures: three could not preserve
the exact dates and one exposed only a nightly rate without a verifiable mandatory-charge total. Accepted
nightly totals were DKK 1,178.36, DKK 1,365.29, DKK 1,417.43, DKK 1,652.57, and DKK 1,738.93, for a
median of DKK 1,417.43. Four rates are non-refundable and one is flexible; two bundle breakfast, two are
room-only, and one does not state a meal basis. Each attempt retains the ownership evidence, exact dates,
payable total, tax treatment, cancellation basis, meal basis, and failure reason. The shoulder stratum now
passes its five-property sample gate, but the calculator still reports one incomplete seasonal
accommodation measure and publishes no accommodation tier because low/high coverage and 60% cross-season
property overlap are not yet available. This separation prevents availability and technical failures from
being misreported as zero-cost rooms or silently disappearing from the evidence.

### Robust Aggregation And Missing Data

Prices remain in local currency until city-level aggregation is complete. Comparable observations are
aggregated with robust medians or documented trimmed estimators; a property's headline minimum is not
treated as a payable representative rate. Source disagreement, excluded outliers, ranges, counts,
retrieval dates, and URLs
remain in the observation table rather than disappearing into a final average.

Missing values will be predicted on the log-price scale, where proportional errors are symmetric. The
candidate fallback set includes global ratios, region/cost-band ratios, regularized feature models, and a
hierarchical partial-pooling model with city, country, region, and category effects. Whole cities—not
individual rows—are held out during cross-validation. The simplest method that performs best on unseen
cities is selected and published with its prediction interval. The current arbitrary nearest-city
10% to 30% adjustment will not survive unless it wins that comparison.

### How Accuracy Will Be Measured

For estimate `p_hat` and independent benchmark `p`, the primary residual is:

~~~text
signed_log_error = ln(p_hat / p)
~~~

This residual is zero when correct and treats reciprocal proportional errors consistently. No single
summary statistic is sufficient, so the validation report will include:

- median signed log error and mean signed percentage error for systematic bias
- median absolute percentage error for typical error
- weighted absolute percentage error for budget impact
- root mean squared log error to penalise variance and large misses
- 50th, 80th, and 90th absolute-error percentiles
- shares within 10%, 15%, and 25%
- Spearman rank correlation for cross-city affordability ordering
- prediction-interval coverage and width for uncertainty calibration
- itinerary-weighted error after trip length and category mix are applied

Results will always include city count, observation count, dataset version, reference window, and
cluster-level uncertainty intervals. They will be broken down by category, region, cost quartile,
season, and direct-versus-imputed provenance so a good global average cannot conceal a failing subgroup.

The pilot-enrichment contract now freezes the remaining subgroup definitions before modelling. City size
means resident population for the smallest consistently defined city or urban-area geography containing
the destination. Tourism intensity means annual overnight visitor arrivals divided by resident population
for that same geography and a stated year. Neither field may be assigned from intuition, a country total,
or an unlabeled search result. Until comparable public values are retained, the artifact records them as
unknown rather than introducing silent classification error.

Population enrichment uses the United Nations World Urbanization Prospects 2025 File 21, which applies
the harmonised Degree of Urbanization (DEGURBA) definition across countries. Twenty-nine of the 36 pilot
destinations have a reviewed 2025 match. Published values in thousands are converted to integer residents,
while the UN city code and original location label are retained for audit. These are comparable urban-centre
populations, not municipal-boundary counts, so later sources may only replace them if they preserve or
explicitly improve geographic comparability.

Seven destinations remain pending with an explicit match outcome. Dubrovnik, Queenstown, Don Det,
Pu Luong, Vang Vieng, and Santa Fe (Bantayan) have no matching named File 21 record; Goa is a state and
multi-city destination, so assigning one city's population would misstate the estimand. The audit rejects
plausible-looking but wrong fuzzy matches, including Pu Luong to Phú Cường and Vang Vieng to Vientiane.
Tourism-intensity collection has begun with Prague. For 2024, the Czech Statistical Office reports
8,063,367 guests in collective accommodation establishments and 1,397,880 residents for the same
Capital City of Prague administrative geography. The resulting 5.77 arrivals per resident is classified
as `high`. The artifact retains both counts, definitions, sources, year, geography, and the derived value.
This is a reproducible accommodation-based proxy and a lower bound on total overnight visitation because
some small, informal, and platform-only stays fall outside the reported establishment frame.

Barcelona is the second measured record. Its official 2024 activity report publishes 12,726,360 tourists
in the available Barcelona city tourist-accommodation series and 1,702,814 municipal residents, producing
7.47 arrivals per resident (`high`). The report's “according to data availability” qualifier is retained:
this is also an accommodation-based proxy, not an exhaustive count of every overnight visitor. The other
34 tourism-intensity fields remain pending rather than mixing incompatible destination geographies or
using international-only arrivals, guest-night totals, incomplete-year figures, or forecasts as substitutes.

Mexico City adds the first non-European measured record. The city tourism authority reports 14,403,349
hotel tourists in 2023. The matching CONAPO municipal projection file gives 9,221,637 mid-year residents
after summing both sexes across the same 16-borough Ciudad de Mexico federal entity. The resulting 1.56
arrivals per resident is classified as `medium`. The numerator is deliberately labelled hotel-only: it
excludes other accommodation, friends-and-relatives stays, and some platform inventory, so it remains a
reproducible lower-bound proxy rather than a claim about all overnight visitors.

Fukuoka and Budapest broaden the evidence beyond the first three records. Fukuoka reports an estimated
5,760,000 overnight tourists in 2023 and 1,642,571 residents on 1 October, producing 3.51 arrivals per
resident (`medium`). The numerator is rounded to the nearest 10,000 and is modelled from city tax data,
the national accommodation survey, and a visitor-survey overnight rate, so its estimated status remains
visible. Budapest reports 6,730,727 arrivals across commercial, private, and other accommodation in 2024
and 1,686,222 residents at the start of that year for the same capital-region boundary. Its ratio is 3.99
(`medium`).

Sofia contributes a lower-intensity case rather than extending only the upper end of the distribution.
The Bulgarian National Statistical Institute records 1,185,345 arrivals in categorized accommodation
establishments with at least 10 bed places during 2024 and 1,295,931 residents at 31 December for the
same Sofia-capital district. The resulting 0.91 arrivals per resident is `low`. Smaller and informal stays
are outside the accommodation frame, so the retained value is a lower-bound proxy.

Istanbul adds a second `low` case from a common province boundary. The provincial tourism directorate
reports 13,212,666 domestic and international arrivals for an overnight stay at Ministry-certified
tourism-operation and simple-accommodation establishments during 2023; TurkStat reports 15,655,924
province residents at 31 December 2023. The resulting 0.84 arrivals per resident is `low`. The source
counts establishment entries, not unique visitors, so repeat stays by the same person are separate
arrivals; informal and other out-of-frame stays are excluded.

Two Croatian city records widen the upper tail. Dubrovnik's city government reports 1,397,052 eVisitor
arrivals in 2024 against an official year-end municipal population estimate of 42,016, producing 33.25
arrivals per resident (`very_high`). The Split Tourist Board reports 1,050,847 domestic and international
eVisitor arrivals against 158,636 residents for the same city boundary, producing 6.62 (`high`). eVisitor
counts registrations rather than unique people, so an accommodation change can register one person more
than once; the ratios are tourism-pressure signals, not unique visitor counts.

San Francisco adds a North American `high` case using a different evidence design. San Francisco Travel's
published 2023 model separates 5.81 million domestic and 2.19 million international overnight visitors,
including hotels, rentals, and stays with friends or family. Their rounded sum of 8.00 million divided by
the Census Bureau's 808,988 city/county residents produces 9.89 arrivals per resident. Because the
numerator is a rounded model output rather than an accommodation register, its inputs and published
precision remain explicit. Tokyo remains pending because its official table reports person-nights,
not arrivals, and its broader tourism estimate mixes day and overnight trips.

Lisbon adds another `high` case from a single bilingual official municipal profile sourced to Statistics
Portugal's Regional Statistical Yearbook. It reports 6,460,430 guests in tourist accommodation and
567,131 residents for Lisbon municipality in 2023, producing 11.39 arrivals per resident. The common
year and boundary remove the denominator-matching ambiguity, but the numerator remains a count within
surveyed accommodation: stays outside the frame are absent and separate stays can count one person more
than once. It is retained as an accommodation-pressure proxy rather than a unique-visitor estimate.
Vancouver adds the second North American record and a `very_high` case. Summing Destination Vancouver's
twelve exact monthly 2024 overnight-visitation values gives 11,271,967; dividing by BC Stats' same-year
Vancouver municipality population estimate of 748,777 produces 15.05 arrivals per resident. The public
destination page rounds the annual total to 11.3 million but does not publish detailed model methodology
inline, so the exact inputs and that limitation remain attached. The other 24 tourism-intensity fields
remain pending.

Pending fields can now retain source-attributed rejection reasons rather than a generic missing label.
Queenstown is the first structured rejection: its council reports guest nights plus average-day and peak-day
visitor populations for the wider Queenstown Lakes District, not annual overnight arrivals for the city.
None of those measures is converted into the required numerator. The published enrichment artifact retains
the outcome, reason, and source URLs. The current profile therefore distinguishes 12 measured cities, one
screened rejection, and 23 tourism-intensity cities still awaiting a compatible-source screen.

Auckland is also screened and remains missing. Its official destination overview reports international
visitor arrivals plus domestic and international guest nights. International arrivals omit domestic
overnight visitors, while guest nights are not arrivals, so neither measure satisfies the registered
numerator. With Auckland recorded, the profile distinguishes two screened rejections and 22 unscreened gaps.

Tokyo is the third screened rejection. Its metropolitan catalog publishes broad Japanese and foreign
traveler estimates, while the national accommodation survey publishes guest nights. Neither source exposes
the required overnight-only arrivals numerator, leaving 21 pilot cities still unscreened.

Public-source density is already reproducible from the observation store: zero retained measures is
`none`, one or two is `sparse`, three to five is `moderate`, and six or more is `dense`. The current
36-city candidate set contains three none, one sparse, 32 moderate, and zero dense cities. These are
coverage diagnostics, not claims that the underlying sources are statistically representative.

The first joined missingness profile uses the entire 36-city manifest as its denominator, including
cities with no materialized values. It finds 32 represented cities and 151 materialized tier cells out
of 684 required (22.08%), with no complete city. The source materializer also contains Bangkok,
Copenhagen, and Dubai from earlier batch-zero work; the pilot profile explicitly excludes those three
non-pilot rows so they cannot inflate coverage or leak into later whole-city validation. Coverage is
currently concentrated in coffee and light-drink tiers (30 cities each), the always-zero free-activity
tier (32), and budget activities (26). All accommodation and food tiers remain unmaterialized because
their required direct parent measures or seasonal gates are incomplete. This is evidence that fallback
model selection is premature, not a reason to fill missing cells with unvalidated regional adjustments.

### Validation Design And Provisional Gates

The first defensible study will use at least 30 whole cities stratified by region, cost quartile, city
size, tourism intensity, and data density. Benchmark observations will be recollected independently and
kept separate from model fitting. Confidence intervals will resample cities as clusters because prices
within a city are correlated. A second behavioural layer will compare representative tier baskets with
real trip expenses mapped to the same definitions.

The provisional holdout targets are median APE at or below 10% for food/drink anchors, at or below 15%
for accommodation/activities, absolute bias below 5% to 7.5%, a two-person city-basket median APE at or
below 12%, a 90th-percentile basket error at or below 25%, Spearman rank correlation of at least 0.95,
and empirical 80% interval coverage between 75% and 85%. These are acceptance criteria for future work,
not results the current dataset claims to have achieved.

The detailed execution plan, source feasibility assessment, and frozen first nine-city accommodation
schedule are recorded in
`docs/dev/plans/observed-first-methodology.md`.

## Version 2.1 Baseline (Retained For Reproducibility)

The sections below document the currently active April 2026 dataset and its original generation prompt.
They are retained so the baseline can be reproduced and audited; their Booking.com/Hostelworld sourcing,
global multipliers, and nearest-city adjustments are not the version 3 collection policy.

## 1. Anchor Prices

Each city is represented by 10 named USD anchor slots. They are sourced directly where coverage exists
and explicitly approximated when a direct observation is unavailable:

| # | Anchor | Definition | Primary Source |
|---|--------|-----------|----------------|
| 1 | `beer` | Domestic draft beer, 1 pint, at a restaurant | Numbeo "Domestic Draft Beer (1 Pint)" |
| 2 | `coffee` | Regular cappuccino | Numbeo "Cappuccino (Regular Size)" |
| 3 | `inexp_meal_1p` | Meal at an inexpensive restaurant, 1 person | Numbeo "Meal, Inexpensive Restaurant" |
| 4 | `midrange_meal_2p` | Mid-range restaurant, 3 courses, 2 people, no drinks | Numbeo "Meal for 2, Mid-range Restaurant" |
| 5 | `cocktail` | Standard cocktail at a bar or restaurant | If unavailable: `beer × 2.5` |
| 6 | `wine_glass` | Glass of wine at a restaurant | If unavailable: `beer × 1.5` |
| 7 | `hostel_dorm_1p` | 1 dorm bed per night, well-reviewed hostel | Hostelworld median for city |
| 8 | `hostel_private_2p` | 1 private hostel/guesthouse room, 2 people, per night | Hostelworld or Booking.com |
| 9 | `hotel_1star_2p` | Very basic hotel or guesthouse, 1 room, 2 people, per night | Booking.com lowest tier |
| 10 | `hotel_3star_2p` | Comfortable 3-star hotel, 1 room, 2 people, per night | Booking.com 3-star median |

### Source Priority

1. **Numbeo.com** — city-level data, most recent available (crowd-sourced, large sample sizes for major cities).
2. **Hostelworld.com / Booking.com** — accommodation pricing (use median, not minimum).
3. **Nearest-city scaling** — if no direct data exists, find the nearest city WITH Numbeo data. Apply Numbeo's relative cost-of-living index to scale from that city. Record this in a `confidence_notes` field.
4. **Regional-hub adjustment** — for very small or remote places (e.g. Pu Luong, Don Det, Santa Fe Bantayan), use the nearest regional hub and adjust down 10–30% based on remoteness and local price level.

### Fallback Rules for Missing Anchors

- **Cocktail unavailable:** estimate as `beer × 2.5`
- **Wine glass unavailable:** estimate as `beer × 1.5`
- **No hostel scene** (e.g. small rural town): set `hostel_dorm_1p = hotel_1star_2p / 2` and `hostel_private_2p = hotel_1star_2p`
- **"Street food" in expensive Western cities** (Paris, London, Copenhagen, etc.): this tier represents cheap takeaway, fast food, or budget counter-service — not literal street stalls.

---

### Research Procedure And Evidence

For each anchor, the research record should identify the city, source, reference date or pricing
window, currency, unit, occupancy, and whether the value is direct or inferred. A number without its
unit or observation context is not reproducible.

The source hierarchy is a consistency rule, not a claim that one website is universally authoritative:

1. Prefer city-level observations over country averages and preserve the original source unit.
2. Use a representative accommodation price or median where possible; do not select an unusually cheap
   minimum and present it as a typical night.
3. Use the most recent comparable observation available, while recording seasonal or event-driven
   limitations instead of silently smoothing them away.
4. If direct coverage is missing, scale from a nearby city with a documented cost relationship.
5. For remote or very small destinations, use a regional hub and record the stated 10% to 30%
   adjustment for local price level and remoteness.
6. Use BudgetYourTrip, Price of Travel, hikersbay, and similar sources for external plausibility checks;
   they are not silently mixed into the primary anchor calculation.

### Approximation And Confidence

The arithmetic is deterministic after the inputs are selected, but the inputs are not equally certain.
Confidence describes the quality and proximity of the evidence behind a city row. It is not a calibrated
probability that the estimate will be correct.

- **High:** direct city-level observations cover most material anchors using the preferred source types.
- **Medium:** one or more material anchors use a nearby city or clearly comparable market with a
  documented scaling assumption.
- **Low:** the destination relies substantially on a regional hub, sparse alcohol data, or multiple
  formula fallbacks.

Confidence notes should say what was directly observed, what was scaled, which fallback was used, and
why the approximation was considered reasonable. The current system does not publish formal prediction
intervals; this is an explicit limitation rather than something that should be inferred from a qualitative
label.

---

## 2. Tier Derivation Formulas

All formulas produce values for **2 people**. The database stores these base-2 values; scaling to other group sizes happens at runtime (see Section 3).

### Accommodation (per night, 2 people)

```
accom_shared_hostel_dorm  = hostel_dorm_1p × 2
accom_hostel_private_room = hostel_private_2p                [direct lookup]
accom_1_star              = hotel_1star_2p                   [direct lookup]
accom_2_star              = (hotel_1star_2p + hotel_3star_2p) / 2
accom_3_star              = hotel_3star_2p                   [direct lookup]
accom_4_star              = hotel_3star_2p × 1.80
```

**Rationale:** 2-Star is interpolated as the midpoint between 1-Star and 3-Star. The 4-Star multiplier of 1.80× was empirically validated across the 20-city calibration set and is stable (CV = 0%).

### Food (per day, 2 people)

```
street_food_meal = inexp_meal_1p × 0.60

food_street_food = street_food_meal × 3 meals × 2 people
food_budget      = (street_food_meal × 2 + inexp_meal_1p) × 2 people
food_mid_range   = (street_food_meal + inexp_meal_1p + midrange_pp) × 2 people
food_high_end    = food_mid_range × 1.50

where midrange_pp = midrange_meal_2p / 2
```

**Rationale:**
- Street food tier assumes 3 cheap meals, each costing 60% of the cheapest sit-down restaurant.
- Budget tier mixes 2 street meals with 1 cheap restaurant meal.
- Mid-range blends a cheap meal, a street meal, and a proper restaurant meal.
- High-end applies a fixed 1.5× uplift on mid-range, reflecting larger portions, more courses, and nicer venues.
- The Food Mid/Street ratio has CV = 21.3% across calibration cities. This is expected — SEA street food is structurally cheaper relative to restaurants than in Western cities. This variance is a feature, not a bug.

### Drinks (per day, 2 people — basket approach)

```
drinks_none     = 2 × coffee
drinks_light    = 2 × coffee + 2 × beer
drinks_moderate = 2 × coffee + 4 × beer + 2 × cocktail
drinks_heavy    = 2 × coffee + 6 × beer + 4 × cocktail + 2 × wine_glass
```

**Rationale:** Each tier is a literal basket of drinks consumed by 2 people across the day. This is the most robust derivation (CV = 11.5%) because it's a direct sum of observable unit prices with no multipliers or approximations.

**Basket definitions:**
- **None:** 1 coffee each per day.
- **Light:** 1 coffee each + 1 beer each per day.
- **Moderate:** 1 coffee each + 2 beers each + 1 cocktail each per day.
- **Heavy:** 1 coffee each + 3 beers each + 2 cocktails each + 1 glass of wine each per day.

### Activities (per day, 2 people — blended local/global scaling)

```
blended_factor    = (inexp_meal_1p + 10.00) / 2

activities_free       = 0.00
activities_budget     = blended_factor × 2
activities_mid_range  = blended_factor × 5.5
activities_high_end   = blended_factor × 12
```

**Rationale:** Activities pricing is influenced by both local cost levels (a tuk-tuk tour costs less in Cambodia than Denmark) and global price floors (a scuba dive costs ~$50–80 USD globally). The blended factor averages the local proxy (`inexp_meal_1p`) with a $10 USD global baseline to prevent:
- Too-low values in cheap countries (without blending: Bangkok high-end activities = A$43/day, which is below the cost of a single cooking class)
- Too-high values in expensive countries (without blending: Copenhagen = A$535/day, which is absurd)

With blending, the range is A$18–50 (budget) to A$112–298 (high-end), which aligns with real-world activity pricing.

---

## 3. Group Size Scaling (1–5 people)

The database stores base values for **2 people only**. The app applies these scaling rules at runtime.

### Accommodation — Hostel Dorm (per-bed pricing)

```
scaled = base_2p × (N / 2)
```

| People | Multiplier |
|--------|-----------|
| 1 | ×0.50 |
| 2 | ×1.00 |
| 3 | ×1.50 |
| 4 | ×2.00 |
| 5 | ×2.50 |

### Accommodation — All room-based tiers (Private Room / 1★ / 2★ / 3★ / 4★)

```
rooms_needed = ceil(N / 2)
scaled = base_2p × rooms_needed
```

| People | Rooms | Multiplier |
|--------|-------|-----------|
| 1 | 1 | ×1.0 |
| 2 | 1 | ×1.0 |
| 3 | 2 | ×2.0 |
| 4 | 2 | ×2.0 |
| 5 | 3 | ×3.0 |

**Rationale:** Hotels charge per room, not per person. A solo traveller in a double room pays the same as a couple. Groups of 3+ need additional rooms. The `ceil(N/2)` rule assumes standard double occupancy.

### Food (sharing discount for groups)

```
sharing_discount = 1.0 − 0.05 × max(0, N − 2)
scaled = base_2p × (N / 2) × sharing_discount
```

| People | Raw multiplier | Discount | Effective multiplier |
|--------|---------------|----------|---------------------|
| 1 | 0.50 | 0% | ×0.500 |
| 2 | 1.00 | 0% | ×1.000 |
| 3 | 1.50 | 5% | ×1.425 |
| 4 | 2.00 | 10% | ×1.800 |
| 5 | 2.50 | 15% | ×2.125 |

**Rationale:** Food scales roughly per-person, but groups share dishes, appetisers, sides, and platters. The 5% discount per additional person beyond 2 is conservative and reflects this sharing economy. Capped at 15% (5 people).

### Drinks (strictly linear)

```
scaled = base_2p × (N / 2)
```

Drinks are individual consumption — no group discount.

### Activities (strictly linear)

```
scaled = base_2p × (N / 2)
```

Entry fees and tickets are per person — no group discount.

### Implementation Reference

```python
import math

def scale_cost(base_2p, n_people, category):
    """Scale a base-2-person cost to N people.
    
    Args:
        base_2p: Cost for 2 people (from database)
        n_people: Group size (1-5)
        category: One of 'accom_dorm', 'accom_room', 'food', 'drinks', 'activities'
    
    Returns:
        Scaled cost for the group
    """
    if category == 'accom_dorm':
        return base_2p * (n_people / 2)
    elif category == 'accom_room':
        rooms = math.ceil(n_people / 2)
        return base_2p * rooms
    elif category == 'food':
        discount = 1.0 - 0.05 * max(0, n_people - 2)
        return base_2p * (n_people / 2) * discount
    else:  # drinks, activities
        return base_2p * (n_people / 2)
```

---

## 4. Validation Results

### Ratio Stability (20-city calibration set)

A coefficient of variation (CV) below 20% indicates the formula produces consistent results across diverse cities.

| Ratio | Mean | CV | Status |
|-------|------|-----|--------|
| Food High-End / Mid-Range | 1.50 | 0.0% | ✓ Fixed multiplier |
| Drinks Heavy / Light | 5.69 | 11.5% | ✓ Stable |
| Hostel Private / Dorm | 1.38 | 13.7% | ✓ Stable |
| Activities High-End / Budget | 6.00 | 0.0% | ✓ Fixed multiplier |
| Food Mid-Range / Street Food | 2.62 | 21.3% | ⚠ Expected variance |

### Budget-per-person-per-day Sanity Check

| City | Backpacker (AUD) | Mid-Range (AUD) | Luxury (AUD) |
|------|-----------------|-----------------|--------------|
| Don Det (cheapest) | $24 | $53 | $100 |
| Hanoi | $28 | $82 | $155 |
| Bangkok | $37 | $109 | $200 |
| Budapest | $62 | $160 | $288 |
| Tokyo | $84 | $209 | $377 |
| Paris | $142 | $324 | $578 |
| NYC (most expensive) | $178 | $419 | $747 |

These align with published backpacker indexes from BudgetYourTrip and Price of Travel.

### Validation Interpretation

Validation is applied at three levels:

1. **Structural:** required city fields are present, values are non-negative, the canonical dataset has
   the expected city and country coverage, and the explicit coffee input is available.
2. **Deterministic invariants:** composed baskets and fixed-ratio tiers reconcile with their inputs,
   including drinks_none equal to two coffees.
3. **Empirical plausibility:** ratio diagnostics and external traveller-budget references are used to
   identify implausible outputs or assumptions that deserve review.

The ratio diagnostics are descriptive rather than proof of accuracy. A stable ratio shows that a
transformation behaves consistently across the calibration set; it does not establish that the absolute
level is correct. Formal prediction intervals and automated outlier treatment are not currently
published, so the qualitative confidence notes and limitations remain important.

---

## 5. Data Sources

| Source | What it provides | URL |
|--------|-----------------|-----|
| Numbeo | Food, drink, transport unit prices (crowd-sourced) | numbeo.com/cost-of-living |
| Hostelworld | Hostel dorm + private room pricing | hostelworld.com |
| Booking.com | Hotel star-category median pricing | booking.com |
| Price of Travel | Hostel Price Index (cross-validation) | priceoftravel.com |
| BudgetYourTrip | Traveler-reported daily budgets (validation) | budgetyourtrip.com |
| hikersbay / world-prices | Secondary cross-validation | hikersbay.com |

## 5.1 Data Lineage And Reproducibility

The active city row is the planner source, while estimate history is retained as an audit trail. This
keeps the operational dataset simple without discarding the evidence and model settings that produced
earlier estimates.

For generated rows, the metadata can include:

- provider and model
- prompt version
- confidence notes
- anchor values
- source details
- input snapshot
- fallback log
- inferred AUD-per-USD rate

Reference rows are traceable to data/reference/city_costs_app_aud.csv and the base_csv_apr_2026 seed
source. Generated rows retain the prompt version so a future prompt change does not make old results
ambiguous. A reviewer can recompute each composed category from the anchors without needing access to
the original LLM response.

---

## 6. Known Limitations

1. **"Street Food" in expensive Western cities** = cheap takeaway or fast food, not literal street stalls.
2. **4-Star hotel** uses a fixed 1.8× multiplier on 3-Star. May underestimate luxury pricing in cities with very steep hotel gradients (e.g. Dubai, NYC).
3. **Seasonal variation** not captured. All prices are shoulder-season estimates. Peak season (Christmas, New Year, local festivals) can inflate accommodation by 30–100%.
4. **Remote/small cities** (Pu Luong, Don Det, Santa Fe Bantayan, etc.) are estimated from regional hubs. These carry lower confidence.
5. **Activities** use a blended local/global scaling factor. The global baseline ($10 USD) may need adjustment if the global cost floor changes significantly.
6. **Wine and cocktail prices** are estimated where Numbeo data is sparse — these should be verified for accuracy in alcohol-restricted countries (e.g. parts of SE Asia, Middle East).
7. **Currency rates** — the USD→AUD rate of 1.55 is approximate. The app should ideally use a live or regularly-updated rate.
8. **Confidence labels** are qualitative evidence-quality labels, not calibrated error probabilities.
9. **Prediction intervals and automatic outlier treatment** are not currently published; unusual rows require
   human review and source inspection.
10. **Source drift** is possible because third-party websites change definitions, coverage, and prices over time.
11. **Transport boundary** is deliberate: local transport and intercity transport are handled as planner-level
    manual inputs rather than hidden inside city daily costs.

---

## 7. Adding New Cities

Use the LLM prompt in `llm_prompt_new_cities.md` to generate entries for cities not in the database. The prompt instructs the model to:

1. Look up the 10 anchor prices from the specified source hierarchy
2. Apply the exact derivation formulas documented above
3. Convert to AUD
4. Output JSON in the database schema
5. Flag confidence level (high / medium / low)

The output JSON is an input to the city-generation save flow. It should be reviewed, validated, and
mapped into the app-facing CSV or database schema rather than appended blindly.

Before accepting a generated or manually edited row, review the city and country identity, inspect all
ten anchors, mark direct versus inferred values, recompute the tier formulas, review the confidence
notes, and compare the resulting daily budget with an external plausibility reference. The goal is not
to remove all uncertainty; it is to make each approximation visible and replaceable.

---

## 8. Column Reference

The app-facing CSV (`data/reference/city_costs_app_aud.csv`) contains these columns:

| Column | Unit | Description |
|--------|------|-------------|
| `city` | — | City name |
| `country` | — | Country name |
| `region` | — | One of: SEA, East Asia, South Asia, Middle East, Africa, Europe, Latin America, North America, Oceania |
| `accom_shared_hostel_dorm` | AUD/night/2p | Two dorm beds |
| `accom_hostel_private_room` | AUD/night/2p | One private hostel room |
| `accom_1_star` | AUD/night/2p | One basic hotel/guesthouse room |
| `accom_2_star` | AUD/night/2p | One simple hotel room |
| `accom_3_star` | AUD/night/2p | One mid-range hotel room |
| `accom_4_star` | AUD/night/2p | One upscale hotel room |
| `food_street_food` | AUD/day/2p | Daily food: mostly street stalls and markets |
| `food_budget` | AUD/day/2p | Daily food: mix of street food and cheap restaurants |
| `food_mid_range` | AUD/day/2p | Daily food: casual + some nicer sit-down meals |
| `food_high_end` | AUD/day/2p | Daily food: frequent nicer restaurants |
| `drink_coffee` | AUD/unit | One regular cappuccino or equivalent coffee |
| `drinks_none` | AUD/day/2p | 2 coffees |
| `drinks_light` | AUD/day/2p | 2 coffees + 2 beers |
| `drinks_moderate` | AUD/day/2p | 2 coffees + 4 beers + 2 cocktails |
| `drinks_heavy` | AUD/day/2p | 2 coffees + 6 beers + 4 cocktails + 2 wines |
| `activities_free` | AUD/day/2p | Parks, beaches, walks, free sights |
| `activities_budget` | AUD/day/2p | Low-cost museums, temples, local attractions |
| `activities_mid_range` | AUD/day/2p | Paid tours, classes, bigger ticket entries |
| `activities_high_end` | AUD/day/2p | Premium tours, adventure activities, splurges |

### Coffee Input Backfill

The April 2026 CSV originally contained the composed drink baskets but omitted the coffee unit input. The current
reference file includes both `drink_coffee` and `drinks_none` so the coffee-only tier is available to the planner.
For the backfill, 44 city-name matches retained the legacy seed coffee values; the remaining rows use a regional
coffee-to-light-basket inference as an editable starting value. In every row, `drinks_none = drink_coffee × 2`.
