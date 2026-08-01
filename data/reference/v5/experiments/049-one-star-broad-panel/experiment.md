# Experiment 049 — broad one-star property panel

## Hypothesis

Broadening the one-star property search to Google Hotels, Expedia, and Hotels.com across a city-stratified panel
will produce enough explicit two-adult, tax-resolved one-star quotes to establish direct ground truth.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Amsterdam, Prague, Copenhagen, Dublin, Vienna, Budapest, Istanbul, Seoul, Sydney, Vancouver,
  Nairobi, and Buenos Aires.
- Exactly three ordered searches per call: Google Hotels, Expedia, Hotels.com.
- No page reads, retries, arithmetic, FX conversion, averaging, or cross-city evidence.

## Pre-registered verdict rules

- Promote to a broader calibration/aggregation design only if at least 6/12 cities pass the strict quote contract.
- Accepted rows remain named-property ground truth. No city average, correction, or product mapping follows this
  panel without an independently declared selection/aggregation rule and 30-city/10-holdout validation.

## Results

The twelve-city panel produced **1/12 strict one-star quotes** (Amsterdam only). Each city used exactly three
ordered searches (36 total), with no reads, retries, arithmetic, FX conversion, averaging, or cross-city evidence.
The other cities failed on absent occupancy, wrong star class, from/lowest prices, missing tax treatment, or no
numeric nightly quote.

**Verdict:** reject the broad one-star route. Preserve Amsterdam as a ground-truth candidate only; do not map or
fit `accom_1_star` from this panel.
