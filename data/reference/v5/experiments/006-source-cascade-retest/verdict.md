# Verdict — revise and retest

Experiment 006 improved coverage from **20/90 (22.2%)** to **30/90 (33.3%)**.

- Accommodation rose from 0 to 6 facts: five dorm observations and one explicit private double room.
- Activities rose from 0 to 4 facts: one adult attraction ticket in each well-covered city.
- Don Det improved from 0 to 1 fact through a city-specific dorm listing.
- The original 20 Numbeo food/drink facts were retained.
- No hotel-star class prices were compatible.
- No half-day or full-day adult activity price satisfied the required duration/type basis.
- All five contracts retained 18 keys and emitted no arithmetic, FX, tiers, or unsupported facts.

The cascade materially improves search allocation, but direct extraction of 18 anchors remains unsuitable
for production: two thirds of requested facts are still missing, hotel classes remain completely
unresolved, and duration-specific activities remain completely unresolved. The next candidate should
reduce the required observed anchor set rather than lengthen the cascade, then validate deterministic
models for the omitted targets.

This remains a no-key delegated prompt pilot. Exact provider model ID, parameters, tokens, latency, and
cost are unavailable through orchestration and still require separate production-path measurement.

