# Experiment 067 verdict - source-level occupancy proxy does not meet coverage

## Decision

Reject promotion of the BudgetYourTrip source-level double-occupancy proxy. The twelve one-city Luna contexts
completed the exact protocol: two searches and two page reads per city, with no retries, fallbacks, arithmetic, FX,
or cross-city evidence. Only **1/12** cities (Cairo) joined an exact-city one-star numeric page with a same-source
double-occupancy statement. The screening gate required 8/12 proxy candidates; all 12 calls were protocol-compliant.

The Cairo value is retained as a labelled `proxy_candidate`, not an observed two-adult price. Other rows failed
because one page was blocked/timed out, the one-star class was absent or stale, or the two source pages could not be
joined. This is evidence that relaxing occupancy semantics alone does not provide a production-ready one-star
anchor at the observed web-tool reliability. Do not map or fit from the proxy. A different source/cascade or a
product decision about a modelled missing class is required.
