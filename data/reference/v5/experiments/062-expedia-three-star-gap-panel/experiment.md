# Experiment 062 - Expedia three-star gap panel

## Hypothesis

The four missing 3-star rows in Experiment 061 may be query-sensitive. An exact-class 3-star search may recover
enough rows to complete the paired source panel; this experiment does not change the 061 gate or fit a model.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: the four Experiment 061 3-star misses (Cairo, Kuala Lumpur, Mumbai, and Santiago) plus eight new
  cities (Manila, Oslo, Athens, Zurich, Brussels, Johannesburg, Ho Chi Minh City, and Montreal).
- Exactly one ordered Expedia-restricted 3-star search per call.
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence.
- Strict rows require exact city/class, numeric non-from city-class average/trend, explicit two-adult source basis,
  reference window, valid currency, and tax status explicitly included or excluded.

## Pre-registered promotion gates

- At least 8/12 strict rows overall.
- At least 3/4 strict recoveries among the four Experiment 061 misses.
- This panel can repair source coverage only. It cannot amend Experiment 061's gate, authorize mapping, or authorize
  fitting; pooled modelling still requires 30 complete matched cities and 10 locked holdouts.

## Results

The panel produced **4/12 strict rows** overall: Athens, Ho Chi Minh City, Manila, and Zurich. None of the four
Experiment 061 recovery cities produced a qualifying 3-star row, so both the overall 8/12 and recovery 3/4 gates
failed. See `results.json`, `audit.json`, and `verdict.md`.

**Verdict:** reject coverage repair, retain the four strict rows as evidence, and reassess the pooled Expedia source
and modelling boundary. Do not map or fit.
