# Experiment 066 - BudgetYourTrip one-star semantic-basis audit

## Hypothesis

BudgetYourTrip exposes broad one-star city averages, but prior panels labelled their occupancy
`unknown_source_default`. The page itself may nevertheless define a two-person room and tax basis that was absent
from search snippets. If the definition is explicit on the same page, BudgetYourTrip could become a direct one-star
source candidate; if not, its rows remain an incompatible proxy and cannot calibrate or validate a one-star model.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Amsterdam, Budapest, Dublin, Seoul, Sydney, Vancouver, Buenos Aires, Cape Town, Mexico City,
  Tokyo, Jakarta, and Hanoi.
- Exactly one search followed by one page read of the best exact-city BudgetYourTrip hotel-by-star page.
- No second search, second page, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city
  evidence.
- Strict acceptance requires exact city and one-star class, numeric city statistic, explicit per-room/night unit,
  explicit two-person/two-adult occupancy, named currency, reference period, and explicit tax/fee treatment on the
  same source page.

## Pre-registered promotion gate

- At least 8/12 strict semantic rows and at least 6/12 cities with all required fields on the same page.

A pass authorizes only a larger 30-city/10-locked-holdout direct-source validation panel. It does not authorize
mapping, ratio fitting, tax normalization, or treating `unknown_source_default` as explicit occupancy. A failure
closes this semantic route and requires a materially different source or a separately documented product decision.

## Results

To be filled by the deterministic analyzer after all twelve one-city calls. Not-found, blocked, stale, and
class-absent outcomes must remain distinct.
