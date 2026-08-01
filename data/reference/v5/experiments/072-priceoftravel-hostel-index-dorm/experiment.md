# Experiment 072 - Price of Travel Hostel Index dorm anchor

## Hypothesis

Price of Travel's public Hostel Index is a production-feasible dorm anchor because its methodology defines a shared
dorm-bed price for one person, includes taxes and fees, and uses a fixed reference window. Deterministic code can
multiply the one-bed input by two to obtain the product's two-bed dorm cost without asking the LLM to calculate.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Bangkok, Lisbon, London, Paris, Rome, Prague, Tokyo, Hanoi, New York City, Sydney, Cape Town, and
  Mexico City.
- Exactly two ordered operations per call: search for the exact Price of Travel Hostel Index row, then open the exact
  Price of Travel Hostel Index page returned by that search.
- No second search/read, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.
- Accept only an exact-city row that states a named hostel or index observation, one person in a shared dorm bed,
  numeric price per night, named currency, taxes/fees basis, and reference dates/window. `from`, range, country-only,
  private-room, and unlabelled generic hostel prices fail closed.
- The LLM reports the one-bed source fact. Deterministic code owns the fixed factor of two; this experiment does not
  materialize or map the product field.

## Pre-registered screening gate

- At least 8/12 strict one-bed rows.
- At least 10/12 protocol-compliant calls.

A pass authorizes a separate two-bed scaling and independent accuracy validation. It does not authorize immediate
product mapping; the final validation still requires at least 30 definition-compatible matched cities with 10 locked
holdout cities.

## Results

The deterministic analyzer found 12/12 protocol-compliant calls and 12/12 strict one-person shared-dorm rows, passing
the pre-registered screening gate. Every row uses the same Price of Travel Hostel Index page and its stated Thursday/
Friday mid-April 2023 reference window; the source methodology says taxes and fees are included. Values are one-person
inputs only and are not current 2026 quotes.

**Verdict:** promote to a separate two-bed scaling and independent accuracy validation. Do not yet map
`accom_shared_hostel_dorm`; the index is stale relative to the retrieval date and its selected-hostel statistic must be
compared with a locked, definition-compatible benchmark before production use.
