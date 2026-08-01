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
| `node scripts/analyze-v5-accommodation-bed-boundary.mjs` | `analyze-v5-accommodation-bed-boundary.mjs` | Experiment 025: accepts only explicit one-bed dorm inputs for deterministic scaling; hotel classes remain two-adult per-room |
| `node scripts/analyze-v5-hotevi-tier-feasibility.mjs` | `analyze-v5-hotevi-tier-feasibility.mjs` | Experiment 027: audits exact HOTEVI city/tier/month rows; grouped tiers never map directly to product star classes |
| `node scripts/analyze-v5-expedia-class-trends.mjs` | `analyze-v5-expedia-class-trends.mjs` | Experiment 028: audits exact Expedia two-adult class-trend rows and rejects from/lowest/event prices |
| `node scripts/analyze-v5-one-star-source.mjs` | `analyze-v5-one-star-source.mjs` | Experiment 030: audits Momondo/KAYAK 1-star candidates without upgrading unknown occupancy |
| `node scripts/analyze-v5-one-star-occupancy-calibration.mjs` | `analyze-v5-one-star-occupancy-calibration.mjs` | Experiment 031: audits Momondo candidates against explicit two-adult Skyscanner/Expedia rows |
| `node scripts/analyze-v5-one-star-property-basket.mjs` | `analyze-v5-one-star-property-basket.mjs` | Experiment 032: audits explicit two-adult named 1-star property quotes without aggregating them |
| `node scripts/analyze-v5-one-star-aggregators.mjs` | `analyze-v5-one-star-aggregators.mjs` | Experiment 033: audits Trip.com/HotelsCombined/Budget Your Trip city-level 1-star candidates |
| `node scripts/analyze-v5-one-star-aggregator-panel.mjs` | `analyze-v5-one-star-aggregator-panel.mjs` | Experiment 034: audits 10-city aggregator coverage and source agreement with city holdouts |
| `node scripts/analyze-v5-activity-budgetyourtrip.mjs` | `analyze-v5-activity-budgetyourtrip.mjs` | Experiment 035: audits Budget Your Trip per-person activity/entertainment rows without scaling or fitting |
| `node scripts/analyze-v5-activity-budgetyourtrip-panel.mjs` | `analyze-v5-activity-budgetyourtrip-panel.mjs` | Experiment 036: audits 10-city activity coverage with locked holdouts |
| `node scripts/analyze-v5-activity-definition-matched.mjs` | `analyze-v5-activity-definition-matched.mjs` | Experiment 037: audits low-cost ticket, half-day, and full-day premium activity anchors |
| `node scripts/analyze-v5-one-star-budgetyourtrip-panel.mjs` | `analyze-v5-one-star-budgetyourtrip-panel.mjs` | Experiment 038: audits guarded BudgetYourTrip 1-star coverage with zero-denominator checks |
| `node scripts/analyze-v5-hostel-private-boundary.mjs` | `analyze-v5-hostel-private-boundary.mjs` | Experiment 039: audits one-bed dorm inputs and explicit two-adult private-hostel rows |
| `node scripts/analyze-v5-private-two-guest-search.mjs` | `analyze-v5-private-two-guest-search.mjs` | Experiment 040: audits explicit two-adult named-hostel quotes; no city-wide mapping |
| `node scripts/analyze-v5-one-star-paired-calibration.mjs` | `analyze-v5-one-star-paired-calibration.mjs` | Experiment 041: audits one-star city-statistic/explicit-two-adult pairing without fitting |
| `node scripts/analyze-v5-registry-class-property-quotes.mjs` | `analyze-v5-registry-class-property-quotes.mjs` | Experiment 042: audits official-register class joins to property quotes without basket aggregation |
| `node scripts/analyze-v5-google-hotels-one-star.mjs` | `analyze-v5-google-hotels-one-star.mjs` | Experiment 043: audits Google Hotels one-star property quotes without basket aggregation |

| `node scripts/analyze-v5-activity-operator-sources.mjs` | `analyze-v5-activity-operator-sources.mjs` | Experiment 044: audits GetYourGuide/Viator activity-definition rows without scaling or product mapping |
| `node scripts/analyze-v5-trip-activity-definitions.mjs` | `analyze-v5-trip-activity-definitions.mjs` | Experiment 045: audits Trip.com activity-definition rows without scaling or product mapping |

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
