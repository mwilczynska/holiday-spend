# Experiment 059 - Expedia two-adult class-trend panel

## Hypothesis

Expedia's public class-trend snippets may provide a scalable accommodation anchor: exact city/class, an explicit
two-adult nightly average/trend window, a named currency, and known tax treatment (normally a base rate excluding
taxes and fees). This is a broader validation of the strongest surviving class source after the Booking, Skyscanner,
Agoda, and Trip.com strict panels failed.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve new cities: Amsterdam, Prague, Vienna, Budapest, Istanbul, Seoul, Tokyo, Sydney, Vancouver, Buenos Aires,
  Mexico City, and Cape Town.
- Exactly three ordered searches per call: Expedia 2-star, 3-star, then 4-star.
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence.
- Strict rows require exact city/class, numeric non-from city-class average/trend, explicit two-adult source basis,
  reference window, valid currency, and tax status explicitly included or excluded.

## Pre-registered promotion gates

- At least 8/12 strict rows for each of 2-star, 3-star, and 4-star.
- At least 6/12 cities complete for all three classes.
- A pass authorizes a 30-city/10-holdout source-and-basis validation only. It does not authorize product mapping,
  ratio fitting, or combining the excluded-tax basis with tax-inclusive observations.

## Basis rule

Rows explicitly marked as Expedia base rates excluding taxes/fees are retained as `taxStatus: excluded`. They remain
separate from tax-inclusive rows and are not silently grossed up. Unknown tax treatment fails the strict row.

## Results

The twelve-city panel produced **27/36 strict rows**: 2-star 9/12, 3-star 11/12, and 4-star 7/12. Six cities were
complete. The complete-city sub-gate passed, but the pre-registered 4-star 8/12 gate failed, so the panel is a
near-pass rather than a promotion. All accepted rows explicitly state a two-adult base-rate trend and excluded
taxes/fees; no mapping or model fitting follows. See `results.json`, `audit.json`, and `verdict.md`.

**Verdict:** retain Expedia as the strongest source candidate and test the 4-star gaps separately; do not promote
the route or combine its excluded-tax basis with tax-inclusive observations.

## Results

The twelve-city panel produced **27/36 strict rows**: 2-star 9/12, 3-star 11/12, and 4-star 7/12. Six cities were
complete. The complete-city sub-gate passed, but the pre-registered 4-star 8/12 gate failed, so the panel is a
near-pass rather than a promotion. All accepted rows explicitly state a two-adult base-rate trend and excluded
taxes/fees; no mapping or model fitting follows. See `results.json`, `audit.json`, and `verdict.md`.

**Verdict:** retain Expedia as the strongest source candidate and test the 4-star gaps separately; do not promote
the route or combine its excluded-tax basis with tax-inclusive observations.
