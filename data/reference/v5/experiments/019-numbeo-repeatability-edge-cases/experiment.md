# Experiment 019 — Numbeo edge-case repeatability

Date: 2026-07-31

## Hypothesis

The frozen one-city Numbeo search contract is repeatable on difficult outcomes rather than succeeding only
because of one lucky sample. Three independent calls for each of five edge-case cities should preserve the
same coverage, missingness, source basis, and accepted values within ordinary source/date drift.

## Pre-registered method

- Prompt: `docs/prompts/llm_prompt_city_cost_v5_experiment_016.md`, unchanged from Experiment 018.
- Cities: Kyoto (no-result holdout), Helsinki (beer no-result holdout), Don Det (sparse), Nha Trang
  (displayCurrency basis), and Beijing (symbol-to-ISO basis).
- Three independent one-city GPT-5.6 Luna-class invocations per city; 15 invocations total.
- Exactly five Numbeo-restricted searches per invocation. No direct reads, retries, fallbacks, arithmetic,
  FX, or other-city evidence.
- A fact is accepted only with exact city identity, row label, central value, currency, and canonical URL.

## Protocol sensitivity amendment (recorded after repeat 1)

Experiment 018 accepted a row when it appeared in any canonical snippet returned by the same five-query
search batch, even if the row was co-displayed under another measure's query. Repeat 1 for Helsinki followed
that broad rule and counted beer. Repeats 2 and 3 additionally recorded a strict dedicated-query reading:
the measure counts only when its own targeted query returns the row; a co-displayed row is `not_found`.
This is a sensitivity analysis, not a silent change to the results. The verdict reports both policies and
the strict policy is the production recommendation because it makes query-to-fact provenance auditable.

## Acceptance and reporting

Report per-run cell coverage, city-completion rate, statuses, exact values/currencies/source URLs, query and
search counts, and dispersion for repeated found facts. Do not average away a not-found or wrong-city result.
Any drift is recorded with its source date and currency basis. This experiment is prompt/source repeatability
evidence only; it does not validate accommodation, activities, or the 19-field derivation.
