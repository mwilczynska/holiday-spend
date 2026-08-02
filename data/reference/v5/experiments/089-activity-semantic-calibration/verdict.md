# Experiment 089 verdict

**Outcome: reject activity semantic calibration.**

The 12 independent one-city GPT-5.6 Luna calls all obeyed the exact three-search, search-only protocol. The strict
audit accepted 0/12 low-cost adult attraction tickets, 5/12 half-day group activities, and 4/12 full-day premium
activities; zero cities had all three independent anchors. The pre-registered screen required at least 8 rows in
each anchor and 6 complete cities, so it fails before any model fitting. Compatible USD matches to the
BudgetYourTrip baseline were only 0, 1, and 2 rows respectively and cannot support a calibration.

Failures were honest semantic exclusions: missing explicit tax treatment, `from`/starting prices, insufficient
duration, missing party or premium basis, stale or non-current pages, or otherwise incompatible ticket evidence.
No arithmetic, FX conversion, ratio, or product mapping was performed.

Retain all raw JSON and not-found reasons as source/access evidence. The BudgetYourTrip 080 values remain
`source_defined_proxy` and must not be presented as observed ticket, half-day, or full-day activity prices.

Reproduce with:

```text
cmd /c node scripts/analyze-v5-activity-semantic-calibration.mjs
```
