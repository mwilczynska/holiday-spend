# Experiment 023 — activity ground-truth audit

Date: 2026-07-31

## Hypothesis

The retained accepted-direct observation ledger may support a simple activity model even though target-model
search feasibility is weak. Before fitting anything, count definition-compatible city observations and apply
the frozen 30-city/10-holdout gate.

## Method

Run `node scripts/analyze-v5-activity-ground-truth.mjs` over the committed accepted direct observation JSONL
ledger. Count unique cities and rows for each activity anchor and complete cities containing all three anchors.
Do not treat search snippets, the shipping CSV, or modelled values as ground truth.

## Verdict rule

Fit no activity relationship unless every material target has at least 30 definition-compatible cities and a
locked holdout can contain at least 10 complete cities. Record the shortfall as a blocker, not as permission to
fit a proxy relationship.
