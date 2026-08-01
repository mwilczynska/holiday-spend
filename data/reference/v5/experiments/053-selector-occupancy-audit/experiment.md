# Experiment 053 - selector-based occupancy semantic audit

## Hypothesis

Hotel search results that explicitly select two adults for a one-night stay may be usable as a relaxed one-room
semantic when the snippet omits the words “one room”. This could address the dominant blocker in Experiment 052,
but it must not be treated as explicit room occupancy without validation.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Amsterdam, Prague, Copenhagen, Dublin, Vienna, Budapest, Istanbul, Seoul, Sydney, Vancouver,
  Nairobi, and Buenos Aires.
- Exactly three ordered searches per call: Google Hotels, Expedia, Booking.com.
- No page reads, retries, arithmetic, FX conversion, averaging, or cross-city evidence.
- Record both strict explicit-one-room status and the pre-registered selector-relaxed status.

## Pre-registered decision rules

- Strict status remains the frozen data-dictionary contract.
- A selector-relaxed candidate requires exact city, named 3-star class, numeric non-from nightly price,
  tax/fee treatment, and explicit two-adult/one-night selector evidence, with no multi-room, per-person, suite,
  nearby-city, generic-average, login-only, or unknown-tax signal.
- Promote the relaxed hypothesis to an independent ground-truth validation panel only if at least 8/12 cities
  pass the relaxed contract and at least 6/12 remain strict failures attributable solely to omitted room wording.
- Do not map, aggregate, fit, or overwrite `accom_3_star` from this audit. Any promotion requires a new
  30-city/10-holdout explicit-room comparison and a dated estimand decision.

## Results

The twelve-city panel produced **0/12 strict** explicit-one-room quotes and **7/12 selector-relaxed** candidates.
All seven relaxed rows had exact-city named 3-star evidence, a two-adult one-night selector, numeric non-from
nightly prices, and known tax treatment, but omitted explicit one-room wording. The 8/12 relaxed promotion gate
therefore failed, even though the six-failure condition was met.

**Verdict:** reject promotion. The relaxed label remains a semantic hypothesis only; no `accom_3_star` mapping,
aggregation, or correction fit is permitted. Read `results.json`, `audit.json`, and `verdict.md` for the
deterministic scoring and per-city evidence.
