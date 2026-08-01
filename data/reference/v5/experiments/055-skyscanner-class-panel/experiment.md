# Experiment 055 - Skyscanner hotel-class average panel

## Hypothesis

Skyscanner class pages may expose city-level 1-, 2-, 3-, and 4-star average prices with an explicit two-adult,
one-room basis. This could provide a definition-compatible accommodation source or paired observations for later
model validation, but prior small panels do not establish broad coverage or tax comparability.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Amsterdam, Prague, Copenhagen, Dublin, Vienna, Budapest, Istanbul, Seoul, Sydney, Vancouver,
  Nairobi, and Buenos Aires.
- Exactly four ordered searches per call, one each for 1-, 2-, 3-, and 4-star Skyscanner class pages.
- No page reads, retries, arithmetic, FX conversion, averaging, fallback sources, or cross-city evidence.
- Strict rows require exact city/class, explicit 2 adults and 1 room, numeric non-from current class average, and
  known tax treatment.

## Pre-registered promotion gates

- Per-class strict coverage: at least 6/12 cities for 1-star and 2-star; at least 8/12 for 3-star and 4-star.
- At least 6/12 cities complete across all four classes.
- A pass promotes only to a separately validated source/aggregation experiment; no product mapping or ratio fit
  follows this panel.

## Results

The panel returned **0/48 strict rows**: 1-star 0/12, 2-star 0/12, 3-star 0/12, and 4-star 0/12; no city was
complete. Multiple 3-/4-star candidates had exact city/class and explicit 2-adult/1-room selectors, but tax
treatment was unknown or currency/class evidence was malformed. Lower classes were absent or ambiguous.

**Verdict:** reject promotion. Do not map, aggregate, or fit from these snippets. A materially different tax or
price-statistic estimand would require a new pre-registered experiment.
