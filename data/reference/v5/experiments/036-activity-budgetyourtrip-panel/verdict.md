# Experiment 036 — verdict

**Verdict: promote the BudgetYourTrip activity source contract to methodology candidate; retain independent
scaling and accuracy gates.**

Ten independent one-city Luna calls covered seven development cities and three locked holdouts. Every call issued
exactly two BudgetYourTrip-restricted searches; all 20 searches/operations were protocol-compliant. Strict
coverage was **40/40**, with every city complete. All rows explicitly used one-person/day basis; no call used
reads, retries, fallback sources, scaling, arithmetic, FX conversion, averaging, or cross-city evidence.

The source contract is now strong enough for deterministic implementation design: `activities_free = 0`,
`activities_budget/mid/high` can be sourced from the labelled entertainment rows, and a two-person multiplier can
be applied locally without LLM arithmetic. However, the activity average equals the mid-range row in every city,
so that relationship is source behaviour rather than independent validation. Do not claim product accuracy until
the two-person scaling, tier interpretation, source-date drift, and locked holdout accuracy gates pass against
definition-matched ground truth.
