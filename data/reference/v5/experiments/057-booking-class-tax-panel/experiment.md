# Experiment 057 - Booking class-average tax panel

## Hypothesis

Booking class-average pages may provide the exact city/class, two-adult/one-room basis, and a numeric 3-/4-star
nightly average; this experiment tests whether tax/fee treatment is also visible in the search result. A positive
result would only promote the source to a separate validation panel.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Amsterdam, Prague, Copenhagen, Dublin, Vienna, Budapest, Istanbul, Seoul, Sydney, Vancouver,
  Nairobi, and Buenos Aires.
- Exactly two ordered searches per call: Booking 3-star then Booking 4-star class page.
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence.
- Strict rows require exact city/class, explicit 2 adults and 1 room, numeric current class average, and known tax.

## Pre-registered promotion gates

- At least 8/12 strict rows for 3-star and at least 8/12 for 4-star.
- At least 6/12 cities complete for both classes.
- A pass authorizes only a separate source/aggregation validation; no product mapping or ratio fit follows.

## Results

The twelve-city panel produced **0/24 strict rows**: 3-star 0/12 and 4-star 0/12, with no complete city. Some
Booking class pages returned a current numeric average and, in a few cases, a two-adult/one-room selector, but
tax/fee treatment was not stated in the same evidence. Other results lacked a class average, had a wrong city or
class, or lacked same-evidence occupancy. The one-call panel therefore failed closed; see `results.json`,
`audit.json`, and `verdict.md`.

**Verdict:** reject promotion. Do not map or fit from Booking class averages under the frozen definitions.
