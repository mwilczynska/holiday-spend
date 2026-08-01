# Experiment 083 — World Stay Tracker cityid/rating URL panel

**Status:** Complete — reject promotion

## Question

Can one exact-city World Stay Tracker search provide a stable `cityid` whose 3-star and 4-star rating URLs can be
read directly, avoiding the search index's repeated 4-star-to-3-star misrouting while preserving the source contract?

## Hypothesis

The cityid URL parameter will yield strict 3-star and 4-star rows for at least 10/12 cities with one search and two
direct reads per city. Breakfast inclusion and popular-property selection remain explicit semantic warnings; this
experiment does not silently treat the source as room-only ground truth. **Rejected:** all 12 calls were protocol
compliant, but zero 4-star direct reads were available and zero cities were complete.

## Pre-registered protocol

- One independent GPT-5.6 Luna-class context per city.
- Exactly three ordered operations: one exact-city World Stay Tracker search; read the returned city page; read the
  same cityid page with only `rating=4` substituted for the returned rating parameter.
- No second search, retries, fallback source, arithmetic, FX conversion, or cross-city evidence.
- Accept only exact-city pages with numeric USD average, selected rating, dates/window, property count, and explicit
  2-adult/1-night/breakfast/review-score basis.
- A screen pass authorizes a separate 30-city semantic/accuracy calibration against independent room-only observations;
  it does not authorize product mapping or breakfast removal.
