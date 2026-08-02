# Experiment 093 verdict

**Verdict: promote the retrieval contract; reject bottle-to-glass modelling.**

## Evidence

- 12 independent city contexts were tested.
- All 12 issued exactly the three registered searches and had zero retries,
  fallback sources, arithmetic, FX conversion, averaging, or cross-city evidence.
- 9/12 responses contained at least three positive red-wine prices from one
  exact-city public menu with an explicit 125–175 ml or 15 cl serving.
- The registered screen gate (at least 10 compliant calls and 8 strict rows)
  therefore passed.
- 9 same-currency joins to Experiment 091 were available. The median
  glass/bottle ratio was 0.727, with ratios from 0.001 to 3.704. This is not a
  stable production coefficient.

## Data-quality findings

The screen measures retrieval feasibility, not price accuracy. Dubai's source
displayed `$` while the response declared AED, and Hanoi reports amounts in
thousand VND. Those observations are retained with their evidence and must not
be silently normalized or used in a fit until a deterministic denomination and
currency audit exists. Tax treatment is also mixed or unknown.

## Decision

Use the explicit-volume query pattern in a future locked calibration study. Do
not derive a wine-glass product field from a bottle anchor, do not fit a global
ratio, and do not present any screen row as a production value without the
normalization and held-out validation gates. The v5 Definition of Done remains
unmet.
