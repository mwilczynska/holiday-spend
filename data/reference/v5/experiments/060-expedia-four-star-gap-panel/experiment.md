# Experiment 060 - Expedia four-star gap panel

## Hypothesis

The near-pass in Experiment 059 may reflect query sensitivity rather than a general lack of Expedia 4-star trend
coverage. A focused exact-class search may recover the five failed 4-star cities from that panel and establish whether
the same explicit two-adult, tax-excluded basis appears in additional cities.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: the five Experiment 059 4-star failures (Buenos Aires, Budapest, Cape Town, Sydney, Tokyo) plus
  seven new cities (Dublin, Berlin, Madrid, Rome, Paris, Warsaw, and Jakarta).
- Exactly one ordered Expedia-restricted 4-star search per call.
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence.
- Strict rows require exact city/class, numeric non-from city-class average/trend, explicit two-adult source basis,
  reference window, valid currency, and tax status explicitly included or excluded.

## Pre-registered promotion gates

- At least 8/12 strict rows overall.
- At least 4/5 strict recoveries among the five Experiment 059 failures.
- This panel can repair source coverage only. It cannot amend Experiment 059's 4-star gate, authorize mapping, or
  authorize fitting. Any combined source validation still requires 30 complete matched cities and 10 locked holdouts.

## Results

The panel produced **9/12 strict rows** overall and recovered **3/5** of the prior Experiment 059 misses (Budapest,
Sydney, Tokyo). Buenos Aires, Cape Town, and Warsaw remained not-found under the strict contract. The overall 8/12
sub-gate passed, but the pre-registered recovery gate of 4/5 failed. See `results.json`, `audit.json`, and
`verdict.md`.

**Verdict:** reject the coverage-repair gate, retain the recovered rows as source evidence, and continue a new-city
paired 2-/3-/4-star panel. Do not map or fit.
