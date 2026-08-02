# Experiment 092 verdict

**Outcome: wine-glass calibration rejected; cocktail evidence retained for future validation.**

The 12 independent one-city Luna contexts all followed the exact three-search protocol, with public page reads
recorded and no retries, fallback sources, arithmetic, FX, averaging, or cross-city evidence. The deterministic
audit accepted 12/12 standard-cocktail medians but only 4/12 strict wine-glass medians. Wine failures were caused by
missing pour volume, nonstandard 10–12 cl pours, or otherwise incompatible menus; no substitution or conversion was
made.

Ten cocktail rows matched Expatistan in the same currency. Their direct-menu/Expatistan ratio had median 0.917,
but the city ratios ranged from roughly 0.54 to 1.55, so this is a dispersion screen, not an accepted coefficient.
The four wine-glass matches are too few for calibration. **No product drink field is mapped, and no bottle-to-glass
factor is fitted.**

Reproduce with:

```text
cmd /c node scripts/analyze-v5-drink-menu-calibration.mjs
```
