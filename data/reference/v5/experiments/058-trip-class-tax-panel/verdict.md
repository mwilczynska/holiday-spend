# Experiment 058 verdict - reject Trip.com hotel-class tax route

## Decision

Reject the Trip.com class-page route under the strict contract. Do not map 2-, 3-, or 4-star prices, treat a
weekday/weekend average as a current two-person room price, or fit a class ratio from these results. Trip.com's
absence of a star-1 page is not evidence that a city lacks one-star hotels.

## Evidence

- Twelve independent single-city GPT-5.6 Luna-class contexts issued exactly three ordered searches each (Trip.com
  star-2, star-3, then star-4; 36 searches total).
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence were used.
- Strict coverage was **0/36**: 2-star 0/12, 3-star 0/12, and 4-star 0/12; no city was complete.
- Trip.com often exposed exact class pages and weekday/weekend or other city-class snippets, but the same evidence
  did not establish explicit two-adult/one-room occupancy and tax/fee treatment. Other rows were “from” prices,
  localized/stale displays, or lacked a numeric class average.

The route does not provide definition-compatible source facts in the one-call shape. Retain raw failures as negative
evidence and move to a materially different source or an explicitly pre-registered tax/price-statistic estimand.
