# Experiment 040 — explicit private-hostel two-guest search

## Hypothesis

Two highly targeted signed-out searches can expose a private-hostel room price with explicit two-adult or
two-guest occupancy often enough to support the product definition.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Six cities: London, Lisbon, Tokyo, Hanoi, New York City, and Melbourne.
- Exactly two ordered searches per call: Hostelworld then Booking.com.
- No page reads, retries, fallback sources, arithmetic, FX conversion, or cross-city facts.
- Accept only explicit two-adult/two-guest one-night private-hostel rows; generic private-room averages fail closed.

## Pre-registered verdict rules

- Promote to a broader source panel only if at least 3/6 cities pass the strict contract.
- If fewer than 3/6 pass, reject this source route as a production anchor and do not fit a correction from it.
- Any found rows remain source-feasibility evidence until an independent 30-city/10-holdout accuracy panel exists.
