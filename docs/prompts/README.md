# Prompt Contracts

Do not add status banners or commentary inside the prompt files. The app reads them verbatim and sends them to a
model, so anything added to a file becomes part of the prompt. Status is recorded here.

Every file below is a runtime prompt: `scripts/lib/runtime-prompts.mjs` lists them, and the build, Dockerfile, start
script and container entrypoint check that each one is present.

| File | Status | Selected by |
| --- | --- | --- |
| `llm_prompt_new_cities_v1_2.md` | Active city generation | `CITY_COST_METHODOLOGY_VERSION` unset or `v1.2` |
| `llm_prompt_new_cities_v1_1.md` | Rollback | `CITY_COST_METHODOLOGY_VERSION=v1.1` |
| `llm_prompt_new_cities_1.md` | Rollback; frozen historical v1 contract | `CITY_COST_METHODOLOGY_VERSION=v1` |
| `llm_prompt_intercity_transport_v1_1.md` | Active intercity transport | `TRANSPORT_PROMPT_VERSION` unset or `v1.1` |
| `llm_prompt_intercity_transport_1.md` | Rollback; frozen, does not state which fare to return | `TRANSPORT_PROMPT_VERSION=v1` |

`src/lib/city-generation.ts` and `src/lib/transport-estimation.ts` read the files. The methods are described in
`docs/product/city-cost-methodology.md` and `docs/product/transport-estimation.md`.

## v1 formulas

The v1 prompt asserts `accom_4_star = hotel_3star_2p × 1.80`. Measured against observed prices that constant is too
high in most cities, but v1.1 and v1.2 keep the v1 formulas unchanged and apply them on the server, so 4-star follows
the corrected 3-star price (owner decision, 18 October 2026). Change the formula only as a new methodology version.

## Retired prompts

Research prompts are not kept on `main`:

| Prompts | Where they are |
| --- | --- |
| v3 observation prompt, v4 anchor prompt | tag `city-cost-v3-v4-research-final-2026-10-21` |
| v5 experiment prompts (001–094) | branch `feat/city-cost-methodology-v6`, tag `city-cost-v6.1-research-final-2026-08-18` |
