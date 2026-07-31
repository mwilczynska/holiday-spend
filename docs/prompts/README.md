# Prompt Contracts

> **Do not add status banners or commentary inside the prompt files themselves.** Several are read
> verbatim with `readFileSync` and sent to a model, so anything added to the file becomes part of the
> prompt. Status is recorded here instead.

| File | Status | Read by | Notes |
| --- | --- | --- | --- |
| `llm_prompt_new_cities_1.md` | **ACTIVE — shipping** | `src/lib/city-generation.ts` at runtime | The v1 city generation path. Every user-facing city cost comes from this |
| `llm_prompt_intercity_transport_1.md` | **ACTIVE — shipping** | `src/lib/transport-estimation.ts` | Planner intercity transport estimation. Unrelated to city costs |
| `llm_prompt_city_anchors_v4.md` | **ACTIVE — not yet wired up** | nothing yet | The v4 collection contract. Tested end to end but no ingestion path exists |
| `llm_prompt_city_cost_v5_experiment_001.md` | **EXPERIMENT — unvalidated** | `scripts/run-city-cost-v5-one-call.mjs` | Candidate 18-measure extractor; target-class prompt testing uses delegated Luna, provider telemetry remains pending |
| `llm_prompt_city_cost_v5_experiment_006.md` | **EXPERIMENT — unvalidated** | delegated GPT-5.6 Luna-class sub-agent | Explicit source cascade and hard-category query budget; retest after Experiment 005 coverage failure |
| `llm_prompt_city_cost_v5_experiment_007.md` | **EXPERIMENT — unvalidated** | delegated GPT-5.6 Luna-class sub-agent | Minimal nine-anchor candidate; tests whether modelling omitted targets is more feasible than direct 18-anchor extraction |
| `llm_prompt_city_cost_v5_experiment_009.md` | **EXPERIMENT — unvalidated** | delegated GPT-5.6 Luna-class sub-agent | Narrow accommodation panel for class/occupancy source feasibility |
| `llm_prompt_city_cost_observations_1.md` | **ABANDONED (v3)** | `scripts/run-city-cost-research.ts` | v3 tooling. Kept only so `npm run methodology:research` still runs |

The v5 experiment prompt includes auxiliary `mcmeal_combo`; it is never silently substituted for a missing street-food anchor.

## Known defect in the shipping prompt

`llm_prompt_new_cities_1.md` asserts `accom_4_star = hotel_3star_2p × 1.80`. That constant has been
**measured and refuted** — it overpredicts 14 of 16 tested cities with a median absolute error of 38.8%,
reaching +80.1% in San Francisco, and the observed IQR (1.257–1.555) does not contain 1.800.

It is deliberately still in place because no replacement path is built yet. Do not "fix" the constant in
isolation: the whole derivation moves to the v4 calculator. See `/PLAN.md`.

## `llm_prompt_city_anchors_v4.md` is generated

It is extracted from §9.1 of `docs/product/methodology-v4.md`, which is the source of truth.
**Never edit the prompt file directly** — edit the methodology and regenerate, or the two will drift.
