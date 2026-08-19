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
- The owner explicitly authorized v1.1 activation on 18 August 2026 while deferring the keyed smoke because secure
  remote-desktop access is unavailable. The smoke remains an open operational follow-up and is not represented as passed.
- The independent pre-activation and post-activation baselines passed. The archived v6 branch and annotated tag remain
  present locally and on origin, and the clean product tree contains no retired experiment corpus.
- v1.1 persistence/API/UI provenance is implemented. v1.1 rows use `llm_city_generation_v1_1`; grades and statistical
  intervals are intentionally absent because these are holistic model estimates, not source observations.
- The deterministic verification checkpoint is complete: typecheck, build, 36 Vitest files / 160 tests, memory checks,
  and `npm run methodology:v1.1:check` pass; the post-activation run reports 36 files / 161 tests.
- The complete 19-field boundary is explicit: 18 daily/accommodation derivations plus direct `drink_coffee` at cent
  precision; the materializer, API query, tests, and deterministic check cover it.
- v1.1 source maps now include the five direct drink inputs as well as the 18 derived planner fields; v1's historical
  source-map shape is unchanged.
- The live `data/reference/city_costs_app_aud.csv` is unchanged. Existing cities are not migrated. New cities now
  default to v1.1; explicit `CITY_COST_METHODOLOGY_VERSION=v1` remains the rollback.
- `npm run dev` now runs `scripts/prepare-next-dev.mjs`, which removes a OneDrive reparse-point `.next` cache before
  Next starts; it leaves an ordinary cache alone. This prevents the known high-CPU/hung-first-compilation failure.

## Exact next action

The owner-authorized activation and post-activation baseline are complete without the keyed smoke. The smoke for
**Tottori**, **Toowoomba**, and **Brno** remains a deferred operational follow-up. If it is later run, configure the
app temporarily as `CITY_COST_METHODOLOGY_VERSION=v1.1`; the owner enters the provider key in the browser, and it must
never be read, copied, logged, committed, or stored by the agent.

The prior native-host-missing diagnosis is stale. Chrome subsequently connected successfully with plugin build
`26.814.41407`, so do not repair the extension, edit the registry, restart Chrome, or reinstall the plugin for that
superseded issue. The current Codex in-app Browser retry instead fails its trusted RPC bootstrap before tab discovery;
this is a separate desktop integration failure and no app action has run through it. The isolated port-3001 app
previously returned HTTP 200 for `/dataset` and was intentionally stopped before the independent production build.
If the smoke is later resumed, restore the in-app Browser connection and restart the app with
`CITY_COST_METHODOLOGY_VERSION=v1.1`. If the local page hangs, stop the exact dev-server process, then restart it
with `npm run dev` so the predev `.next` guard runs.

For each city, verify through the UI and `/api/estimates` that:

1. all ten returned anchors are finite and positive;
2. deterministic tiers are present for all 19 planner fields;
3. exactly one city-generation provider call occurred, with no metadata or search call;
4. the persisted source is `llm_city_generation_v1_1` and methodology is `v1.1`;
5. model, reasoning effort, prompt/formula versions, FX snapshot, anchors, request context, and confidence notes
   survive the API/UI provenance path;
6. the live CSV is untouched.

This is an operational boundary smoke, not an accuracy benchmark. It was explicitly deferred for this activation; no
pass result is claimed. If it is later run and fails, use the explicit v1 rollback and do not tune formulas or edit the
live CSV.

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
