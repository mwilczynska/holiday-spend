# Experiment 091 verdict

**Outcome: promote source coverage to calibration only.**

The 12 independent one-city GPT-5.6 Luna calls obeyed the exact two-search protocol. The audit accepted 10/12
standard cocktail rows and 12/12 red-wine-bottle rows, passing the registered screen. Lisbon and London cocktail
results were comparison-only and remained `not_found`.

This is not product validation. The cocktail statistic is source-defined, tax treatment is unknown, and the wine
measure is explicitly a good-quality red-wine **bottle**, not a standard glass. No bottle-to-glass factor, FX,
arithmetic, or product mapping was performed. **Verdict:** retain the rows as labelled source evidence and promote
only to a separately pre-registered independent cocktail panel and bottle-to-glass calibration.

Reproduce with:

```text
cmd /c node scripts/analyze-v5-expatistan-drink-anchors.mjs
```
