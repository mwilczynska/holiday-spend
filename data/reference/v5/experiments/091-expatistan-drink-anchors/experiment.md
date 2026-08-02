# Experiment 091 — Expatistan drink-anchor panel

**Status:** Complete — promote to calibration only

## Question

Can Expatistan's public city pages provide a repeatable standard cocktail and bottle-of-wine input for cities where
Numbeo has no cocktail or wine-glass rows?

## Hypothesis

Search snippets from exact Expatistan city pages will expose `1 cocktail drink in downtown club` and
`1 bottle of red table wine, good quality` with source currency and current reference context. The cocktail is a
candidate direct input. The bottle is not a wine-glass observation; any conversion to the frozen wine-glass field
must be a separately named model and cannot be performed by the LLM.

## Protocol

- Twelve independent GPT-5.6 Luna contexts, one city per context.
- Exactly two ordered Expatistan-restricted searches: cocktail, then bottle of red table wine.
- Search only: no page reads, retries, fallback, arithmetic, FX conversion, averaging, or cross-city evidence.
- Accept only exact-city page evidence with the canonical row label, numeric central value, named currency, public URL,
  and a reference/update context. Preserve source-defined units and do not call the bottle a glass.

## Screen gate and verdict

The screen requires at least 10/12 protocol-compliant calls and at least 8/12 accepted rows for each anchor. A pass
authorizes only a broader independent cocktail validation and a pre-registered bottle-to-glass calibration; it does
not map either product field automatically. A failure rejects Expatistan as a bounded production anchor.

## Results

All 12 calls were protocol-compliant. The deterministic audit accepted 10 cocktail rows and 12 wine-bottle rows,
passing the screen gates. Two cocktail cities returned only comparison pages and were correctly left `not_found`.
All wine rows remain `per_bottle`; no bottle-to-glass conversion occurred. Expatistan tax treatment is unknown and
the source statistic is a source-defined city item, not independent product ground truth.

**Verdict:** promote Expatistan only to independent cocktail validation and bottle-to-glass calibration. Do not map
`drinks_moderate`/`drinks_heavy` or a wine-glass input from this panel, and do not present the bottle as a glass.
