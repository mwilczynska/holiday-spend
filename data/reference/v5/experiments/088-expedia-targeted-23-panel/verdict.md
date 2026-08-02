# Experiment 088 verdict

**Outcome: reject targeted Expedia 2-/3-star coverage.**

The 15 independent one-city GPT-5.6 Luna contexts all obeyed the pre-registered two-search, search-only
protocol. The deterministic audit accepted 12 rows, but none formed a new 2-star/3-star pair. Pooled,
de-duplicated evidence therefore remains at 20 matched cities versus the required 30; the eight-new-pair and
pooled gates both fail. This is a source-coverage result, not an accuracy result.

The accepted rows and not-found reasons are retained for reproducibility. Bare-dollar Expedia rows remain
`found_proxy` with `currency: null`, and any exact-host currency label is an imputed provenance field rather
than observed currency. No coefficient, product mapping, or class split is authorized.

The query shape is rejected as a repair strategy. The next accommodation work must test a materially different
source/query or a pre-registered semantic calibration, while preserving the frozen estimand and independent
ground-truth requirements.

Reproduce with:

```text
cmd /c node scripts/analyze-v5-expedia-targeted-23-panel.mjs
```
