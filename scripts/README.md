# Scripts

Legend — **LIVE** is current tooling · **HISTORICAL** belongs to the abandoned v3 programme and is kept
so its artifacts stay reproducible.

Roughly **two thirds of this folder is v3 tooling for a programme that was abandoned.** It is retained
rather than deleted because the artifacts it produced are still cited as evidence, and a claim you cannot
re-derive is a claim you cannot audit.

---

## LIVE — app tooling

| Command | Script | Purpose |
| --- | --- | --- |
| `npm run docs:sync-memory` / `:check-memory` | `sync-memory-docs.mjs` | Mirror and verify `AGENTS.md` against `CLAUDE.md` |
| `npm run country-metadata:generate` | `generate-country-metadata.mjs` | Regenerate canonical country metadata |
| `npm run models:refresh` / `:check` | `refresh-curated-models.ts` | Refresh the curated LLM model snapshot |
| — | `backup.sh`, `generate-certs.sh` | Ops helpers |

## LIVE — methodology v4

| Command (`npm run …`) | Script | Purpose |
| --- | --- | --- |
| `methodology:v4:fit-ratios` | `fit-city-cost-ratios.mjs` | **Ratio model fitting and validation.** Fully deterministic — regenerates `phase-0c-ratio-model-fit.json` byte-identically, and with it every figure in methodology-v4 §6–§7 |
| `methodology:v4:fit-accommodation-ladder` | `fit-accommodation-class-ratios.mjs` | Fits the star ladder and the incumbent-1.800 comparison |
| `methodology:v4:analyze-accommodation` | `analyze-accommodation-stage1.mjs` | First-page estimator depth, ratio and headline analysis |
| `methodology:v4:score-prompt` | `score-anchor-prompt-test.mjs` | Scores prompt output against ground truth. Needs `TEST_DIR` |
| `methodology:v4:combine-samples` | `combine-anchor-samples.mjs` | k-sample combination and coverage analysis. Needs `TEST_DIR` |
| `methodology:v4:score-accommodation-bias` | `score-accommodation-bias.mjs` | Headline-vs-direct-quote bias. **Refuses to correct on under 3 cities** — a deliberate guard against the one-city reversal that has already happened once |

> The two accommodation scripts embed a `generatedAt` timestamp, so their artifacts differ by that one
> line on re-run while every computed value reproduces exactly.

## CURRENT — methodology v5

| Command (`npm run …`) | Script | Purpose |
| --- | --- | --- |
| `methodology:v5:baseline` | `audit-city-cost-v5-baseline.mjs` | Experiment 000: deterministic coverage and provenance audit of the retained v3/v4 evidence; does not treat the shipping CSV as ground truth |
| `methodology:v5:accommodation` | `audit-city-cost-v5-accommodation.mjs` | Experiment 002: reassesses the retained hotel ladder, estimator stability, and hostel-unit identifiability |
| `node scripts/run-city-cost-v5-one-call.mjs` | `run-city-cost-v5-one-call.mjs` | Experiment 001: exactly one OpenAI Responses or Anthropic Messages request with built-in web search, telemetry, and strict local validation; requires a provider key |
| `npx vitest run src/lib/city-cost-methodology-v5.test.ts` | `src/lib/city-cost-methodology-v5.ts` | Experiment 003: deterministic 19-tier derivation boundary with fail-closed provenance propagation |
| `node scripts/analyze-v5-activity-ground-truth.mjs` | `analyze-v5-activity-ground-truth.mjs` | Experiment 023: deterministic audit of definition-compatible direct activity observations; refuses to fit below the 30-city/10-holdout gate |
| `node scripts/analyze-v5-accommodation-panel.mjs` | `analyze-v5-accommodation-panel.mjs` | Experiment 024: strict acceptance audit for single-city accommodation panel rows; no fit below the 30-city/10-holdout gate |

V5 experiment outputs live under `data/reference/v5/experiments/` and must retain their hypothesis,
inputs, raw evidence, deterministic results, and verdict.

## HISTORICAL — v1 audit

| Command | Script | Purpose |
| --- | --- | --- |
| `npm run methodology:audit` | `audit-city-cost-accuracy.mjs` | Reproduces `accuracy_audit.csv` — the 9-observation audit that triggered the rebuild |

## HISTORICAL — v3 observed-first programme

All of the below belong to the abandoned programme. **Do not build on them.** See `/LOG.md` Part 1.

### Pilot, observations and materialization

| Command (`npm run …`) | Script |
| --- | --- |
| `methodology:pilot` | `select-city-cost-pilot.mjs` |
| `methodology:pilot:enrich` / `:check` | `build-city-cost-pilot-enrichment.ts` |
| `methodology:pilot:profile` / `:check` | `build-city-cost-pilot-profile.ts` |
| `methodology:research` | `run-city-cost-research.ts` — reads `docs/prompts/llm_prompt_city_cost_observations_1.md` |
| `methodology:batches:validate` | `validate-city-cost-batches.ts` |
| `methodology:observations:validate` | `validate-city-cost-observations.ts` |
| `methodology:materialize:v3` / `:check` | `materialize-city-cost-v3.ts` |

### Accommodation panels

The register-first path that produced **five accepted quotes in one city** across five frozen frames —
the cost profile that forced the move to a platform channel.

| Command (`npm run …`) | Script |
| --- | --- |
| `methodology:accommodation-panel:build:{barcelona,copenhagen,prague,lisbon,da-nang}` | `build-*-accommodation-property-panel.ts` |
| `methodology:accommodation-panels:validate` | `validate-accommodation-property-panels.ts` |
| `methodology:accommodation-windows:validate` | `validate-accommodation-reference-windows.ts` |
| `methodology:accommodation-quotes:validate` | `validate-accommodation-quote-attempts.ts` |
| `methodology:accommodation:websites` / `:check` | `apply-accommodation-website-verifications.ts` |
| `methodology:accommodation-register:capture:{da-nang,hanoi}` | `capture-vietnam-accommodation-register.ts` |
| `methodology:accommodation-register:validate:{da-nang,hanoi}` | `validate-vietnam-accommodation-register.ts` |
| `methodology:accommodation-classification:build:hanoi` / `:validate:hanoi` | `*-hanoi-accommodation-classification-reconciliation.ts` |
| `methodology:accommodation-geocode:da-nang` / `:validate:da-nang` | `*-da-nang-accommodation-geocod*.ts` |

The Hanoi reconciliation never unblocked: 330 records stayed pending with zero geolocation-eligible rows.
