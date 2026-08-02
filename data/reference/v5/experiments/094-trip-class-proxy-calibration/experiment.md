# Experiment 094 — Trip.com class proxy calibration

**Status:** Complete; reject proxy calibration

## Question

Can Trip.com's public city/star pages be retained as a labelled `source_defined_proxy` and calibrated against
independent Expedia class trends, rather than being silently treated as two-adult, tax-resolved observations?

## Hypothesis

Trip.com will produce numeric weekday class averages for enough exact cities/classes to serve as a cheap proxy. If
same-currency ratios to Expedia's explicit-two-adult, tax-excluded trends are sufficiently stable, the proxy may merit
a larger locked calibration study. This experiment does not change the frozen product estimand and cannot authorize
production mapping.

## Protocol

- Twelve independent GPT-5.6 Luna-class contexts, one city per context.
- Exactly three ordered Trip.com searches per city (2-star, 3-star, 4-star); public reads only for returned pages.
- No retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.
- A proxy row requires exact city/class, a numeric non-`from` weekday average, displayed ISO currency, source URL/title,
  and reference evidence. Occupancy and tax remain explicitly `unknown`; weekend values are retained separately.
- Expedia rows are existing source evidence with explicit two-adult, tax-excluded base-rate trends. They are an
  independent calibration comparator, not ground truth for the final product.

## Screen gates and decision rule

Require at least 10/12 protocol-compliant calls, 8 proxy rows for each class, 15 same-currency city/class pairs,
median APE ≤25%, and p90 APE ≤50%. A pass authorizes only a locked city-level calibration panel with a held-out
split. It does not fit a coefficient, remove the occupancy/tax labels, or map any product field. A failure preserves
Trip.com only as negative/proxy evidence and directs the next accommodation experiment elsewhere.

## Results and verdict

All 12 calls were protocol-compliant and all 36 class rows met the separate source-defined proxy contract. However,
only 12 rows joined an existing Expedia observation in the same displayed currency. Their median absolute error was
124.2%, p90 absolute error was 532.4%, and the median signed error was +124.2%. The screen therefore failed both the
pair-count and accuracy gates.

**Verdict: reject Trip.com class proxies for calibration and production mapping.** The proxy rows remain useful
negative/source-access evidence, but unknown occupancy and tax cannot be treated as a small semantic gap. Do not
relax the frozen accommodation estimand, fit a correction, or present these rows as observed two-person prices.
