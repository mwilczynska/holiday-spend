# Experiment 002 - independent all-tier anchor panel

## Hypothesis

Independent official menus, venue price lists, and operator tariff pages can supply enough comparable
ground truth to fit the food, drink, activity, and two-star accommodation derivations without circularly
scoring Numbeo or BudgetYourTrip against themselves.

## Pre-registered sample and window

- Development sample: the 25 cities in `validation-manifest-v6.json`.
- Measures: the eleven new v2 rows: inexpensive meal, midrange meal, McDonald's combo, cappuccino,
  domestic draft beer, half-day group activity, full-day premium activity, premium meal, cocktail, wine
  glass, and two-star room.
- Accommodation: Booking.com logged out, frozen 2026-09-17 to 2026-09-18, default Our top picks, all
  first-page eligible listings, median, with class inventory count.
- Food/drink: official venue menus or price lists only; Numbeo is prohibited. Expatistan is cross-check
  only. Wine follows the volume-targeted 125-175 ml / 15 cl method from v5 experiment 093.
- Activities: official attraction/operator pages only; BudgetYourTrip is prohibited.

## Acceptance and rejection

Each found row must satisfy the manifest selection rule, retain its source currency and URL, preserve all
individual prices in `samplePrices`, and have a positive median. Explicit `not_found`, `blocked`, `stale`,
or `class_absent` is a valid outcome after the source route and bounded retries are exhausted; it is never
converted to a plausible estimate. A batch artifact candidate is recorded and collection continues unless
more than 30% of the cities in that batch are candidates.

The panel is promoted to fitting evidence when every field has either a found observation or explicit
missingness in all 25 development cities, with no production-source ground truth. Coefficients are fitted
only from found, currency-normalized independent rows and receive leave-one-city-out residual intervals.

## Budget

At most eight bounded collection experiments per field. This first panel uses one research pass per city
and measure family; no coefficient is refit or gate is scored during collection.
