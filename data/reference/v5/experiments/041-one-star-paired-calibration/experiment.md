# Experiment 041 — paired one-star source/calibration search

## Hypothesis

A single-city call can retrieve both a broad exact-city BudgetYourTrip one-star statistic and an independent
explicit two-adult one-star property quote, allowing later occupancy calibration without using ambiguous source
rows as observed product values.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Six cities across regions and cost bands: Madrid, Rome, Tokyo, New York City, Mexico City, and Cape Town.
- Exactly three ordered searches per call: BudgetYourTrip, Booking.com, Hotels.com.
- No page reads, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.
- City statistics and explicit property quotes are stored separately; neither maps directly to `accom_1_star`.

## Pre-registered verdict rules

- Promote paired calibration to a broader panel only if at least 3/6 cities contain both a valid city statistic
  and at least one valid explicit two-adult one-star quote.
- If fewer than 3/6 pair, retain whichever source channel is feasible but reject occupancy calibration from this
  route and do not fit a correction.
- Any later model still requires at least 30 complete matched cities, including 10 locked holdouts, with
  definition-compatible independent observations.
