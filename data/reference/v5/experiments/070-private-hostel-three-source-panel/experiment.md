# Experiment 070 - explicit two-guest private-hostel three-source panel

## Hypothesis

The two-source Experiment 040 screen may have understated private-hostel coverage. Adding a Google Hotels search and
retaining every qualifying named-property result may produce enough explicit two-guest private-room candidates to
support a later city-level basket anchor.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve stratified cities: London, Lisbon, Tokyo, Hanoi, New York City, Melbourne, Bangkok, Nairobi, Cape Town,
  Madrid, Rome, and Paris.
- Exactly three ordered searches per call: Hostelworld, Booking.com, then Google Hotels.
- Search only. No page reads, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.
- Preserve every candidate. A direct candidate must identify the exact city, a named hostel/private room, explicit
  two-adult or two-guest occupancy, a numeric standard non-`from` one-night room price, named currency, and tax/fee
  treatment. Generic private-room averages, lowest/from prices, dorm beds, hotels without hostel identity, and unknown
  tax status fail closed.
- A candidate is property-level evidence, not a city average. The analyzer counts candidates and cities only; it never
  chooses, averages, or maps them.

## Pre-registered screening gate

- At least 6/12 cities have at least one qualifying direct candidate.
- At least 10/12 calls are protocol-compliant.

A pass authorizes a new property-basket aggregation design and a 30-city/10-locked-holdout validation. It does not
authorize a product value or correction. A failure rejects this three-source search-only route at current reliability.

## Results

The deterministic analyzer found 12/12 protocol-compliant calls, 4/12 cities with at least one qualifying direct
candidate, and 5 accepted property rows. Accepted cities were Lisbon, Hanoi, Nairobi, and Cape Town. London, Tokyo,
New York City, Melbourne, Bangkok, Madrid, Rome, and Paris failed because snippets exposed `from`/sale prices,
ambiguous room or property class, missing occupancy, missing numeric prices, or no result.

The 4/12 city gate failed (required 6/12), so the search-only three-source route is rejected at current reliability.
The five rows remain property-level evidence only; no city basket, correction, scaling, or product mapping was created.
Any future private-hostel method must use a new pre-registered source/aggregation design and still meet the 30-city/
10-locked-holdout validation requirement.
