# Experiment 077 - HOTEVI explicit class/property quote panel

## Hypothesis

HOTEVI's individual public hotel pages may expose the missing evidence behind its grouped research proxy: exact city,
one-/three-/four-star class, a standard room for two adults, a numeric one-night price, dates, and fees/taxes. If so,
the same source could support direct anchors and independent calibration rather than relying on the grouped table.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Bangkok, Lisbon, London, Paris, Rome, Prague, Tokyo, Hanoi, New York City, Sydney, Cape Town, and
  Mexico City.
- Exactly six ordered web operations per call: for 1-star, 3-star, and 4-star in that order, search the public HOTEVI
  hotel pages and read the exact HOTEVI hotel page returned for each search.
- No second search/read, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.
- Accept only a named property in the exact city, explicit star class, one room for two adults, standard non-`from`
  numeric nightly price, named currency, explicit tax/fee basis, visible stay dates, source URL/title, and evidence.
  `from`, sale/member prices, packages, multi-night totals, occupancy-unknown, class-ambiguous, and missing-tax rows
  fail closed.
- The LLM reports facts only. No tier derivation, ratio, FX, or product mapping occurs in this screen.

## Pre-registered screening gate

- At least 6/12 cities have all three strict class rows.
- At least 8/12 strict rows for each class.
- At least 10/12 protocol-compliant calls.

A pass authorizes a larger definition-matched panel and 30-city/10-holdout validation. It does not authorize mapping
any row immediately. A fail rejects this direct HOTEVI page boundary while retaining the grouped table as proxy-only.

## Results

All twelve calls were protocol-compliant, but zero strict rows were recovered in any class (1-star 0/12, 3-star
0/12, 4-star 0/12) and zero cities were complete. Search results frequently returned the grouped research table,
wrong-city properties, cache misses, or pages without a date-bound two-adult amount and tax treatment. No grouped proxy
was leaked into a direct class row.

**Verdict:** reject the direct HOTEVI property-page boundary. Retain the grouped HOTEVI table as proxy-only; do not
map, split, scale, or fit any product tier from these direct-page attempts.
