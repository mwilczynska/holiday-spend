# Experiment 063 - Expedia paired 2-/3-/4-star panel, tranche 2

## Hypothesis

The surviving Expedia source can add more complete 2-/3-/4-star cities when tested on a fresh geographic tranche.
Experiment 062 ruled out a narrow 3-star retry as a repair; this panel instead collects new paired cities toward the
30-city complete-case requirement without fitting or changing definitions.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve new cities: Melbourne, Brisbane, Perth, Los Angeles, Chicago, Miami, Dubai, Doha, Bucharest, Sofia,
  Belgrade, and Tallinn.
- Exactly three ordered searches per call: Expedia 2-star, 3-star, then 4-star.
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence.
- Strict rows require exact city/class, numeric non-from city-class average/trend, explicit two-adult source basis,
  reference window, valid currency, and tax status explicitly included or excluded.

## Pre-registered promotion gates

- At least 8/12 strict rows for each class.
- At least 6/12 cities complete for all three classes.
- A pass authorizes only pooled 30-city/10-holdout source-and-basis validation. It does not authorize product mapping,
  ratio fitting, or tax normalization.

## Results

The twelve-city tranche produced **15/36 strict rows**: 2-star 2/12, 3-star 7/12, and 4-star 6/12. Only Chicago
was complete, so every promotion gate failed. See `results.json`, `audit.json`, and `verdict.md`.

**Verdict:** reject the paired tranche, retain strict rows for a pooled source-ceiling audit, and do not map or fit.
