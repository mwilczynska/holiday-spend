# Free-Only City Cost Collection And Batch Zero

> **SUPERSEDED — 18 August 2026.** This is retained source-access and v3/v4 collection history. It is not part of the
> active v1.1 new-city path; read `PLAN.md` and `LOOP-PROMPT-V1-1.md` for current work.

<!-- status-banner -->
> **RETAINED HISTORICAL.** The source-access decisions and the surrounding v3/v4 collection programme are
> historical evidence only. They are not requirements for the active v1.1 path, which makes no new
> methodology collection calls. Preserve this document for audit; do not resume its collection plan or
> treat its open decisions as current product work.

## Constraint

Phase 6 will not use paid data APIs. Collection must run through no-cost LLM calls with web access,
publicly accessible pages, and official/open sources. The project does not impose its own daily call cap:
collection continues for as long as the selected provider makes free calls available.

This changes throughput, not the evidence standard. Every accepted observation still requires a URL,
retrieval timestamp, original currency, unit, definition, and direct/derived/imputed status. When a page
cannot be accessed or a value cannot be verified, the collector records missingness rather than filling
the cell from model memory.

## Collection Architecture

~~~text
versioned city batch manifest
        -> bounded LLM research call
        -> public web search and page inspection
        -> deterministic property panel for accommodation
        -> structured observations with URLs
        -> local schema validation
        -> reviewer/quality-control queue
        -> checkpointed JSONL observation file
        -> coverage report
        -> next adaptive batch
~~~

The LLM is a research agent, not the numeric model. For this private project it may inspect a public
Numbeo city page one city at a time with attribution, or locate an official attraction page, public
property booking page, menu, or tourism publication and extract a displayed
value. It may not output an uncited price or calculate final city tiers. Local deterministic code performs
currency normalization, aggregation, basket construction, and later imputation.

The local runner makes this hand-off reproducible without coupling the project to a paid API. A versioned
assignment JSON renders the bounded prompt; a saved free web-enabled LLM response is then parsed and checked
against that assignment. Raw JSON and a single JSON code fence are accepted, but surrounding prose,
wrong-city output, out-of-category measures, duplicate ids, implicit missingness, and self-accepted rows are
rejected. Runner output is always `unreviewed` until a separate evidence review accepts it.

```text
npm run methodology:research -- --assignment <assignment.json>
npm run methodology:research -- --assignment <assignment.json> --response <llm-response.txt>
```

## Free Source Hierarchy

| Category | First choice | Secondary evidence | Explicit fallback |
|---|---|---|---|
| Food and drinks | Public Numbeo city pages reached through LLM web search | Public menus, official venue pages, other publicly accessible city-price pages | Missing; later impute from the validated model |
| Hostel accommodation | Dated public rates on official hostel sites for a deterministic panel drawn from an official destination directory or register | Another eligible panel property selected by the frozen reserve order | Missing |
| Hotel accommodation | Dated public rates on official property sites for a deterministic panel from an official register or classification directory, stratified by star class | Another eligible panel property selected by the frozen reserve order | Missing |
| Activities | Official attraction or tour-operator price pages | Official destination/tourism pages that publish a matching current price | Missing |
| FX | Public ECB reference-rate pages/data | Another official central-bank source | Freeze the last verified public rate and flag age |
| Seasonality | Eurostat, national tourism bodies, public destination calendars | Observed cross-date accommodation dispersion | `unknown`, never assumed away |

Public availability does not automatically grant unrestricted reuse. Numbeo is used under its
personal-use-with-attribution terms, through reviewed page-by-page lookups rather than a scraper,
crawler, or paid API. Other calls must also stay within normal browsing behaviour, respect access
controls, and avoid attempts to bypass blocks, logins, CAPTCHAs, or explicit restrictions. The stored
record contains facts needed for audit, not copied page content.

### Accommodation source-access decision

**Superseded 27 July 2026. Booking.com and Trip.com are now in scope as accommodation price sources.**
The v3 exclusion below is retained as the record of what was decided and why, because the reasoning that
replaced it depends on knowing what it replaced.

**Current position.** Booking.com and Trip.com are the primary accommodation channels. The decision is
the project owner's, is deliberate, and rests on the facts of this project rather than on a reading of
the terms: Holiday Spend is a private budget tool for two travellers, collection runs at browsing scale
and pace against pages any visitor is served, and the stored record holds extracted facts with
provenance, not copied page content. The terms text below has not changed and has not been reinterpreted
— the tradeoff has been weighed and accepted.

Operating constraints that remain binding:

- Signed out. No member, login-gated, or account-conditional rates.
- No bypassing blocks, CAPTCHAs, rate limits, or access controls. A block is a missing observation.
- Browsing pace and volume, with checkpointing. No crawler, no bulk harvesting, no paid scraping proxy.
- Terms are re-reviewed before any material expansion of use.

The reviewed terms are retained as evidence of what was weighed:

- https://www.booking.com/content/terms.en-gb.html
- https://www.hostelworld.com/legal/hostel-terms-and-conditions/

**Superseded v3 text.** Booking.com and Hostelworld were excluded as price-extraction sources for the
version 3 accommodation panel. Booking.com's consumer terms expressly cover unauthorized use by automated
means or an automated assistant, including assistants that interact with a browser. Hostelworld permits
personal, non-commercial booking use but restricts robots, scrapers, automated means, and manual
processes used for purposes outside its terms. Each city's sampling frame was instead built from an
official tourism/accommodation register or official classification directory, frozen with a deterministic
selection seed and reserve order, with the price read from the selected property's own public booking
page.

**Why it was reversed.** That design was executed across five frozen city frames and produced five
accepted quotes in one city. In the same period, a single public Booking.com class page returned ten
named properties with prices whose median landed 13.4% from Copenhagen's direct-quote ground truth, while
the headline average on that same page was 54.4% high. The register-first path was not more accurate; it
was differently sourced and far more expensive. Property pages are still checked individually for access
conditions, and login-only, member-only, mobile-only, blocked, or tax-ambiguous rates remain missing
observations rather than invitations to work around a restriction.

The panel design follows the same properties through low, shoulder, and high seasons where availability
allows. This reduces property-mix confounding. Each city/measure/season targets 12 properties, requires at
least five accepted quotes, and requires at least 60% panel overlap across seasons. The city point
estimate gives each season equal weight by taking the median of the three seasonal medians, so a season
with more visible inventory cannot dominate the annualized reference rate.

For Da Nang, the Viet Nam National Authority of Tourism accommodation directory is accepted as the
eligibility and official-classification source. The capture must submit the province, hotel type,
government-managed provenance, and star filter on every paginated request: the site's displayed GET page
links do not retain those filters. The normalized capture retains stable property ids, names, addresses,
reported totals, page byte counts, and SHA-256 hashes. The directory does not supply property coordinates,
so it cannot by itself establish the fixed centre, radius eligibility, or ranking.

For Hanoi, the same directory is accepted only as a source-universe input until active classification is
reconciled. The 24 July 2026 filtered capture returns 330 government-managed 1-4-star hotel records, while
the tourism authority's February 2026 city summary reports only 37 hotels with currently valid 1-4-star
classifications. The capture therefore cannot establish current eligibility by itself. Every Hanoi row
must be joined to a current classification decision or another authoritative active-status record before
it can enter geolocation, ranking, or quote collection; unresolved rows remain visibly excluded.
`data/reference/hanoi_accommodation_classification_reconciliation_2026.json` is the row-complete
reconciliation ledger. It starts with all 330 records as `pending_current_decision`, zero eligible for
geolocation, and the published 37-property aggregate as a non-identifying benchmark rather than a source
of inferred row status.

The one-time address-resolution pass uses the public OpenStreetMap Foundation Nominatim service under its
published usage policy: one machine and thread, at least 1.1 seconds between calls, an identifying user
agent, local caching, no autocomplete, no grid/systematic POI search, and no repeated scheduled run. Each
cached response retains the exact query, timestamp, URL, byte count, SHA-256, result set, policy URL, and
OpenStreetMap/ODbL attribution. An empty name-plus-normalized-address query may receive one address-only
fallback. A coordinate is eligible only if it is a name-matched lodging POI or an exact house-number and
road match in Da Nang; coarse results are stored but rejected. The service and source are replaceable and
are not exposed as an application feature.

### First frozen sampling frame: Barcelona

`data/reference/accommodation_property_panels_2026_2027.json` contains the first audited property frame.
It joins two open official sources by the stable `HB-xxxxxx` registration id:

- the Generalitat de Catalunya Tourism Register supplies active status, municipality, hotel modality,
  star category, address, and capacity;
- Barcelona City Council's hotel datastore supplies latitude and longitude.

The July 2026 register snapshot contains 112,752 rows and is retained by retrieval timestamp plus SHA-256
checksum. After restricting to active Barcelona establishments with `Hotels -> Hotel -> Hotel` and an
exact one- through four-star category, 344 rows remain. Of those, 327 (95.06%) join to usable official
coordinates. The sampling centre is the component-wise median of those joined coordinates
(`41.38749043, 2.16952564`), chosen before price collection so the radius does not depend on observed
rates. Five joined properties lie beyond 5 km and 17 lack an official coordinate match, leaving 322
eligible in-radius properties: 40 one-star, 40 two-star, 110 three-star, and 132 four-star.

Within each star class, the frozen rank is the ascending SHA-256 hash of schedule id, city, country,
measure, a version label, and registration id. Registration id is the tie-break. Price, brand, capacity,
and website visibility are not inputs. The first 12 in each class form 48 primary properties; all 274
remaining in-radius properties form the ordered reserve pool. The 17 missing-coordinate and five
out-of-radius rows remain in the artifact as visible exclusions instead of disappearing during cleaning.

This is a sampling-frame milestone, not an accommodation-price result. Official property websites have
not yet been verified and no dated quote has been accepted. The register's `Hostal o pensió` group is not
treated as a youth hostel: it does not prove dorm-bed or hostel-private inventory. Barcelona's two hostel
measures therefore remain explicitly unavailable until a separate official youth-hostel frame is found.
This prevents a translation/classification error from silently contaminating the cheapest tiers.

### Second frozen sampling frame: Copenhagen

The same collection now contains a Copenhagen frame built from two current, free, no-key official
directories. Hotelstars Union's Denmark search is the classification and geolocation source; its own
site describes Hotelstars Union as the official European hotel-classification system. VisitCopenhagen,
the destination's official guide, supplies a separate 13-property hostel candidate universe and links
to each property's own site. Neither source states an open-data licence, so the artifact retains only the
factual fields needed for this private research frame, attributes both publishers, and records the exact
retrieval time, byte count, request body where applicable, and SHA-256 checksum.

The Hotelstars public search endpoint returned 309 Denmark records on 24 July 2026: 209 `Hotel` records
and 100 separate `Conference` products. Conference products are excluded before selection so a hotel is
not double-weighted through its meeting classification. Restricting the hotel records to planner-facing
one- through four-star classes leaves 201 records, all with usable official-directory coordinates: nine
two-star, 117 three-star, and 75 four-star properties nationally, with no one-star property. Five-star
records are outside the planner's published tiers and remain source-count exclusions.

The sampling centre is the component-wise median of the 29 eligible hotel records whose official city
field begins with `København`: `55.67250000, 12.56450000`. Applying the frozen 5 km radius to every
eligible Denmark record, rather than only matching the city label, retains one nearby `Valby` property
and produces 29 in-radius hotels: three two-star, 11 three-star, and 15 four-star. The price-blind SHA-256
rank makes all three two-star and all 11 three-star properties primary, and selects 12 four-star primary
properties plus three reserves.

The sparse classes are not papered over. The one-star panel is explicitly unavailable. The full two-star
universe has only three properties, below the pre-registered minimum of five accepted quotes per season,
so it is frozen but cannot materialize a direct estimate under the current rule. VisitCopenhagen's 13
hostel links are retained as candidates, not yet ranked: each direct site must still prove a Copenhagen
address within 5 km and the relevant dorm-bed and/or private-room inventory. This is precisely why the
version 2 panel contract separates properties from per-measure rankings: one hostel can legitimately
enter both panels after verification without being duplicated as two establishments.

This also remains a sampling-frame result, not a price or accuracy result. The directory supplied 65
websites across the 201 national hotel records and 13 hostel links, but all 78 are merely source-listed;
none has passed ownership/public-booking verification and no dated accommodation quote has been
accepted. The legacy GuideDanmark JSON extract was rejected because its records were serialized in
2016, while direct GuideDanmark API access requires authentication and a commercial agreement, which is
outside the project's no-paid-API constraint.

### Third frozen sampling frame: Prague

Prague reuses the current, public, no-key Hotelstars Union search for hotel classification and
coordinates, and adds Prague City Tourism's official 12-property hostel directory plus all 12 official
destination detail pages. The latter are unusually useful: they expose address coordinates, direct
property websites, and prose that can establish dorm/shared and private-room inventory without inferring
either measure from the word `hostel` alone. Exact retrieval timestamps, page byte counts, page-modified
dates where published, request body, and SHA-256 checksums are frozen for all 14 source artifacts.

The Czech Hotelstars response contains 229 hotel rows, including repeated records for the same physical
property. After excluding four 5-star rows, the remaining 225 one- through four-star rows collapse to 148
physical properties using normalized name, street, street number, and postcode. Seventy-six identity
groups contain duplicate rows. Class and city must agree inside every group. Coordinates are combined by
component-wise median only when their maximum pairwise separation is at most 0.25 km; four materially
conflicting groups remain visibly ungeolocated rather than receiving an arbitrary coordinate.

The price-independent centre is the component-wise median of the 18 deduplicated eligible hotels whose
official city field starts with `Praha`: `50.07870000, 14.43375000`. The full physical-property frame has
25 eligible in-radius properties: ten with explicit dorm inventory, ten with explicit private-room
inventory, five 3-star hotels, and nine 4-star hotels. A hostel may appear in both measure panels but is
stored once. No 1-star or 2-star hotel remains within 5 km, so those measures are unavailable rather than
filled from another class. Luma Terra's official page verifies its location and website but does not state
dorm or private-room inventory; it is retained as geolocated and inventory-pending, not promoted.

Both hostel panels exceed the five-property minimum with ten properties each. The 3-star hotel panel
meets the gate exactly with five properties and the 4-star panel contains nine. All 34 measure-specific
ranked entries are primary because no eligible Prague measure reaches the 12-property target. These are
still source-listed websites, not verified owner booking paths, and no Prague accommodation price has yet
been accepted.

Reviewed source pages:

- https://www.hotelstars.eu/denmark/hotel-search
- https://www.hotelstars.eu/denmark/
- https://www.visitcopenhagen.dk/node/1570
- https://www.opendata.dk/open-data-dk/guidedanmark-oplevelser-overnatning-aktiviteter-i-hele-danmark
- https://api.guidedanmark.org/
- https://www.hotelstars.eu/czech-republic/hotel-search
- https://www.hotelstars.eu/czech-republic/
- https://prague.eu/en/ubytovani-kategorie/hostels/

All three builders consume downloaded source snapshots rather than silently refetching mutable data. They
reject any checksum drift and upsert only their own city, preserving the other frozen frames:

```text
npm run methodology:accommodation-panel:build:barcelona -- --register-csv <catalonia.csv> --geolocation-json <barcelona-hotels.json> --write
npm run methodology:accommodation-panel:build:copenhagen -- --hotelstars-json <hotelstars-denmark.json> --hostels-html <visitcopenhagen-hostels.html> --write
npm run methodology:accommodation-panel:build:prague -- --hotelstars-json <hotelstars-czech.json> --hostels-html <prague-hostels.html> --hostel-details-dir <prague-hostel-detail-pages> --write
```

Running any command with the frozen 24 July inputs reproduces the same collection SHA-256 rather than
changing row order, ranks, source metadata, or the other cities' frames.

## Adaptive Throughput And Checkpointing

The collection unit is one city/category call, not one entire city. This keeps prompts focused and makes
partial progress recoverable.

There is no project-defined numerical limit on calls per day, cities per day, or retries. Continue while
the provider permits free calls and the source evidence remains usable. A provider's actual free-tier
rate or quota response is the only call ceiling. When throttled, preserve the checkpoint, apply the
provider's retry guidance or a bounded backoff, and resume when free access is available. Repeatedly
inaccessible sources are recorded as missing instead of consuming unbounded retries.

After batch zero, use the observed success rate, review workload, and observations per call to size each
subsequent batch. The batch manifest records requested calls, completed calls, failures, accepted
observations, and remaining cities; it does not predict or enforce provider quotas.

Each successful call is appended to a date-stamped JSONL file only after schema validation. Re-running a
batch must be idempotent by `observationId`; duplicate ids are rejected. Progress is committed in small
auditable batches rather than held in an LLM conversation.

## Research Prompt Contract

Every free research call must:

1. Name one city, country, category, and pricing window.
2. Define the requested items and units exactly.
3. Require current public web research rather than model memory.
4. Require a source URL and retrieval date for every numeric observation.
5. Preserve the displayed currency and tax/fee treatment.
6. Capture displayed low/high ranges, counts, and date validity where present.
7. Return `missing` with a reason when evidence is unavailable.
8. Avoid derived tiers, AUD conversion, confidence labels, or unsupported narrative estimates.
9. Return JSON matching `city-cost-observation-v1` fields.

`src/lib/city-cost-research-response.ts` enforces this call contract, including complete accounting of
every requested measure as either observed or explicitly missing. Fixture-backed tests cover raw and
fenced JSON, assignment mismatches, missing coverage, the review gate, and prompt rendering.

A value mentioned only in a search snippet may enter the raw queue but cannot be marked `accepted` until
the definition, unit, and source page are verified.

## Batch Zero

Batch zero tests whether the free path produces enough auditable observations per call:

| City | Reason |
|---|---|
| Lisbon | Recheck the largest baseline-audit bias |
| Prague | Recheck the best-performing baseline city |
| Hanoi | Recheck the low-cost baseline city |
| Copenhagen | High-cost European stress test |
| Bangkok | Dense lower-cost market with broad public coverage |
| Pu Luong | Sparse-city stress test and missing-data path |

Collection order is Lisbon, Prague, and Hanoi first because their prior audit values provide immediate
comparisons. Copenhagen, Bangkok, and Pu Luong follow after the first checkpoint.

For each city, seek:

- inexpensive restaurant meal, mid-range meal for two, cappuccino, and domestic draft beer
- cocktail and wine only where directly observable
- dated dorm-bed, hostel-private, and hotel-room observations from selected official property pages
- official paid-attraction, half-day activity, and full-day/premium activity prices
- explicit missing records for items that cannot be supported

## Batch-Zero Success Measures

- at least 90% of accepted numeric observations have a directly inspected page rather than a snippet
- 100% have a URL, retrieval timestamp, original currency, unit, and extraction method
- zero accepted observations are sourced only from LLM memory
- observation schema validation passes with no duplicate ids
- at least four direct food/drink primitives are found for each dense city
- accommodation and activity success rates are reported separately
- accepted direct accommodation measures cover all three frozen seasons with at least five eligible
  panel-property quotes per season; partial panels remain visible but cannot materialize a tier
- calls used, observations returned, observations accepted, and minutes of review per city are measured

If the free path has poor coverage for a category, the methodology will report that category as sparse
and use a validated imputation model. It will not reopen the paid-API path without an explicit change from
the project owner.

## Scaling To All 121 Cities

After batch zero:

1. Run the 36-city candidate pilot in adaptive batches using all free calls actually available.
2. Measure source coverage and disagreement by region and category.
3. Refine prompts and validators using the pilot, without looking at the frozen holdout outcomes.
4. Process the remaining cities in deterministic manifest order.
5. Revisit failed/missing cells only after primary coverage is complete.
6. Independently recollect the holdout cities for accuracy measurement.

No elapsed-time estimate is attached to an invented daily quota. Throughput will be reported from the
observed calls-per-city and provider availability after batch zero. The checkpointed design allows the
work to proceed continuously when free capacity exists and resume without loss when a real limit is hit.
