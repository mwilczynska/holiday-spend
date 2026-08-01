# Experiment 052 — broad three-star property panel

## Hypothesis

The three-star hotel anchor is sourceable with explicit class and two-adult occupancy from Google Hotels, Expedia,
or Booking across a broader city panel, unlike the zero-coverage result in the minimal-anchor test.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Amsterdam, Prague, Copenhagen, Dublin, Vienna, Budapest, Istanbul, Seoul, Sydney, Vancouver,
  Nairobi, and Buenos Aires.
- Exactly three ordered searches per call: Google Hotels, Expedia, Booking.com.
- No page reads, retries, arithmetic, FX conversion, averaging, or cross-city evidence.

## Pre-registered verdict rules

- Promote to property-panel/ground-truth collection only if at least 6/12 cities pass the strict quote contract.
- Accepted rows remain named-property ground truth. No city average, correction, or product mapping follows this
  panel without an independently declared selection/aggregation rule and 30-city/10-holdout validation.

## Results

The twelve-city panel produced **0/12 strict three-star quotes**. Each city used exactly three ordered searches
(36 total), with no reads, retries, arithmetic, FX conversion, averaging, or cross-city evidence. Most candidates
had class, price, and tax but omitted explicit one-room occupancy; remaining failures were from prices, generic
averages, wrong classes, nearby cities, or missing class.

**Verdict:** reject the route. Do not map `accom_3_star` or infer one-room occupancy from a “2 adults” selector;
any relaxation requires a pre-registered estimand change and independent validation.
