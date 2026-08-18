# City Cost v1.1 — current handoff

**As at 18 August 2026.** This is the current cold-start note for the v1.1 simplification workstream. The
authoritative checklist is [`PLAN.md`](../../../PLAN.md); this note names the exact next action and the constraints
that must remain visible during implementation.

## Current state

- Branch: `feat/city-cost-methodology-v1-1`.
- v6/v6.1 research is rejected for product cutover and preserved on the archived
  `feat/city-cost-methodology-v6` branch at tag `city-cost-v6.1-research-final-2026-08-18`.
- v1.1 keeps all 19 planner tiers and the exact v1 formulas. One schema-constrained call returns the existing ten
  USD anchors; server code performs arithmetic and USD→AUD conversion from the checked-in FX snapshot.
- v1.1 persistence/API/UI provenance is implemented. v1.1 rows use `llm_city_generation_v1_1`; grades and statistical
  intervals are intentionally absent because these are holistic model estimates, not source observations.
- The deterministic verification checkpoint is complete: typecheck, build, 36 Vitest files / 160 tests, memory checks,
  and `npm run methodology:v1.1:check` pass.
- The complete 19-field boundary is explicit: 18 daily/accommodation derivations plus direct `drink_coffee` at cent
  precision; the materializer, API query, tests, and deterministic check cover it.
- v1.1 source maps now include the five direct drink inputs as well as the 18 derived planner fields; v1's historical
  source-map shape is unchanged.
- The live `data/reference/city_costs_app_aud.csv` is unchanged. Existing cities are not migrated. The default remains
  v1 until the functional smoke passes.

## Exact next action

Run the owner-key functional smoke for **Tottori**, **Toowoomba**, and **Brno** with the app configured temporarily as
`CITY_COST_METHODOLOGY_VERSION=v1.1`. The owner enters the provider key in the browser; it must never be read,
copied, logged, committed, or stored by the agent.

The current external blocker is the Chrome bridge: the extension is installed/enabled and the manifest exists, but the
required Windows native-messaging registry entry is still missing. Repair the Browser plugin from the ChatGPT/Codex
desktop app's **Settings → Computer use** before attempting the smoke; do not hand-edit the registry.

For each city, verify through the UI and `/api/estimates` that:

1. all ten returned anchors are finite and positive;
2. deterministic tiers are present for all 19 planner fields;
3. exactly one city-generation provider call occurred, with no metadata or search call;
4. the persisted source is `llm_city_generation_v1_1` and methodology is `v1.1`;
5. model, reasoning effort, prompt/formula versions, FX snapshot, anchors, request context, and confidence notes
   survive the API/UI provenance path;
6. the live CSV is untouched.

This is an operational boundary smoke, not an accuracy benchmark. If any city fails, keep v1 as default and record the
failure; do not tune formulas or edit the live CSV. If all three pass, update the selector default to v1.1, retain
`CITY_COST_METHODOLOGY_VERSION=v1` as the immediate rollback, run the full baseline, and commit/push that activation.

## Guardrails

- No holdout access, new methodology collection, benchmark, coefficient fitting, or accommodation refit.
- Do not bulk-migrate existing cities or replace/regenerate `data/reference/city_costs_app_aud.csv`.
- Do not reintroduce v6/v6.1 collectors, priors, staged migration artifacts, or search contracts.
- Provider keys remain browser-only. Generated values are model estimates and must not be described as observed prices.
- Update `PLAN.md` at task start/end and before every commit/push. Commit and push each sizeable checkpoint.

## Verification

```text
npx tsc --noEmit
npm run build
npm test -- --run
npm run docs:check-memory
npm run methodology:v1.1:check
```
