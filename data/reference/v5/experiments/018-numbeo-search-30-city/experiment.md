# Experiment 018 — 30-city Numbeo search validation

Date: 2026-07-31

## Hypothesis

The Numbeo-restricted search-snippet route can provide definition-compatible food/drink anchors for at
least 30 cities, including a locked city-level holdout, without direct-page retries, cross-city substitution,
or a material regional/cost-band failure. Sparse cities remain an explicit failure mode unless a separately
validated fallback is found.

## Pre-registered sample

The sample and split are frozen in `manifest.json` before collection. It contains 30 cities drawn from the
retained v3/v4 evidence frame, with development and holdout rows separated at city level. The 10 holdout
cities are not used to tune the prompt or source policy. Existing observations are used only for a later
definition/date-compatible source comparison; the shipping CSV is not ground truth.

## Method

- Prompt: `docs/prompts/llm_prompt_city_cost_v5_experiment_016.md`.
- One independent delegated GPT-5.6 Luna-class invocation per city.
- Exactly five Numbeo-restricted search queries per invocation, one per food/drink measure.
- No direct page reads, retries, fallback sources, arithmetic, FX, or other-city evidence.
- A fact is accepted only when the search evidence contains exact city identity, exact row label, central
  value, source currency, and canonical Numbeo URL.
- Every raw response and telemetry record is retained by city.

## Acceptance and reporting

Report cell and complete-city coverage overall and by split, region, and cost band; exact citation-contract
compliance; wrong-city, blocked, and rate-limited outcomes; query/search counts; and any source/date drift
against retained definition-compatible observations. Promotion requires meeting the pre-registered 30-city
coverage and 10-city holdout target without hiding sparse failures. This experiment does not by itself
accept the full 19-field methodology or provide provider token/latency/cost telemetry.
