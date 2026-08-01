# Experiment 076 - HOTEVI grouped hotel-tier proxy panel

## Hypothesis

HOTEVI's public research dataset can provide a current, repeatable city-level hotel anchor through its published
monthly average rates for budget (1–2 star), mid-range (3 star), and luxury (4–5 star) groups. The source defines a
standard-room rate but does not yet establish the product's explicit two-adult occupancy or tax basis. It is therefore
tested as a source-defined proxy, not as observed product ground truth.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Bangkok, Lisbon, London, Paris, Rome, Prague, Tokyo, Hanoi, New York City, Sydney, Cape Town, and
  Mexico City.
- Exactly two ordered web operations per call: search for the HOTEVI research dataset, then read the exact public
  research page returned (`https://hotevi.com/research`).
- No second search/read, retries, fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.
- Extract only the target city's table row and all three published groups: budget (1–2 star), mid-range (3 star), and
  luxury (4–5 star). Do not treat another city's row as evidence.
- Accept a row only with a numeric USD price, monthly-average statistic, standard-room unit, source-defined group,
  source URL/title, reference period, and evidence text. Tax status is `unknown` when the page does not state tax/fee
  treatment; unknown tax rows are proxy candidates and cannot be compared with tax-resolved observations.
- The LLM performs no arithmetic or tier splitting. Deterministic code performs only coverage counting in this screen.

## Pre-registered screening gate

- At least 8/12 cities have all three strict grouped rows.
- At least 10/12 calls are protocol-compliant.

A pass authorizes independent calibration of the grouped proxy against definition-compatible explicit two-adult rows; it
does not authorize mapping any grouped row to `accom_1_star` through `accom_4_star`, splitting the 1–2 or 4–5 groups,
or fitting a correction. A failure rejects this exact source/query boundary.

## Results

All twelve calls were protocol-compliant and all twelve cities produced all three strict grouped rows (36/36 rows).
The source table reports monthly average USD rates for budget (1–2 star), mid-range (3 star), and luxury (4–5 star)
groups. Every row has `occupancyBasis: source_defined_standard_room` and `taxStatus: unknown`; the page does not
expose the index month, only a July 2026 retrieval/citation note. New York City is represented by HOTEVI's explicit
`New York | United States` source row and is retained as a documented canonical alias, not a silent string match.

**Verdict:** promote only to independent proxy calibration. Do not split the grouped tiers, infer individual stars,
assume two-adult occupancy or taxes, fit coefficients, or map any product value. The complete source screen passes
(12/12 complete and 12/12 compliant), but the source-defined proxy basis remains unresolved.
