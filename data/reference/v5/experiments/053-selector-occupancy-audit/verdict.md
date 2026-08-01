# Experiment 053 verdict - reject selector-relaxed promotion

## Decision

Reject the selector-relaxed occupancy hypothesis for promotion. Do not map any result to `accom_3_star`, fit a
correction, or silently reinterpret a two-adult selector as one-room evidence.

## Evidence

- Twelve independent single-city Luna-class contexts: Amsterdam, Prague, Copenhagen, Dublin, Vienna, Budapest,
  Istanbul, Seoul, Sydney, Vancouver, Nairobi, and Buenos Aires.
- Exactly three ordered searches per city (Google Hotels, Expedia, Booking.com; 36 total).
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence.
- Strict explicit-one-room coverage: **0/12**.
- Selector-relaxed coverage: **7/12**, below the pre-registered 8/12 promotion gate. All seven remain hypotheses
  whose source evidence omits explicit one-room wording; they are not observed two-person room prices.
- The 6/12 strict-failure condition was met, but both conditions were required and the relaxed coverage condition
  failed.

The result shows that the semantic amendment improves retrieval coverage but does not establish that the quoted
price is for one room. Any future change must be a dated estimand decision followed by at least 30 directly matched
explicit-room comparisons, including 10 locked holdouts. No product mapping follows this audit.
