# Experiment 058 - Trip.com hotel-class tax panel

## Hypothesis

Trip.com's public star-2, star-3, and star-4 city pages may expose exact city/class averages with a two-adult,
one-room basis and an explicit included/excluded tax status. This tests the accommodation source family under the
frozen v5 contract after the Booking, Skyscanner, and Agoda class panels failed on tax or occupancy evidence.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Amsterdam, Prague, Copenhagen, Dublin, Vienna, Budapest, Istanbul, Seoul, Sydney, Vancouver,
  Nairobi, and Buenos Aires.
- Exactly three ordered searches per call: Trip.com star-2, star-3, then star-4 class pages.
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence.
- Strict rows require exact city/class, explicit two-adult/one-room occupancy, numeric current city-class average,
  valid source currency, and tax status explicitly included or excluded.

## Pre-registered promotion gates

- At least 8/12 strict rows for each of 2-star, 3-star, and 4-star.
- At least 6/12 cities complete for all three classes.
- A pass authorizes only a separate source/aggregation validation. No product mapping or ratio fit follows this
  panel automatically, and Trip.com's lack of a star-1 page is not class-absence evidence.

## Results

The twelve-city panel produced **0/36 strict rows**: 2-star 0/12, 3-star 0/12, and 4-star 0/12, with no complete
city. Trip.com commonly exposed class-page weekday/weekend averages, but not explicit two-adult/one-room occupancy
and tax/fee status in the same evidence. Other rows were from prices, localized/stale displays, or missing numeric
averages. See `results.json`, `audit.json`, and `verdict.md`.

**Verdict:** reject promotion. Do not map or fit from Trip.com class-page results under the frozen definitions.

## Results

The twelve-city panel produced **0/36 strict rows**: 2-star 0/12, 3-star 0/12, and 4-star 0/12, with no complete
city. Trip.com commonly exposed class-page weekday/weekend averages, but not explicit two-adult/one-room occupancy
and tax/fee status in the same evidence. Other rows were from prices, localized/stale displays, or missing numeric
averages. See `results.json`, `audit.json`, and `verdict.md`.

**Verdict:** reject promotion. Do not map or fit from Trip.com class-page results under the frozen definitions.

## Evidence rule

Known excluded taxes are retained as a distinct source basis; they are not silently treated as included. Unknown tax
status fails the strict row. Rows from a source with a different tax basis cannot be combined with included rows
without a separately documented deterministic normalization.
