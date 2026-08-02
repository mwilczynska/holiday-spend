# Experiment 089 — activity semantic calibration screen

**Status:** Complete — reject activity semantic calibration screen

## Question

Can the high-coverage BudgetYourTrip entertainment tiers be mapped to the frozen activity estimands, rather
than silently presenting reported-spend tiers as attraction/activity prices?

## Hypothesis

For cities with a complete BudgetYourTrip budget/mid-range/luxury row set, a single-city Luna call can find an
independent public price for a low-cost adult attraction ticket, a 3–6 hour group activity, and a 6+ hour premium
activity. If enough definition-matched rows are recovered, a simple global ratio or log-linear calibration can be
screened with city-level leave-one-out predictions. No mapping is accepted by this screen alone.

## Protocol

- Twelve independent GPT-5.6 Luna contexts, one city per context.
- Exactly three ordered searches per call: low-cost attraction, half-day group activity, full-day premium activity.
- Search/page retrieval is limited to the returned city; no retries, fallback sources, arithmetic, FX conversion,
  averaging, or cross-city evidence in the response.
- A strict row requires exact city, numeric non-`from` adult price, named ISO currency, public source URL/title,
  reference date/period, explicit tax status, and the matching ticket/duration/premium evidence.
- Official attraction/operator pages are preferred; a public signed-out operator or reputable activity listing is
  allowed only when the same evidence states the required basis. Member/login-only and checkout-only prices fail.
- The experiment compares only after deterministic code converts currencies using a versioned snapshot. The Luna
  response never performs arithmetic or FX.

## Screen gates and verdict rules

The screen requires at least 8/12 protocol-compliant calls, at least 8 strict rows in each anchor, and at least 6
cities with all three independent anchors. If it passes, fit only the pre-registered simple candidates (global
median ratio and log-linear ratio) on development cities and report held-out city-level error for the named
holdout. If it fails, reject this source/semantic route and keep BudgetYourTrip values as source-defined proxies;
do not map them to product fields.

This is not the final 30-city/10-holdout acceptance gate. A screen pass authorizes a broader 30-city collection and
locked validation only if the independent anchors are definition-compatible and the calibration is materially
identified.

## Results

All 12 calls were protocol-compliant. The deterministic audit accepted zero low-cost attraction-ticket rows, five
half-day group-activity rows, and four full-day premium-activity rows; no city supplied all three anchors. The
registered screen therefore fails all substantive coverage gates (8 rows per anchor and 6 complete cities). The
few compatible USD rows are too sparse to identify a calibration, and no ratio or product value was fitted.

**Verdict:** reject this activity semantic-calibration route. Keep the 080 BudgetYourTrip tiers labelled
`source_defined_proxy`; do not present them as the frozen ticket/half-day/full-day product estimands and do not
map or impute the activity fields from this panel.
