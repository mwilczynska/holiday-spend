# Experiment 061 - Expedia paired 2-/3-/4-star panel

## Hypothesis

The Expedia base-rate trend route can produce definition-compatible paired 2-, 3-, and 4-star observations in new
cities. Building complete matched cities is necessary before testing any simple class-ratio model; this panel does
not fit one.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve new cities: London, Toronto, New York, Santiago, Lima, Rio de Janeiro, Kuala Lumpur, Singapore, Mumbai,
  Cairo, Auckland, and Stockholm.
- Exactly three ordered searches per call: Expedia 2-star, 3-star, then 4-star.
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence.
- Strict rows require exact city/class, numeric non-from city-class average/trend, explicit two-adult source basis,
  reference window, valid currency, and tax status explicitly included or excluded.

## Pre-registered promotion gates

- At least 8/12 strict rows for each class.
- At least 6/12 cities complete for all three classes.
- A pass promotes only to a pooled 30-city/10-holdout source-and-basis validation. It authorizes no product mapping,
  ratio fitting, or tax normalization.

## Basis rule

Rows explicitly marked as Expedia base rates excluding taxes/fees remain `taxStatus: excluded`, separate from
tax-inclusive observations. Unknown tax treatment fails the strict row.

## Results

The twelve-city panel produced **26/36 strict rows**: 2-star 8/12, 3-star 8/12, and 4-star 10/12. Five cities were
complete, so the six-complete-city promotion gate failed even though each per-class coverage threshold passed. See
`results.json`, `audit.json`, and `verdict.md`.

**Verdict:** reject promotion, retain the paired rows as source evidence, and run a separate 3-star gap panel. No
product mapping or ratio fitting follows.
