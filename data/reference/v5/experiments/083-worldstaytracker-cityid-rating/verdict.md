# Experiment 083 verdict

**Reject promotion.** The twelve independent one-city calls were protocol-compliant (12/12): one search, one returned
page read, and one direct read after changing only the `rating` parameter. The deterministic audit accepted six strict
3-star rows and zero strict 4-star rows, so zero cities were complete and the 10/12 screen failed. Every direct 4-star
read was unsafe or unavailable; no fallback search was permitted. Retain the 3-star observations and access failures as
labelled source evidence only. Do not map product tiers, remove breakfast, or fit coefficients.
