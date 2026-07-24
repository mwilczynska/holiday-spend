# Free-Only City Cost Collection And Batch Zero

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

## Free Source Hierarchy

| Category | First choice | Secondary evidence | Explicit fallback |
|---|---|---|---|
| Food and drinks | Public Numbeo city pages reached through LLM web search | Public menus, official venue pages, other publicly accessible city-price pages | Missing; later impute from the validated model |
| Hostel accommodation | Dated public rates on official hostel sites for a deterministic panel drawn from an official accommodation register | Another eligible panel property selected by the frozen reserve order | Missing |
| Hotel accommodation | Dated public rates on official property sites for a deterministic registered-property panel stratified by star class | Another eligible panel property selected by the frozen reserve order | Missing |
| Activities | Official attraction or tour-operator price pages | Official destination/tourism pages that publish a matching current price | Missing |
| FX | Public ECB reference-rate pages/data | Another official central-bank source | Freeze the last verified public rate and flag age |
| Seasonality | Eurostat, national tourism bodies, public destination calendars | Observed cross-date accommodation dispersion | `unknown`, never assumed away |

Public availability does not automatically grant unrestricted reuse. Numbeo is used under its
personal-use-with-attribution terms, through reviewed page-by-page lookups rather than a scraper,
crawler, or paid API. Other calls must also stay within normal browsing behaviour, respect access
controls, and avoid attempts to bypass blocks, logins, CAPTCHAs, or explicit restrictions. The stored
record contains facts needed for audit, not copied page content.

### Accommodation source-access decision

Booking.com and Hostelworld are excluded as price-extraction sources for the version 3 accommodation
panel. Booking.com's current consumer terms expressly cover unauthorized use by automated means or an
automated assistant, including assistants that interact with a browser. Hostelworld permits personal,
non-commercial booking use but restricts robots, scrapers, automated means, and manual processes used for
purposes outside its terms. The reviewed terms are retained as the decision evidence:

- https://www.booking.com/content/terms.en-gb.html
- https://www.hostelworld.com/legal/hostel-terms-and-conditions/

This is a source-design decision, not a claim that publicly displayed prices cannot be factual evidence.
The project does not need those channels: each city's sampling frame will instead be built from an
official tourism or accommodation register, frozen with a deterministic selection seed and reserve
order, and the price will be read from the selected property's own public booking page. Property pages
are still checked individually for access conditions. Login-only, member-only, mobile-only, blocked, or
tax-ambiguous rates are missing observations, not invitations to work around the restriction.

The panel design follows the same properties through low, shoulder, and high seasons where availability
allows. This reduces property-mix confounding. Each city/measure/season targets 12 properties, requires at
least five accepted quotes, and requires at least 60% panel overlap across seasons. The city point
estimate gives each season equal weight by taking the median of the three seasonal medians, so a season
with more visible inventory cannot dominate the annualized reference rate.

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
