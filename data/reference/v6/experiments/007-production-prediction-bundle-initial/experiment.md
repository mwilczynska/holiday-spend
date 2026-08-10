# Experiment 007 — initial provider-mode prediction-bundle attempt

**Status:** superseded by experiment 006.

This is the preserved first attempt to generate production predictions directly in the local checkout.
It ran the real `collectCityCostV6Anchors -> materializeCityCostV6` path for the 25 development cities,
but no supported provider credential was configured. Every city therefore failed closed as `not_run` and
no prediction was fabricated.

Experiment 006 generalises the proven delegated collection route: delegated agents supply schema-validated
raw spine responses, and the local Stage-B generator runs the same shipped materializer deterministically.
