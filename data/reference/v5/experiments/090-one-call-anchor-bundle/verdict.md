# Experiment 090 verdict

**Outcome: reject complete one-call anchor bundle.**

All 12 independent one-city Luna contexts obeyed the exact five-search protocol, so the protocol feasibility gate
passed. Coverage did not: five Numbeo food/drink inputs were accepted in 8/12 cities, all three BudgetYourTrip
activity rows in 8/12, Expedia supplied only four 3-star and two 4-star rows, and zero rows qualified for 2-star,
hostel dorm, private hostel, one-star, cocktail, or wine-glass measures. No city had a complete food/drink, hotel,
hostel/one-star, or all-anchor bundle.

This is a source-boundary result, not a product methodology. BudgetYourTrip rows remain source-defined reported-
spend proxies; Expedia rows retain source-defined occupancy/currency/tax provenance. No arithmetic, FX conversion,
coefficient fitting, imputation, or product mapping was performed.

The five-search bundle is rejected as sufficient for generating all 19 fields in one request. Preserve partial rows
for future source/model work and require explicit evidence or a separately validated model for every missing class.

Reproduce with:

```text
cmd /c node scripts/analyze-v5-one-call-anchor-bundle.mjs
```
