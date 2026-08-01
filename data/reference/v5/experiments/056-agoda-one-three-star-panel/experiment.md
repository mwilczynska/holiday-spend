# Experiment 056 - Agoda one-/three-star class panel

## Hypothesis

Agoda may expose class-specific one- and three-star prices with an explicit two-adult/one-room basis and tax
treatment, supplying the two classes needed for a possible simple accommodation relationship. This source family
has not yet been tested in the v5 one-city Luna production shape.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Amsterdam, Prague, Copenhagen, Dublin, Vienna, Budapest, Istanbul, Seoul, Sydney, Vancouver,
  Nairobi, and Buenos Aires.
- Exactly two ordered searches per call: Agoda 1-star then Agoda 3-star.
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence.
- Strict rows require exact city/class, explicit two-adult one-room one-night basis, numeric non-from nightly price,
  and known tax treatment.

## Pre-registered promotion gates

- At least 6/12 strict rows for 1-star and at least 6/12 for 3-star.
- At least 4/12 cities complete for both classes.
- A pass promotes only to a separately validated source/aggregation or paired-model experiment; no product mapping
  or ratio fit follows this panel.

## Results

The twelve-city panel produced **0/24 strict rows**: one-star 0/12 and three-star 0/12, with no complete city.
Agoda exposed some class/property and maximum-occupancy facts, but selected dates were required before a numeric
nightly price and tax basis appeared. The strict contract therefore failed closed.

**Verdict:** reject promotion. Do not map or fit from Agoda results; a new experiment would need a materially
different retrieval shape or estimand.
