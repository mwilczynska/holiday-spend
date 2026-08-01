# Experiment 075 - targeted Expedia class-gap panel

## Hypothesis

The pooled Expedia source may be close to a usable 2/3/4-star accommodation model: Experiment 064 had 20 matched
2↔3 cities and 22 matched 3↔4 cities, just below the 30-city relationship gate. A targeted fresh panel aimed at
cities missing one or more classes may close the coverage gap without changing the strict two-adult, tax-excluded
class-trend contract.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Fresh calls for Auckland, Buenos Aires, Cape Town, Sydney, Sofia, Rio de Janeiro, Kuala Lumpur, Santiago,
  Bucharest, Cairo, Doha, and Brisbane.
- Exactly three ordered Expedia-restricted searches per call: 2-star, 3-star, then 4-star class trend.
- No page reads, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.
- Accept only exact city/class numeric non-`from` nightly city class averages or trends for two adults, named currency,
  reference window, and explicit tax treatment. The source's base-rate tax exclusion is retained; no tax adjustment is
  made.
- Rows remain source evidence only. No model fitting or product mapping occurs in this panel.

## Pre-registered pooled gate

After deterministic deduplication against Experiments 028, 029, 059, 060, 061, and 063 (new 075 rows have precedence
only for the same city/class key), report both new and pooled coverage. The panel passes its coverage objective only if
the pooled evidence reaches at least 30 matched cities for both `hotel_2_from_3` and `hotel_4_from_3`, while at least
10/12 calls remain protocol-compliant. A relationship reaching the threshold is still not fit-eligible until its
city-level development/holdout split and ten locked holdout cities are pre-registered independently.

If either relationship remains below 30, reject the pooled fitting ceiling and retain all rows without fitting.

## Results

All twelve fresh calls were protocol-compliant and produced 15 strict class rows: 2-star 4, 3-star 7, and 4-star 4.
After deterministic deduplication against Experiments 028, 029, 059, 060, 061, and 063 (075 precedence for a repeated
city/class), the pool contains 81 rows across 36 cities. The matched relationship counts are 20 cities for 2↔3 and
23 cities for 3↔4. The 30-city target was not reached for either relationship; the pooled gate therefore failed.

**Verdict:** reject the pooled fitting-ceiling promotion. Retain all 15 strict rows as source evidence, but do not fit
coefficients, map hotel tiers, or treat the Expedia source as a validated production anchor. A future panel would need
to add genuinely new matched cities and preserve the 30-city plus ten-locked-holdout requirement. See `results.json`
and `audit.json` for the deterministic audit.
