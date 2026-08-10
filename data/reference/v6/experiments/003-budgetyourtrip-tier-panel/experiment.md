# BudgetYourTrip labelled tier-level daily panel

- **Hypothesis:** BudgetYourTrip publishes the product-level food and activity spend estimand more directly and consistently than sparse item-price panels.
- **Pre-registered sample:** 25 development cities, one city-scoped page call per city, six labelled per-person/day tiers per city.
- **Source policy:** Food is independent ground truth against production Numbeo. Activity is retained for production diagnostics only because production also uses BudgetYourTrip.
- **Selection rule:** `budgetyourtrip_labelled_tier_per_person_day_v1`: record the displayed budget, mid-range and luxury food and entertainment values, with the displayed currency, label, URL and evidence text; do not infer missing tiers.
- **Rejection rule:** Missing city page is explicit `not_found`; never substitute a country or neighbouring city. Do not score activity rows as independent truth.
- **Maximum calls:** 25.
