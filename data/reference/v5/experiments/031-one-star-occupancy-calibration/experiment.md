# Experiment 031 — one-star occupancy calibration

Date: 2026-07-31

## Hypothesis

Momondo's repeatable 1-star candidates can become usable only if a second public source yields definition-matched
explicit two-adult/one-room observations for the same city and class. The source-default versus explicit pair may
support a correction later, but only after a 30-city/10-holdout panel.

## Production-shaped test

Each Luna-class invocation researches exactly one city and issues exactly three bounded searches: Momondo,
Skyscanner, and Expedia. There are no page reads, retries, arithmetic, FX conversion, source averaging, or
cross-city evidence. This tranche repeats Bangkok, San Francisco, and Nairobi independently because each has a
retained Momondo candidate from Experiment 030.

## Acceptance and stop rules

Accept only exact city-wide 1-star nightly rows with a numeric non-`from` value, source/date identity, and the
occupancy basis required by the measure. Count explicit two-adult rows separately from source-default/unknown rows.
This tranche is source and calibration feasibility only: do not map a candidate to `accom_1_star`, fit a ratio, or
use a source-default row as ground truth. Reject any city with no explicit two-adult row rather than substituting
a property quote or another class.
