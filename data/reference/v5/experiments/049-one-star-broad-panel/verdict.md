# Experiment 049 verdict — reject broad one-star property route

## Decision

Reject the one-star property route for insufficient coverage. Do not map it to `accom_1_star` or fit a correction.
Preserve Amsterdam’s quote as a single ground-truth candidate and retain all failure reasons.

## Evidence

- Twelve independent single-city Luna-class contexts: Amsterdam, Prague, Copenhagen, Dublin, Vienna, Budapest,
  Istanbul, Seoul, Sydney, Vancouver, Nairobi, and Buenos Aires.
- Exactly three ordered searches per city (36 total): Google Hotels, Expedia, Hotels.com.
- No page reads, retries, arithmetic, FX conversion, averaging, or cross-city evidence.
- Strict accepted quotes: **1/12** — Hotel Not Hotel, Amsterdam. The 6/12 promotion gate failed.
- Common failures: absent explicit occupancy, wrong star class, from/lowest pricing, no tax treatment, or no numeric
  nightly quote.

This confirms that a cheap-model search cascade cannot reliably source definition-matched one-star property ground
truth under the current public snippets. A future one-star solution needs a materially different source or an
explicitly validated imputation/product-semantic decision; no unsupported class substitution is allowed.
