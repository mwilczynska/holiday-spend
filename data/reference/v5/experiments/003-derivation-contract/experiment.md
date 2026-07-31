# Experiment 003 — v5 derivation contract

**Status:** complete; deterministic contract retained as a candidate implementation boundary.

## Hypothesis

If collection produces definition-checked source-currency anchors and deterministic code owns FX and
arithmetic, one pure derivation function can materialize all 19 product values without hiding missingness
or presenting modelled inputs as observed.

## Pre-registered rules

- The function receives only post-FX `valueAud` anchors plus status and provenance metadata.
- It must not call a provider, fetch a page, infer an exchange rate, or use an unvalidated ratio.
- It must return all 19 named tiers on every call.
- `activities_free = 0` is definitional and excluded from accuracy scoring.
- Missing, blocked, not-found, and class-absent anchors remain unresolved; no fallback value is invented.
- A direct one-anchor tier may retain `observed`; a deterministic basket made from observed anchors is
  `derived`; modelled/imputed parents propagate `modelled`/`imputed` respectively.
- Every materialized tier carries its formula, parent anchors, source IDs, model versions, and imputed
  measures. `mcmeal_combo` is collected as an auxiliary anchor but is never silently substituted for
  street food.

## Sample and execution

The Vitest fixture contains all 18 extraction anchors, including the auxiliary McMeal anchor. Tests cover
complete materialization, fail-closed missingness, provenance propagation, contradictory status/value
rejection, and the no-McMeal-substitution rule.

Command:

```text
npx vitest run src/lib/city-cost-methodology-v5.test.ts
```

This is a contract test, not accuracy evidence. No model coefficients are selected or promoted here.
